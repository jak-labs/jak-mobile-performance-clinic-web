# Download YOLOv8-Pose Model

## Quick Download (Choose One Method)

### Method 1: Using Python (Recommended if you have Python)

```bash
# Install ultralytics (use virtual environment if needed)
pip install ultralytics

# Run conversion
cd public/models
python3 download_model.py
```

### Method 2: Manual Download

1. **Visit Hugging Face:**
   - Go to: https://huggingface.co/ultralytics/yolov8n-pose
   - Click "Files and versions" tab
   - Download `yolov8n-pose.onnx` (should be ~13 MB)

2. **Or use wget/curl:**
   ```bash
   cd public/models
   wget https://huggingface.co/ultralytics/yolov8n-pose/resolve/main/yolov8n-pose.onnx
   ```

### Method 3: Using Ultralytics Python Script

Create a file `convert.py`:
```python
from ultralytics import YOLO
model = YOLO('yolov8n-pose.pt')
model.export(format='onnx', imgsz=640, simplify=True)
```

Then run:
```bash
python3 convert.py
mv yolov8n-pose.onnx public/models/
```

## Verify Installation

After downloading, verify the file:
```bash
ls -lh public/models/yolov8n-pose.onnx
```

The file should be approximately **13 MB** (not 9 bytes or 29 bytes).

## Next Steps

Once the model is in place, restart your Next.js dev server and the pose detection should work!





