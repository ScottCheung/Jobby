/** @format */

const { app, BrowserWindow, dialog, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const { spawn, execFileSync } = require('child_process');
const net = require('net');
const http = require('http');
const { getDesktopConfig } = require('./config');
const { DesktopConfigStore } = require('./config-store');
const { ServiceManager } = require('./service-manager');

const APP_NAME = 'Auto Job Apply';
app.setName(APP_NAME);

const WINDOW_CHROME_CSS = `
  html, body {
    scrollbar-width: none !important;
    -ms-overflow-style: none !important;
  }

  html::-webkit-scrollbar,
  body::-webkit-scrollbar {
    width: 0 !important;
    height: 0 !important;
    display: none !important;
  }
`;

let mainWindow = null;
let desktopConfig = null;
let serviceManager = null;
let configStore = null;
let connectionConfig = null;
let loadingFallback = false;
let manualChromeSessionFile = null;

function createWindow() {
  const isMac = process.platform === 'darwin';
  mainWindow = new BrowserWindow({
    width: 2880,
    height: 1800,
    minWidth: (2880 * 1) / 3,
    minHeight: (1800 * 1) / 3,
    title: APP_NAME,
    frame: !isMac,
    titleBarStyle: isMac ? 'hiddenInset' : undefined,
    trafficLightPosition: isMac ? { x: 16, y: 14 } : undefined,
    autoHideMenuBar: true,
    backgroundColor: '#0e1116',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  mainWindow.webContents.on(
    'did-fail-load',
    (_event, errorCode, errorDescription, validatedURL, isMainFrame) => {
      if (!isMainFrame || loadingFallback) {
        return;
      }
      loadFallbackPage(
        `Could not load ${validatedURL || desktopConfig.dashboard.url}. ${errorDescription} (${errorCode}).`,
      );
    },
  );

  mainWindow.webContents.on('dom-ready', () => {
    void mainWindow.webContents.insertCSS(WINDOW_CHROME_CSS);
  });

  loadDashboardPage();
  mainWindow.webContents.openDevTools(); // debug console

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function persistManualChromeSession(session) {
  if (!manualChromeSessionFile) return;
  try {
    if (!session) {
      if (fs.existsSync(manualChromeSessionFile)) {
        fs.unlinkSync(manualChromeSessionFile);
      }
      return;
    }
    fs.writeFileSync(manualChromeSessionFile, JSON.stringify(session, null, 2));
    console.log(
      '[desktop] persisted manual chrome session:',
      manualChromeSessionFile,
      session,
    );
  } catch (e) {
    console.error('[desktop] failed to persist manual chrome session:', e);
  }
}

function loadPersistedManualChromeSession() {
  if (!manualChromeSessionFile || !fs.existsSync(manualChromeSessionFile)) {
    return null;
  }
  try {
    return JSON.parse(fs.readFileSync(manualChromeSessionFile, 'utf8'));
  } catch (e) {
    return null;
  }
}

function probeChromeDebugger(debuggerAddress) {
  return new Promise((resolve) => {
    if (!debuggerAddress) {
      resolve(false);
      return;
    }
    const request = http.get(
      `http://${debuggerAddress}/json/version`,
      (response) => {
        response.resume();
        resolve(response.statusCode === 200);
      },
    );
    request.on('error', () => resolve(false));
    request.setTimeout(1500, () => {
      request.destroy();
      resolve(false);
    });
  });
}

function findFreePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      const port = typeof address === 'object' && address ? address.port : null;
      server.close((err) => {
        if (err) {
          reject(err);
          return;
        }
        resolve(port);
      });
    });
  });
}

function registerIpc() {
  ipcMain.handle('desktop:get-runtime-info', () =>
    serviceManager.getRuntimeInfo(),
  );
  ipcMain.handle('desktop:get-service-status', () =>
    serviceManager.getServiceStatus(),
  );
  ipcMain.handle('desktop:get-connection-config', () => connectionConfig);
  ipcMain.handle('desktop:save-connection-config', async (_event, payload) => {
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
        error:
          error instanceof Error ?
            error.message
          : 'Failed to save desktop connection config',
      };
    }
  });
  ipcMain.handle('desktop:reset-connection-config', async () => {
    const resetConfig = configStore.reset();
    await applyConnectionConfig(resetConfig);
    return {
      ok: true,
      config: connectionConfig,
    };
  });

  serviceManager.on('status', (status) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('desktop:service-status', status);
    }
  });

  ipcMain.handle('desktop:start-bot', async (_event, platform) => {
    try {
      const persistedSession = loadPersistedManualChromeSession();
      if (
        persistedSession &&
        (await probeChromeDebugger(persistedSession.debuggerAddress))
      ) {
        serviceManager.setManualChromeSession(persistedSession);
      } else {
        serviceManager.setManualChromeSession(null);
        if (persistedSession) {
          persistManualChromeSession(null);
        }
      }
      return await serviceManager.startBot(platform);
    } catch (err) {
      return { ok: false, error: err.message };
    }
  });

  ipcMain.handle('desktop:stop-bot', async (_event, platform) => {
    try {
      return await serviceManager.stopBot(platform);
    } catch (err) {
      return { ok: false, error: err.message };
    }
  });

  ipcMain.handle('desktop:get-bot-state', (_event, platform) => {
    return serviceManager.getBotState(platform);
  });

  let manualChromeProcess = null;

  function getChromePath() {
    if (process.platform === 'darwin') {
      return '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
    } else if (process.platform === 'win32') {
      const programFiles = process.env['ProgramFiles'] || 'C:\\Program Files';
      const programFilesX86 =
        process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)';
      const path1 = path.join(
        programFiles,
        'Google\\Chrome\\Application\\chrome.exe',
      );
      const path2 = path.join(
        programFilesX86,
        'Google\\Chrome\\Application\\chrome.exe',
      );
      if (fs.existsSync(path1)) return path1;
      if (fs.existsSync(path2)) return path2;
      return 'chrome.exe';
    } else {
      return 'google-chrome';
    }
  }

  function resolveProfilePath(profilePath) {
    return path.resolve(
      profilePath.replace(/^~/, process.env.HOME || process.env.USERPROFILE),
    );
  }

  function isChromeAlreadyRunning() {
    try {
      if (process.platform === 'darwin' || process.platform === 'linux') {
        const output = execFileSync('ps', ['-ax', '-o', 'command='], {
          encoding: 'utf8',
          stdio: ['ignore', 'pipe', 'ignore'],
        });
        return output
          .split('\n')
          .map((line) => line.trim())
          .some(
            (line) =>
              line &&
              !line.includes('auto-job-apply-profile') &&
              (line.includes('Google Chrome') || line.includes('Chromium')),
          );
      }
    } catch (e) {
      // ignore detection failures and continue
    }
    return false;
  }

  function findCookiesDb(resolvedProfilePath) {
    const candidates = [
      path.join(resolvedProfilePath, 'Default', 'Network', 'Cookies'),
      path.join(resolvedProfilePath, 'Default', 'Cookies'),
    ];
    return candidates.find((candidate) => fs.existsSync(candidate)) || null;
  }

  function getFileSizeMb(filePath) {
    try {
      const stat = fs.statSync(filePath);
      return Math.round((stat.size / (1024 * 1024)) * 100) / 100;
    } catch (e) {
      return 0;
    }
  }

  function queryCookieNames(cookiesDbPath, hostPattern) {
    const tempDbPath = path.join(
      app.getPath('temp'),
      `auto-job-apply-cookie-check-${Date.now()}-${Math.random().toString(36).slice(2)}.sqlite`,
    );
    try {
      fs.copyFileSync(cookiesDbPath, tempDbPath);
      const sql = `SELECT name FROM cookies WHERE host_key LIKE '${hostPattern}'`;
      const raw = execFileSync('/usr/bin/sqlite3', [tempDbPath, sql], {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
      });
      return raw
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean);
    } finally {
      try {
        if (fs.existsSync(tempDbPath)) {
          fs.unlinkSync(tempDbPath);
        }
      } catch (e) {
        // ignore cleanup failures
      }
    }
  }

  function summarizeLinkedInSessionFromCookies(cookieNames) {
    if (cookieNames.includes('li_at')) {
      return {
        loggedIn: true,
        detail:
          'Found LinkedIn auth cookie <strong>li_at</strong> in this browser profile.',
      };
    }
    if (cookieNames.length > 0) {
      return {
        loggedIn: false,
        detail:
          'This profile has LinkedIn cookies, but not the main auth cookie <strong>li_at</strong>, so LinkedIn will likely ask you to sign in again.',
      };
    }
    return {
      loggedIn: false,
      detail: 'No LinkedIn cookies were found in this browser profile yet.',
    };
  }

  function summarizeSeekSessionFromCookies(cookieNames) {
    if (cookieNames.includes('JobseekerSessionId')) {
      return {
        loggedIn: true,
        detail:
          'Found Seek session cookie <strong>JobseekerSessionId</strong> in this browser profile.',
      };
    }
    if (cookieNames.length > 0) {
      return {
        loggedIn: false,
        detail:
          'This profile has some Seek cookies, but not the main jobseeker session cookie, so Seek may still prompt for login.',
      };
    }
    return {
      loggedIn: false,
      detail: 'No Seek cookies were found in this browser profile yet.',
    };
  }

  ipcMain.handle('desktop:open-chrome-session', async (_event, profilePath) => {
    if (manualChromeProcess && !manualChromeProcess.killed) {
      return { ok: false, error: 'Login browser is already open.' };
    }

    if (isChromeAlreadyRunning()) {
      return {
        ok: false,
        code: 'close_other_chrome_windows',
        error: 'Close your other Chrome windows first.',
      };
    }

    const chromePath = getChromePath();
    if (process.platform === 'darwin' || process.platform === 'win32') {
      if (!fs.existsSync(chromePath)) {
        return {
          ok: false,
          error: `Google Chrome was not found at: ${chromePath}. Please make sure Google Chrome is installed.`,
        };
      }
    }

    const resolvedProfilePath = resolveProfilePath(profilePath);
    if (!fs.existsSync(resolvedProfilePath)) {
      fs.mkdirSync(resolvedProfilePath, { recursive: true });
    }

    const debuggingPort = await findFreePort();

    const args = [
      `--user-data-dir=${resolvedProfilePath}`,
      '--profile-directory=Default',
      '--new-window',
      `--remote-debugging-port=${debuggingPort}`,
      '--no-first-run',
      '--no-default-browser-check',
    ];

    try {
      manualChromeProcess = spawn(chromePath, args, {
        detached: true,
        stdio: 'ignore',
      });
      manualChromeProcess.unref();

      manualChromeProcess.on('exit', () => {
        manualChromeProcess = null;
        serviceManager.setManualChromeSession(null);
        persistManualChromeSession(null);
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('desktop:manual-chrome-exit');
        }
      });

      const session = {
        debuggerAddress: `127.0.0.1:${debuggingPort}`,
        profilePath: resolvedProfilePath,
      };
      serviceManager.setManualChromeSession(session);
      persistManualChromeSession(session);

      const debuggerReady = await probeChromeDebugger(session.debuggerAddress);
      if (!debuggerReady) {
        console.warn(
          '[desktop] chrome opened but remote debugger is not reachable yet:',
          session,
        );
      } else {
        console.log('[desktop] chrome remote debugger is ready:', session);
      }

      return { ok: true, debuggerAddress: `127.0.0.1:${debuggingPort}` };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  });

  ipcMain.handle('desktop:close-chrome-session', async () => {
    if (!manualChromeProcess || manualChromeProcess.killed) {
      return { ok: false, error: 'Login browser is not open.' };
    }
    try {
      if (process.platform === 'win32') {
        manualChromeProcess.kill();
      } else {
        process.kill(-manualChromeProcess.pid, 'SIGTERM');
      }
      return { ok: true };
    } catch (e) {
      return {
        ok: false,
        error: e.message || 'Could not close the login browser.',
      };
    }
  });

  ipcMain.handle('desktop:close-all-chrome-windows', async () => {
    try {
      if (process.platform === 'darwin') {
        execFileSync(
          'osascript',
          ['-e', 'tell application "Google Chrome" to quit'],
          {
            stdio: ['ignore', 'ignore', 'ignore'],
          },
        );
      } else if (process.platform === 'win32') {
        execFileSync('taskkill', ['/IM', 'chrome.exe', '/F'], {
          stdio: ['ignore', 'ignore', 'ignore'],
        });
      } else {
        execFileSync('pkill', ['-f', 'google-chrome|chromium'], {
          stdio: ['ignore', 'ignore', 'ignore'],
          shell: true,
        });
      }
      manualChromeProcess = null;
      serviceManager.setManualChromeSession(null);
      persistManualChromeSession(null);
      return { ok: true };
    } catch (e) {
      return {
        ok: false,
        error: e.message || 'Failed to close Chrome windows.',
      };
    }
  });

  ipcMain.handle(
    'desktop:clear-chrome-session',
    async (_event, profilePath) => {
      if (manualChromeProcess && !manualChromeProcess.killed) {
        return {
          ok: false,
          error:
            'Cannot clear profile while Chrome is running. Please close Chrome first.',
        };
      }

      const resolvedProfilePath = resolveProfilePath(profilePath);
      if (!fs.existsSync(resolvedProfilePath)) {
        return { ok: true, message: 'Profile folder does not exist.' };
      }

      try {
        fs.rmSync(resolvedProfilePath, { recursive: true, force: true });
        return { ok: true };
      } catch (e) {
        return {
          ok: false,
          error: `Failed to delete profile folder: ${e.message}. Is Chrome still running?`,
        };
      }
    },
  );

  ipcMain.handle(
    'desktop:check-chrome-session-status',
    async (_event, profilePath) => {
      const resolvedProfilePath = resolveProfilePath(profilePath);
      const exists = fs.existsSync(resolvedProfilePath);
      let sizeMb = 0;
      if (exists) {
        try {
          const cookiesDbPath = findCookiesDb(resolvedProfilePath);
          if (cookiesDbPath) {
            sizeMb = getFileSizeMb(cookiesDbPath);
          }
        } catch (err) {
          // ignore
        }
      }

      return {
        exists,
        isRunning: !!(manualChromeProcess && !manualChromeProcess.killed),
        path: resolvedProfilePath,
        sizeMb,
      };
    },
  );

  ipcMain.handle(
    'desktop:verify-browser-session',
    async (_event, profilePath) => {
      if (manualChromeProcess && !manualChromeProcess.killed) {
        return {
          ok: false,
          error:
            'Please close the manual Chrome session before running verification.',
        };
      }

      const resolvedProfilePath = resolveProfilePath(profilePath);
      if (!fs.existsSync(resolvedProfilePath)) {
        return {
          ok: false,
          error:
            'The browser profile folder does not exist yet. Open a browser session first.',
        };
      }

      try {
        const cookiesDbPath = findCookiesDb(resolvedProfilePath);
        if (!cookiesDbPath) {
          return {
            ok: false,
            error:
              'Could not find the Chrome cookie database in this browser profile yet.',
          };
        }

        const linkedinCookies = queryCookieNames(
          cookiesDbPath,
          '%.linkedin.com%',
        );
        const seekCookies = queryCookieNames(cookiesDbPath, '%.seek.com%');

        return {
          ok: true,
          checkedAt: new Date().toISOString(),
          results: {
            linkedin: summarizeLinkedInSessionFromCookies(linkedinCookies),
            seek: summarizeSeekSessionFromCookies(seekCookies),
          },
        };
      } catch (e) {
        return {
          ok: false,
          error: e.message || 'Failed to verify browser session.',
        };
      }
    },
  );

  serviceManager.on('bot-status', ({ platform, state }) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('desktop:bot-status', { platform, state });
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
    await loadFallbackPage('Dashboard URL is not configured yet.');
    return;
  }

  try {
    await mainWindow.loadURL(desktopConfig.dashboard.url);
  } catch (error) {
    await loadFallbackPage(
      error instanceof Error ?
        error.message
      : 'Could not load the configured dashboard',
    );
  }
}

async function loadFallbackPage(reason) {
  if (!mainWindow || mainWindow.isDestroyed()) {
    return;
  }

  loadingFallback = true;
  await mainWindow.loadFile(path.join(__dirname, 'fallback.html'));
  mainWindow.webContents.once('did-finish-load', () => {
    mainWindow.webContents.send('desktop:fallback-reason', {
      reason,
      dashboardUrl: desktopConfig.dashboard.url,
      apiUrl: desktopConfig.api.url,
    });
  });
}

app
  .whenReady()
  .then(async () => {
    configStore = new DesktopConfigStore(app.getPath('userData'));
    manualChromeSessionFile = path.join(
      app.getPath('userData'),
      'manual-chrome-session.json',
    );
    connectionConfig = configStore.load();
    desktopConfig = getDesktopConfig({ connectionConfig });
    serviceManager = new ServiceManager(desktopConfig);
    registerIpc();
    await serviceManager.startManagedServices();
    createWindow();

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
      }
    });
  })
  .catch((error) => {
    dialog.showErrorBox('Desktop startup failed', error.message);
    app.quit();
  });

app.on('window-all-closed', () => {
  serviceManager.stopManagedServices();
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  serviceManager.stopManagedServices();
});
