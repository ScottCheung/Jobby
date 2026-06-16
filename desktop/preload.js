const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("autoJobDesktop", {
  appName: "Auto Job Apply",
  getRuntimeInfo: () => ipcRenderer.invoke("desktop:get-runtime-info"),
  getServiceStatus: () => ipcRenderer.invoke("desktop:get-service-status"),
  getConnectionConfig: () => ipcRenderer.invoke("desktop:get-connection-config"),
  saveConnectionConfig: (payload) => ipcRenderer.invoke("desktop:save-connection-config", payload),
  resetConnectionConfig: () => ipcRenderer.invoke("desktop:reset-connection-config"),
  onServiceStatus: (callback) => {
    const listener = (_event, payload) => callback(payload);
    ipcRenderer.on("desktop:service-status", listener);
    return () => ipcRenderer.removeListener("desktop:service-status", listener);
  },
  onFallbackReason: (callback) => {
    const listener = (_event, payload) => callback(payload);
    ipcRenderer.on("desktop:fallback-reason", listener);
    return () => ipcRenderer.removeListener("desktop:fallback-reason", listener);
  },
});
