# Platforms and browser support

## Play in a browser

Tarka is a self-contained static web game. The production build is intended
for current versions of Chrome, Edge, Firefox, and Safari on Windows, macOS,
Linux, Android, and iOS/iPadOS. JavaScript, same-origin static assets, Web
Storage, and browser audio are required; no wallet, extension, API key, or
backend connection is required.

Desktop browsers show the approved integer-scaled presentation. On narrow
touch screens, the game preserves the native 480×270 canvas for panning and
pinch zoom. A visible full-screen icon fits the complete game to the display.
Android browsers may accept the best-effort landscape request; browsers that
decline it receive a centered, letterboxed portrait presentation instead.

Browser autoplay rules may keep music muted until the first player gesture.
Save data and preferences remain local to the current browser and origin.

## Run from source

Install Node.js 20.19 or later and npm 10 or later. The same commands work in
Windows PowerShell or Command Prompt, macOS Terminal, and common Linux shells:

```text
git clone https://github.com/th3Wh1t3Rabbit/tarka.git
cd tarka
npm ci
npm run dev
```

For the exact static production shape:

```text
npm run release:verify
npm run preview
```

The release gate rejects machine-local paths and confirms that required art,
audio, fonts, and scenario files are present in `dist/`. The runtime itself
does not invoke an operating-system-specific command.
