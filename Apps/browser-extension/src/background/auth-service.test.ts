import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  extensionRedirectWithState,
  getAuthStatus,
  getValidAuthSession,
  openLogin,
  refreshAuthSessionOnce,
} from "./auth-service";
import { apiClient } from "./api-client";

const localStorage = new Map<string, unknown>();

beforeEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
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
  vi.stubGlobal("fetch", vi.fn());
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
});

describe("auth lifecycle and silent refresh", () => {
  it("stores the access token and refresh token returned by the web session", async () => {
    vi.mocked(chrome.identity.launchWebAuthFlow).mockImplementation(async ({ url }) => {
      const loginUrl = new URL(url);
      const callback = new URL(loginUrl.searchParams.get("extension_redirect")!);
      callback.hash = new URLSearchParams({
        access_token: "access-token",
        refresh_token: "refresh-token",
        expires_at: String(Math.floor(Date.now() / 1000) + 3600),
        user_id: "user-id",
        email: "user@example.com",
      }).toString();
      return callback.toString();
    });

    await expect(openLogin()).resolves.toMatchObject({ connected: true });
    expect(localStorage.get("jobby.auth.session")).toEqual({
      accessToken: "access-token",
      refreshToken: "refresh-token",
      expiresAt: expect.any(String),
      user: { id: "user-id", email: "user@example.com" },
    });
  });

  it("returns the existing valid session without refreshing or opening a login flow", async () => {
    const session = {
      accessToken: "valid-token",
      refreshToken: "refresh-token",
      expiresAt: new Date(Date.now() + 3600_000).toISOString(),
      user: { id: "user-id", email: "user@example.com" },
    };
    localStorage.set("jobby.auth.session", session);

    const validSession = await getValidAuthSession();
    expect(validSession).toEqual(session);
    expect(fetch).not.toHaveBeenCalled();
    expect(chrome.identity.launchWebAuthFlow).not.toHaveBeenCalled();
  });

  it("silently refreshes an expired access token using the refresh token without opening a login flow", async () => {
    localStorage.set("jobby.auth.session", {
      accessToken: "expired-token",
      refreshToken: "valid-refresh-token",
      expiresAt: new Date(Date.now() - 60_000).toISOString(),
      user: { id: "user-id", email: "user@example.com" },
    });

    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          access_token: "new-access-token",
          refresh_token: "new-refresh-token",
          expires_in: 3600,
          user: { id: "user-id", email: "user@example.com" },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );

    const refreshed = await getValidAuthSession();
    expect(refreshed).toMatchObject({
      accessToken: "new-access-token",
      refreshToken: "new-refresh-token",
      user: { id: "user-id", email: "user@example.com" },
    });
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(chrome.identity.launchWebAuthFlow).not.toHaveBeenCalled();
    expect(localStorage.get("jobby.auth.session")).toMatchObject({
      accessToken: "new-access-token",
      refreshToken: "new-refresh-token",
    });
  });

  it("deduplicates 10 concurrent refresh calls into a single network request", async () => {
    localStorage.set("jobby.auth.session", {
      accessToken: "expired-token",
      refreshToken: "refresh-token",
      expiresAt: new Date(Date.now() - 60_000).toISOString(),
      user: { id: "user-id", email: "user@example.com" },
    });

    vi.mocked(fetch).mockImplementation(async () => {
      await new Promise((resolve) => setTimeout(resolve, 20));
      return new Response(
        JSON.stringify({
          access_token: "shared-refreshed-token",
          refresh_token: "shared-next-refresh",
          expires_in: 3600,
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    });

    const results = await Promise.all(
      Array.from({ length: 10 }, () => refreshAuthSessionOnce()),
    );

    expect(fetch).toHaveBeenCalledTimes(1);
    expect(chrome.identity.launchWebAuthFlow).not.toHaveBeenCalled();
    for (const res of results) {
      expect(res?.accessToken).toBe("shared-refreshed-token");
      expect(res?.refreshToken).toBe("shared-next-refresh");
    }
  });

  it("clears an expired session when refresh token is rejected and does not open a login flow", async () => {
    localStorage.set("jobby.auth.session", {
      accessToken: "expired-token",
      refreshToken: "invalid-refresh-token",
      expiresAt: new Date(Date.now() - 60_000).toISOString(),
      user: { id: "user-id", email: "user@example.com" },
    });

    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ error: "invalid_grant" }), { status: 400 }),
    );

    await expect(getAuthStatus()).resolves.toEqual({ connected: false });
    expect(localStorage.has("jobby.auth.session")).toBe(false);
    expect(chrome.identity.launchWebAuthFlow).not.toHaveBeenCalled();
  });

  it("does not open an auth flow while checking a missing session", async () => {
    await expect(getAuthStatus()).resolves.toEqual({ connected: false });
    expect(chrome.identity.launchWebAuthFlow).not.toHaveBeenCalled();
  });

  it("does not open an auth flow while resolving a missing API session", async () => {
    await expect(getValidAuthSession()).resolves.toBeNull();
    expect(chrome.identity.launchWebAuthFlow).not.toHaveBeenCalled();
  });

  it("fails unauthenticated API client requests without opening a login flow", async () => {
    await expect(apiClient.request("/api/test")).rejects.toThrow();
    expect(chrome.identity.launchWebAuthFlow).not.toHaveBeenCalled();
  });

  it("retries an authenticated API request once after receiving a 401 by silently refreshing", async () => {
    localStorage.set("jobby.auth.session", {
      accessToken: "initial-token",
      refreshToken: "valid-refresh",
      expiresAt: new Date(Date.now() + 3600_000).toISOString(),
      user: { id: "user-id", email: "user@example.com" },
    });

    vi.mocked(fetch).mockImplementation(async (input, init) => {
      const url = String(input);
      if (url.includes("/api/test")) {
        const headers = init?.headers as Headers | undefined;
        const auth = headers?.get?.("Authorization") ?? (headers as Record<string, string> | undefined)?.["Authorization"];
        if (auth === "Bearer initial-token") {
          return new Response(JSON.stringify({ detail: "Token revoked" }), {
            status: 401,
            headers: { "Content-Type": "application/json" },
          });
        }
        if (auth === "Bearer retried-token") {
          return new Response(JSON.stringify({ data: "success" }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        }
      }

      if (url.includes("grant_type=refresh_token") || url.includes("/api/auth/refresh")) {
        return new Response(
          JSON.stringify({
            access_token: "retried-token",
            refresh_token: "next-refresh",
            expires_in: 3600,
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }

      return new Response("Not found", { status: 404 });
    });

    const res = await apiClient.request<{ data: string }>("/api/test");
    expect(res).toEqual({ data: "success" });
    expect(chrome.identity.launchWebAuthFlow).not.toHaveBeenCalled();
    expect(localStorage.get("jobby.auth.session")).toMatchObject({
      accessToken: "retried-token",
    });
  });

  it("throws 401 and does not open a login flow when API returns 401 and refresh fails", async () => {
    localStorage.set("jobby.auth.session", {
      accessToken: "initial-token",
      refreshToken: "revoked-refresh",
      expiresAt: new Date(Date.now() + 3600_000).toISOString(),
      user: { id: "user-id", email: "user@example.com" },
    });

    vi.mocked(fetch).mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes("/api/test")) {
        return new Response(JSON.stringify({ detail: "Token expired" }), {
          status: 401,
          headers: { "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ error: "invalid_grant" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    });

    await expect(apiClient.request("/api/test")).rejects.toMatchObject({
      status: 401,
    });
    expect(chrome.identity.launchWebAuthFlow).not.toHaveBeenCalled();
    expect(localStorage.has("jobby.auth.session")).toBe(false);
  });
});
