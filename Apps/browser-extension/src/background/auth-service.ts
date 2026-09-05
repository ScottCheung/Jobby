import {
  clearAuthSession,
  getAuthSession,
  getAuthStatus as readAuthStatus,
  setAuthSession,
  setExplicitDisconnect,
} from "./session-store";
import type { AuthSession, AuthStatus } from "../shared/contracts/auth";

const REFRESH_SKEW_MS = 60_000;

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

  refreshInFlight = (async () => {
    try {
      return await performRefresh();
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
    await clearAuthSession();
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
      await clearAuthSession();
      return null;
    }

    const data = await response.json();
    const nextAccessToken = data.access_token;
    const nextRefreshToken = data.refresh_token;
    if (!nextAccessToken || !nextRefreshToken) {
      await clearAuthSession();
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
        id: data.user?.id || current.user.id,
        email: data.user?.email || current.user.email,
      },
    };

    await setAuthSession(nextSession);
    return nextSession;
  } catch {
    return null;
  }
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

  return { connected: false };
}
