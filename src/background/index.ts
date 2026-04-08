import { Settings, DEFAULT_SETTINGS, DetectionState, INITIAL_STATE } from '../lib/types';

let currentState: DetectionState = { ...INITIAL_STATE };

async function getSettings(): Promise<Settings> {
  const result = await chrome.storage.local.get('settings');
  return { ...DEFAULT_SETTINGS, ...result.settings };
}

async function setSettings(settings: Partial<Settings>): Promise<Settings> {
  const current = await getSettings();
  const updated = { ...current, ...settings };
  await chrome.storage.local.set({ settings: updated });
  return updated;
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  switch (message.type) {
    case 'GET_SETTINGS':
      getSettings().then(sendResponse);
      return true;

    case 'SET_SETTINGS':
      setSettings(message.settings).then(sendResponse);
      return true;

    case 'GET_STATE':
      sendResponse(currentState);
      return false;

    case 'STATE_UPDATE':
      currentState = { ...currentState, ...message.state };
      return false;

    case 'EYE_ROLL_DETECTED':
      currentState.sessionRolls++;
      currentState.lastDetection = Date.now();
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]?.id) {
          chrome.tabs.sendMessage(tabs[0].id, { type: 'SKIP_REEL' });
        }
      });
      return false;
  }
});

chrome.runtime.onInstalled.addListener(() => {
  console.log('SWISH installed. Your eyes now have power. 👀');
});
