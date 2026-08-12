import { useCallback, useEffect, useRef, useState } from "react";
import type { ExtensionPlanAction, ValidatedApplicationPlanResponse } from "../../shared/contracts/backend";
import type { FieldFillResult } from "../../shared/contracts/form-actions";
import type { FormInspection } from "../../shared/contracts/form-inspection";
import type { PageInspection } from "../../shared/contracts/page-inspection";
import { executeAutoRun, executeMoveNext, executeMovePrevious, executeOpenLinkedIn } from "../services/application-actions";
import { send, wait } from "../services/messaging";

export type StatusState = "idle" | "running" | "success" | "warning" | "error";

export interface StatusBannerState {
  state: StatusState;
  message: string;
}

export function useApplicationPlan(
  latestInspection: PageInspection | null,
  latestForm: FormInspection | null,
  inspectPage: () => Promise<void>,
  inspectForm: () => Promise<FormInspection | null>,
) {
  const [latestPlan, setLatestPlan] = useState<ValidatedApplicationPlanResponse | null>(null);
  const [status, setStatus] = useState<StatusBannerState>({
    state: "idle",
    message: "Ready: Open job details or Easy Apply popup to get started.",
  });
  const [fillResults, setFillResults] = useState<FieldFillResult[]>([]);
  const [unansweredFields, setUnansweredFields] = useState<Array<{ key: string; label: string; reason: string }>>([]);
  const [loadingButton, setLoadingButton] = useState<string | null>(null);
  const lastJobKey = useRef<string | null>(null);
  const autoPlanCreatedRef = useRef<string | null>(null);

  useEffect(() => {
    const currentJobKey =
      latestInspection?.kind === "job"
        ? `${latestInspection.snapshot.platform}:${latestInspection.snapshot.externalId}`
        : null;
    if (currentJobKey && lastJobKey.current && currentJobKey !== lastJobKey.current) {
      setLatestPlan(null);
      setFillResults([]);
      setUnansweredFields([]);
      setStatus({
        state: "idle",
        message: "New job detected, ready for application.",
      });
    }
    lastJobKey.current = currentJobKey;
  }, [latestInspection]);

  // Automatically create application plan and derive match score upon job identification
  useEffect(() => {
    if (latestInspection?.kind !== "job") {
      autoPlanCreatedRef.current = null;
      return;
    }
    const currentJobKey = `${latestInspection.snapshot.platform}:${latestInspection.snapshot.externalId}`;
    if (autoPlanCreatedRef.current !== currentJobKey && !latestPlan) {
      autoPlanCreatedRef.current = currentJobKey;
      void send({
        type: "application.create-plan-active",
        inspection: latestInspection,
      }).then((response) => {
        if (response?.ok && response?.plan) {
          setLatestPlan(response.plan);
          void send({
            type: "content.render-score-card",
            inspection: latestInspection,
            plan: response.plan,
          }).catch(() => undefined);
        }
      }).catch(() => undefined);
    }
  }, [latestInspection, latestPlan]);

  useEffect(() => {
    if (latestInspection?.kind === "job" && latestPlan) {
      void send({
        type: "content.render-score-card",
        inspection: latestInspection,
        plan: latestPlan,
      }).catch(() => undefined);
    }
  }, [latestInspection, latestPlan]);

  const setActionStatus = useCallback((state: StatusState, message: string) => {
    setStatus({ state, message });
  }, []);

  const createPlan = useCallback(async () => {
    const response = await send({
      type: "application.create-plan-active",
      ...(latestInspection ? { inspection: latestInspection } : {}),
    });
    if (!response.ok) {
      setActionStatus("error", response.error);
      return null;
    }
    if (response.plan) setLatestPlan(response.plan);
    return response.plan ?? null;
  }, [latestInspection, setActionStatus]);

  const applyPlanAction = useCallback(async (
    action: ExtensionPlanAction,
    reason?: string,
  ): Promise<ValidatedApplicationPlanResponse | null> => {
    if (!latestPlan) return null;
    const response = await send({
      type: "application.plan-action-active",
      applicationId: latestPlan.application_id,
      action,
      ...(reason ? { reason } : {}),
    });
    if (response.ok && response.plan) {
      setLatestPlan(response.plan);
      return response.plan;
    }
    return null;
  }, [latestPlan]);

  const ensurePlanPrepared = useCallback(async (): Promise<boolean> => {
    let plan = latestPlan;
    if (!plan && latestInspection?.kind === "job") {
      await inspectPage();
      plan = await createPlan();
    }
    if (!plan) return false;
    if (plan.plan.state === "planned" || plan.plan.state === "awaiting_user_review") {
      await applyPlanAction("prepare");
    }
    return true;
  }, [latestPlan, latestInspection, inspectPage, createPlan, applyPlanAction]);

  const autofillForm = useCallback(async () => {
    setLoadingButton("autofill");
    setActionStatus("running", "Matching your profile and filling out the form...");
    try {
      let form =
        latestForm?.kind === "application_form" || latestForm?.kind === "page_input_fields"
          ? latestForm
          : await inspectForm();
      if (!form || (form.kind !== "application_form" && form.kind !== "page_input_fields")) {
        await wait(150);
        form = await inspectForm();
      }
      if (!form || (form.kind !== "application_form" && form.kind !== "page_input_fields")) {
        setActionStatus("error", "No fillable form detected. Please open the application form and try again.");
        return;
      }

      const response = await send({ type: "form.autofill-active" });
      if (!response.ok) {
        setActionStatus("error", `Autofill failed: ${response.error}`);
        return;
      }

      const results = response.fillResults || [];
      const unanswered = response.unansweredFields || [];
      setFillResults(results);
      setUnansweredFields(unanswered);
      await inspectForm();

      const filledCount = results.filter(
        (item) => item.status === "filled" || item.status === "already_filled",
      ).length;
      setActionStatus(
        unanswered.length > 0 ? "warning" : "success",
        unanswered.length > 0
          ? `Autofilled ${filledCount} field(s). ${unanswered.length} field(s) need your review.`
          : `Autofilled ${filledCount} field(s). Please inspect and proceed to next step.`,
      );
    } finally {
      setLoadingButton(null);
    }
  }, [latestForm, inspectForm, setActionStatus]);

  const fillAndNext = useCallback(async () => {
    setLoadingButton("fillAndNext");
    setActionStatus("running", "🔄 Preparing application plan and extracting form fields...");
    try {
      let form = latestForm?.kind === "application_form" ? latestForm : await inspectForm();
      if (!form || form.kind !== "application_form") {
        const openRes = await send({ type: "application.open-linkedin-active" }).catch(() => null);
        if (openRes?.ok) {
          await wait(300);
          form = await inspectForm();
        }
      }
      if (!form || form.kind !== "application_form") {
        setActionStatus("error", "❌ No application form popup detected. Please open Easy Apply first.");
        return;
      }
      if (await ensurePlanPrepared() && latestPlan) {
        setActionStatus("running", "🔄 Matching answers, autofilling, and proceeding...");
        const response = await send({ type: "application.fill-and-next-active", applicationId: latestPlan.application_id });
        if (response.ok) {
          setFillResults(response.fillResults || []);
          setUnansweredFields(response.unansweredFields || []);
          if (response.plan) setLatestPlan(response.plan);
          await inspectForm();
          if (response.stepAdvanced) {
            setActionStatus("success", `✅ Form filled and moved to next step (${response.actionLabel || "Next"})!`);
            return;
          }
        }
      }
      const res = await executeMoveNext(inspectForm);
      setActionStatus(res.success ? "success" : "error", res.success ? res.message || "Moved to next step" : res.error || "Failed");
    } finally {
      setLoadingButton(null);
    }
  }, [latestForm, inspectForm, ensurePlanPrepared, latestPlan, setActionStatus]);

  const runAction = useCallback(
    async (btnName: string, runningMsg: string, fn: () => Promise<{ success: boolean; message?: string; error?: string }>) => {
      setLoadingButton(btnName);
      setActionStatus("running", runningMsg);
      try {
        const res = await fn();
        setActionStatus(res.success ? "success" : "error", res.success ? res.message || "Done" : res.error || "Failed");
      } finally {
        setLoadingButton(null);
      }
    },
    [setActionStatus],
  );

  const openLinkedIn = () => runAction("open", "🔄 Attempting to open Easy Apply modal...", () => executeOpenLinkedIn(inspectForm));
  const moveNext = () => runAction("next", "🔄 Requesting Next step...", () => executeMoveNext(inspectForm));
  const movePrevious = () => runAction("previous", "🔄 Requesting Previous step...", () => executeMovePrevious(inspectForm));

  const submitApplication = useCallback(async () => {
    setLoadingButton("submit");
    setActionStatus("running", "🔄 Confirming Plan and submitting LinkedIn application...");
    try {
      let plan = latestPlan ?? (latestInspection?.kind === "job" ? await createPlan() : null);
      if (!plan) return setActionStatus("error", "❌ Submission failed: Application plan not created.");

      const response = await send({ type: "application.submit-linkedin-active", applicationId: plan.application_id });
      if (!response.ok) return setActionStatus("error", `❌ Application submission failed: ${response.error}`);
      setActionStatus("success", `🎉 ${response.linkedinApplication?.message || "LinkedIn application successfully submitted!"}`);
      if (response.plan) setLatestPlan(response.plan);
    } finally {
      setLoadingButton(null);
    }
  }, [latestPlan, latestInspection, createPlan, setActionStatus]);

  const autoRunLinkedIn = useCallback(async () => {
    setLoadingButton("autoRun");
    setActionStatus("running", "⚡ Starting auto-apply workflow, analyzing & filling form...");
    try {
      const res = await executeAutoRun(latestPlan?.application_id);
      if (!res.success) return setActionStatus("error", res.error || "Failed");
      if (res.plan) setLatestPlan(res.plan);
      if (res.fillResults) setFillResults(res.fillResults);
      if (res.unansweredFields) setUnansweredFields(res.unansweredFields);
      setActionStatus(
        res.autoStatus === "paused_for_user" ? "warning" : "success",
        res.autoStatus === "paused_for_user" ? `⏸️ Auto-apply paused: ${res.autoMessage || "Please complete remaining fields on page."}` : `✅ ${res.autoMessage || "Auto-apply phase completed!"}`,
      );
    } finally {
      setLoadingButton(null);
    }
  }, [latestPlan, setActionStatus]);

  const recordApplication = useCallback(async () => {
    setLoadingButton("record");
    setActionStatus("running", "📝 Recording application info...");
    try {
      let plan = latestPlan;
      if (!plan && latestInspection?.kind === "job") {
        plan = await createPlan();
      }
      if (!plan) {
        setActionStatus("error", "❌ Record failed: Unable to extract job info from current page.");
        return;
      }

      const applicationId = plan.application_id;

      // Reconcile plan state transitions so backend accepts mark_submitted
      if (["planned", "awaiting_user_review"].includes(plan.plan.state)) {
        const prepRes = await send({
          type: "application.plan-action-active",
          applicationId,
          action: "prepare",
        }).catch(() => null);
        if (prepRes?.ok && prepRes.plan) plan = prepRes.plan;
      }

      if (plan.plan.state === "preparing") {
        const markPrepRes = await send({
          type: "application.plan-action-active",
          applicationId,
          action: "mark_prepared",
        }).catch(() => null);
        if (markPrepRes?.ok && markPrepRes.plan) plan = markPrepRes.plan;
      }

      if (plan.plan.state === "awaiting_user_review") {
        const appRes = await send({
          type: "application.plan-action-active",
          applicationId,
          action: "approve",
        }).catch(() => null);
        if (appRes?.ok && appRes.plan) plan = appRes.plan;
      }

      const response = await send({
        type: "application.plan-action-active",
        applicationId,
        action: "mark_submitted",
        reason: "Manually recorded via browser extension",
      });

      if (response.ok && response.plan) {
        setLatestPlan(response.plan);
        setActionStatus("success", "🎉 Application record successfully saved! View on /applications page.");
      } else {
        const errMsg = !response.ok ? response.error : "Error saving application record.";
        setActionStatus("error", `❌ Record failed: ${errMsg}`);
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : "An exception occurred while recording.";
      setActionStatus("error", `❌ Record failed: ${msg}`);
    } finally {
      setLoadingButton(null);
    }
  }, [latestPlan, latestInspection, createPlan, setActionStatus]);

  return {
    latestPlan,
    setLatestPlan,
    status,
    fillResults,
    unansweredFields,
    loadingButton,
    createPlan,
    applyPlanAction,
    autofillForm,
    fillAndNext,
    openLinkedIn,
    moveNext,
    movePrevious,
    submitApplication,
    recordApplication,
    autoRunLinkedIn,
  };
}
