"""Pydantic request/response models for the detection API."""
from typing import List, Optional

from pydantic import BaseModel, Field

import config


class BBoxModel(BaseModel):
    x1: int
    y1: int
    x2: int
    y2: int


class DetectionModel(BaseModel):
    class_: str = Field(alias="class")
    confidence: float
    confidence_percent: int
    bbox: BBoxModel

    class Config:
        populate_by_name = True


class DetectionResponse(BaseModel):
    detections: List[DetectionModel]
    frame_width: int
    frame_height: int
    inference_ms: float
    timestamp: float
    count: int


class HealthResponse(BaseModel):
    status: str
    model_loaded: bool
    model_error: Optional[str] = None


class WSDetectRequest(BaseModel):
    image: str  # base64 data-URL
    confidence_threshold: float = config.DEFAULT_CONFIDENCE_THRESHOLD
    frame_id: Optional[int] = None
