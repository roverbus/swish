declare var chrome: any;
import { EyeRollDetector } from './src/lib/eye-detector.ts';

const detector = new EyeRollDetector();

const logEl = document.getElementById('log')!;
const indicatorEl = document.getElementById('indicator')!;
const sensitivityEl = document.getElementById('sensitivity') as HTMLInputElement;
const sensitivityValEl = document.getElementById('sensitivity-val')!;
const webcamEl = document.getElementById('webcam') as HTMLVideoElement;

function log(msg: string) {
    console.log(msg);
    logEl.innerHTML = `<div>${new Date().toLocaleTimeString()}: ${msg}</div>` + logEl.innerHTML;
}

sensitivityEl.addEventListener('input', () => {
    const val = parseInt(sensitivityEl.value, 10);
    sensitivityValEl.textContent = val.toString();
    detector.setSensitivity(val);
});

// Calibration state
let calibrating: 'neutral' | 'roll' | null = null;
let neutralSamples: number[][] = [];
let rollSamples: number[][] = [];

const btnNeutral = document.getElementById('btn-cal-neutral')!;
const btnRoll = document.getElementById('btn-cal-roll')!;
const calStatus = document.getElementById('cal-status')!;
const calResult = document.getElementById('cal-result')!;

function updateCalibrationResult() {
    let resultText = `Samples - Neutral: ${neutralSamples.length}, Roll: ${rollSamples.length}. `;
    if (neutralSamples.length > 0 && rollSamples.length > 0) {
        detector.train(neutralSamples, rollSamples);
        resultText += `<br/><b>KNN Model Trained Successfully!</b> The detector is now using your custom facial map.`;

        // Save to chrome extension if we are running as the options page
        if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
            chrome.runtime.sendMessage({
                type: 'SET_SETTINGS',
                settings: {
                    calibrationProfiles: {
                        neutral: neutralSamples,
                        roll: rollSamples
                    }
                }
            }).then(() => {
                resultText += `<br/><span style="color: #4CAF50;">✅ Saved to Extension Storage!</span>`;
                calResult.innerHTML = resultText;
            }).catch((err: any) => {
                console.error("Storage save failed", err);
            });
        } else {
            resultText += `<br/><span style="color: #ff9800;">Note: Not saving to extension because not running in extension context.</span>`;
        }
    }
    calResult.innerHTML = resultText;
}

btnNeutral.addEventListener('mousedown', () => { calibrating = 'neutral'; neutralSamples = []; calStatus.textContent = 'Recording neutral... Look around naturally, or look down.'; calStatus.style.color = '#fff'; });
btnNeutral.addEventListener('mouseup', () => { calibrating = null; calStatus.textContent = ''; updateCalibrationResult(); });
btnNeutral.addEventListener('mouseleave', () => { if (calibrating === 'neutral') { calibrating = null; calStatus.textContent = ''; updateCalibrationResult(); }});

btnRoll.addEventListener('mousedown', () => { calibrating = 'roll'; rollSamples = []; calStatus.textContent = 'Recording roll... Roll your eyes UP!'; calStatus.style.color = '#0f0'; });
btnRoll.addEventListener('mouseup', () => { calibrating = null; calStatus.textContent = ''; updateCalibrationResult(); });
btnRoll.addEventListener('mouseleave', () => { if (calibrating === 'roll') { calibrating = null; calStatus.textContent = ''; updateCalibrationResult(); }});

detector.onFrame = (data) => {
    if (data.features && calibrating) {
        if (calibrating === 'neutral') neutralSamples.push(data.features);
        if (calibrating === 'roll') rollSamples.push(data.features);
    }
};

detector.setOnStateChange((state) => {
    if (state.cameraActive !== undefined) log(`Camera active: ${state.cameraActive}`);
    if (state.modelLoaded !== undefined) log(`Model loaded: ${state.modelLoaded}`);
    if (state.faceDetected !== undefined) log(`Face detected: ${state.faceDetected}`);
});

detector.setOnEyeRoll(() => {
    log('👀 Eye Roll Detected!');
    indicatorEl.classList.add('roll-active');
    indicatorEl.textContent = '👀 ROOOLLL DETECTED! 👀';
    setTimeout(() => {
        indicatorEl.classList.remove('roll-active');
        indicatorEl.textContent = 'Waiting for eye roll...';
    }, 1000);
});

async function start() {
    try {
        log('Initializing detector...');
        await detector.initialize();
        log('Detector initialized, starting...');
        detector.start();
        
        // Connect the detector's internal video stream to our UI video element
        const stream = (detector as any).stream;
        if (stream) {
            webcamEl.srcObject = stream;
        }
    } catch (err) {
        log(`Error: ${err}`);
    }
}

start();
