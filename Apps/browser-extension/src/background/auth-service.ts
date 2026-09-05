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

export async function getValidAuthSession(): Promise<AuthSession | null> {
  const current = await getAuthSession();
  if (current && Date.parse(current.expiresAt) > Date.now() + REFRESH_SKEW_MS) {
    return current;
  }

  if (current) await clearAuthSession();
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

  if (current) await clearAuthSession();
  return { connected: false };
}
