"""
YOLO object-detection service.

This module wraps Ultralytics YOLO behind a small, stable interface
(ObjectDetector.detect). The rest of the application never touches the
Ultralytics API directly, so the underlying model/weights can be swapped
(e.g. for a custom-trained waste-classification model with classes like
plastic/glass/metal/paper/organic/electronic) by changing config.MODEL_PATH
alone - main.py, the schemas and the frontend all stay exactly the same
as long as the new model still outputs [class, confidence, bbox].
"""
import logging
import threading
import time
from dataclasses import dataclass, field
from typing import List

import numpy as np
from ultralytics import YOLO

import config

logger = logging.getLogger("detector")


@dataclass
class BBox:
    x1: int
    y1: int
    x2: int
    y2: int


@dataclass
class Detection:
    class_name: str
    confidence: float
    confidence_percent: int
    bbox: BBox

    def to_dict(self) -> dict:
        return {
            "class": self.class_name,
            "confidence": round(self.confidence, 4),
            "confidence_percent": self.confidence_percent,
            "bbox": {
                "x1": self.bbox.x1,
                "y1": self.bbox.y1,
                "x2": self.bbox.x2,
                "y2": self.bbox.y2,
            },
        }


@dataclass
class DetectionResult:
    detections: List[Detection] = field(default_factory=list)
    frame_width: int = 0
    frame_height: int = 0
    inference_ms: float = 0.0
    timestamp: float = 0.0

    def to_dict(self) -> dict:
        return {
            "detections": [d.to_dict() for d in self.detections],
            "frame_width": self.frame_width,
            "frame_height": self.frame_height,
            "inference_ms": round(self.inference_ms, 1),
            "timestamp": self.timestamp,
            "count": len(self.detections),
        }


class ModelNotReadyError(RuntimeError):
    """Raised when a detection is requested before the model has finished loading."""


class ObjectDetector:
    """Thread-safe singleton-style wrapper around an Ultralytics YOLO model."""

    def __init__(self, model_path: str = config.MODEL_PATH):
        self._model_path = model_path
        self._model: YOLO | None = None
        self._lock = threading.Lock()
        self._load_error: str | None = None

    def load(self) -> None:
        """Load (and warm up) the model. Safe to call once at startup."""
        try:
            logger.info("Loading YOLO model from %s", self._model_path)
            model = YOLO(self._model_path)
            # Warm-up inference so the first real request isn't slow.
            dummy = np.zeros((320, 320, 3), dtype=np.uint8)
            model.predict(dummy, imgsz=config.INFERENCE_IMG_SIZE, verbose=False)
            self._model = model
            self._load_error = None
            logger.info("YOLO model loaded successfully")
        except Exception as exc:  # noqa: BLE001 - surface any load failure to the API layer
            self._load_error = str(exc)
            logger.exception("Failed to load YOLO model")

    @property
    def is_ready(self) -> bool:
        return self._model is not None

    @property
    def load_error(self) -> str | None:
        return self._load_error

    @property
    def class_names(self) -> dict:
        if not self._model:
            return {}
        return self._model.names

    def detect(
        self,
        frame: np.ndarray,
        confidence_threshold: float = config.DEFAULT_CONFIDENCE_THRESHOLD,
    ) -> DetectionResult:
        if self._model is None:
            raise ModelNotReadyError(self._load_error or "Model is not loaded yet")

        h, w = frame.shape[:2]
        start = time.perf_counter()

        # Ultralytics predict() releases the GIL during the heavy C++/torch
        # work, but we still serialize calls to avoid contention on the
        # single model instance under concurrent requests.
        with self._lock:
            results = self._model.predict(
                frame,
                imgsz=config.INFERENCE_IMG_SIZE,
                conf=max(confidence_threshold, config.MIN_CONFIDENCE_THRESHOLD),
                iou=config.IOU_THRESHOLD,
                verbose=False,
            )

        inference_ms = (time.perf_counter() - start) * 1000
        detections: List[Detection] = []

        if results:
            result = results[0]
            names = result.names
            for box in result.boxes:
                conf = float(box.conf[0])
                if conf < confidence_threshold:
                    continue
                cls_id = int(box.cls[0])
                x1, y1, x2, y2 = box.xyxy[0].tolist()
                detections.append(
                    Detection(
                        class_name=names.get(cls_id, str(cls_id)),
                        confidence=conf,
                        confidence_percent=round(conf * 100),
                        bbox=BBox(x1=int(x1), y1=int(y1), x2=int(x2), y2=int(y2)),
                    )
                )

        detections.sort(key=lambda d: d.confidence, reverse=True)

        return DetectionResult(
            detections=detections,
            frame_width=w,
            frame_height=h,
            inference_ms=inference_ms,
            timestamp=time.time(),
        )


# Single shared instance used across the app (created at import time,
# populated by detector.load() during FastAPI startup).
detector = ObjectDetector()
