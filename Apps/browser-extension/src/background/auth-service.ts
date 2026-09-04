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

function webAppUrl(): string {
  return (import.meta.env.VITE_WEB_APP_URL || "http://localhost:3000").replace(/\/$/, "");
}

export function extensionRedirectWithState(redirectUri: string, state: string): string {
  const callback = new URL(redirectUri);
  callback.searchParams.set("state", state);
  return callback.toString();
}

export async function openLogin(interactive = true): Promise<AuthStatus> {
  const state = crypto.randomUUID();
  const callback = extensionRedirectWithState(
    chrome.identity.getRedirectURL("jobby-auth"),
    state,
  );

  // When interactive = true, load the full login page for user interaction.
  // When interactive = false (silent restore), directly invoke the extension callback endpoint
  // so the server immediately redirects back with an access token or error.
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
  const userId = hash.get("user_id");
  const email = hash.get("email");
  const expiresAtValue = hash.get("expires_at");
  const expiresAt = Number(expiresAtValue);
  if (!accessToken || !userId || !email || !expiresAtValue || !Number.isFinite(expiresAt)) {
    throw new Error("The Jobby login callback did not include a complete Supabase session.");
  }

  await setAuthSession({
    accessToken,
    expiresAt: new Date(expiresAt * 1000).toISOString(),
    user: { id: userId, email },
  });
  await setExplicitDisconnect(false);
  return readAuthStatus();
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

export async function getValidAuthSession(): Promise<AuthSession | null> {
  const current = await getAuthSession();
  if (current && Date.parse(current.expiresAt) > Date.now() + REFRESH_SKEW_MS) {
    return current;
  }

  const restored = await restoreWebSession();
  if (restored?.connected) {
    const next = await getAuthSession();
    if (next && Date.parse(next.expiresAt) > Date.now() + REFRESH_SKEW_MS) {
      return next;
    }
  }

  await clearAuthSession();
  return null;
}

export async function disconnect(): Promise<void> {
  await clearAuthSession();
  await setExplicitDisconnect(true);
}

export async function getAuthStatus(): Promise<AuthStatus> {
  const current = await getAuthSession();
  if (current && Date.parse(current.expiresAt) > Date.now() + REFRESH_SKEW_MS) {
    return readAuthStatus();
  }

  const restored = await restoreWebSession();
  if (restored?.connected) return restored;

  await clearAuthSession();
  return { connected: false };
}
