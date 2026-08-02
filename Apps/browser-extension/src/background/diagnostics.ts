import type { DiagnosticEntry, DiagnosticLevel } from "../shared/contracts/execution";

import { appendDiagnostic } from "./session-store";

export async function logDiagnostic(
  level: DiagnosticLevel,
  scope: string,
  message: string,
  details?: Record<string, unknown>,
): Promise<DiagnosticEntry> {
  const entry: DiagnosticEntry = {
    id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    level,
    scope,
    message,
    ...(details ? { details } : {}),
  };
  await appendDiagnostic(entry);
  return entry;
}
