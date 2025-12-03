import { app, BrowserWindow, screen } from 'electron';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const createWindow = () => {
  const win = new BrowserWindow({
    width: 1000,
    height: 700,
    frame: true,
    backgroundColor: "#000000",
    titleBarStyle: 'hidden',
    titleBarOverlay: {
      color: '#00000000',
      symbolColor: '#ffffff',
      height: 35
    },
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      webviewTag: true
    }

  });

  const startUrl = process.env.ELECTRON_START_URL || `file://${path.join(__dirname, 'index.html')}`;
  win.loadURL(startUrl);
  win.webContents.on("page-favicon-updated", (event, favicons) => {
    win.webContents.send("favicon", favicons[0]);
  });

  // Custom maximize behavior:
  // - First click: window fills the screen work area (best fit) but is NOT truly maximized.
  // - Second click: window returns to its previous "floating" size and position.
  let isCustomMaximized = false;
  let lastNormalBounds = win.getBounds();

  win.on('maximize', () => {
    try {
      const { workArea } = screen.getPrimaryDisplay();

      if (!isCustomMaximized) {
        // Store current bounds to restore later.
        lastNormalBounds = win.getBounds();
        isCustomMaximized = true;
        // Cancel real maximize and resize to work area instead.
        win.unmaximize();
        win.setBounds(workArea);
      } else {
        // Toggle back to previous floating size.
        isCustomMaximized = false;
        win.unmaximize();
        if (lastNormalBounds) {
          win.setBounds(lastNormalBounds);
        }
      }
    } catch {
      // Fallback: ensure we never stay truly maximized.
      win.unmaximize();
    }
  });
};

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
