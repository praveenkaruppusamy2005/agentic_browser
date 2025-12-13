// Use CommonJS in preload to avoid ESM import errors
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("api", {
  onfavicon: (fn) => ipcRenderer.on("favicon", (event, favicons) => fn(favicons)),

  /**
   * Ask the main process to open a new top-level browser window
   * (with UrlBar + Page UI) pointing at the given URL.
   */
  openPopupWindow: (url) => {
    ipcRenderer.send("open-popup-window", url);
  },
  setThemeMode: (mode) => {
    ipcRenderer.send("set-theme-mode", mode);
  },
  runGroq: (text, options = {}) => ipcRenderer.invoke("groq-run", { text, ...options }),
  onOpenNewTab: (fn) => {
    ipcRenderer.on('open-new-tab', (_event, url) => fn(url));
  },
});