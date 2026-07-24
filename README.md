# MotionKeys

MotionKeys is a browser-based virtual piano that uses MediaPipe hand tracking to let you play notes with your fingertips. Turn on your camera, hold your hands above the on-screen keys, and dip a fingertip to play.

Live version: https://motionkeys-piano.netlify.app

## Features

- Real-time hand tracking with MediaPipe Tasks Vision
- Webcam-powered fingertip note triggering
- Playable piano keys with mouse, touch, keyboard, or hand gestures
- Web Audio synth with sustain and volume controls
- Responsive interface for desktop and mobile browsers

## Requirements

- Node.js 22.13 or newer
- npm
- A modern browser with camera access

## Install Locally

Clone the repository:

```bash
git clone https://github.com/dnorton94/motionkeys.git
cd motionkeys
```

Install dependencies:

```bash
npm install
```

Start the local development server:

```bash
npm run dev
```

Open the local app:

```text
http://localhost:3000
```

When the page opens, allow camera access if you want to use hand tracking. The app can also be played directly with the on-screen keys or the keyboard shortcuts shown on each piano key.

## Build

Create a production build:

```bash
npm run build
```

Create the Netlify-ready static output:

```bash
npm run build:netlify
```

The Netlify output is generated in `netlify-dist/`.

## Notes

MediaPipe's hand model and WebAssembly assets are loaded from the MediaPipe CDN at runtime, so the first hand-tracking session needs network access.
