import {
  clearAuthSession,
  getAuthSession,
  getAuthStatus as readAuthStatus,
  setAuthSession,
  setExplicitDisconnect,
  isExplicitlyDisconnected,
} from "./session-store";
import type { AuthSession, AuthStatus } from "../shared/contracts/auth";

const REFRESH_SKEW_MS = 60_000;

class AuthRefreshError extends Error {
  constructor(message: string, readonly definitive: boolean) {
    super(message);
    this.name = "AuthRefreshError";
  }
}

type SessionPayload = {
  access_token: string;
  refresh_token: string;
  expires_at?: number;
  expires_in?: number;
  user?: {
    id?: string;
    email?: string;
  };
};

function webAppUrl(): string {
  return (import.meta.env.VITE_WEB_APP_URL || "http://localhost:3000").replace(/\/$/, "");
}

export function extensionRedirectWithState(redirectUri: string, state: string): string {
  const callback = new URL(redirectUri);
  callback.searchParams.set("state", state);
  return callback.toString();
}

function supabaseConfig(): { url: string; anonKey: string } {
  const url = import.meta.env.VITE_SUPABASE_URL?.trim();
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim();
  if (!url || !anonKey) {
    throw new Error("Supabase is not configured for the extension. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.");
  }
  return { url: url.replace(/\/$/, ""), anonKey };
}

function sessionFromPayload(payload: SessionPayload, previousUser?: AuthSession["user"]): AuthSession {
  const email = payload.user?.email || previousUser?.email;
  const id = payload.user?.id || previousUser?.id;
  if (!email || !id) throw new Error("The Supabase session did not include complete user information.");

  const expiresAtSeconds = payload.expires_at ??
    Math.floor(Date.now() / 1000) + (payload.expires_in ?? 3600);

  return {
    accessToken: payload.access_token,
    refreshToken: payload.refresh_token,
    expiresAt: new Date(expiresAtSeconds * 1000).toISOString(),
    user: { id, email },
  };
}

function errorMessage(payload: unknown, fallback: string): string {
  if (typeof payload === "object" && payload !== null) {
    const detail = (payload as { msg?: unknown; error_description?: unknown; error?: unknown }).msg ??
      (payload as { error_description?: unknown }).error_description ??
      (payload as { error?: unknown }).error;
    if (typeof detail === "string" && detail.trim()) return detail.trim();
  }
  return fallback;
}

async function saveSession(payload: SessionPayload, previousUser?: AuthSession["user"]): Promise<AuthSession> {
  const session = sessionFromPayload(payload, previousUser);
  await setAuthSession(session);
  return session;
}

export async function openLogin(interactive = true): Promise<AuthStatus> {
  supabaseConfig();
  const state = crypto.randomUUID();
  const callback = extensionRedirectWithState(
    chrome.identity.getRedirectURL("jobby-auth"),
    state,
  );

  // When interactive = true, load the full login page for user interaction.
  // When interactive = false (silent restore), directly invoke the extension callback endpoint
  // so the server immediately 302 redirects back with tokens or error, taking <15ms with 0 persistent memory.
  const targetUrl = interactive
    ? new URL(`${webAppUrl()}/login`)
    : new URL(`${webAppUrl()}/auth/extension-callback`);

  if (interactive) {
    targetUrl.searchParams.set("extension_redirect", callback);
  } else {
    targetUrl.searchParams.set("redirect_uri", callback);
  }

  const responseUrl = await chrome.identity.launchWebAuthFlow({
    url: targetUrl.toString(),
    interactive,
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
  const expiresAt = Number(hash.get("expires_at"));
  if (!accessToken || !refreshToken || !userId || !email || !Number.isFinite(expiresAt)) {
    throw new Error("The Jobby login callback did not include a complete Supabase session.");
  }

  await saveSession({
    access_token: accessToken,
    refresh_token: refreshToken,
    expires_at: expiresAt,
    user: { id: userId, email },
  });
  await setExplicitDisconnect(false);
  return getAuthStatus();
}

let restoreInFlight: Promise<AuthStatus | null> | null = null;
let lastRestoreAttempt = 0;
const RESTORE_COOLDOWN_MS = 15_000;

export async function restoreWebSession(): Promise<AuthStatus | null> {
  if (restoreInFlight) return restoreInFlight;
  if (Date.now() - lastRestoreAttempt < RESTORE_COOLDOWN_MS) {
    return null;
  }
  lastRestoreAttempt = Date.now();

  restoreInFlight = (async () => {
    try {
      if (await isExplicitlyDisconnected()) {
        return null;
      }
      return await openLogin(false);
    } catch {
      // A non-interactive flow normally fails when the Jobby web session is not
      // present. That is expected; the panel can then offer the regular login.
      return null;
    } finally {
      restoreInFlight = null;
    }
  })();

  return restoreInFlight;
}

export async function refreshAuthSession(): Promise<AuthSession | null> {
  if (refreshInFlight) return refreshInFlight;
  refreshInFlight = refreshAuthSessionOnce().finally(() => {
    refreshInFlight = null;
  });
  return refreshInFlight;
}

let refreshInFlight: Promise<AuthSession | null> | null = null;

async function refreshAuthSessionOnce(): Promise<AuthSession | null> {
  const current = await getAuthSession();
  if (!current) return null;

  const { url, anonKey } = supabaseConfig();
  const response = await fetch(`${url}/auth/v1/token?grant_type=refresh_token`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      apikey: anonKey,
    },
    body: JSON.stringify({ refresh_token: current.refreshToken }),
  });
  const payload = await response.json().catch(() => null) as unknown;
  if (!response.ok) {
    // Only a definitive token rejection should disconnect the extension.
    // Network outages and backend/Supabase 5xx responses are recoverable and
    // must not force the user through the browser login flow again.
    if ([400, 401, 403].includes(response.status)) {
      throw new AuthRefreshError(
        errorMessage(payload, "Your Jobby session expired. Please sign in again."),
        true,
      );
    }
    throw new AuthRefreshError(
      errorMessage(payload, "Could not refresh the Jobby session. Please try again shortly."),
      false,
    );
  }

  return saveSession(payload as SessionPayload, current.user);
}

export async function getValidAuthSession(): Promise<AuthSession | null> {
  const current = await getAuthSession();
  if (!current) return null;
  if (Date.parse(current.expiresAt) > Date.now() + REFRESH_SKEW_MS) return current;
  try {
    return await refreshAuthSession();
  } catch (error) {
    // Supabase rotates refresh tokens. If another client (usually the web app)
    // rotated this token first, recover the current browser session before
    // asking the user to sign in again.
    if (error instanceof AuthRefreshError && error.definitive) {
      const restored = await restoreWebSession();
      if (restored?.connected) return getAuthSession();
      await clearAuthSession();
    }
    throw error;
  }
}

export async function disconnect(): Promise<void> {
  await clearAuthSession();
  await setExplicitDisconnect(true);
}

export async function getAuthStatus(): Promise<AuthStatus> {
  const current = await getAuthSession();
  if (current && Date.parse(current.expiresAt) <= Date.now()) {
    try {
      await refreshAuthSession();
    } catch {
      // Keep the persisted refresh token for a later silent retry.
    }
  }
  return readAuthStatus();
}
