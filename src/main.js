import { app, BrowserWindow, screen, nativeTheme, ipcMain, session } from 'electron';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import runGroqAgent from '../service/groq.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const overlayForTheme = () => {
  const symbolColor = nativeTheme.shouldUseDarkColors ? '#ffffff' : '#000000';
  return {
    color: '#00000000',
    symbolColor,
    height: 35
  };
};

const createWindow = (initialStartUrl) => {
  const win = new BrowserWindow({
    width: 1000,
    height: 700,
    frame: true,
    backgroundColor: "#ffffff",
    titleBarStyle: 'hidden',
    titleBarOverlay: overlayForTheme(),
    icon: path.join(__dirname, '..', 'renderer', 'icons', 'logo.png'),
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
    win.webContents.send("favicon", favicons);
  });

  // Ensure any window.open / popup opens as a full browser UI window
  // with UrlBar + Page, pointing its internal webview at the target URL.
  win.webContents.setWindowOpenHandler(({ url }) => {
    try {
      if (url && win && win.webContents) {
        win.webContents.send('open-new-tab', url);
      }
    } catch {}
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
  // Default to light; renderer can switch between light/dark/system
  nativeTheme.themeSource = 'light';

  // Set a strict CSP header (includes frame-ancestors) so the meta tag isn't needed.
  const isDev = !!process.env.ELECTRON_START_URL;
  const scriptSrc = isDev
    ? "script-src 'self' 'unsafe-inline' 'unsafe-eval'"
    : "script-src 'self'";
  const csp = [
    "default-src 'self'",
    scriptSrc,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: https: blob:",
    "font-src 'self' data:",
    "connect-src 'self' ws://127.0.0.1:5002 http://localhost:3000 https:",
    "media-src 'self' https: blob: data:",
    "frame-src 'self'",
    "frame-ancestors 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "worker-src 'self'",
  ].join('; ');

  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    const headers = {
      ...details.responseHeaders,
      'Content-Security-Policy': [csp],
    };
    callback({ responseHeaders: headers });
  });

  createWindow();

  // Popups requested from renderer (e.g., <webview>) arrive here via IPC.
  // Open them as full browser windows with our UI.
  ipcMain.on('open-popup-window', (event, url) => {
    if (typeof url === 'string' && url.length > 0) {
      createWindow(url);
    }
  });

  ipcMain.on('set-theme-mode', (_event, mode) => {
    const allowed = ['light', 'dark', 'system'];
    const next = allowed.includes(mode) ? mode : 'system';
    nativeTheme.themeSource = next;
    const overlay = overlayForTheme();
    BrowserWindow.getAllWindows().forEach((win) => {
      try {
        win.setTitleBarOverlay(overlay);
      } catch {}
    });
  });


  app.on('web-contents-created', (event, contents) => {
    try {
      if (contents.getType && contents.getType() === 'webview') {
        contents.setWindowOpenHandler(({ url }) => {
          try {
            const host = contents.hostWebContents;
            if (url && host) {
              host.send('open-new-tab', url);
            }
          } catch {}
          return { action: 'deny' };
        });
      }
    } catch {
    
    }
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });

  ipcMain.handle('groq-run', async (_event, arg) => {
    try {
      let prompt = '', options = {};
      if (typeof arg === 'string') {
        prompt = arg.trim();
      } else if (arg && typeof arg === 'object') {
        prompt = typeof arg.text === 'string' ? arg.text.trim() : '';
        options = arg;
      }
      if (!prompt) return { text: '', audio: null };
      const answer = await runGroqAgent(prompt, options);
      return answer || { text: '', audio: null };
    } catch (err) {
      console.error('[Groq IPC] error:', err);
      return { text: '', audio: null };
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
