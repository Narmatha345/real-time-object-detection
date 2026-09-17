# Real-Time AI Object Detection

Live camera object detection using **YOLO (Ultralytics) + OpenCV** on the
backend, streamed over a WebSocket to a **React** frontend that draws
bounding boxes and confidence percentages on top of the camera preview.

```
real-time-object-detection/
│
├── backend/
│   ├── main.py            FastAPI app: REST + WebSocket endpoints
│   ├── detector.py         ObjectDetector service wrapping Ultralytics YOLO
│   ├── config.py           Model path, thresholds, CORS, streaming settings
│   ├── schemas.py          Pydantic response models
│   ├── models/              YOLO weights live here (auto-downloaded)
│   ├── utils/
│   │   └── image_utils.py  base64/bytes decoding, resizing, encoding
│   └── requirements.txt
│
├── frontend/
│   ├── src/
│   │   ├── components/     CameraView, DetectionOverlay, ControlPanel, StatusBar, DetectionList, ErrorBanner
│   │   ├── hooks/
│   │   │   └── useObjectDetection.js   camera + WebSocket + detection state machine
│   │   ├── pages/
│   │   │   └── DetectionPage.jsx
│   │   ├── services/       cameraService, detectionSocket, api
│   │   └── App.jsx
│   ├── package.json
│   └── vite.config.js
│
└── README.md
```

## How the detection pipeline works

1. **Capture** - the browser opens the device camera via
   `getUserMedia` ([cameraService.js](frontend/src/services/cameraService.js))
   and renders it into a `<video>` element.
2. **Frame extraction** - a `requestAnimationFrame` loop
   ([useObjectDetection.js](frontend/src/hooks/useObjectDetection.js))
   draws the current video frame onto a hidden `<canvas>`, downscales it
   (max 640px on the long side) and encodes it as a JPEG data-URL.
3. **Streaming** - the frame is sent over a WebSocket
   (`/ws/detect`) to the backend. The client never sends a new frame
   until it gets a response for the previous one - this is what keeps
   the app real-time instead of building up a lagging backlog: the
   effective frame rate is however fast the server can actually infer.
4. **Preprocessing** - the backend decodes the base64 JPEG with OpenCV
   ([image_utils.py](backend/utils/image_utils.py)) and resizes it again
   defensively to `MAX_INPUT_DIMENSION`.
5. **Inference** - [`ObjectDetector.detect()`](backend/detector.py) runs
   the frame through a pretrained Ultralytics YOLO model
   (`model.predict(...)`), which returns class ids, confidence scores and
   `xyxy` bounding boxes for every detected object above the confidence
   threshold.
6. **Post-processing** - confidences are converted to rounded percentages
   (`0.943 → 94%`), results are sorted by confidence, and packaged as
   JSON matching the shape in [schemas.py](backend/schemas.py).
7. **Response** - the JSON is sent back over the WebSocket, tagged with
   the `frame_id` it answers.
8. **Rendering** - [`DetectionOverlay.jsx`](frontend/src/components/DetectionOverlay.jsx)
   draws bounding boxes and `ClassName XX%` labels on a transparent
   canvas positioned over the video, and
   [`DetectionList.jsx`](frontend/src/components/DetectionList.jsx) lists
   them as chips (`Person 98%`, `Chair 94%`, ...) below the preview.
   [`StatusBar.jsx`](frontend/src/components/StatusBar.jsx) shows live
   FPS (measured from actual received results) and the object count.

Every number on screen - class name, confidence percentage, box
coordinates - comes directly from that round trip. Nothing is
hardcoded; point the camera at something else and the labels change
accordingly.

## Deploying so it works on mobile over a live HTTPS URL

See [DEPLOYMENT.md](DEPLOYMENT.md) - Render (backend) + Vercel (frontend).
Mobile browsers require HTTPS for camera access, so `localhost` testing
alone won't work from a phone.

## Prerequisites (Windows)

* Python 3.10–3.12 (64-bit)
* Node.js 18+ and npm
* A webcam (desktop) or phone browser with camera access

## Setup

### 1. Backend

```powershell
cd D:\real-time-object-detection\backend
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
```

The first run downloads `yolo11s.pt` (the pretrained COCO model,
~20 MB) automatically into `backend/models/`.

### 2. Frontend

```powershell
cd D:\real-time-object-detection\frontend
npm install
```

## Run (Windows)

Open two terminals.

**Terminal 1 - backend:**

```powershell
cd D:\real-time-object-detection\backend
venv\Scripts\activate
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

**Terminal 2 - frontend:**

```powershell
cd D:\real-time-object-detection\frontend
npm run dev
```

Open **http://localhost:5173** in your browser, click **Start Camera**,
allow camera access, and point it at objects.

### Testing on a phone

Browsers only allow camera access on `localhost` or over **HTTPS** - a
plain `http://<your-pc-ip>:5173` link will not work on a phone. Easiest
options:

* Use a tunnel (e.g. `cloudflared tunnel --url http://localhost:5173`)
  to get a temporary HTTPS URL, or
* Use `npx vite --host` with a self-signed cert / mkcert for LAN HTTPS.

If you tunnel the frontend, also tunnel the backend (port 8000) and set
`VITE_API_BASE_URL` in a `frontend/.env` file to the tunneled backend
URL before running `npm run dev`.

## Configuration

| Setting | File | Default |
|---|---|---|
| Model weights | `backend/config.py` → `MODEL_PATH` | `models/yolo11s.pt` |
| Default confidence threshold | `backend/config.py` → `DEFAULT_CONFIDENCE_THRESHOLD` | `0.50` |
| Inference image size | `backend/config.py` → `INFERENCE_IMG_SIZE` | `480` |
| Max streamed frame size | `backend/config.py` → `MAX_INPUT_DIMENSION` | `640` |
| Backend URL (frontend) | `frontend/.env` → `VITE_API_BASE_URL` | derived from current hostname, port `8000` |

Users can also change the confidence threshold live from the slider in
the UI - detections below the threshold are filtered out both by the
backend (`conf=` param) and are simply never sent to the frontend.

## Swapping in a custom-trained model later

This app is built so the pretrained COCO model can be replaced without
touching the pipeline:

1. Train a custom model with Ultralytics, e.g. for waste-sorting classes
   (`plastic`, `glass`, `metal`, `paper`, `organic`, `electronic`).
2. Drop the resulting `best.pt` into `backend/models/`.
3. Change `MODEL_PATH` in `backend/config.py` to point at it.
4. Restart the backend.

`detector.py` reads whatever class names the loaded model reports, the
WebSocket/REST contract is unchanged, and the React UI already renders
arbitrary class names - no frontend changes required.

## Error handling

The UI shows friendly messages instead of raw errors for:

* Camera permission denied
* No camera found / camera unavailable
* Backend unavailable / WebSocket disconnected
* Model failed to load on the server
* No objects above the confidence threshold ("No supported objects detected")

See [ErrorBanner.jsx](frontend/src/components/ErrorBanner.jsx) and the
`error` state in [useObjectDetection.js](frontend/src/hooks/useObjectDetection.js).

## API reference

* `GET /api/health` → `{ status, model_loaded, model_error }`
* `GET /api/config` → default/min/max confidence thresholds
* `GET /api/classes` → list of class names the loaded model supports
* `POST /api/detect` (multipart: `file`, optional `confidence_threshold`) → single-image detection, same JSON shape as the WebSocket
* `WS /ws/detect` → send `{ image, confidence_threshold, frame_id }`, receive:

```json
{
  "detections": [
    {
      "class": "chair",
      "confidence": 0.943,
      "confidence_percent": 94,
      "bbox": { "x1": 120, "y1": 80, "x2": 420, "y2": 500 }
    }
  ],
  "frame_width": 640,
  "frame_height": 480,
  "inference_ms": 42.1,
  "timestamp": 1737033600.12,
  "count": 1,
  "frame_id": 57
}
```
