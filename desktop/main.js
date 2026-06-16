const { app, BrowserWindow, dialog, ipcMain } = require("electron");
const path = require("path");
const { getDesktopConfig } = require("./config");
const { DesktopConfigStore } = require("./config-store");
const { ServiceManager } = require("./service-manager");

const APP_NAME = "Auto Job Apply";
app.setName(APP_NAME);

let mainWindow = null;
let desktopConfig = null;
let serviceManager = null;
let configStore = null;
let connectionConfig = null;
let loadingFallback = false;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 960,
    minWidth: 1200,
    minHeight: 800,
    title: APP_NAME,
    backgroundColor: "#0e1116",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  mainWindow.webContents.on("did-fail-load", (_event, errorCode, errorDescription, validatedURL, isMainFrame) => {
    if (!isMainFrame || loadingFallback) {
      return;
    }
    loadFallbackPage(
      `Could not load ${validatedURL || desktopConfig.dashboard.url}. ${errorDescription} (${errorCode}).`,
    );
  });

  loadDashboardPage();

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

function registerIpc() {
  ipcMain.handle("desktop:get-runtime-info", () => serviceManager.getRuntimeInfo());
  ipcMain.handle("desktop:get-service-status", () => serviceManager.getServiceStatus());
  ipcMain.handle("desktop:get-connection-config", () => connectionConfig);
  ipcMain.handle("desktop:save-connection-config", async (_event, payload) => {
    const previousConfig = connectionConfig;
    const nextConnectionConfig = configStore.save(payload);

    try {
      await applyConnectionConfig(nextConnectionConfig);
      return {
        ok: true,
        config: connectionConfig,
      };
    } catch (error) {
      configStore.save(previousConfig);
      await applyConnectionConfig(previousConfig);
      return {
        ok: false,
        config: connectionConfig,
        error: error instanceof Error ? error.message : "Failed to save desktop connection config",
      };
    }
  });
  ipcMain.handle("desktop:reset-connection-config", async () => {
    const resetConfig = configStore.reset();
    await applyConnectionConfig(resetConfig);
    return {
      ok: true,
      config: connectionConfig,
    };
  });

  serviceManager.on("status", (status) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send("desktop:service-status", status);
    }
  });
}

async function applyConnectionConfig(nextConnectionConfig) {
  connectionConfig = nextConnectionConfig;
  desktopConfig = getDesktopConfig({ connectionConfig });
  if (serviceManager) {
    await serviceManager.stopManagedServices();
    serviceManager.updateConfig(desktopConfig);
    await serviceManager.startManagedServices();
  }

  if (mainWindow && !mainWindow.isDestroyed()) {
    await loadDashboardPage();
  }
}

async function loadDashboardPage() {
  if (!mainWindow || mainWindow.isDestroyed()) {
    return;
  }

  loadingFallback = false;
  if (!desktopConfig.dashboard.url) {
    await loadFallbackPage("Dashboard URL is not configured yet.");
    return;
  }

  try {
    await mainWindow.loadURL(desktopConfig.dashboard.url);
  } catch (error) {
    await loadFallbackPage(
      error instanceof Error ? error.message : "Could not load the configured dashboard",
    );
  }
}

async function loadFallbackPage(reason) {
  if (!mainWindow || mainWindow.isDestroyed()) {
    return;
  }

  loadingFallback = true;
  await mainWindow.loadFile(path.join(__dirname, "fallback.html"));
  mainWindow.webContents.once("did-finish-load", () => {
    mainWindow.webContents.send("desktop:fallback-reason", {
      reason,
      dashboardUrl: desktopConfig.dashboard.url,
      apiUrl: desktopConfig.api.url,
    });
  });
}

app.whenReady()
  .then(async () => {
    configStore = new DesktopConfigStore(app.getPath("userData"));
    connectionConfig = configStore.load();
    desktopConfig = getDesktopConfig({ connectionConfig });
    serviceManager = new ServiceManager(desktopConfig);
    registerIpc();
    await serviceManager.startManagedServices();
    createWindow();

    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
      }
    });
  })
  .catch((error) => {
    dialog.showErrorBox("Desktop startup failed", error.message);
    app.quit();
  });

app.on("window-all-closed", () => {
  serviceManager.stopManagedServices();
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("before-quit", () => {
  serviceManager.stopManagedServices();
});
