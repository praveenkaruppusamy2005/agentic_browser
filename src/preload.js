// Use CommonJS in preload to avoid ESM import errors
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("api", {
  onfavicon: (fn) => ipcRenderer.on("favicon", (event, favicon) => fn(favicon)),
});