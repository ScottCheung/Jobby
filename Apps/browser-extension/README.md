# Jobby Browser Extension

This package is Jobby's Manifest V3 browser execution layer. It intentionally
does not contain AI, job-matching, resume-generation, or application-policy
logic. Those remain backend responsibilities.

## Current scope

The initial execution layer contains a Manifest V3 service worker, a side
panel, typed messages, session-backed diagnostics, a Bearer-authenticated REST
client, read-only SEEK and LinkedIn page inspectors, and a form driver for
explicit, backend-provided cached answers. It can move an application plan through
preparation and durable human-review states. LinkedIn Easy Apply can be advanced
through its adapter and submitted only after the backend plan is approved and the
user explicitly presses Submit application. It does not generate resumes or
upload files.

The backend remains the source of all decisions and answers. The content script
only writes exact, non-sensitive text/select/checkbox/radio targets after the
user triggers the side-panel action; missing answers and any driver mismatch
request durable review instead of guessing.

Authentication opens the existing Jobby `/login` page through Chrome's identity
flow. Email/password and Google login are handled by the web application using
the existing Supabase session. After login, the web callback returns the same
Supabase access and refresh tokens to the extension; no password or connection
code is entered into the extension.

## Development

```bash
npm install
npm run dev
```

During development, keep the Vite process running and load `dist-dev/` as an
unpacked extension once. CRXJS watches source files and automatically reloads
the extension when the background or manifest changes; it hot-updates the side
panel and content scripts on open SEEK and LinkedIn tabs. Do not load `dist/`
for development: it is the production build and has no connection to the Vite
dev server.

`dist-dev/` and `dist/` are deliberately separate. Restart `npm run dev` after
changing Vite configuration. A browser refresh is only needed when Chrome
blocks a content-script reinjection or after changing permissions; otherwise
save the source file and wait for the update to apply.

Create `.env.local` beside this package (copy `.env.example`) and set the same
Supabase URL and anon key used by `Apps/user/.env.local`. Set
`VITE_WEB_APP_URL` to the running Jobby web app, normally
`http://localhost:3000` (or the port where the web app is running).

For a production build:

```bash
npm run build
```

Load `dist/` as an unpacked extension at `chrome://extensions` after a build.
The extension needs the `identity` permission to open `/login` and receive its
callback. Keep the generated extension ID stable for local testing; in
production, set `JOBBY_EXTENSION_IDS` in the web app to the allowed extension
ID(s). The web app allows Chromium callback URLs without that allowlist only in
development.

## Architecture rules

- Content scripts perform isolated page reads and actions only.
- The service worker owns REST communication, orchestration, and persisted run state.
- Platform adapters contain site-specific selectors and flows.
- SEEK and LinkedIn adapters return structured job snapshots; their selectors
  remain isolated from shared form and execution code.
- Form inspection returns field metadata only. The separate form driver may
  write only exact backend instructions for non-sensitive fields; it never
  locates or clicks platform controls. LinkedIn submission stays inside the
  LinkedIn adapter and is gated by the backend plan plus an explicit UI action.
- All messages and REST payloads have runtime validation before use.
- Access tokens live in `chrome.storage.session` and are never written to logs.
- The backend remains the source of truth for application plans and submission permission.
