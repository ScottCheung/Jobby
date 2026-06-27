import type {
  DesktopBotPlatform,
  DesktopBotState,
  DesktopConnectionConfig,
  DesktopConnectionConfigResult,
  DesktopRuntimeInfo,
  DesktopServiceStatus,
} from './types';

declare global {
  interface Window {
    autoJobDesktop?: {
      appName?: string;
      getRuntimeInfo?: () => Promise<DesktopRuntimeInfo>;
      getServiceStatus?: () => Promise<DesktopServiceStatus>;
      getConnectionConfig?: () => Promise<DesktopConnectionConfig>;
      saveConnectionConfig?: (
        payload: DesktopConnectionConfig,
      ) => Promise<DesktopConnectionConfigResult>;
      resetConnectionConfig?: () => Promise<DesktopConnectionConfigResult>;
      onServiceStatus?: (callback: (payload: DesktopServiceStatus) => void) => () => void;
      startBot?: (
        platform: DesktopBotPlatform,
      ) => Promise<{
        ok: boolean;
        error?: string;
        code?: string;
        state?: DesktopBotState;
      }>;
      stopBot?: (
        platform: DesktopBotPlatform,
      ) => Promise<{ ok: boolean; error?: string }>;
      getBotState?: (platform: DesktopBotPlatform) => Promise<DesktopBotState>;
      onBotStatus?: (
        callback: (payload: {
          platform: DesktopBotPlatform;
          state: DesktopBotState;
        }) => void,
      ) => () => void;
      openChromeSession?: (profilePath: string) => Promise<{
        ok: boolean;
        error?: string;
        code?: string;
      }>;
      closeChromeSession?: () => Promise<{ ok: boolean; error?: string }>;
      closeAllChromeWindows?: () => Promise<{ ok: boolean; error?: string }>;
      clearChromeSession?: (profilePath: string) => Promise<{ ok: boolean; error?: string; message?: string }>;
      checkChromeSessionStatus?: (profilePath: string) => Promise<{
        exists: boolean;
        isRunning: boolean;
        path: string;
        sizeMb: number;
      }>;
      verifyBrowserSession?: (profilePath: string) => Promise<{
        ok: boolean;
        error?: string;
        checkedAt?: string;
        results?: {
          linkedin: {
            loggedIn: boolean;
            detail: string;
          };
          seek: {
            loggedIn: boolean;
            detail: string;
          };
        };
      }>;
      onManualChromeExit?: (callback: () => void) => () => void;
    };
  }
}

let cachedApiBaseUrl: string | null = null;
let cachedSseBaseUrl: string | null = null;

export async function resolveApiBaseUrl(): Promise<string> {
  if (cachedApiBaseUrl) {
    return cachedApiBaseUrl;
  }

  if (typeof window !== 'undefined' && window.autoJobDesktop?.getRuntimeInfo) {
    try {
      const runtimeInfo = await window.autoJobDesktop.getRuntimeInfo();
      const desktopApiUrl = runtimeInfo?.api?.url;
      if (desktopApiUrl) {
        cachedApiBaseUrl = desktopApiUrl;
        return desktopApiUrl;
      }
    } catch {
      // Fall back to the web env value if Electron runtime info is not ready.
    }
  }

  // In the web app we proxy API traffic through Next so browser requests stay same-origin.
  cachedApiBaseUrl = '';
  return cachedApiBaseUrl;
}

export async function resolveSseBaseUrl(): Promise<string> {
  if (cachedSseBaseUrl) {
    return cachedSseBaseUrl;
  }

  if (typeof window !== 'undefined' && window.autoJobDesktop?.getRuntimeInfo) {
    try {
      const runtimeInfo = await window.autoJobDesktop.getRuntimeInfo();
      const desktopApiUrl = runtimeInfo?.api?.url;
      if (desktopApiUrl) {
        cachedSseBaseUrl = desktopApiUrl;
        return desktopApiUrl;
      }
    } catch {
      // Fall back to the public API URL or same-origin path if desktop runtime info is not ready.
    }
  }

  const envUrl = process.env.NEXT_PUBLIC_API_BASE_URL;
  if (envUrl) {
    cachedSseBaseUrl = envUrl;
  } else if (typeof window !== 'undefined') {
    const hostname = window.location.hostname;
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      cachedSseBaseUrl = `http://${hostname}:8000`;
    } else {
      cachedSseBaseUrl = '';
    }
  } else {
    cachedSseBaseUrl = '';
  }
  return cachedSseBaseUrl;
}

export function isDesktopRuntime(): boolean {
  return typeof window !== 'undefined' && Boolean(window.autoJobDesktop);
}
