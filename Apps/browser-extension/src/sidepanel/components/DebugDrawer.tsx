import { useEffect, useState } from "react";

interface DebugDrawerProps {
  onInspectPage: () => void;
  onInspectForm: () => void;
}

export function DebugDrawer({
  onInspectPage,
  onInspectForm,
}: DebugDrawerProps) {
  const [disabledDomainsCount, setDisabledDomainsCount] = useState<number>(0);
  const [isDisabledAllPages, setIsDisabledAllPages] = useState<boolean>(false);

  const refreshFloatingBallStatus = () => {
    if (typeof chrome !== "undefined" && chrome.storage?.local) {
      chrome.storage.local.get(
        ["jobby_disabled_domains", "jobby_disabled_all_pages"],
        (res) => {
          const list = Array.isArray(res.jobby_disabled_domains)
            ? res.jobby_disabled_domains
            : [];
          setDisabledDomainsCount(list.length);
          setIsDisabledAllPages(!!res.jobby_disabled_all_pages);
        }
      );
    }
  };

  useEffect(() => {
    refreshFloatingBallStatus();
  }, []);

  const handleResetFloatingBall = () => {
    if (typeof chrome !== "undefined" && chrome.storage?.local) {
      chrome.storage.local.set(
        {
          jobby_disabled_domains: [],
          jobby_disabled_all_pages: false,
        },
        () => {
          refreshFloatingBallStatus();
          try {
            sessionStorage.removeItem("jobby-floating-ball-dismissed");
          } catch {}
        }
      );
    }
  };

  return (
    <details className="debug-drawer">
      <summary>🛠️ Advanced & Debug Tools</summary>
      <div className="debug-actions">
        <button type="button" onClick={onInspectPage}>
          Inspect Page
        </button>

        <button type="button" onClick={onInspectForm}>
          Inspect Form
        </button>

        <button
          type="button"
          onClick={handleResetFloatingBall}
        >
          {isDisabledAllPages || disabledDomainsCount > 0
            ? "Reset Floating Logo Display Rules"
            : "Reset Floating Logo Rules"}
        </button>
      </div>
    </details>
  );
}
