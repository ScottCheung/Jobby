import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  extensionRedirectWithState,
  getAuthStatus,
  getValidAuthSession,
  openLogin,
} from "./auth-service";

const localStorage = new Map<string, unknown>();

beforeEach(() => {
  localStorage.clear();
  vi.stubGlobal("chrome", {
    identity: {
      getRedirectURL: () => "https://abcdefghijklmnopabcdefghijklmnop.chromiumapp.org/jobby-auth",
      launchWebAuthFlow: vi.fn(),
    },
    storage: {
      local: {
        get: async (key: string) => ({ [key]: localStorage.get(key) }),
        set: async (values: Record<string, unknown>) => {
          Object.entries(values).forEach(([key, value]) => localStorage.set(key, value));
        },
        remove: async (key: string) => {
          localStorage.delete(key);
        },
      },
    },
  });
});

describe("extensionRedirectWithState", () => {
  it("preserves the callback target and forwards the OAuth state", () => {
    const redirect = extensionRedirectWithState(
      "https://abcdefghijklmnopabcdefghijklmnop.chromiumapp.org/jobby-auth?source=panel",
      "session-state",
    );
    const callback = new URL(redirect);

    expect(callback.searchParams.get("source")).toBe("panel");
    expect(callback.searchParams.get("state")).toBe("session-state");
  });

  it("stores only a short-lived access token returned by the web session", async () => {
    vi.mocked(chrome.identity.launchWebAuthFlow).mockImplementation(async ({ url }) => {
      const loginUrl = new URL(url);
      const callback = new URL(loginUrl.searchParams.get("extension_redirect")!);
      callback.hash = new URLSearchParams({
        access_token: "access-token",
        expires_at: String(Math.floor(Date.now() / 1000) + 3600),
        user_id: "user-id",
        email: "user@example.com",
      }).toString();
      return callback.toString();
    });

    await expect(openLogin()).resolves.toMatchObject({ connected: true });
    expect(localStorage.get("jobby.auth.session")).toEqual({
      accessToken: "access-token",
      expiresAt: expect.any(String),
      user: { id: "user-id", email: "user@example.com" },
    });
  });

  it("does not open an auth flow while checking a missing session", async () => {
    await expect(getAuthStatus()).resolves.toEqual({ connected: false });
    expect(chrome.identity.launchWebAuthFlow).not.toHaveBeenCalled();
  });

  it("clears an expired session without opening a login flow", async () => {
    localStorage.set("jobby.auth.session", {
      accessToken: "expired-token",
      expiresAt: new Date(Date.now() - 60_000).toISOString(),
      user: { id: "user-id", email: "user@example.com" },
    });

    await expect(getAuthStatus()).resolves.toEqual({ connected: false });
    expect(localStorage.has("jobby.auth.session")).toBe(false);
    expect(chrome.identity.launchWebAuthFlow).not.toHaveBeenCalled();
  });

  it("does not open an auth flow while resolving a missing API session", async () => {
    await expect(getValidAuthSession()).resolves.toBeNull();
    expect(chrome.identity.launchWebAuthFlow).not.toHaveBeenCalled();
  });
});
