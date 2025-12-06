# YOLOv8-Pose Model

Place the YOLOv8-Pose ONNX model file here: `yolov8n-pose.onnx`

## Quick Setup (Recommended)

### Option 1: Using Python Script (Easiest)

1. Install ultralytics:
   ```bash
   pip install ultralytics
   ```

2. Run the conversion script:
   ```bash
   cd public/models
   python download_model.py
   ```

3. The model will be created as `yolov8n-pose.onnx` (~13 MB)

### Option 2: Manual Python Conversion

```python
from ultralytics import YOLO

# Load YOLOv8-Pose model (auto-downloads if needed)
model = YOLO("yolov8n-pose.pt")

# Export to ONNX
model.export(format="onnx", imgsz=640, simplify=True)
```

### Option 3: Download Pre-converted Model

1. Visit: https://github.com/ultralytics/assets/releases
2. Download `yolov8n-pose.onnx`
3. Place it in this directory

### Option 4: Use Hugging Face

```bash
# Using huggingface-cli
pip install huggingface_hub
huggingface-cli download ultralytics/yolov8n-pose --local-dir . --include "*.onnx"
```

## Model Information

- **Model**: YOLOv8n-Pose (nano version)
- **Size**: ~13 MB
- **Input**: 640x640 RGB image
- **Output**: 17 keypoints (COCO format)
- **Format**: ONNX

## Verification

After placing the model, verify it exists:
```bash
ls -lh public/models/yolov8n-pose.onnx
```

The file should be approximately 13 MB in size.
