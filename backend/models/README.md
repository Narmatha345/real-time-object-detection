# Models directory

`yolo11s.pt` (the pretrained, COCO-trained Ultralytics YOLO11 "small" model)
is downloaded here automatically the first time the backend starts, so it
does not need to be committed to the repo. It trades some speed for
noticeably better accuracy than the "nano" variant - see `MODEL_PATH` in
[`../config.py`](../config.py) to switch back to `yolo11n.pt` if you need
faster, less accurate inference instead.

## Using your own custom-trained model later

Train a model with Ultralytics (e.g. for waste-sorting classes: `plastic`,
`glass`, `metal`, `paper`, `organic`, `electronic`), then:

1. Copy the resulting `best.pt` into this folder.
2. Update `MODEL_PATH` in [`../config.py`](../config.py) to point at it.
3. Restart the backend.

Nothing else in the app (API, WebSocket protocol, or React frontend) needs
to change - `detector.py` reads whatever classes the loaded model reports.
