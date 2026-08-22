import { describe, expect, it } from "vitest";

import { extensionRedirectWithState } from "./auth-service";

describe("extensionRedirectWithState", () => {
  it("preserves the callback target and forwards the OAuth state", () => {
    const redirect = extensionRedirectWithState(
      "https://abcdefghijklmnopabcdefghijklmnop.chromiumapp.org/jobby-auth?source=panel",
      "session-state",
    );
    const callback = new URL(redirect);

    expect(callback.searchParams.get("source")).toBe("panel");
    expect(callback.searchParams.get("state")).toBe("session-state");
  });
});
