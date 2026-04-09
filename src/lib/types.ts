export interface Settings {
  enabled: boolean;
  sensitivity: number; // 0-100, higher = more sensitive (triggers more easily)
  audioEnabled: boolean;
  overlayEnabled: boolean;
  cooldownMs: number;
  calibrationProfiles?: {
    neutral: number[][]; // normalized vectors
    roll: number[][];    // normalized vectors
  };
}

export const DEFAULT_SETTINGS: Settings = {
  enabled: false,
  sensitivity: 50,
  audioEnabled: true,
  overlayEnabled: true,
  cooldownMs: 1500,
  calibrationProfiles: { neutral: [], roll: [] },
};

export interface DetectionState {
  cameraActive: boolean;
  modelLoaded: boolean;
  detecting: boolean;
  faceDetected: boolean;
  lastDetection: number | null;
  sessionRolls: number;
  sessionSkips: number;
  error: string | null;
}

export const INITIAL_STATE: DetectionState = {
  cameraActive: false,
  modelLoaded: false,
  detecting: false,
  faceDetected: false,
  lastDetection: null,
  sessionRolls: 0,
  sessionSkips: 0,
  error: null,
};

export type MessageType =
  | { type: 'GET_SETTINGS' }
  | { type: 'SET_SETTINGS'; settings: Partial<Settings> }
  | { type: 'GET_STATE' }
  | { type: 'STATE_UPDATE'; state: Partial<DetectionState> }
  | { type: 'EYE_ROLL_DETECTED' }
  | { type: 'SKIP_REEL' };
