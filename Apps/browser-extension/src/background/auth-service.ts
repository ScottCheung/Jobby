import {
  clearAuthSessionIfCurrent,
  clearAuthSession,
  commitAuthSessionIfCurrent,
  getAuthRefreshCompletedAt,
  getAuthSession,
  getAuthStatus as readAuthStatus,
  setAuthRefreshCompletedAt,
  setAuthSession,
  setExplicitDisconnect,
} from "./session-store";
import type { AuthSession, AuthStatus } from "../shared/contracts/auth";

const REFRESH_SKEW_MS = 60_000;
const REFRESH_COOLDOWN_MS = 5_000;

function webAppUrl(): string {
  return (import.meta.env.VITE_WEB_APP_URL || "http://localhost:3000").replace(/\/$/, "");
}

function supabaseUrl(): string {
  return (import.meta.env.VITE_SUPABASE_URL || "").replace(/\/$/, "");
}

function supabaseAnonKey(): string {
  return import.meta.env.VITE_SUPABASE_ANON_KEY || "";
}

function refreshEndpoint(): string {
  const sbUrl = supabaseUrl();
  if (sbUrl) {
    return `${sbUrl}/auth/v1/token?grant_type=refresh_token`;
  }
  return `${webAppUrl()}/api/auth/refresh`;
}

export function extensionRedirectWithState(redirectUri: string, state: string): string {
  const callback = new URL(redirectUri);
  callback.searchParams.set("state", state);
  return callback.toString();
}

export async function openLogin(): Promise<AuthStatus> {
  const state = crypto.randomUUID();
  const callback = extensionRedirectWithState(
    chrome.identity.getRedirectURL("jobby-auth"),
    state,
  );

  const targetUrl = new URL(`${webAppUrl()}/login`);
  targetUrl.searchParams.set("extension_redirect", callback);

  const responseUrl = await chrome.identity.launchWebAuthFlow({
    url: targetUrl.toString(),
    interactive: true,
  });
  if (!responseUrl) throw new Error("The Jobby login window did not return a session.");

  const callbackUrl = new URL(responseUrl);
  if (callbackUrl.searchParams.get("state") !== state) {
    throw new Error("The Jobby login callback state did not match.");
  }

  const hash = new URLSearchParams(callbackUrl.hash.replace(/^#/, ""));
  const callbackError = hash.get("error_description") || hash.get("error");
  if (callbackError) throw new Error(callbackError);

  const accessToken = hash.get("access_token");
  const refreshToken = hash.get("refresh_token");
  const userId = hash.get("user_id");
  const email = hash.get("email");
  const expiresAtValue = hash.get("expires_at");
  const expiresAt = Number(expiresAtValue);
  if (!accessToken || !refreshToken || !userId || !email || !expiresAtValue || !Number.isFinite(expiresAt)) {
    throw new Error("The Jobby login callback did not include a complete Supabase session.");
  }

  await setAuthSession({
    accessToken,
    refreshToken,
    expiresAt: new Date(expiresAt * 1000).toISOString(),
    user: { id: userId, email },
  });
  await setExplicitDisconnect(false);
  return readAuthStatus();
}

let refreshInFlight: Promise<AuthSession | null> | null = null;

export async function refreshAuthSessionOnce(): Promise<AuthSession | null> {
  if (refreshInFlight) {
    return refreshInFlight;
  }

  const lastRefreshCompletedAt = await getAuthRefreshCompletedAt();
  if (refreshInFlight) {
    return refreshInFlight;
  }
  if (
    lastRefreshCompletedAt > 0 &&
    Date.now() - lastRefreshCompletedAt < REFRESH_COOLDOWN_MS
  ) {
    return getAuthSession();
  }

  refreshInFlight = (async () => {
    try {
      const session = await performRefresh();
      if (session) {
        await setAuthRefreshCompletedAt(Date.now());
      }
      return session;
    } finally {
      refreshInFlight = null;
    }
  })();

  return refreshInFlight;
}

export async function refreshAuthSession(_current?: AuthSession): Promise<AuthSession | null> {
  return refreshAuthSessionOnce();
}

async function performRefresh(): Promise<AuthSession | null> {
  const current = await getAuthSession();
  if (!current?.refreshToken) {
    return null;
  }

  const endpoint = refreshEndpoint();
  const anonKey = supabaseAnonKey();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (anonKey) {
    headers["apikey"] = anonKey;
    headers["Authorization"] = `Bearer ${anonKey}`;
  }

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers,
      body: JSON.stringify({ refresh_token: current.refreshToken }),
    });

    if (!response.ok) {
      const error = await readRefreshError(response);
      if (isDefinitelyRevokedRefreshToken(response.status, error)) {
        await clearAuthSessionIfCurrent(current.refreshToken);
      }
      return null;
    }

    const data = await readRefreshResponse(response);
    const nextAccessToken = data?.access_token;
    const nextRefreshToken = data?.refresh_token;
    if (
      typeof nextAccessToken !== "string" ||
      typeof nextRefreshToken !== "string" ||
      !nextAccessToken ||
      !nextRefreshToken
    ) {
      return null;
    }

    const expiresAt =
      data.expires_at ?
        new Date(Number(data.expires_at) * 1000).toISOString()
      : new Date(Date.now() + (Number(data.expires_in) || 3600) * 1000).toISOString();

    const nextSession: AuthSession = {
      accessToken: nextAccessToken,
      refreshToken: nextRefreshToken,
      expiresAt,
      user: {
        id: typeof data.user?.id === "string" ? data.user.id : current.user.id,
        email: typeof data.user?.email === "string" ? data.user.email : current.user.email,
      },
    };

    return commitAuthSessionIfCurrent(current.refreshToken, nextSession);
  } catch {
    return null;
  }
}

type RefreshResponse = {
  access_token?: unknown;
  refresh_token?: unknown;
  expires_at?: unknown;
  expires_in?: unknown;
  user?: { id?: unknown; email?: unknown };
};

async function readRefreshResponse(response: Response): Promise<RefreshResponse | null> {
  try {
    const data: unknown = await response.json();
    return typeof data === "object" && data !== null ? data as RefreshResponse : null;
  } catch {
    return null;
  }
}

async function readRefreshError(response: Response): Promise<Record<string, unknown>> {
  try {
    const data: unknown = await response.json();
    return typeof data === "object" && data !== null ? data as Record<string, unknown> : {};
  } catch {
    return {};
  }
}

function isDefinitelyRevokedRefreshToken(
  status: number,
  error: Record<string, unknown>,
): boolean {
  if (status !== 400) return false;

  const errorCode = [error.error, error.error_code]
    .filter((value): value is string => typeof value === "string")
    .map((value) => value.toLowerCase());
  if (errorCode.includes("invalid_grant") || errorCode.includes("invalid_refresh_token")) {
    return true;
  }

  const description = [error.error_description, error.message, error.msg]
    .filter((value): value is string => typeof value === "string")
    .join(" ")
    .toLowerCase();
  return (
    description.includes("refresh token") &&
    /(invalid|revoked|not found|expired|already used)/.test(description)
  );
}

export async function getValidAuthSession(): Promise<AuthSession | null> {
  const current = await getAuthSession();
  if (!current) return null;

  if (Date.parse(current.expiresAt) > Date.now() + REFRESH_SKEW_MS) {
    return current;
  }

  const refreshed = await refreshAuthSessionOnce();
  if (refreshed) return refreshed;

  if (Date.parse(current.expiresAt) > Date.now()) {
    return current;
  }

  return null;
}

export async function disconnect(): Promise<void> {
  await clearAuthSession();
  await setExplicitDisconnect(true);
}

export async function getAuthStatus(): Promise<AuthStatus> {
  const current = await getAuthSession();
  if (!current) return { connected: false };

  if (Date.parse(current.expiresAt) > Date.now() + REFRESH_SKEW_MS) {
    return readAuthStatus();
  }

  const refreshed = await refreshAuthSessionOnce();
  if (refreshed) {
    return readAuthStatus();
  }

  const latest = await getAuthSession();
  if (!latest) return { connected: false };

  return {
    connected: true,
    reconnecting: true,
    expiresAt: latest.expiresAt,
    user: latest.user,
  };
}
