#!/usr/bin/env python3
"""
Script to download and convert YOLOv8-Pose to ONNX format
"""

try:
    from ultralytics import YOLO
    import os
    
    print("Downloading YOLOv8n-Pose model...")
    model = YOLO('yolov8n-pose.pt')  # This will auto-download if not present
    
    print("Exporting to ONNX format...")
    model.export(format='onnx', imgsz=640, simplify=True)
    
    # The exported file will be named yolov8n-pose.onnx
    if os.path.exists('yolov8n-pose.onnx'):
        print("✅ Success! Model exported to: yolov8n-pose.onnx")
        print(f"   File size: {os.path.getsize('yolov8n-pose.onnx') / (1024*1024):.2f} MB")
    else:
        print("❌ Error: Model file not found after export")
        
except ImportError:
    print("❌ Error: ultralytics package not installed")
    print("   Install it with: pip install ultralytics")
except Exception as e:
    print(f"❌ Error: {e}")




