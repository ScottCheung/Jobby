import { useCallback, useState } from "react";
import type { AuthStatus } from "../../shared/contracts/auth";
import { send } from "../services/messaging";

const DEFAULT_AUTH: AuthStatus = { connected: false };

export function useAuth() {
  const [authStatus, setAuthStatus] = useState<AuthStatus>(DEFAULT_AUTH);
  const [authError, setAuthError] = useState<string>("");
  const [isSigningIn, setIsSigningIn] = useState<boolean>(false);
  const [isCheckingAuth, setIsCheckingAuth] = useState<boolean>(true);

  const refreshAuth = useCallback(async () => {
    setIsCheckingAuth(true);
    try {
      const response = await send({ type: "auth.status" });
      if (!response.ok) {
        setAuthError(response.error);
        return;
      }
      setAuthError("");
      const status = response.auth ?? DEFAULT_AUTH;
      setAuthStatus(status);
    } finally {
      setIsCheckingAuth(false);
    }
  }, []);

  const signIn = useCallback(async () => {
    setIsSigningIn(true);
    setAuthError("");
    try {
      const response = await send({ type: "auth.open-login" });
      if (!response.ok) {
        setAuthError(response.error);
        return;
      }
      await refreshAuth();
    } finally {
      setIsSigningIn(false);
    }
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
    isSigningIn,
    isCheckingAuth,
  };
}
