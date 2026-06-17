# Architecture Refactor Plan

## Goal

Refactor the current Electron + Python automation stack into a clean, extensible desktop runtime that:

- keeps the existing LinkedIn flow working
- removes all legacy popup / confirm-dialog control paths
- shows low-latency start / stop state in the UI
- supports Seek as the next first-class platform
- leaves room for third-party guided form filling later

## Current Problems

- Start / stop state is spread across old and new code paths.
- The UI still depends on dialog-driven control in places.
- Python execution and UI state are not modeled as one clear lifecycle.
- Platform logic is mixed with shared automation logic.
- The codebase is harder to extend without breaking existing behavior.

## Target Shape

- `desktop`
  Owns process lifecycle, IPC, config, and realtime runtime state.
- `worker/core`
  Owns shared automation primitives, status events, logging, and common helpers.
- `worker/platforms/linkedin`
  Keeps the current LinkedIn behavior behind a platform adapter.
- `worker/platforms/seek`
  Adds Seek with the same runtime contract.
- `worker/platforms/generic`
  Supports assisted third-party apply flows with user confirmation at the end.

## Rules

1. No new popups or confirm dialogs for start / stop.
2. UI state must come from process / IPC events, not local guesswork.
3. Shared code stays shared; platform differences stay isolated.
4. Existing LinkedIn capabilities should be preserved first, then cleaned up.
5. Third-party sites should start as guided assistance, not full automation.

## Phases

### Phase 1: Clean runtime control

1. Replace scattered bot start / stop logic with one desktop process controller.
2. Use `child_process.spawn` as the single Python launch path.
3. Stream JSON status events from Python stdout.
4. Forward those events to the renderer through IPC.
5. Drive button state only from that live runtime state.

### Phase 2: Remove legacy interaction paths

1. Delete old popup-based control branches.
2. Remove redundant confirmation flows for start / stop.
3. Keep only one source of truth for running / stopped / error state.
4. Clean up stale UI and backend wiring that no longer participates.

### Phase 3: Extract shared automation core

1. Move common application lifecycle logic into shared modules.
2. Standardize logging, status, metrics, and cancellation.
3. Separate shared form handling from platform-specific selectors.
4. Keep LinkedIn behavior intact while moving code behind the new boundary.

### Phase 4: Add platform adapters

1. Implement Seek as a first-class adapter using the same runtime contract.
2. Keep LinkedIn and Seek on the same shared orchestration layer.
3. Add a generic assisted-flow adapter for third-party sites.
4. For third-party sites, support fill-next-review-submit, with final user approval.

### Phase 5: UI expansion

1. Turn the current button area into a small control panel.
2. Show running state, active platform, logs, and cancel control.
3. Keep the UI minimal and fast, with no modal interruptions.
4. Leave room for future platform tabs and per-platform runtime cards.

## Suggested Rollout Order

1. Runtime lifecycle and IPC.
2. Remove old popup logic.
3. Extract shared core.
4. Keep LinkedIn stable.
5. Add Seek.
6. Add third-party guided flow.

## Success Criteria

- App opens in the correct idle state.
- Start / stop changes are visible immediately.
- No legacy dialogs appear during normal control.
- LinkedIn still works after the refactor.
- Seek can be added without duplicating the whole worker.
- Third-party support can reuse the shared flow layer.

