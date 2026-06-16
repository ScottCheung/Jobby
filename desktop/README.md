# Desktop App

This folder contains the Electron shell for the desktop version of Auto Job Apply.

The default assumption is:

- Electron is the desktop client.
- The main API and database currently run in your local Docker containers.
- The local worker agent still runs on the user's machine so one-click auto-apply can control Chrome and the host browser session.

## Current role

- Load the dashboard inside a desktop window.
- Provide a runtime bridge so the dashboard can read the desktop API URL.
- Manage optional local services for development.
- Keep the boundary clean for future multi-service and multi-user support.

## Runtime modes

The desktop shell supports two kinds of service wiring:

- `external`
  Use an already-running service at a known URL.
- `local-*`
  Start the service from Electron and wait for its health check.

## Useful scripts

```bash
npm install
npm run start:containers
```

Uses the API and dashboard that are already running outside Electron.
Right now that usually means your local Docker containers on `127.0.0.1`.
In this mode the desktop shell also starts the local Python worker agent by default, so `Start Auto Apply` has a local runner available.

The desktop app persists its connection settings in the Electron user data directory, so you can switch environments from the app without editing code.
If the remote dashboard cannot be reached, the desktop shell falls back to its own recovery screen so the connection can be corrected without relaunching.

Important environment variables:

```bash
AUTO_JOB_API_URL=http://127.0.0.1:8000
AUTO_JOB_DASHBOARD_URL=http://127.0.0.1:3000
```

```bash
npm run start:dev
```

Starts the dashboard locally in Next dev mode, but expects the API to already exist.

```bash
npm run start:full-dev
```

Starts the dashboard locally and tries to start the Python API locally from `backend/`.
This still expects a reachable database connection.

```bash
npm run start:desktop-stack
```

Starts the dashboard, local API, and local worker agent from Electron.
This is the closest dev-mode version of the eventual desktop product.

## Packaging

```bash
npm run pack:dir
```

Builds an unpacked desktop bundle for quick verification.

```bash
npm run pack:mac
```

Builds a macOS package.

```bash
npm run pack:win
```

Builds a Windows package.

```bash
npm run pack:linux
```

Builds a Linux package.

## Future extension path

- Add a service profile for each automation provider such as LinkedIn and Seek.
- Add a desktop account/session selector that maps to backend tenant and user context.
- Add packaging so the dashboard can run from a built asset instead of a dev server.
