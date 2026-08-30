let activeRunId: string | undefined;
const cancelledRuns = new Set<string>();

export function beginWorkdayAutofill(runId: string): void {
  activeRunId = runId;
  cancelledRuns.delete(runId);
}

export function cancelWorkdayAutofill(runId?: string): void {
  const targetRunId = runId || activeRunId;
  if (targetRunId) cancelledRuns.add(targetRunId);
}

export function isWorkdayAutofillCancelled(runId: string): boolean {
  return cancelledRuns.has(runId);
}

export function finishWorkdayAutofill(runId: string): void {
  cancelledRuns.delete(runId);
  if (activeRunId === runId) activeRunId = undefined;
}
