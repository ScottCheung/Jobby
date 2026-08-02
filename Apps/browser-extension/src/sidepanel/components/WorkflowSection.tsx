import type { ValidatedApplicationPlanResponse } from "../../shared/contracts/backend";
import type { FormInspection } from "../../shared/contracts/form-inspection";
import type { PageInspection } from "../../shared/contracts/page-inspection";

interface WorkflowSectionProps {
  latestInspection: PageInspection | null;
  latestForm: FormInspection | null;
  latestPlan: ValidatedApplicationPlanResponse | null;
  loadingButton: string | null;
  onAutoApply: () => void;
  onOpenLinkedIn: () => void;
  onMovePrevious: () => void;
  onMoveNext: () => void;
  onFillAndNext: () => void;
  onOpenReviewModal: () => void;
}

export function WorkflowSection({
  latestInspection,
  latestForm,
  latestPlan,
  loadingButton,
  onAutoApply,
  onOpenLinkedIn,
  onMovePrevious,
  onMoveNext,
  onFillAndNext,
  onOpenReviewModal,
}: WorkflowSectionProps) {
  const linkedInJob =
    latestInspection?.kind === "job" && latestInspection.snapshot.platform === "linkedin"
      ? latestInspection.snapshot
      : null;
  const isLinkedInForm =
    latestForm?.kind === "application_form" && latestForm.platform === "linkedin";
  const isActionableForm = latestForm?.kind === "application_form";
  const isSubmitStep = latestForm?.kind === "application_form" && latestForm.action === "submit";
  const planIsTerminal = Boolean(
    latestPlan && ["submitting", "submitted", "failed", "rejected", "skipped"].includes(latestPlan.plan.state),
  );
  const isJobPage = latestInspection?.kind === "job";

  // The displayed form state can briefly be stale after LinkedIn removes a
  // modal. Let the content script resolve the live state when Open is clicked;
  // it safely returns "already open" when the modal is actually present.
  const disableOpen = planIsTerminal || !linkedInJob || !linkedInJob.easyApply;
  // Keep LinkedIn Back available while its step transition settles; the
  // content script performs the final live availability check on click.
  const disablePrevious = !isActionableForm || (
    !latestForm.canGoBack && latestForm.platform !== "linkedin"
  );
  const disableNext = !isActionableForm || isSubmitStep;
  const disableFillAndNext = !(latestPlan?.plan.state === "preparing" && latestForm?.kind === "application_form");
  // Reaching LinkedIn's final step is the source of truth for whether the
  // page can submit. A manually-debugged flow may not have advanced Jobby's
  // application-plan state yet; the confirmation flow reconciles it.
  const disableSubmit = planIsTerminal || !isLinkedInForm || !isSubmitStep;
  const disableAutoApply = planIsTerminal || (!isJobPage && !isLinkedInForm);

  return (
    <div className="workflow-controls">
      <button
        type="button"
        className={`hero-button ${loadingButton === "autoRun" ? "is-loading" : ""}`}
        disabled={disableAutoApply || loadingButton !== null}
        onClick={onAutoApply}
      >
        {loadingButton === "autoRun" ? "⏳ 自动投递中..." : "⚡ 一键自动投递 (Auto Apply)"}
      </button>

      <div className="step-debug-controls" aria-label="Application step debugging controls">
        <button
          type="button"
          className={`step-debug-button previous ${loadingButton === "previous" ? "is-loading" : ""}`}
          disabled={disablePrevious || loadingButton !== null}
          onClick={onMovePrevious}
        >
          {loadingButton === "previous" ? "⏳ 返回中..." : "⬅️ 上一步 (Back)"}
        </button>
        <button
          type="button"
          className={`step-debug-button next ${loadingButton === "next" ? "is-loading" : ""}`}
          disabled={disableNext || loadingButton !== null}
          onClick={onMoveNext}
        >
          {loadingButton === "next" ? "⏳ 前进中..." : "➡️ 下一步 (Next)"}
        </button>
      </div>

      <div className="action-grid">
        <button
          type="button"
          className={loadingButton === "open" ? "is-loading" : ""}
          disabled={disableOpen || loadingButton !== null}
          onClick={onOpenLinkedIn}
        >
          {loadingButton === "open" ? "⏳ 打开中..." : "📖 打开申请 (Open)"}
        </button>

        <button
          type="button"
          className={`primary ${loadingButton === "fillAndNext" ? "is-loading" : ""}`}
          disabled={disableFillAndNext || loadingButton !== null}
          onClick={onFillAndNext}
        >
          {loadingButton === "fillAndNext" ? "⏳ 填表中..." : "➡️ 填表并下一步"}
        </button>

        <button
          type="button"
          className={`primary danger-btn ${loadingButton === "submit" ? "is-loading" : ""}`}
          disabled={disableSubmit || loadingButton !== null}
          onClick={onOpenReviewModal}
        >
          📤 提交申请 (Submit)
        </button>
      </div>
    </div>
  );
}
