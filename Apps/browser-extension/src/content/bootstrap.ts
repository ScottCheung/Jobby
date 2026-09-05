import { autoSelectFirstJobCard } from "./auto-select-first-job";
import { handleContentCommand, startContentFormDiscovery } from "./command-handler";
import { initializeFloatingBall, runJobDetectionForBall } from "./dom/floating-ball";
import { classifyCurrentPage } from "./page-classifier";
import { detectDedicatedProvider } from "./platforms/provider-routing";

type ContentMessageListener = Parameters<typeof chrome.runtime.onMessage.addListener>[0];

declare global {
  interface Window {
    __jobbyContentMessageListener?: ContentMessageListener;
    __jobbyContentBootstrapCleanup?: () => void;
    __jobbyFormObserverCleanup?: () => void;
    __jobbyFormDiscoveryCleanup?: () => void;
  }
}

window.__jobbyContentBootstrapCleanup?.();
window.__jobbyContentBootstrapCleanup = undefined;

function isExtensionContextValid(): boolean {
  try {
    return typeof chrome !== "undefined" && Boolean(chrome.runtime?.id);
  } catch {
    return false;
  }
}

// Backward-compatible cleanup for a page that was injected by an older build
// before the unified teardown hook existed.
if (window.__jobbyContentMessageListener && isExtensionContextValid() && chrome.runtime?.onMessage) {
  try {
    chrome.runtime.onMessage.removeListener(window.__jobbyContentMessageListener);
  } catch {
    // Ignore
  }
}
window.__jobbyFormObserverCleanup?.();
window.__jobbyFormDiscoveryCleanup?.();

const isTopLevelFrame = typeof window !== 'undefined' ? window.top === window : true;
const cleanupCallbacks: Array<() => void> = [];

const listener: ContentMessageListener = (message, _sender, sendResponse) => {
  if (!isExtensionContextValid()) return false;
  if (
    typeof message === 'object' &&
    message !== null &&
    (message as { type?: unknown }).type === 'content.highlight-job-requirement' &&
    !isTopLevelFrame
  ) {
    return false;
  }
  void handleContentCommand(message)
    .then((response) => {
      sendResponse(response !== undefined ? { ok: true, ...response } : { ok: true });
    })
    .catch((error: unknown) => {
      const reason = error instanceof Error ? error.message : "Could not inspect the current page.";
      sendResponse({ ok: false, error: reason });
    });
  return true;
};

window.__jobbyContentMessageListener = listener;
if (isExtensionContextValid() && chrome.runtime?.onMessage) {
  try {
    chrome.runtime.onMessage.addListener(listener);
    cleanupCallbacks.push(() => {
      try {
        if (isExtensionContextValid()) {
          chrome.runtime.onMessage.removeListener(listener);
        }
      } catch {
        // Ignore
      }
    });
  } catch {
    // Ignore
  }
}

// Listen for theme changes from the Jobby web app and update chrome.storage.local
const onThemeMessage = (event: MessageEvent) => {
  if (
    event.source === window &&
    event.data &&
    event.data.source === "jobby-web-app" &&
    event.data.type === "JOBBY_THEME_CHANGE"
  ) {
    if (!isExtensionContextValid()) return;
    const { theme, themeColor } = event.data;
    const updatePayload: Record<string, string> = {};
    if (theme) updatePayload["auto-job-ui-theme"] = theme;
    if (themeColor) updatePayload["auto-job-ui-theme-color"] = themeColor;
    if (Object.keys(updatePayload).length > 0 && chrome.storage?.local) {
      try {
        void chrome.storage.local.set(updatePayload);
      } catch {
        // Ignore
      }
    }
  }
};
window.addEventListener("message", onThemeMessage);
cleanupCallbacks.push(() => window.removeEventListener("message", onThemeMessage));

const isJobbyWebAppPage = (): boolean => {
  try {
    const configuredOrigin = new URL(
      import.meta.env.VITE_WEB_APP_URL || "http://localhost:3000",
    ).origin;
    return (
      window.location.origin === configuredOrigin ||
      ((window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1") &&
        (window.location.port === "3000" || window.location.port === "3001"))
    );
  } catch {
    return false;
  }
};

const onJobInspectionMessage = (event: MessageEvent) => {
  const data = event.data as {
    source?: unknown;
    type?: unknown;
    requestId?: unknown;
    url?: unknown;
  } | null;
  if (
    event.source !== window ||
    event.origin !== window.location.origin ||
    !isJobbyWebAppPage() ||
    data?.source !== "jobby-web-app" ||
    data.type !== "JOBBY_INSPECT_JOB_URL" ||
    typeof data.requestId !== "string" ||
    typeof data.url !== "string" ||
    !isExtensionContextValid()
  ) {
    return;
  }

  window.postMessage(
    {
      source: "jobby-extension",
      type: "JOBBY_INSPECT_JOB_URL_ACK",
      requestId: data.requestId,
    },
    window.location.origin,
  );

  void chrome.runtime
    .sendMessage({ type: "content.inspect-url", url: data.url })
    .then((response) => {
      window.postMessage(
        {
          source: "jobby-extension",
          type: "JOBBY_INSPECT_JOB_URL_RESULT",
          requestId: data.requestId,
          response,
        },
        window.location.origin,
      );
    })
    .catch((error: unknown) => {
      window.postMessage(
        {
          source: "jobby-extension",
          type: "JOBBY_INSPECT_JOB_URL_RESULT",
          requestId: data.requestId,
          response: {
            ok: false,
            error:
              error instanceof Error
                ? error.message
                : "Could not inspect the job link.",
          },
        },
        window.location.origin,
      );
    });
};
window.addEventListener("message", onJobInspectionMessage);
cleanupCallbacks.push(() => window.removeEventListener("message", onJobInspectionMessage));

const onTailoredResumeMessage = (event: MessageEvent) => {
  if (
    event.source !== window ||
    event.origin !== window.location.origin ||
    !isJobbyWebAppPage() ||
    event.data?.source !== 'jobby-web-app' ||
    event.data?.type !== 'JOBBY_TAILORED_RESUME_UPDATED' ||
    !isExtensionContextValid() ||
    !chrome.storage?.local
  ) {
    return;
  }
  void chrome.storage.local.set({ 'jobby-tailored-resume-version': Date.now() });
};
window.addEventListener('message', onTailoredResumeMessage);
cleanupCallbacks.push(() =>
  window.removeEventListener('message', onTailoredResumeMessage),
);

// Broadcast extension theme changes to web app window in real-time
if (isExtensionContextValid() && chrome.storage?.onChanged) {
  const onStorageChanged = (changes: Record<string, chrome.storage.StorageChange>, areaName: string) => {
    if (!isExtensionContextValid()) return;
    if (areaName !== "local") return;
    const newTheme = changes["auto-job-ui-theme"]?.newValue;
    const newColor = changes["auto-job-ui-theme-color"]?.newValue;
    if (newTheme !== undefined || newColor !== undefined) {
      window.postMessage(
        {
          source: "jobby-extension",
          type: "JOBBY_EXTENSION_THEME_CHANGE",
          theme: newTheme,
          themeColor: newColor,
        },
        "*"
      );
    }
  };
  try {
    chrome.storage.onChanged.addListener(onStorageChanged);
    cleanupCallbacks.push(() => {
      try {
        if (isExtensionContextValid()) chrome.storage.onChanged.removeListener(onStorageChanged);
      } catch {
        // Ignore
      }
    });
  } catch {
    // Ignore
  }
}

// Large job boards are observed continuously for client-side job selection
// and application-step changes. ATS pages still use on-demand inspection so
// the extension does not attach a whole-document observer to every website.
const activeProvider = detectDedicatedProvider(window.location, document);

if (isTopLevelFrame && isExtensionContextValid()) {
  cleanupCallbacks.push(initializeFloatingBall());
  if (activeProvider) {
    cleanupCallbacks.push(autoSelectFirstJobCard(document));
    const syncDiscoveryState = () => {
      try {
        if (!isExtensionContextValid()) {
          window.__jobbyContentBootstrapCleanup?.();
          return;
        }
        const pageClass = classifyCurrentPage();
        if (pageClass.isJobPage) {
          startContentFormDiscovery();
        } else {
          window.__jobbyFormDiscoveryCleanup?.();
          window.__jobbyFormObserverCleanup?.();
        }
      } catch {
        window.__jobbyContentBootstrapCleanup?.();
      }
    };

    syncDiscoveryState();

    let pageChangeTimer: number | undefined;
    const notifyPageChanged = () => {
      if (pageChangeTimer !== undefined) return;
      pageChangeTimer = window.setTimeout(() => {
        pageChangeTimer = undefined;
        try {
          if (!isExtensionContextValid()) {
            window.__jobbyContentBootstrapCleanup?.();
            return;
          }
          autoSelectFirstJobCard(document);
          syncDiscoveryState();
          runJobDetectionForBall(true);
          if (chrome.runtime?.id && chrome.runtime?.sendMessage) {
            chrome.runtime.sendMessage({ type: "content.page-changed" }).catch(() => undefined);
          }
        } catch {
          // Ignore context invalidation on reload
        }
      }, 100);
    };

    document.addEventListener("jobby.url-changed", notifyPageChanged);
    window.addEventListener("popstate", notifyPageChanged);
    cleanupCallbacks.push(() => {
      document.removeEventListener("jobby.url-changed", notifyPageChanged);
      window.removeEventListener("popstate", notifyPageChanged);
      if (pageChangeTimer !== undefined) window.clearTimeout(pageChangeTimer);
    });

    if (activeProvider.pageObserver?.observe) {
      cleanupCallbacks.push(activeProvider.pageObserver.observe(notifyPageChanged, document));
    }

    // Observe clicks on job listing cards/links.
    const onJobCardClick = (event: MouseEvent) => {
      try {
        if (!isExtensionContextValid()) {
          window.__jobbyContentBootstrapCleanup?.();
          return;
        }
        const target = event.target as HTMLElement | null;
        if (!target) return;
        const isJobClick = activeProvider.jobSelection?.isJobCardElement
          ? activeProvider.jobSelection.isJobCardElement(target)
          : Boolean(
              target.closest(
                activeProvider.jobSelection?.cardSelector ||
                  "a[href*='/job/'], a[href*='/jobs/view/'], .job-card, [data-job-id]",
              ),
            );
        if (isJobClick) {
          notifyPageChanged();
        }
      } catch {
        // Ignore
      }
    };
    document.addEventListener("click", onJobCardClick, { capture: true, passive: true });
    cleanupCallbacks.push(() => document.removeEventListener("click", onJobCardClick, true));
  }
}

window.__jobbyContentBootstrapCleanup = () => {
  cleanupCallbacks.forEach((cleanup) => {
    try {
      cleanup();
    } catch {
      // Ignore
    }
  });
  window.__jobbyFormObserverCleanup?.();
  window.__jobbyFormDiscoveryCleanup?.();
};
