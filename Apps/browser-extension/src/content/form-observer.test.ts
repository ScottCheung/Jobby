// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";

import { startFormDiscovery } from "./form-observer";

describe("form discovery", () => {
  afterEach(() => {
    window.__jobbyFormDiscoveryCleanup?.();
    window.__jobbyFormObserverCleanup?.();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("publishes a form that was already rendered before discovery starts", async () => {
    vi.useFakeTimers();
    const sendMessage = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("chrome", { runtime: { id: "test-extension", sendMessage } });
    document.body.innerHTML = `<input id="resume" type="file" />`;

    startFormDiscovery(() => ({
      kind: "application_form",
      platform: "seek",
      url: "https://au.seek.com/job/94120995/apply",
      fields: [
        {
          key: "resume",
          id: "resume",
          type: "file",
          label: "Resumé",
          required: false,
          filled: false,
          sensitive: true,
          options: [],
        },
      ],
      hasSubmitAction: true,
      canGoBack: false,
      action: "next",
    }));

    await vi.advanceTimersByTimeAsync(500);

    expect(sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "content.form-changed",
        form: expect.objectContaining({ platform: "seek" }),
      }),
    );
  });
});
