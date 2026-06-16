# Electron Migration Plan

## Goal

Turn the current dashboard + Python automation stack into one desktop product with a single launcher, while keeping the existing backend and worker logic mostly intact.

Current default deployment assumption:

- Docker is the current backend/runtime shape while we validate the full product locally.
- Electron acts as the user-facing desktop client.
- The desktop app currently connects to the API and dashboard exposed by local Docker containers.
- The browser automation worker remains local to the user's machine so it can drive the host browser session.

## Why this path

- Reuse the existing Next.js dashboard instead of rebuilding it.
- Keep the Python worker and backend as the source of truth for automation.
- Avoid a large rewrite before the product direction is validated.
- Leave room for future multi-tenant support and additional platforms.

## Phase 1: Desktop shell

1. Add an Electron app that becomes the primary launcher.
2. Start the Python API from the Electron main process when the app launches.
3. Open the existing dashboard inside the Electron window.
4. Surface service status, logs, and start/stop controls in the desktop shell.
5. Keep startup wired through a service registry so future automation providers can plug into the same runtime.

## Phase 2: Local product integration

1. Make the dashboard talk to the local API through a stable config layer.
2. Add desktop-level configuration for API URL, Python path, and runtime options.
3. Persist local app state in a user-scoped storage area.
4. Add a startup health check so the UI can show whether the backend and worker are ready.
5. Add packaging scripts so the desktop client can move toward distributable installers.

## Phase 3: Multi-tenant foundation

1. Introduce tenant-aware data models in the backend.
2. Scope user profile, search profile, runtime settings, and job history by tenant.
3. Add account selection and account switching in the UI.
4. Separate desktop identity from business identity so the app can support multiple users later.

## Phase 4: Multi-platform automation

1. Extract platform-specific automation into adapters.
2. Keep LinkedIn as the first adapter.
3. Add Seek next, then other platforms behind the same job pipeline.
4. Reuse the same dashboard entities for every platform with platform metadata.

## Recommended service boundaries

- `desktop-shell`
  Owns window lifecycle, local config, service orchestration, and user-device state.
- `api-service`
  Owns profiles, preferences, runs, application history, and tenant-aware data.
- `automation-provider`
  One provider per platform, such as LinkedIn or Seek, behind a common run contract.
- `account-context`
  A future abstraction that lets one desktop app switch among users, tenants, and platform accounts safely.

## Recommended order

1. Electron shell.
2. Local API launch and lifecycle control.
3. Dashboard integration with the shell.
4. Tenant model later.
5. Seek and other platform adapters last.

## Notes

- The browser plugin route is still useful later if we want deeper in-tab control.
- For now, Electron gives the best balance of speed, reuse, and lower rewrite risk.
