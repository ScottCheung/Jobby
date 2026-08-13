import { useEffect, useState } from "react";
import type { ExtensionPlanAction, ValidatedApplicationPlanResponse } from "../../shared/contracts/backend";
import type { FormInspection } from "../../shared/contracts/form-inspection";
import type { PageInspection } from "../../shared/contracts/page-inspection";

interface DebugDrawerProps {
  latestInspection: PageInspection | null;
  latestForm: FormInspection | null;
  latestPlan: ValidatedApplicationPlanResponse | null;
  loadingButton: string | null;
  onInspectPage: () => void;
  onInspectForm: () => void;
  onCreatePlan: () => void;
  onApplyPlanAction: (action: ExtensionPlanAction) => void;
  onMoveNext: () => void;
  onMovePrevious: () => void;
}

export function DebugDrawer({
  latestInspection,
  latestForm,
  latestPlan,
  loadingButton,
  onInspectPage,
  onInspectForm,
  onCreatePlan,
  onApplyPlanAction,
  onMoveNext,
  onMovePrevious,
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

  const isPreparing = latestPlan?.plan.state === "preparing";
  const isActionableForm = latestForm?.kind === "application_form";
  const isSubmitStep = latestForm?.kind === "application_form" && latestForm.action === "submit";
  const canMoveNext = isActionableForm && latestForm.action === "next";
  const canMovePrevious = isActionableForm && (
    latestForm.canGoBack || latestForm.platform === "linkedin"
  );

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
          disabled={latestInspection?.kind !== "job" || loadingButton !== null}
          onClick={onCreatePlan}
        >
          Create Plan
        </button>

        <button
          type="button"
          disabled={latestPlan?.plan.state !== "planned" || loadingButton !== null}
          onClick={() => onApplyPlanAction("prepare")}
        >
          Prepare Plan
        </button>

        <button
          type="button"
          disabled={!isPreparing || loadingButton !== null}
          onClick={() => onApplyPlanAction("mark_prepared")}
        >
          Mark Prepared
        </button>

        <button
          type="button"
          disabled={latestPlan?.plan.state !== "awaiting_user_review" || loadingButton !== null}
          onClick={() => onApplyPlanAction("approve")}
        >
          Approve Plan
        </button>

        <button
          type="button"
          disabled={!canMovePrevious || loadingButton !== null}
          onClick={onMovePrevious}
        >
          Click Back Only
        </button>

        <button
          type="button"
          disabled={!canMoveNext || isSubmitStep || loadingButton !== null}
          onClick={onMoveNext}
        >
          Click Next Only
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
