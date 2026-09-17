"""
FastAPI application entrypoint.

Two ways to reach the detection service:

1. WebSocket  /ws/detect   - primary path used by the live camera UI.
   The frontend pushes one JPEG frame at a time and waits for the JSON
   result before sending the next, which naturally throttles the stream
   to whatever the server can actually process (no backlog, no lag
   build-up) instead of needing a fixed client-side frame-rate cap.

2. REST       POST /api/detect - single-image detection, used for the
   "debug" upload page / non-streaming clients / automated tests.

Both paths funnel through the same ObjectDetector.detect() call, so
behaviour (and any future custom model) is identical either way.
"""
import asyncio
import logging
import time

from fastapi import FastAPI, File, Form, HTTPException, UploadFile, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

import config
from detector import ModelNotReadyError, detector
from schemas import DetectionResponse, HealthResponse
from utils.image_utils import decode_base64_image, decode_image_bytes, resize_for_inference

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(name)s] %(levelname)s: %(message)s")
logger = logging.getLogger("main")

app = FastAPI(title="Real-Time Object Detection API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # dev convenience so phones on the LAN can reach the API too
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def load_model_on_startup() -> None:
    loop = asyncio.get_event_loop()
    # Model loading is CPU-bound and can take a few seconds; run it off
    # the event loop so the server can still answer /api/health meanwhile.
    await loop.run_in_executor(None, detector.load)


@app.get("/api/health", response_model=HealthResponse)
async def health() -> HealthResponse:
    return HealthResponse(
        status="ok" if detector.is_ready else "model_unavailable",
        model_loaded=detector.is_ready,
        model_error=detector.load_error,
    )


@app.get("/api/classes")
async def classes() -> dict:
    return {"classes": list(detector.class_names.values())}


@app.get("/api/config")
async def get_config() -> dict:
    return {
        "default_confidence_threshold": config.DEFAULT_CONFIDENCE_THRESHOLD,
        "min_confidence_threshold": config.MIN_CONFIDENCE_THRESHOLD,
        "max_confidence_threshold": config.MAX_CONFIDENCE_THRESHOLD,
    }


@app.post("/api/detect", response_model=DetectionResponse)
async def detect_image(
    file: UploadFile = File(...),
    confidence_threshold: float = Form(config.DEFAULT_CONFIDENCE_THRESHOLD),
) -> dict:
    if not detector.is_ready:
        raise HTTPException(status_code=503, detail="Model is still loading, please retry shortly")

    contents = await file.read()
    if not contents:
        raise HTTPException(status_code=400, detail="Empty file upload")

    try:
        frame = decode_image_bytes(contents)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    frame = resize_for_inference(frame)
    loop = asyncio.get_event_loop()
    try:
        result = await loop.run_in_executor(None, detector.detect, frame, confidence_threshold)
    except ModelNotReadyError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc

    return result.to_dict()


@app.websocket("/ws/detect")
async def ws_detect(websocket: WebSocket) -> None:
    await websocket.accept()
    loop = asyncio.get_event_loop()
    logger.info("WebSocket client connected: %s", websocket.client)

    try:
        while True:
            payload = await websocket.receive_json()
            frame_id = payload.get("frame_id")
            confidence_threshold = float(payload.get("confidence_threshold", config.DEFAULT_CONFIDENCE_THRESHOLD))
            image_data = payload.get("image")

            if not image_data:
                await websocket.send_json({"error": "Missing 'image' field", "frame_id": frame_id})
                continue

            try:
                frame = decode_base64_image(image_data)
            except ValueError as exc:
                await websocket.send_json({"error": str(exc), "frame_id": frame_id})
                continue

            frame = resize_for_inference(frame)

            try:
                result = await loop.run_in_executor(None, detector.detect, frame, confidence_threshold)
            except ModelNotReadyError as exc:
                await websocket.send_json({"error": str(exc), "frame_id": frame_id})
                continue
            except Exception as exc:  # noqa: BLE001 - never let one bad frame kill the socket
                logger.exception("Inference error")
                await websocket.send_json({"error": f"Inference failed: {exc}", "frame_id": frame_id})
                continue

            response = result.to_dict()
            response["frame_id"] = frame_id
            await websocket.send_json(response)

    except WebSocketDisconnect:
        logger.info("WebSocket client disconnected: %s", websocket.client)
    except Exception:  # noqa: BLE001
        logger.exception("Unexpected WebSocket error")
        try:
            await websocket.close()
        except RuntimeError:
            pass


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
