# Models directory

`yolo11n.pt` (the pretrained, COCO-trained Ultralytics YOLO11 "nano" model)
is downloaded here automatically the first time the backend starts, so it
does not need to be committed to the repo.

Nano is the fastest, least accurate variant - chosen here because the
free-tier deployment CPU is slow enough that a bigger model (`yolo11s.pt`,
`yolo11m.pt`, ...) pushes inference past what feels "live" (tested at
~64s/frame for `yolo11s` vs ~21s/frame for `yolo11n` on Render's free
plan). If you deploy on hardware with real CPU/GPU power, switch
`MODEL_PATH` in [`../config.py`](../config.py) to a bigger variant for
better accuracy.

## Using your own custom-trained model later

Train a model with Ultralytics (e.g. for waste-sorting classes: `plastic`,
`glass`, `metal`, `paper`, `organic`, `electronic`), then:

1. Copy the resulting `best.pt` into this folder.
2. Update `MODEL_PATH` in [`../config.py`](../config.py) to point at it.
3. Restart the backend.

Nothing else in the app (API, WebSocket protocol, or React frontend) needs
to change - `detector.py` reads whatever classes the loaded model reports.
