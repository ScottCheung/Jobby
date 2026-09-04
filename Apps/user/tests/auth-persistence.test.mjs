import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { createBrowserClient } from '@supabase/ssr';

const DAY_MS = 24 * 60 * 60 * 1000;

function accessToken(expiresAt, subject = 'test-user') {
  const encode = (value) =>
    Buffer.from(JSON.stringify(value)).toString('base64url');

  return `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({
    aud: 'authenticated',
    exp: expiresAt,
    role: 'authenticated',
    sub: subject,
  })}.test-signature`;
}

function jsonResponse(body) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
}

function createCookieJar() {
  const cookies = new Map();

  return {
    entries: cookies,
    getAll: async () =>
      Array.from(cookies, ([name, cookie]) => ({ name, value: cookie.value })),
    setAll: async (cookiesToSet) => {
      for (const { name, value, options } of cookiesToSet) {
        if (options?.maxAge === 0) {
          cookies.delete(name);
        } else {
          cookies.set(name, { value, options });
        }
      }
    },
  };
}

function createTestClient(cookieJar, fetch) {
  return createBrowserClient(
    'https://test-project.supabase.co',
    'test-anon-key',
    {
      isSingleton: false,
      cookies: {
        getAll: cookieJar.getAll,
        setAll: cookieJar.setAll,
      },
      global: { fetch },
      auth: { autoRefreshToken: false },
    },
  );
}

test('saved login survives a restart and refreshes an expired access token the next day', async (t) => {
  const originalNow = Date.now;
  const signedInAt = Date.UTC(2026, 7, 31, 0, 0, 0);
  let now = signedInAt;
  Date.now = () => now;
  t.after(() => {
    Date.now = originalNow;
  });

  const user = {
    id: 'test-user',
    aud: 'authenticated',
    role: 'authenticated',
    email: 'test@example.com',
    app_metadata: {},
    user_metadata: {},
    created_at: new Date(signedInAt).toISOString(),
  };
  const firstAccessToken = accessToken(
    Math.floor(signedInAt / 1000) + 60 * 60,
  );
  const refreshedAccessToken = accessToken(
    Math.floor((signedInAt + DAY_MS) / 1000) + 60 * 60,
  );
  const cookieJar = createCookieJar();
  let refreshRequests = 0;

  const fetch = async (input) => {
    const url = String(input);

    if (url.endsWith('/auth/v1/user')) {
      return jsonResponse({ user });
    }

    if (url.includes('/auth/v1/token?grant_type=refresh_token')) {
      refreshRequests += 1;
      return jsonResponse({
        access_token: refreshedAccessToken,
        refresh_token: 'refresh-token-2',
        expires_in: 60 * 60,
        token_type: 'bearer',
        user,
      });
    }

    throw new Error(`Unexpected auth request: ${url}`);
  };

  const firstClient = createTestClient(cookieJar, fetch);
  const { error: signInError } = await firstClient.auth.setSession({
    access_token: firstAccessToken,
    refresh_token: 'refresh-token-1',
  });

  assert.equal(signInError, null);
  assert.ok(cookieJar.entries.size > 0, 'the session should be stored in cookies');
  assert.ok(
    Array.from(cookieJar.entries.values()).every(
      ({ options }) => options.maxAge > DAY_MS / 1000,
    ),
    'the saved cookie must live longer than one day',
  );

  now += DAY_MS;

  const restartedClient = createTestClient(cookieJar, fetch);
  const {
    data: { session },
    error: restoreError,
  } = await restartedClient.auth.getSession();

  assert.equal(restoreError, null);
  assert.equal(refreshRequests, 1);
  assert.equal(session?.access_token, refreshedAccessToken);
  assert.equal(session?.refresh_token, 'refresh-token-2');
});

test('the application does not impose a second local login deadline', async () => {
  const clientSource = await readFile(
    new URL('../lib/supabase/client.ts', import.meta.url),
    'utf8',
  );
  const consoleSource = await readFile(
    new URL('../components/ConsoleContext.tsx', import.meta.url),
    'utf8',
  );
  const middlewareSource = await readFile(
    new URL('../lib/supabase/middleware.ts', import.meta.url),
    'utf8',
  );
  const serverSource = await readFile(
    new URL('../lib/supabase/server.ts', import.meta.url),
    'utf8',
  );

  assert.doesNotMatch(clientSource, /auth-storage|localStorage|loginTime|maxAge|signOut/);
  assert.doesNotMatch(consoleSource, /isTokenExpired|loginTime/);
  assert.doesNotMatch(middlewareSource, /maxAge/);
  assert.doesNotMatch(serverSource, /maxAge/);
  assert.match(
    middlewareSource,
    /supabaseResponse\.cookies\.set\(name, value, options\)/,
  );
  assert.match(serverSource, /cookieStore\.set\(name, value, options\)/);
});

test('the extension callback does not expose the web refresh token', async () => {
  const callbackSource = await readFile(
    new URL('../app/auth/extension-callback/route.ts', import.meta.url),
    'utf8',
  );
  const extensionAuthSource = await readFile(
    new URL(
      '../../browser-extension/src/background/auth-service.ts',
      import.meta.url,
    ),
    'utf8',
  );

  assert.doesNotMatch(callbackSource, /refresh_token/);
  assert.doesNotMatch(extensionAuthSource, /refresh_token|refreshAuthSession/);
  assert.match(callbackSource, /supabase\.auth\.getUser\(\)/);
});
