import { useCallback, useState } from "react";
import type { DiagnosticEntry, RuntimeSnapshot } from "../../shared/contracts/execution";
import type { RuntimeMessage } from "../../shared/contracts/messages";
import { send } from "../services/messaging";

const DEFAULT_SNAPSHOT: RuntimeSnapshot = {
  phase: "idle",
  updatedAt: new Date().toISOString(),
};

export function useDiagnostics() {
  const [snapshot, setSnapshot] = useState<RuntimeSnapshot>(DEFAULT_SNAPSHOT);
  const [diagnostics, setDiagnostics] = useState<DiagnosticEntry[]>([]);
  const [errorMessage, setErrorMessage] = useState<string>("");

  const refresh = useCallback(async () => {
    const response = await send({ type: "diagnostics.list" });
    if (!response.ok) {
      setErrorMessage(response.error);
      return;
    }
    setErrorMessage("");
    setSnapshot(response.snapshot);
    setDiagnostics(response.diagnostics || []);
  }, []);


  const sendCommand = useCallback(async (msg: RuntimeMessage) => {
    const response = await send(msg);
    if (!response.ok) {
      setErrorMessage(response.error);
      return;
    }
    setErrorMessage("");
    await refresh();
  }, [refresh]);

  const clearLogs = useCallback(() => {
    setDiagnostics([]);
  }, []);

  return {
    snapshot,
    diagnostics,
    errorMessage,
    setErrorMessage,
    refresh,
    sendCommand,
    clearLogs,
  };
}
