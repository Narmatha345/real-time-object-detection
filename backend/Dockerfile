FROM python:3.12-slim

# System libs opencv (and matplotlib, pulled in transitively by
# ultralytics) need at runtime even in "headless" mode.
RUN apt-get update && apt-get install -y --no-install-recommends \
    libgl1 \
    libglib2.0-0 \
    libsm6 \
    libxext6 \
    libxrender1 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .

# Install the CPU-only PyTorch build first so ultralytics' own install
# (further below) is satisfied by it instead of pulling the default
# CUDA-enabled wheels, which drag in several GB of unused nvidia_*
# packages and blow up free-tier build time/disk.
RUN pip install --no-cache-dir torch==2.4.1+cpu torchvision==0.19.1+cpu \
    --index-url https://download.pytorch.org/whl/cpu

RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Bake the pretrained weights into the image at build time so the
# container never needs outbound internet access (or a slow first
# request) to fetch them at runtime.
RUN python -c "import config; from ultralytics import YOLO; YOLO(config.MODEL_PATH)"

EXPOSE 8000

CMD uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000}
