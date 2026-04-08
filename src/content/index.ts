import { EyeRollDetector } from '../lib/eye-detector';
import { Settings, DEFAULT_SETTINGS, DetectionState } from '../lib/types';
import { Overlay } from './overlay';
import { AudioReactor } from './audio';

console.log('👀 SWISH loaded. Watching for eye rolls...');

let detector: EyeRollDetector | null = null;
let overlay: Overlay | null = null;
let audioReactor: AudioReactor | null = null;
let settings: Settings = { ...DEFAULT_SETTINGS };
let isOnReelsPage = false;

// Check if we're on Instagram Reels
function checkReelsPage(): boolean {
  const url = window.location.href;
  return url.includes('instagram.com/reels') ||
         url.includes('instagram.com/reel/') ||
         (url.includes('instagram.com') && document.querySelector('video') !== null);
}

// Skip to next reel
function skipReel(): void {
  if (!isOnReelsPage) {
    console.log('Not on Reels page, skipping action');
    return;
  }

  console.log('⏭️ Skipping reel...');

  // Keyboard navigation for Reels
  const event = new KeyboardEvent('keydown', {
    key: 'ArrowDown',
    code: 'ArrowDown',
    keyCode: 40,
    which: 40,
    bubbles: true,
    cancelable: true,
  });
  document.dispatchEvent(event);

  // Update stats
  chrome.runtime.sendMessage({ type: 'STATE_UPDATE', state: { sessionSkips: 1 } }).catch(() => {});
}

// Handle eye roll detection
function onEyeRollDetected(): void {
  console.log('👀 Eye roll detected!');

  // Show toast
  if (overlay && settings.overlayEnabled) {
    overlay.showToast();
  }

  // Play audio reaction
  if (audioReactor && settings.audioEnabled) {
    audioReactor.playReaction();
  }

  // Notify background
  chrome.runtime.sendMessage({ type: 'EYE_ROLL_DETECTED' }).catch(() => {});

  // Skip the reel
  skipReel();
}

// Update state in background
function updateState(partial: Partial<DetectionState>): void {
  chrome.runtime.sendMessage({ type: 'STATE_UPDATE', state: partial }).catch(() => {});

  // Update overlay status
  if (overlay) {
    if (partial.faceDetected === true) {
      overlay.setStatus('active');
    } else if (partial.cameraActive === true) {
      overlay.setStatus('waiting');
    } else if (partial.cameraActive === false || partial.error) {
      overlay.setStatus('inactive');
    }
  }
}

// Initialize everything
async function initializeDetector(): Promise<void> {
  if (detector) return;

  try {
    // Create overlay first
    if (!overlay) {
      overlay = new Overlay();
      overlay.create();
      overlay.setVisible(settings.overlayEnabled);
    }

    // Create audio reactor
    if (!audioReactor) {
      audioReactor = new AudioReactor();
      audioReactor.setEnabled(settings.audioEnabled);
    }

    // Create detector
    detector = new EyeRollDetector();
    detector.setOnStateChange((state) => updateState(state));
    detector.setOnEyeRoll(onEyeRollDetected);

    await detector.initialize();
    detector.setSensitivity(settings.sensitivity);
    detector.setCooldown(settings.cooldownMs);

    // Connect video to overlay
    const video = detector.getVideoElement();
    if (video && overlay) {
      overlay.setVideoSource(video);
    }

    if (settings.enabled) {
      detector.start();
      updateState({ detecting: true });
    }

    console.log('✅ SWISH initialized');
  } catch (err) {
    console.error('Failed to initialize detector:', err);
    updateState({ error: err instanceof Error ? err.message : 'Unknown error' });
  }
}

// Cleanup
function destroyDetector(): void {
  if (detector) {
    detector.destroy();
    detector = null;
  }
  if (overlay) {
    overlay.destroy();
    overlay = null;
  }
  if (audioReactor) {
    audioReactor.destroy();
    audioReactor = null;
  }
  updateState({
    cameraActive: false,
    modelLoaded: false,
    detecting: false,
    faceDetected: false
  });
}

// Handle settings changes
function applySettings(newSettings: Settings): void {
  const wasEnabled = settings.enabled;
  settings = newSettings;

  if (detector) {
    detector.setSensitivity(settings.sensitivity);
    detector.setCooldown(settings.cooldownMs);

    if (settings.enabled && !wasEnabled) {
      detector.start();
      updateState({ detecting: true });
    } else if (!settings.enabled && wasEnabled) {
      detector.stop();
      updateState({ detecting: false });
    }
  } else if (settings.enabled && isOnReelsPage) {
    initializeDetector();
  }

  if (overlay) {
    overlay.setVisible(settings.overlayEnabled);
  }

  if (audioReactor) {
    audioReactor.setEnabled(settings.audioEnabled);
  }
}

// Listen for messages
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'SKIP_REEL') {
    skipReel();
    sendResponse({ success: true });
  }
  return false;
});

// Monitor settings changes
chrome.storage.onChanged.addListener((changes) => {
  if (changes.settings) {
    applySettings({ ...DEFAULT_SETTINGS, ...changes.settings.newValue });
  }
});

// Monitor URL changes
let lastUrl = window.location.href;
const urlObserver = new MutationObserver(() => {
  if (window.location.href !== lastUrl) {
    lastUrl = window.location.href;
    isOnReelsPage = checkReelsPage();
    console.log(`URL changed. On Reels: ${isOnReelsPage}`);

    if (isOnReelsPage && settings.enabled && !detector) {
      initializeDetector();
    } else if (!isOnReelsPage && detector) {
      destroyDetector();
    }
  }
});

// Start
async function start(): Promise<void> {
  const result = await chrome.storage.local.get('settings');
  settings = { ...DEFAULT_SETTINGS, ...result.settings };

  isOnReelsPage = checkReelsPage();
  console.log(`Initial check. On Reels: ${isOnReelsPage}`);

  urlObserver.observe(document.body, { childList: true, subtree: true });

  if (settings.enabled && isOnReelsPage) {
    initializeDetector();
  }
}

window.addEventListener('beforeunload', destroyDetector);
start();
