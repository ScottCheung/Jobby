import { useCallback, useState } from "react";
import type { AuthStatus } from "../../shared/contracts/auth";
import { send } from "../services/messaging";

const DEFAULT_AUTH: AuthStatus = { connected: false };

export function useAuth() {
  const [authStatus, setAuthStatus] = useState<AuthStatus>(DEFAULT_AUTH);
  const [authError, setAuthError] = useState<string>("");

  const refreshAuth = useCallback(async () => {
    const response = await send({ type: "auth.status" });
    if (!response.ok) {
      setAuthError(response.error);
      return;
    }
    setAuthError("");
    setAuthStatus(response.auth ?? DEFAULT_AUTH);
  }, []);

  const signIn = useCallback(async () => {
    const response = await send({ type: "auth.open-login" });
    if (!response.ok) {
      setAuthError(response.error);
      return;
    }
    await refreshAuth();
  }, [refreshAuth]);

  const disconnect = useCallback(async () => {
    const response = await send({ type: "auth.disconnect" });
    if (!response.ok) {
      setAuthError(response.error);
      return;
    }
    await refreshAuth();
  }, [refreshAuth]);

  return {
    authStatus,
    authError,
    refreshAuth,
    signIn,
    disconnect,
  };
}
