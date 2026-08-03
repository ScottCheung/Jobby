const EXTENSION_CALLBACK_SUFFIX = ".chromiumapp.org";

export function isAllowedExtensionRedirect(value: string | null): value is string {
  if (!value) return false;

  try {
    const target = new URL(value);
    if (target.protocol !== "https:" || !target.hostname.endsWith(EXTENSION_CALLBACK_SUFFIX)) {
      return false;
    }

    const extensionId = target.hostname.slice(0, -EXTENSION_CALLBACK_SUFFIX.length);
    if (!/^[a-p]{32}$/.test(extensionId)) return false;

    const configuredIds = (process.env.JOBBY_EXTENSION_IDS || "")
      .split(",")
      .map((id) => id.trim())
      .filter(Boolean);
    return configuredIds.length === 0
      ? process.env.NODE_ENV !== "production"
      : configuredIds.includes(extensionId);
  } catch {
    return false;
  }
}

export function extensionCallbackPath(redirectUri: string): string {
  return `/auth/extension-callback?redirect_uri=${encodeURIComponent(redirectUri)}`;
}
