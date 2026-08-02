import type { RunPhase, RuntimeSnapshot } from "../shared/contracts/execution";

import { logDiagnostic } from "./diagnostics";
import { getRuntimeSnapshot, updateRuntimeSnapshot } from "./session-store";

type ControllablePhase = "paused" | "running" | "stopped";

const ALLOWED_TRANSITIONS: Record<ControllablePhase, readonly RunPhase[]> = {
  paused: ["running", "needs_user_action"],
  running: ["paused", "needs_user_action"],
  stopped: ["running", "paused", "needs_user_action", "failed"],
};

export async function controlRun(phase: ControllablePhase): Promise<RuntimeSnapshot> {
  const current = await getRuntimeSnapshot();
  if (current.phase === "idle") throw new Error("There is no active browser run.");
  if (current.phase === phase) return current;
  if (!ALLOWED_TRANSITIONS[phase].includes(current.phase)) {
    throw new Error(`Cannot move a ${current.phase} browser run to ${phase}.`);
  }

  const reason = `${capitalize(phase)} from the side panel.`;
  const snapshot = await updateRuntimeSnapshot({ phase, reason });
  await logDiagnostic("info", "run-controller", reason);
  return snapshot;
}

function capitalize(value: string): string {
  return `${value.slice(0, 1).toUpperCase()}${value.slice(1)}`;
}
