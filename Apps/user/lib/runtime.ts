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
      ) => Promise<{ ok: boolean; error?: string; state?: DesktopBotState }>;
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
    };
  }
}

let cachedApiBaseUrl: string | null = null;

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

  cachedApiBaseUrl =
    process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://127.0.0.1:8000';
  return cachedApiBaseUrl;
}

export function isDesktopRuntime(): boolean {
  return typeof window !== 'undefined' && Boolean(window.autoJobDesktop);
}
