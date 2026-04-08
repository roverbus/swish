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
        video: { width: 320, height: 240, facingMode: 'user' },
        audio: false,
      });
      this.video.srcObject = this.stream;
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

  start(): void {
    if (this.running || !this.detector || !this.video) return;
    this.running = true;
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
      } else {
        this.notifyStateChange({ faceDetected: true });
        const face = faces[0];
        const eyePos = this.extractEyePosition(face.keypoints);

        if (this.isEyeRoll(eyePos)) {
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

  private isEyeRoll(pos: EyePosition): boolean {
    // Calculate how far up the iris is within the eye socket
    // 0 = bottom, 1 = top
    const leftEyeHeight = pos.leftEyeBottomY - pos.leftEyeTopY;
    const rightEyeHeight = pos.rightEyeBottomY - pos.rightEyeTopY;

    if (leftEyeHeight <= 0 || rightEyeHeight <= 0) return false;

    const leftIrisPosition = (pos.leftEyeBottomY - pos.leftIrisY) / leftEyeHeight;
    const rightIrisPosition = (pos.rightEyeBottomY - pos.rightIrisY) / rightEyeHeight;

    // Average position of both irises
    const avgIrisPosition = (leftIrisPosition + rightIrisPosition) / 2;

    // Threshold: sensitivity 0 = need iris at 95% up, sensitivity 100 = need iris at 55% up
    // Default (50) = need iris at 75% up
    const threshold = 0.95 - (this.sensitivity / 100) * 0.4;

    return avgIrisPosition > threshold;
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
