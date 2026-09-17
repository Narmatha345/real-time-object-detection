FROM python:3.12-slim

# Minimal system libs opencv-python-headless still needs at runtime.
RUN apt-get update && apt-get install -y --no-install-recommends \
    libglib2.0-0 \
    libsm6 \
    libxext6 \
    libxrender1 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Bake the pretrained weights into the image at build time so the
# container never needs outbound internet access (or a slow first
# request) to fetch them at runtime.
RUN python -c "import config; from ultralytics import YOLO; YOLO(config.MODEL_PATH)"

EXPOSE 8000

CMD uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000}
