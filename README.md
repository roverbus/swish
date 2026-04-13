# 👀 SWISH 🙄

**Skip With Intense Side-eye, Honey**

A Chrome extension that detects when you roll your eyes 🙄 and automatically advances to the next Instagram Reel. Because sometimes swiping is too much effort, but judging content with your eyeballs? *Chef's kiss.*

> "Your side-eye now has superpowers."

## Features

- **Eye-roll detection** — Uses your webcam to detect that signature upward eye motion
- **Auto-skip** — Advances to the next Reel when judgment is rendered
- **Dramatic audio reactions** — Optional voice lines like "For real?", "Thank you, next", and "Whatever"
- **Visual feedback** — Small overlay shows camera preview and detection status
- **Adjustable sensitivity** — Tune how much eye-roll it takes to trigger
- **Privacy-first** — All processing happens locally in your browser. No data leaves your machine.

## Demo

*[Insert satisfying GIF of eye-rolling and content skipping here]*

## Installation

1. Clone or download this repo
2. Run the build:
   ```bash
   npm install
   npm run build
   ```
3. Open Chrome and go to `chrome://extensions/`
4. Enable "Developer mode" (top right)
5. Click "Load unpacked" and select the `dist` folder
6. Navigate to Instagram Reels and enable detection in the popup

## Usage

1. Click the SWISH icon in your Chrome toolbar
2. Toggle "Detection" ON
3. Grant camera permission when prompted
4. Open Instagram Reels
5. Roll your eyes at cringe content
6. Watch the Reel skip automatically
7. Repeat until you've judged everything

### Controls

| Setting | Description |
|---------|-------------|
| Detection | Master on/off for eye tracking |
| Audio Reactions | Enable/disable sassy voice lines |
| Show Overlay | Toggle the camera preview widget |
| Sensitivity | How dramatic your eye roll needs to be (lower = more dramatic required) |

## How It Works

1. **Face detection** — TensorFlow.js with MediaPipe Face Mesh identifies facial landmarks
2. **Iris tracking** — The model tracks 468+ landmarks including iris position
3. **Eye-roll detection** — Algorithm detects when both irises move significantly upward
4. **Debouncing** — 1.5-second cooldown prevents rapid-fire skipping
5. **Navigation** — Simulates ArrowDown keypress to advance the Reel

## Privacy

**Your privacy matters.** SWISH:

- ✅ Processes everything locally in your browser
- ✅ Never uploads video or images anywhere
- ✅ Never stores recordings
- ✅ Only activates on Instagram when you enable it
- ✅ Camera can be disabled anytime via the popup

The webcam feed never leaves your computer. The ML model runs entirely in-browser using TensorFlow.js.

## Known Limitations

- **Lighting matters** — Works best in well-lit environments
- **Face position** — You need to be roughly facing the camera
- **Glasses** — May reduce accuracy for some users (thick frames can occlude eyes)
- **Instagram changes** — The skip mechanism relies on keyboard navigation; Instagram UI changes could affect this
- **Not for Chrome Web Store** — This is a personal project, not packaged for distribution

## Tech Stack

- **Chrome Extension Manifest V3**
- **TensorFlow.js** with MediaPipe Face Mesh model
- **TypeScript** for sanity
- **Vite** + **@crxjs/vite-plugin** for builds
- **Web Speech API** for dramatic audio reactions

## Development

```bash
# Install dependencies
npm install

# Build (one-time)
npm run build

# Watch mode for development
npm run dev

# Type checking
npm run typecheck

# Linting
npm run lint
```

## Contributing

This is a joke project that accidentally works. PRs welcome if you want to make it funnier or more functional.

Ideas:
- Custom audio clips
- Configurable phrases
- More gesture support (squint = rewatch?)
- Better icons
- Port to Firefox

## License

MIT — do whatever you want with it.

## Disclaimer

This is a **personal project** built for entertainment and to see if the idea would actually work. It's not intended for production use, accessibility purposes, or anything serious. The author is not responsible for any missed content, awkward moments caught on camera, or existential crises about how you spend your time.

If you make a video about this, I'd love to see it.

---

*Built with equal parts curiosity and disdain for endless scrolling.*
