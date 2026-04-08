import { Settings, DetectionState } from '../lib/types';

const FUNNY_MESSAGES = [
  'Ready to judge your content.',
  'Your eyes have opinions.',
  'Retina-based curation active.',
  'Judgment mode: ENGAGED.',
  'The algorithm is you.',
];

async function init() {
  const settings = await chrome.runtime.sendMessage({ type: 'GET_SETTINGS' }) as Settings;
  const state = await chrome.runtime.sendMessage({ type: 'GET_STATE' }) as DetectionState;

  const enabledEl = document.getElementById('enabled') as HTMLInputElement;
  const audioEl = document.getElementById('audio') as HTMLInputElement;
  const overlayEl = document.getElementById('overlay') as HTMLInputElement;
  const sensitivityEl = document.getElementById('sensitivity') as HTMLInputElement;
  const sensitivityValueEl = document.getElementById('sensitivity-value')!;
  const statusTextEl = document.getElementById('status-text')!;
  const rollsEl = document.getElementById('rolls')!;
  const skipsEl = document.getElementById('skips')!;
  const messageEl = document.getElementById('message')!;

  enabledEl.checked = settings.enabled;
  audioEl.checked = settings.audioEnabled;
  overlayEl.checked = settings.overlayEnabled;
  sensitivityEl.value = String(settings.sensitivity);
  sensitivityValueEl.textContent = String(settings.sensitivity);

  rollsEl.textContent = String(state.sessionRolls);
  skipsEl.textContent = String(state.sessionSkips);

  updateStatus(state);
  messageEl.textContent = FUNNY_MESSAGES[Math.floor(Math.random() * FUNNY_MESSAGES.length)];

  enabledEl.addEventListener('change', async () => {
    await chrome.runtime.sendMessage({ type: 'SET_SETTINGS', settings: { enabled: enabledEl.checked } });
    const newState = await chrome.runtime.sendMessage({ type: 'GET_STATE' }) as DetectionState;
    updateStatus(newState);
  });

  audioEl.addEventListener('change', () => {
    chrome.runtime.sendMessage({ type: 'SET_SETTINGS', settings: { audioEnabled: audioEl.checked } });
  });

  overlayEl.addEventListener('change', () => {
    chrome.runtime.sendMessage({ type: 'SET_SETTINGS', settings: { overlayEnabled: overlayEl.checked } });
  });

  sensitivityEl.addEventListener('input', () => {
    sensitivityValueEl.textContent = sensitivityEl.value;
    chrome.runtime.sendMessage({ type: 'SET_SETTINGS', settings: { sensitivity: Number(sensitivityEl.value) } });
  });

  function updateStatus(s: DetectionState) {
    if (s.error) {
      statusTextEl.textContent = s.error;
      statusTextEl.className = 'status-inactive';
    } else if (!settings.enabled && !enabledEl.checked) {
      statusTextEl.textContent = '⏸ Detection paused';
      statusTextEl.className = 'status-warning';
    } else if (!s.cameraActive) {
      statusTextEl.textContent = '📷 Waiting for camera...';
      statusTextEl.className = 'status-warning';
    } else if (!s.modelLoaded) {
      statusTextEl.textContent = '🧠 Loading eye model...';
      statusTextEl.className = 'status-warning';
    } else if (!s.faceDetected) {
      statusTextEl.textContent = '🔍 Looking for your face...';
      statusTextEl.className = 'status-warning';
    } else {
      statusTextEl.textContent = '✅ Watching your eyes';
      statusTextEl.className = 'status-active';
    }
  }
}

init();
