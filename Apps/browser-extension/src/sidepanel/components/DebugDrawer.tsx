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
  const isPreparing = latestPlan?.plan.state === "preparing";
  const isActionableForm = latestForm?.kind === "application_form";
  const isSubmitStep = latestForm?.kind === "application_form" && latestForm.action === "submit";
  const canMoveNext = isActionableForm && latestForm.action === "next";
  const canMovePrevious = isActionableForm && (
    latestForm.canGoBack || latestForm.platform === "linkedin"
  );

  return (
    <details className="debug-drawer">
      <summary>🛠️ 高级与调试工具</summary>
      <div className="debug-actions">
        <button type="button" onClick={onInspectPage}>
          检测页面 (Inspect)
        </button>

        <button type="button" onClick={onInspectForm}>
          检测表单 (Inspect Form)
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
          仅点击 Back
        </button>

        <button
          type="button"
          disabled={!canMoveNext || isSubmitStep || loadingButton !== null}
          onClick={onMoveNext}
        >
          仅点击 Next
        </button>
      </div>
    </details>
  );
}
