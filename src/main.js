import { app, BrowserWindow, screen, nativeTheme, ipcMain } from 'electron';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const createWindow = (initialStartUrl) => {
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

  const baseUrl = process.env.ELECTRON_START_URL || `file://${path.join(__dirname, 'index.html')}`;
  const startUrl =
    typeof initialStartUrl === "string" && initialStartUrl.length > 0
      ? `${baseUrl}?startUrl=${encodeURIComponent(initialStartUrl)}`
      : baseUrl;

  win.loadURL(startUrl);
  win.webContents.on("page-favicon-updated", (event, favicons) => {
    win.webContents.send("favicon", favicons[0]);
  });

  // Ensure any window.open / popup opens as a full browser UI window
  // with UrlBar + Page, pointing its internal webview at the target URL.
  win.webContents.setWindowOpenHandler(({ url }) => {
    createWindow(url);
    return { action: "deny" };
  });


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
  // Respect the user's OS theme to avoid forcing dark mode
  // Options: 'system' | 'light' | 'dark'. Using 'system' prevents unwanted dark styling on sites.
  nativeTheme.themeSource = 'system';
  createWindow();

  // Popups requested from renderer (e.g., <webview>) arrive here via IPC.
  // Open them as full browser windows with our UI.
  ipcMain.on('open-popup-window', (event, url) => {
    if (typeof url === 'string' && url.length > 0) {
      createWindow(url);
    }
  });

  // For any <webview> guest contents, also force window.open/popups
  // to open as our full browser window instead of a bare Electron popup.
  app.on('web-contents-created', (event, contents) => {
    try {
      if (contents.getType && contents.getType() === 'webview') {
        contents.setWindowOpenHandler(({ url }) => {
          if (typeof url === 'string' && url.length > 0) {
            createWindow(url);
          }
          return { action: 'deny' };
        });
      }
    } catch {
      // Ignore errors; fall back to default behavior.
    }
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
