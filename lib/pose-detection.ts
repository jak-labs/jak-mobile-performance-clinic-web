// ONNX Runtime Web + YOLOv8-Pose Detection
import * as ort from 'onnxruntime-web';

export interface PoseKeypoint {
  id: number;
  x: number;
  y: number;
  z: number;
  visibility: number;
  score?: number;
}

export interface PoseData {
  timestamp: number;
  sequenceNumber: number;
  keypoints: PoseKeypoint[];
  angles?: BiomechanicalAngles;
  metrics?: BiomechanicalMetrics;
}

export interface BiomechanicalAngles {
  leftKnee: number | null;
  rightKnee: number | null;
  leftHip: number | null;
  rightHip: number | null;
  leftShoulder: number | null;
  rightShoulder: number | null;
  leftElbow: number | null;
  rightElbow: number | null;
  spineLean: number | null;
  neckFlexion: number | null;
}

export interface BiomechanicalMetrics {
  balanceScore: number;
  symmetryScore: number;
  posturalEfficiency: number;
  centerOfMass: { x: number; y: number };
}

// YOLOv8-Pose uses COCO format (17 keypoints) - same as MoveNet
// https://cocodataset.org/#keypoints-2020
export const POSE_LANDMARKS = {
  NOSE: 0,
  LEFT_EYE: 1,
  RIGHT_EYE: 2,
  LEFT_EAR: 3,
  RIGHT_EAR: 4,
  LEFT_SHOULDER: 5,
  RIGHT_SHOULDER: 6,
  LEFT_ELBOW: 7,
  RIGHT_ELBOW: 8,
  LEFT_WRIST: 9,
  RIGHT_WRIST: 10,
  LEFT_HIP: 11,
  RIGHT_HIP: 12,
  LEFT_KNEE: 13,
  RIGHT_KNEE: 14,
  LEFT_ANKLE: 15,
  RIGHT_ANKLE: 16,
} as const;

// Type for ONNX session
export type PoseDetector = {
  session: ort.InferenceSession;
  inputShape: [number, number, number, number];
};

let detector: PoseDetector | null = null;
let isInitializing = false;
let initPromise: Promise<PoseDetector> | null = null;

// Model configuration
const MODEL_INPUT_SIZE = 640; // YOLOv8-Pose standard input size
const MODEL_URL = '/models/yolov8n-pose.onnx'; // Place model in public/models/
const MIN_CONFIDENCE = 0.25; // Minimum confidence threshold

/**
 * Initialize ONNX Runtime Web + YOLOv8-Pose detector
 */
export async function createPoseDetector(): Promise<PoseDetector> {
  if (typeof window === 'undefined') {
    throw new Error('Pose detection only works in browser');
  }

  // Return existing detector if already initialized
  if (detector) {
    return detector;
  }

  // If already initializing, wait for that promise
  if (isInitializing && initPromise) {
    return initPromise;
  }

  // Start initialization
  isInitializing = true;
  initPromise = (async () => {
    // Suppress CPU vendor warning (it's harmless)
    // ONNX Runtime logs warnings with ANSI color codes, so we need to check the raw string
    const originalWarn = console.warn;
    const originalError = console.error;
    
    console.warn = (...args: any[]) => {
      // Suppress ONNX Runtime CPU vendor warning (check both string and first arg)
      const firstArg = args[0];
      const argString = typeof firstArg === 'string' ? firstArg : String(firstArg);
      
      if (argString.includes('Unknown CPU vendor') || 
          argString.includes('cpuinfo_vendor') ||
          argString.includes('[W:onnxruntime') ||
          argString.includes('cpuid_info.cc')) {
        return; // Suppress this specific warning
      }
      originalWarn.apply(console, args);
    };
    
    console.error = (...args: any[]) => {
      // Also suppress in error logs (sometimes it shows up there)
      const firstArg = args[0];
      const argString = typeof firstArg === 'string' ? firstArg : String(firstArg);
      
      if (argString.includes('Unknown CPU vendor') || 
          argString.includes('cpuinfo_vendor') ||
          argString.includes('[W:onnxruntime') ||
          argString.includes('cpuid_info.cc')) {
        return; // Suppress this specific warning
      }
      originalError.apply(console, args);
    };
    
    try {
      console.log('[Pose Detection] Initializing ONNX Runtime Web + YOLOv8-Pose...');
      
      // Yield to browser to prevent freezing
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Set up ONNX Runtime Web
      ort.env.wasm.numThreads = 1; // Use single thread for stability
      ort.env.wasm.simd = true; // Enable SIMD for better performance
      
      // Load the ONNX model
      console.log('[Pose Detection] Loading YOLOv8-Pose model from:', MODEL_URL);
      const session = await ort.InferenceSession.create(MODEL_URL, {
        executionProviders: ['wasm'], // Use WASM backend (more stable than WebGL)
      });
      
      // Restore console.warn and console.error
      console.warn = originalWarn;
      console.error = originalError;
      
      // Get input shape from model metadata
      const inputName = session.inputNames[0];
      
      // ONNX Runtime Web may not have inputShapes directly, so we need to get it from metadata
      // For YOLOv8-Pose, the input shape is always [1, 3, 640, 640] (batch, channels, height, width)
      let inputShape: [number, number, number, number] = [1, 3, MODEL_INPUT_SIZE, MODEL_INPUT_SIZE];
      
      // Try to get input shape from session metadata if available
      try {
        if (session.inputMetadata && session.inputMetadata[inputName]) {
          const metadata = session.inputMetadata[inputName];
          if (metadata.shape && Array.isArray(metadata.shape)) {
            inputShape = metadata.shape as [number, number, number, number];
            console.log('[Pose Detection] Got input shape from metadata:', inputShape);
          }
        } else if ((session as any).inputShapes && (session as any).inputShapes[0]) {
          // Fallback: try inputShapes property if it exists
          inputShape = (session as any).inputShapes[0] as [number, number, number, number];
          console.log('[Pose Detection] Got input shape from inputShapes:', inputShape);
        } else {
          // Use default shape for YOLOv8-Pose
          console.log('[Pose Detection] Using default input shape for YOLOv8-Pose:', inputShape);
        }
      } catch (shapeError) {
        console.warn('[Pose Detection] Could not get input shape from metadata, using default:', shapeError);
        // Use default shape
        inputShape = [1, 3, MODEL_INPUT_SIZE, MODEL_INPUT_SIZE];
      }
      
      console.log('[Pose Detection] Model loaded successfully. Input name:', inputName, 'Input shape:', inputShape);
      
      detector = {
        session,
        inputShape,
      };
      
      isInitializing = false;
      return detector;
    } catch (error) {
      // Restore console.warn even on error
      console.warn = originalWarn;
      isInitializing = false;
      initPromise = null;
      console.error('[Pose Detection] Failed to initialize YOLOv8-Pose:', error);
      
      // Check if it's a model file not found error
      if (error instanceof Error && (error.message.includes('404') || error.message.includes('Failed to fetch'))) {
        throw new Error(`Model file not found at ${MODEL_URL}. Please download yolov8n-pose.onnx and place it in public/models/`);
      }
      
      throw new Error(`Failed to initialize YOLOv8-Pose detector: ${error instanceof Error ? error.message : String(error)}`);
    }
  })();

  return initPromise;
}

/**
 * Preprocess video frame for YOLOv8-Pose
 */
function preprocessImage(
  videoElement: HTMLVideoElement,
  inputSize: number = MODEL_INPUT_SIZE
): Float32Array {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d')!;
  
  // Set canvas size to model input size
  canvas.width = inputSize;
  canvas.height = inputSize;
  
  // Draw video frame to canvas (resized)
  ctx.drawImage(videoElement, 0, 0, inputSize, inputSize);
  
  // Get image data
  const imageData = ctx.getImageData(0, 0, inputSize, inputSize);
  const data = imageData.data;
  
  // Convert to normalized tensor [1, 3, 640, 640]
  // YOLOv8 expects RGB format, normalized to [0, 1]
  const tensor = new Float32Array(1 * 3 * inputSize * inputSize);
  
  for (let i = 0; i < inputSize * inputSize; i++) {
    const r = data[i * 4];
    const g = data[i * 4 + 1];
    const b = data[i * 4 + 2];
    
    // Normalize to [0, 1] and convert RGB to tensor format
    tensor[i] = r / 255.0; // R channel
    tensor[i + inputSize * inputSize] = g / 255.0; // G channel
    tensor[i + 2 * inputSize * inputSize] = b / 255.0; // B channel
  }
  
  return tensor;
}

/**
 * Postprocess YOLOv8-Pose output to extract keypoints
 */
function postprocessOutput(
  output: ort.Tensor,
  originalWidth: number,
  originalHeight: number,
  inputSize: number = MODEL_INPUT_SIZE
): PoseKeypoint[] {
  // YOLOv8-Pose output format: [1, num_detections, 56] or [num_detections, 56]
  // Each detection: [x, y, w, h, conf, kp1_x, kp1_y, kp1_conf, ..., kp17_x, kp17_y, kp17_conf]
  // So: 4 (bbox) + 1 (conf) + 17*3 (keypoints) = 56
  
  const outputData = output.data as Float32Array;
  const dims = output.dims;
  
  // Handle different output shapes: [1, N, 56] or [N, 56]
  let numDetections: number;
  let dataOffset = 0;
  
  if (dims.length === 3 && dims[0] === 1) {
    // Shape: [1, N, 56]
    numDetections = dims[1];
    dataOffset = 0;
  } else if (dims.length === 2) {
    // Shape: [N, 56]
    numDetections = dims[0];
    dataOffset = 0;
  } else {
    // Flattened: assume [N*56]
    numDetections = Math.floor(outputData.length / 56);
    dataOffset = 0;
  }
  
  const keypoints: PoseKeypoint[] = [];
  
  // Scale factors for converting from model input size to original size
  const scaleX = originalWidth / inputSize;
  const scaleY = originalHeight / inputSize;
  
  // Find the detection with highest confidence
  let bestDetection = -1;
  let bestConf = 0;
  
  for (let i = 0; i < numDetections; i++) {
    const baseIdx = dataOffset + i * 56;
    if (baseIdx + 4 >= outputData.length) break;
    
    const conf = outputData[baseIdx + 4]; // Confidence at index 4
    if (conf > bestConf && conf > MIN_CONFIDENCE) {
      bestConf = conf;
      bestDetection = i;
    }
  }
  
  if (bestDetection === -1) {
    return keypoints; // No valid detection
  }
  
  // Extract keypoints from best detection
  const baseIndex = dataOffset + bestDetection * 56;
  
  for (let kp = 0; kp < 17; kp++) {
    const kpIndex = baseIndex + 5 + kp * 3; // Skip bbox (4) + conf (1), then 3 values per keypoint
    
    if (kpIndex + 2 >= outputData.length) break;
    
    const x = outputData[kpIndex] * scaleX;
    const y = outputData[kpIndex + 1] * scaleY;
    const conf = outputData[kpIndex + 2];
    
    keypoints.push({
      id: kp,
      x: x / originalWidth, // Normalize to [0, 1]
      y: y / originalHeight, // Normalize to [0, 1]
      z: 0, // YOLOv8-Pose is 2D
      visibility: conf,
      score: conf,
    });
  }
  
  return keypoints;
}

/**
 * Estimate poses from video element
 */
export async function estimatePoses(
  detector: PoseDetector,
  videoElement: HTMLVideoElement
): Promise<{ keypoints: PoseKeypoint[] }[]> {
  if (!videoElement || videoElement.readyState < 2) {
    return [];
  }
  
  const originalWidth = videoElement.videoWidth;
  const originalHeight = videoElement.videoHeight;
  
  if (originalWidth === 0 || originalHeight === 0) {
    return [];
  }
  
  try {
    // Preprocess image
    const inputTensor = preprocessImage(videoElement, MODEL_INPUT_SIZE);
    
    // Create ONNX tensor
    const inputName = detector.session.inputNames[0];
    const tensor = new ort.Tensor('float32', inputTensor, detector.inputShape);
    
    // Run inference
    const feeds = { [inputName]: tensor };
    const results = await detector.session.run(feeds);
    
    // Get output (YOLOv8-Pose typically outputs to 'output0' or similar)
    const outputName = detector.session.outputNames[0];
    const output = results[outputName];
    
    // Postprocess to extract keypoints
    const keypoints = postprocessOutput(output, originalWidth, originalHeight, MODEL_INPUT_SIZE);
    
    if (keypoints.length === 0) {
      return [];
    }
    
    return [{ keypoints }];
  } catch (error) {
    console.error('[Pose Detection] Error estimating poses:', error);
    return [];
  }
}

/**
 * Convert YOLOv8 keypoints to our keypoint format (already in correct format)
 */
export function landmarksToKeypoints(keypoints: PoseKeypoint[]): PoseKeypoint[] {
  return keypoints; // Already in correct format
}

/**
 * Compute angle between three points (in degrees)
 */
export function computeAngle(
  pointA: { x: number; y: number },
  pointB: { x: number; y: number },
  pointC: { x: number; y: number }
): number {
  const ab = { x: pointA.x - pointB.x, y: pointA.y - pointB.y };
  const cb = { x: pointC.x - pointB.x, y: pointC.y - pointB.y };

  const dot = ab.x * cb.x + ab.y * cb.y;
  const magAB = Math.sqrt(ab.x ** 2 + ab.y ** 2);
  const magCB = Math.sqrt(cb.x ** 2 + cb.y ** 2);

  if (magAB === 0 || magCB === 0) return 0;

  const cosAngle = Math.max(-1, Math.min(1, dot / (magAB * magCB)));
  return Math.acos(cosAngle) * (180 / Math.PI);
}

/**
 * Calculate all biomechanical angles from pose keypoints
 */
export function calculateBiomechanicalAngles(keypoints: PoseKeypoint[]): BiomechanicalAngles {
  const getPoint = (index: number) => {
    const kp = keypoints[index];
    return kp && kp.visibility > 0.5 ? { x: kp.x, y: kp.y } : null;
  };

  return {
    // Left knee angle (hip-knee-ankle)
    leftKnee: (() => {
      const hip = getPoint(POSE_LANDMARKS.LEFT_HIP);
      const knee = getPoint(POSE_LANDMARKS.LEFT_KNEE);
      const ankle = getPoint(POSE_LANDMARKS.LEFT_ANKLE);
      return hip && knee && ankle ? computeAngle(hip, knee, ankle) : null;
    })(),

    // Right knee angle (hip-knee-ankle)
    rightKnee: (() => {
      const hip = getPoint(POSE_LANDMARKS.RIGHT_HIP);
      const knee = getPoint(POSE_LANDMARKS.RIGHT_KNEE);
      const ankle = getPoint(POSE_LANDMARKS.RIGHT_ANKLE);
      return hip && knee && ankle ? computeAngle(hip, knee, ankle) : null;
    })(),

    // Left hip angle (shoulder-hip-knee)
    leftHip: (() => {
      const shoulder = getPoint(POSE_LANDMARKS.LEFT_SHOULDER);
      const hip = getPoint(POSE_LANDMARKS.LEFT_HIP);
      const knee = getPoint(POSE_LANDMARKS.LEFT_KNEE);
      return shoulder && hip && knee ? computeAngle(shoulder, hip, knee) : null;
    })(),

    // Right hip angle (shoulder-hip-knee)
    rightHip: (() => {
      const shoulder = getPoint(POSE_LANDMARKS.RIGHT_SHOULDER);
      const hip = getPoint(POSE_LANDMARKS.RIGHT_HIP);
      const knee = getPoint(POSE_LANDMARKS.RIGHT_KNEE);
      return shoulder && hip && knee ? computeAngle(shoulder, hip, knee) : null;
    })(),

    // Left shoulder angle (hip-shoulder-elbow)
    leftShoulder: (() => {
      const hip = getPoint(POSE_LANDMARKS.LEFT_HIP);
      const shoulder = getPoint(POSE_LANDMARKS.LEFT_SHOULDER);
      const elbow = getPoint(POSE_LANDMARKS.LEFT_ELBOW);
      return hip && shoulder && elbow ? computeAngle(hip, shoulder, elbow) : null;
    })(),

    // Right shoulder angle (hip-shoulder-elbow)
    rightShoulder: (() => {
      const hip = getPoint(POSE_LANDMARKS.RIGHT_HIP);
      const shoulder = getPoint(POSE_LANDMARKS.RIGHT_SHOULDER);
      const elbow = getPoint(POSE_LANDMARKS.RIGHT_ELBOW);
      return hip && shoulder && elbow ? computeAngle(hip, shoulder, elbow) : null;
    })(),

    // Left elbow angle (shoulder-elbow-wrist)
    leftElbow: (() => {
      const shoulder = getPoint(POSE_LANDMARKS.LEFT_SHOULDER);
      const elbow = getPoint(POSE_LANDMARKS.LEFT_ELBOW);
      const wrist = getPoint(POSE_LANDMARKS.LEFT_WRIST);
      return shoulder && elbow && wrist ? computeAngle(shoulder, elbow, wrist) : null;
    })(),

    // Right elbow angle (shoulder-elbow-wrist)
    rightElbow: (() => {
      const shoulder = getPoint(POSE_LANDMARKS.RIGHT_SHOULDER);
      const elbow = getPoint(POSE_LANDMARKS.RIGHT_ELBOW);
      const wrist = getPoint(POSE_LANDMARKS.RIGHT_WRIST);
      return shoulder && elbow && wrist ? computeAngle(shoulder, elbow, wrist) : null;
    })(),

    // Spine lean (angle from vertical using shoulders and hips)
    spineLean: (() => {
      const leftShoulder = getPoint(POSE_LANDMARKS.LEFT_SHOULDER);
      const rightShoulder = getPoint(POSE_LANDMARKS.RIGHT_SHOULDER);
      const leftHip = getPoint(POSE_LANDMARKS.LEFT_HIP);
      const rightHip = getPoint(POSE_LANDMARKS.RIGHT_HIP);

      if (!leftShoulder || !rightShoulder || !leftHip || !rightHip) return null;

      const shoulderMid = {
        x: (leftShoulder.x + rightShoulder.x) / 2,
        y: (leftShoulder.y + rightShoulder.y) / 2,
      };
      const hipMid = {
        x: (leftHip.x + rightHip.x) / 2,
        y: (leftHip.y + rightHip.y) / 2,
      };

      // Calculate angle from vertical (90 degrees = vertical)
      const dx = shoulderMid.x - hipMid.x;
      const dy = shoulderMid.y - hipMid.y;
      const angle = Math.atan2(dx, -dy) * (180 / Math.PI);
      return angle;
    })(),

    // Neck flexion (angle between nose, shoulder midpoint, and hip midpoint)
    neckFlexion: (() => {
      const nose = getPoint(POSE_LANDMARKS.NOSE);
      const leftShoulder = getPoint(POSE_LANDMARKS.LEFT_SHOULDER);
      const rightShoulder = getPoint(POSE_LANDMARKS.RIGHT_SHOULDER);
      const leftHip = getPoint(POSE_LANDMARKS.LEFT_HIP);
      const rightHip = getPoint(POSE_LANDMARKS.RIGHT_HIP);

      if (!nose || !leftShoulder || !rightShoulder || !leftHip || !rightHip) return null;

      const shoulderMid = {
        x: (leftShoulder.x + rightShoulder.x) / 2,
        y: (leftShoulder.y + rightShoulder.y) / 2,
      };
      const hipMid = {
        x: (leftHip.x + rightHip.x) / 2,
        y: (leftHip.y + rightHip.y) / 2,
      };

      return computeAngle(nose, shoulderMid, hipMid);
    })(),
  };
}

/**
 * Calculate biomechanical metrics from pose keypoints
 */
export function calculateBiomechanicalMetrics(keypoints: PoseKeypoint[]): BiomechanicalMetrics {
  const getPoint = (index: number) => {
    const kp = keypoints[index];
    return kp && kp.visibility > 0.5 ? { x: kp.x, y: kp.y } : null;
  };

  // Calculate center of mass (average of major body points)
  const majorPoints = [
    POSE_LANDMARKS.LEFT_SHOULDER,
    POSE_LANDMARKS.RIGHT_SHOULDER,
    POSE_LANDMARKS.LEFT_HIP,
    POSE_LANDMARKS.RIGHT_HIP,
  ]
    .map((idx) => getPoint(idx))
    .filter((p): p is { x: number; y: number } => p !== null);

  const centerOfMass = majorPoints.length > 0
    ? {
        x: majorPoints.reduce((sum, p) => sum + p.x, 0) / majorPoints.length,
        y: majorPoints.reduce((sum, p) => sum + p.y, 0) / majorPoints.length,
      }
    : { x: 0.5, y: 0.5 };

  // Calculate balance score (based on center of mass deviation from center)
  const balanceDeviation = Math.sqrt(
    Math.pow(centerOfMass.x - 0.5, 2) + Math.pow(centerOfMass.y - 0.5, 2)
  );
  const balanceScore = Math.max(0, Math.min(100, 100 - balanceDeviation * 200));

  // Calculate symmetry score (compare left vs right side)
  const leftShoulder = getPoint(POSE_LANDMARKS.LEFT_SHOULDER);
  const rightShoulder = getPoint(POSE_LANDMARKS.RIGHT_SHOULDER);
  const leftHip = getPoint(POSE_LANDMARKS.LEFT_HIP);
  const rightHip = getPoint(POSE_LANDMARKS.RIGHT_HIP);
  const leftKnee = getPoint(POSE_LANDMARKS.LEFT_KNEE);
  const rightKnee = getPoint(POSE_LANDMARKS.RIGHT_KNEE);

  let symmetryScore = 100;
  if (leftShoulder && rightShoulder) {
    const shoulderDiff = Math.abs(leftShoulder.y - rightShoulder.y);
    symmetryScore -= shoulderDiff * 100;
  }
  if (leftHip && rightHip) {
    const hipDiff = Math.abs(leftHip.y - rightHip.y);
    symmetryScore -= hipDiff * 100;
  }
  if (leftKnee && rightKnee) {
    const kneeDiff = Math.abs(leftKnee.y - rightKnee.y);
    symmetryScore -= kneeDiff * 100;
  }
  symmetryScore = Math.max(0, Math.min(100, symmetryScore));

  // Calculate postural efficiency (combination of balance and symmetry)
  const posturalEfficiency = (balanceScore + symmetryScore) / 2;

  return {
    balanceScore: Math.round(balanceScore),
    symmetryScore: Math.round(symmetryScore),
    posturalEfficiency: Math.round(posturalEfficiency),
    centerOfMass,
  };
}
