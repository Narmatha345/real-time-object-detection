"""
Central configuration for the object-detection backend.

Swapping in a custom-trained model later only requires changing
MODEL_PATH (and CLASS_ALIASES if you want friendlier display names) -
no other code needs to change.
"""
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent
MODELS_DIR = BASE_DIR / "models"

# Pretrained, lightweight, COCO-trained model. Ultralytics downloads it
# automatically on first run if it is not already present in MODELS_DIR.
# To use a custom-trained model later (e.g. waste-classification classes:
# plastic, glass, metal, paper, organic, electronic), point this at your
# own best.pt - the detector, API and frontend all stay unchanged.
MODEL_PATH = str(MODELS_DIR / "yolo11n.pt")

# Inference settings
# Raised from the spec's 0.50 default: the nano model is fast but its
# lower-confidence guesses are frequently wrong (e.g. misclassifying a
# chair or book), so filtering more aggressively cuts down on visibly
# incorrect labels at the cost of missing some true-but-uncertain ones.
DEFAULT_CONFIDENCE_THRESHOLD = 0.65
MIN_CONFIDENCE_THRESHOLD = 0.05
MAX_CONFIDENCE_THRESHOLD = 0.95
IOU_THRESHOLD = 0.45
INFERENCE_IMG_SIZE = 480  # smaller = faster, less accurate

# Streaming / throttling
MAX_INPUT_DIMENSION = 640  # incoming frames are downscaled to this max side
JPEG_QUALITY = 80

# CORS - dev origins for Vite frontend
ALLOWED_ORIGINS = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
]
