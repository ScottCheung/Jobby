export const RUN_PHASES = [
  "idle",
  "running",
  "paused",
  "needs_user_action",
  "stopped",
  "failed",
] as const;

export type RunPhase = (typeof RUN_PHASES)[number];

export type RuntimeSnapshot = {
  phase: RunPhase;
  updatedAt: string;
  runId?: string;
  activeTabId?: number;
  applicationId?: string;
  reason?: string;
};

export type DiagnosticLevel = "debug" | "info" | "warn" | "error";

export type DiagnosticEntry = {
  id: string;
  timestamp: string;
  level: DiagnosticLevel;
  scope: string;
  message: string;
  runId?: string;
  details?: Record<string, unknown>;
};

export type ExtensionSettings = {
  debugLogging: boolean;
};

export const DEFAULT_RUNTIME_SNAPSHOT: RuntimeSnapshot = {
  phase: "idle",
  updatedAt: new Date(0).toISOString(),
};

export const DEFAULT_EXTENSION_SETTINGS: ExtensionSettings = {
  debugLogging: false,
};
