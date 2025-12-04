// Use CommonJS in preload to avoid ESM import errors
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("api", {
  onfavicon: (fn) => ipcRenderer.on("favicon", (event, favicon) => fn(favicon)),

  /**
   * Ask the main process to open a new top-level browser window
   * (with UrlBar + Page UI) pointing at the given URL.
   */
  openPopupWindow: (url) => {
    ipcRenderer.send("open-popup-window", url);
  },
});