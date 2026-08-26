# Jobby Browser Extension

This package is Jobby's Manifest V3 browser execution layer. It intentionally
does not contain AI, job-matching, resume-generation, or application-policy
logic. Those remain backend responsibilities.

## Current scope

The extension detects job pages, extracts editable job details, inspects
application forms, autofills saved profile answers, uploads a selected resume,
can generate tailored documents, and displays a reference match score from the
backend. After the user submits an application on the job site, they can
explicitly record it as applied.

The match score is display-only: it never decides whether to apply or creates an
application record. The current product does not run automatic applications,
click Submit, or store skipped jobs. The backend provides saved profile answers;
the content script writes them only after the user triggers autofill and leaves
unknown fields for review.

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
unpacked extension. The watcher rebuilds the extension after each saved change.
After a successful rebuild, reload the extension from `chrome://extensions`
and refresh the page being tested. Do not load `dist/` for development: it is
the production build.

`dist-dev/` and `dist/` are deliberately separate. Restart `npm run dev` after
changing Vite configuration. A browser refresh is only needed when Chrome
blocks a content-script reinjection or after changing permissions; otherwise
save the source file and wait for the update to apply.

Create `.env.local` beside this package (copy `.env.example`) and set the same
Supabase URL and anon key used by `Apps/user/.env.local`. Set
`VITE_WEB_APP_URL` to the running Jobby web app, normally
`http://localhost:3000` (or the port where the web app is running).

The MAIN-world bridge and the bootstrap content script are intentionally
standalone scripts and cannot use the CRXJS HMR client.

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
- Platform definitions and adapters contain site-specific selectors and flows.
- LinkedIn, SEEK, Indeed, Glassdoor, Workday, Greenhouse, Lever,
  SmartRecruiters, Ashby, and Taleo providers are routed before generic
  job/form detection. Their
  definitions remain isolated from shared ATS and generic execution code;
  unknown sites use the generic fallback. See
  `src/content/platforms/README.md` for the registry and ownership rules.
- Form inspection returns field metadata only. The separate form driver may
  write only exact backend instructions for supported fields; it never clicks
  the final application Submit action.
- All messages and REST payloads have runtime validation before use.
- Access tokens live in `chrome.storage.session` and are never written to logs.
- An application record is created only by the explicit Record as Applied action.
