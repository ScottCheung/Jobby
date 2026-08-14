import { useCallback, useEffect, useRef, useState } from "react";
import type { ExtensionPlanAction, ValidatedApplicationPlanResponse } from "../../shared/contracts/backend";
import type { FieldFillResult } from "../../shared/contracts/form-actions";
import type { FormInspection } from "../../shared/contracts/form-inspection";
import type { PageInspection } from "../../shared/contracts/page-inspection";
import { executeAutoRun, executeMoveNext, executeMovePrevious, executeOpenLinkedIn } from "../services/application-actions";
import { send, wait } from "../services/messaging";

export function useApplicationPlan(
  latestInspection: PageInspection | null,
  latestForm: FormInspection | null,
  inspectPage: () => Promise<void>,
  inspectForm: () => Promise<FormInspection | null>,
  reportError: (message: string) => void,
  applyAutofillResults: (results: FieldFillResult[], form?: FormInspection) => void,
) {
  const [latestPlan, setLatestPlan] = useState<ValidatedApplicationPlanResponse | null>(null);
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

  const createPlan = useCallback(async () => {
    const response = await send({
      type: "application.create-plan-active",
      ...(latestInspection ? { inspection: latestInspection } : {}),
    });
    if (!response.ok) {
      return null;
    }
    if (response.plan) setLatestPlan(response.plan);
    return response.plan ?? null;
  }, [latestInspection]);

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
        return;
      }

      const response = await send({ type: "form.autofill-active" }).catch((error: unknown) => ({
        ok: false as const,
        error: error instanceof Error ? error.message : "Autofill could not start.",
      }));
      if (!response.ok) {
        setFillResults([]);
        setUnansweredFields([]);
        reportError(response.error);
        return;
      }

      const results = response.fillResults || [];
      const unanswered = response.unansweredFields || [];
      setFillResults(results);
      setUnansweredFields(unanswered);
      applyAutofillResults(results, response.form);
      reportError('');
      await inspectForm();
    } finally {
      setLoadingButton(null);
    }
  }, [latestForm, inspectForm, reportError, applyAutofillResults]);

  const fillAndNext = useCallback(async () => {
    setLoadingButton("fillAndNext");
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
        return;
      }
      if (await ensurePlanPrepared() && latestPlan) {
        const response = await send({ type: "application.fill-and-next-active", applicationId: latestPlan.application_id });
        if (response.ok) {
          setFillResults(response.fillResults || []);
          setUnansweredFields(response.unansweredFields || []);
          if (response.plan) setLatestPlan(response.plan);
          await inspectForm();
          if (response.stepAdvanced) {
            return;
          }
        }
      }
      await executeMoveNext(inspectForm);
    } finally {
      setLoadingButton(null);
    }
  }, [latestForm, inspectForm, ensurePlanPrepared, latestPlan]);

  const runAction = useCallback(
    async (btnName: string, fn: () => Promise<{ success: boolean; message?: string; error?: string }>) => {
      setLoadingButton(btnName);
      try {
        await fn();
      } finally {
        setLoadingButton(null);
      }
    },
    [],
  );

  const openLinkedIn = () => runAction("open", () => executeOpenLinkedIn(inspectForm));
  const moveNext = () => runAction("next", () => executeMoveNext(inspectForm));
  const movePrevious = () => runAction("previous", () => executeMovePrevious(inspectForm));

  const submitApplication = useCallback(async () => {
    setLoadingButton("submit");
    try {
      let plan = latestPlan ?? (latestInspection?.kind === "job" ? await createPlan() : null);
      if (!plan) return;

      const response = await send({ type: "application.submit-linkedin-active", applicationId: plan.application_id });
      if (!response.ok) return;
      if (response.plan) setLatestPlan(response.plan);
    } finally {
      setLoadingButton(null);
    }
  }, [latestPlan, latestInspection, createPlan]);

  const autoRunLinkedIn = useCallback(async () => {
    setLoadingButton("autoRun");
    try {
      const res = await executeAutoRun(latestPlan?.application_id);
      if (!res.success) return;
      if (res.plan) setLatestPlan(res.plan);
      if (res.fillResults) setFillResults(res.fillResults);
      if (res.unansweredFields) setUnansweredFields(res.unansweredFields);
    } finally {
      setLoadingButton(null);
    }
  }, [latestPlan]);

  const recordApplication = useCallback(async () => {
    setLoadingButton("record");
    try {
      let plan = latestPlan;
      if (!plan && latestInspection?.kind === "job") {
        plan = await createPlan();
      }
      if (!plan) {
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
      }
    } catch (error) {
      // ignore
    } finally {
      setLoadingButton(null);
    }
  }, [latestPlan, latestInspection, createPlan]);

  return {
    latestPlan,
    setLatestPlan,
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
