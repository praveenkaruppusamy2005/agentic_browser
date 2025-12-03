# Electron Basic Template

A minimal Electron starter app.

## Scripts

- `npm start` – run Electron and load local HTML.
- `npm run start:dev` – run Electron pointing at `http://localhost:3000` (for integrating with a dev server).

## Structure

- `src/main.js` – Electron main process entry
- `src/preload.js` – Preload script
- `src/index.html` – Renderer HTML

## Getting Started

```cmd
cd electron-app
npm install
npm start
```

## Notes

- Uses ES modules (`type: module`).
- Preload exposes version info to the renderer.
