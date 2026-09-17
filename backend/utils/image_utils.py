"""
Frame decoding / preprocessing helpers.

Keeping these separate from detector.py means the detection service
never has to know whether a frame arrived as a base64 data-URL (from
the WebSocket live stream) or as a raw multipart upload (the REST
fallback endpoint) - both paths converge on a plain numpy BGR array.
"""
import base64
import re

import cv2
import numpy as np

from config import MAX_INPUT_DIMENSION

_DATA_URL_RE = re.compile(r"^data:image/\w+;base64,")


def decode_base64_image(data_url: str) -> np.ndarray:
    """Decode a base64 / data-URL encoded image into a BGR numpy array."""
    raw = _DATA_URL_RE.sub("", data_url)
    try:
        binary = base64.b64decode(raw)
    except (ValueError, base64.binascii.Error) as exc:
        raise ValueError("Invalid base64 image payload") from exc

    buffer = np.frombuffer(binary, dtype=np.uint8)
    frame = cv2.imdecode(buffer, cv2.IMREAD_COLOR)
    if frame is None:
        raise ValueError("Could not decode image data")
    return frame


def decode_image_bytes(data: bytes) -> np.ndarray:
    """Decode raw image bytes (e.g. from an UploadFile) into a BGR numpy array."""
    buffer = np.frombuffer(data, dtype=np.uint8)
    frame = cv2.imdecode(buffer, cv2.IMREAD_COLOR)
    if frame is None:
        raise ValueError("Could not decode image data")
    return frame


def resize_for_inference(frame: np.ndarray, max_dim: int = MAX_INPUT_DIMENSION) -> np.ndarray:
    """Downscale large frames so inference stays fast; upscaling never happens."""
    h, w = frame.shape[:2]
    longest = max(h, w)
    if longest <= max_dim:
        return frame
    scale = max_dim / float(longest)
    new_size = (int(w * scale), int(h * scale))
    return cv2.resize(frame, new_size, interpolation=cv2.INTER_AREA)


def encode_jpeg_base64(frame: np.ndarray, quality: int = 80) -> str:
    """Encode a BGR frame back to a base64 JPEG data-URL (used for the debug endpoint)."""
    ok, buffer = cv2.imencode(".jpg", frame, [cv2.IMWRITE_JPEG_QUALITY, quality])
    if not ok:
        raise ValueError("Failed to encode frame as JPEG")
    return "data:image/jpeg;base64," + base64.b64encode(buffer).decode("ascii")
