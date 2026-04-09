import * as faceLandmarksDetection from '@tensorflow-models/face-landmarks-detection';
import '@tensorflow/tfjs-backend-webgl';

export type EyeRollCallback = () => void;

interface EyePosition {
  leftIrisY: number;
  leftEyeTopY: number;
  leftEyeBottomY: number;
  rightIrisY: number;
  rightEyeTopY: number;
  rightEyeBottomY: number;
}

export class EyeRollDetector {
  private detector: faceLandmarksDetection.FaceLandmarksDetector | null = null;
  private video: HTMLVideoElement | null = null;
  private stream: MediaStream | null = null;
  private running = false;
  private onEyeRoll: EyeRollCallback | null = null;
  private onStateChange: ((state: { cameraActive: boolean; modelLoaded: boolean; faceDetected: boolean }) => void) | null = null;
  public onFrame: ((data: { faces: number; irisPosition: number | null; features: number[] | null }) => void) | null = null;

  private sensitivity = 50; // 0-100
  private cooldownMs = 1500;
  private lastTriggerTime = 0;

  // Eye roll detection state
  private consecutiveRollFrames = 0;
  private readonly REQUIRED_ROLL_FRAMES = 3; // Must detect roll for ~100ms at 30fps

  // MediaPipe Face Mesh landmark indices
  // Left eye: upper lid 159, lower lid 145, iris center 468
  // Right eye: upper lid 386, lower lid 374, iris center 473
  private readonly LEFT_EYE_TOP = 159;
  private readonly LEFT_EYE_BOTTOM = 145;
  private readonly LEFT_IRIS = 468;
  private readonly RIGHT_EYE_TOP = 386;
  private readonly RIGHT_EYE_BOTTOM = 374;
  private readonly RIGHT_IRIS = 473;

  async initialize(): Promise<void> {
    // Create hidden video element
    this.video = document.createElement('video');
    this.video.setAttribute('playsinline', '');
    this.video.style.display = 'none';
    document.body.appendChild(this.video);

    // Request camera access
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480, facingMode: 'user' },
        audio: false,
      });
      this.video.srcObject = this.stream;
      
      // FaceMesh requires video dimensions and loaded data
      await new Promise<void>((resolve) => {
        if (!this.video) return;
        this.video.onloadeddata = () => {
          this.video!.width = this.video!.videoWidth;
          this.video!.height = this.video!.videoHeight;
          resolve();
        };
      });
      await this.video.play();
      this.notifyStateChange({ cameraActive: true });
    } catch {
      this.notifyStateChange({ cameraActive: false });
      throw new Error('Camera access denied');
    }

    // Load face detection model
    try {
      this.detector = await faceLandmarksDetection.createDetector(
        faceLandmarksDetection.SupportedModels.MediaPipeFaceMesh,
        {
          runtime: 'tfjs',
          refineLandmarks: true, // Enables iris landmarks
          maxFaces: 1,
        }
      );
      this.notifyStateChange({ modelLoaded: true });
    } catch {
      this.notifyStateChange({ modelLoaded: false });
      throw new Error('Failed to load face model');
    }
  }

  setSensitivity(value: number): void {
    this.sensitivity = Math.max(10, Math.min(90, value));
  }

  setCooldown(ms: number): void {
    this.cooldownMs = ms;
  }

  setOnEyeRoll(callback: EyeRollCallback): void {
    this.onEyeRoll = callback;
  }

  setOnStateChange(callback: (state: { cameraActive: boolean; modelLoaded: boolean; faceDetected: boolean }) => void): void {
    this.onStateChange = callback;
  }

  private notifyStateChange(partial: Partial<{ cameraActive: boolean; modelLoaded: boolean; faceDetected: boolean }>): void {
    if (this.onStateChange) {
      this.onStateChange(partial as { cameraActive: boolean; modelLoaded: boolean; faceDetected: boolean });
    }
  }

  // Calibration samples for KNN predictor
  private neutralSamples: number[][] = [];
  private rollSamples: number[][] = [];

  public train(neutralSamples: number[][], rollSamples: number[][]) {
    this.neutralSamples = neutralSamples;
    this.rollSamples = rollSamples;
  }

  start(): void {
    console.log('EyeRollDetector.start() called', { running: this.running, hasDetector: !!this.detector, hasVideo: !!this.video });
    if (this.running || !this.detector || !this.video) return;
    this.running = true;
    console.log('Starting detection loop...');
    this.detectLoop();
  }

  stop(): void {
    this.running = false;
  }

  destroy(): void {
    this.stop();
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
      this.stream = null;
    }
    if (this.video) {
      this.video.remove();
      this.video = null;
    }
    this.detector = null;
  }

  getVideoElement(): HTMLVideoElement | null {
    return this.video;
  }

  private async detectLoop(): Promise<void> {
    if (!this.running || !this.detector || !this.video) return;

    try {
      const faces = await this.detector.estimateFaces(this.video);

      if (faces.length === 0) {
        this.notifyStateChange({ faceDetected: false });
        this.consecutiveRollFrames = 0;
        if (this.onFrame) this.onFrame({ faces: 0, irisPosition: null, features: null });
      } else {
        this.notifyStateChange({ faceDetected: true });
        const face = faces[0];
        const eyePos = this.extractEyePosition(face.keypoints);
        const features = this.extractFeatureVector(face.keypoints);
        
        // Calculate raw iris position for legacy fallback
        const leftEyeHeight = eyePos.leftEyeBottomY - eyePos.leftEyeTopY;
        const rightEyeHeight = eyePos.rightEyeBottomY - eyePos.rightEyeTopY;
        let avgIrisPosition = 0;
        if (leftEyeHeight > 0 && rightEyeHeight > 0) {
          const leftIrisPosition = (eyePos.leftEyeBottomY - eyePos.leftIrisY) / leftEyeHeight;
          const rightIrisPosition = (eyePos.rightEyeBottomY - eyePos.rightIrisY) / rightEyeHeight;
          avgIrisPosition = (leftIrisPosition + rightIrisPosition) / 2;
        }

        if (this.onFrame) this.onFrame({ faces: faces.length, irisPosition: avgIrisPosition, features });

        if (this.isEyeRoll(eyePos, features)) {
          this.consecutiveRollFrames++;
          if (this.consecutiveRollFrames >= this.REQUIRED_ROLL_FRAMES) {
            this.triggerEyeRoll();
          }
        } else {
          this.consecutiveRollFrames = 0;
        }
      }
    } catch (err) {
      console.error('Detection error:', err);
    }

    // Continue loop at ~30fps
    if (this.running) {
      requestAnimationFrame(() => this.detectLoop());
    }
  }

  private extractFeatureVector(keypoints: faceLandmarksDetection.Keypoint[]): number[] {
    const get = (idx: number) => keypoints[idx];
    
    // Use distance between eye inner corners as scale
    // Left inner: 133, Right inner: 362
    const dx = Math.abs(get(362).x - get(133).x);
    const scale = dx > 0 ? dx : 1;

    // We measure vertical variations (y starts top, goes down)
    // Left eye features
    const l_iris_y = get(468).y;
    const l_corner_inner_y = get(133).y;
    const l_corner_outer_y = get(33).y;
    const l_top_y = get(159).y;
    const l_bottom_y = get(145).y;

    // Right eye features
    const r_iris_y = get(473).y;
    const r_corner_inner_y = get(362).y;
    const r_corner_outer_y = get(263).y;
    const r_top_y = get(386).y;
    const r_bottom_y = get(374).y;

    return [
      (l_iris_y - (l_corner_inner_y + l_corner_outer_y) / 2) / scale, // relative pupil height left
      (r_iris_y - (r_corner_inner_y + r_corner_outer_y) / 2) / scale, // relative pupil height right
      (l_bottom_y - l_top_y) / scale, // EAR - left
      (r_bottom_y - r_top_y) / scale, // EAR - right
    ];
  }

  private extractEyePosition(keypoints: faceLandmarksDetection.Keypoint[]): EyePosition {
    const get = (idx: number) => keypoints[idx];

    return {
      leftIrisY: get(this.LEFT_IRIS).y,
      leftEyeTopY: get(this.LEFT_EYE_TOP).y,
      leftEyeBottomY: get(this.LEFT_EYE_BOTTOM).y,
      rightIrisY: get(this.RIGHT_IRIS).y,
      rightEyeTopY: get(this.RIGHT_EYE_TOP).y,
      rightEyeBottomY: get(this.RIGHT_EYE_BOTTOM).y,
    };
  }

  private isEyeRoll(pos: EyePosition, features: number[]): boolean {
    // If we have calibration data, use KNN predictor
    if (this.neutralSamples.length > 0 && this.rollSamples.length > 0) {
      return this.predictKNN(features);
    }

    // Default heuristic fallback
    const leftEyeHeight = pos.leftEyeBottomY - pos.leftEyeTopY;
    const rightEyeHeight = pos.rightEyeBottomY - pos.rightEyeTopY;

    if (leftEyeHeight <= 0 || rightEyeHeight <= 0) return false;

    const leftIrisPosition = (pos.leftEyeBottomY - pos.leftIrisY) / leftEyeHeight;
    const rightIrisPosition = (pos.rightEyeBottomY - pos.rightIrisY) / rightEyeHeight;
    const avgIrisPosition = (leftIrisPosition + rightIrisPosition) / 2;

    const threshold = 0.95 - (this.sensitivity / 100) * 0.4;
    return avgIrisPosition > threshold;
  }

  private predictKNN(features: number[]): boolean {
    const distances: { dist: number; isRoll: boolean }[] = [];
    
    const addDists = (samples: number[][], isRoll: boolean) => {
      for (const sample of samples) {
        let dist = 0;
        for (let i = 0; i < features.length; i++) {
          dist += (features[i] - sample[i]) ** 2;
        }
        distances.push({ dist, isRoll });
      }
    };

    addDists(this.neutralSamples, false);
    addDists(this.rollSamples, true);

    distances.sort((a, b) => a.dist - b.dist);

    let rollVotes = 0;
    const k = Math.min(3, distances.length);
    for (let i = 0; i < k; i++) {
      if (distances[i].isRoll) rollVotes++;
    }

    return rollVotes > k / 2;
  }

  private triggerEyeRoll(): void {
    const now = Date.now();
    if (now - this.lastTriggerTime < this.cooldownMs) return;

    this.lastTriggerTime = now;
    this.consecutiveRollFrames = 0;

    console.log('👀 Eye roll detected!');
    if (this.onEyeRoll) {
      this.onEyeRoll();
    }
  }
}
