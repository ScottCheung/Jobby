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
    message: "就绪：打开职位或 Easy Apply 弹窗后即可开始操作。",
  });
  const [fillResults, setFillResults] = useState<FieldFillResult[]>([]);
  const [unansweredFields, setUnansweredFields] = useState<Array<{ key: string; label: string; reason: string }>>([]);
  const [loadingButton, setLoadingButton] = useState<string | null>(null);
  const lastJobKey = useRef<string | null>(null);

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
        message: "已检测到新的职位，准备打开新的申请表。",
      });
    }
    lastJobKey.current = currentJobKey;
  }, [latestInspection]);

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
    setActionStatus("running", "正在根据你的资料匹配并填写当前表单...");
    try {
      const form =
        latestForm?.kind === "application_form" || latestForm?.kind === "page_input_fields"
          ? latestForm
          : await inspectForm();
      if (!form || (form.kind !== "application_form" && form.kind !== "page_input_fields")) {
        setActionStatus("error", "未检测到可填写的申请表单。请先打开申请表后重试。");
        return;
      }

      const response = await send({ type: "form.autofill-active" });
      if (!response.ok) {
        setActionStatus("error", `自动填充失败: ${response.error}`);
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
          ? `已自动填充 ${filledCount} 项，另有 ${unanswered.length} 项需要你确认。`
          : `已自动填充 ${filledCount} 项，请检查后继续下一步。`,
      );
    } finally {
      setLoadingButton(null);
    }
  }, [latestForm, inspectForm, setActionStatus]);

  const fillAndNext = useCallback(async () => {
    setLoadingButton("fillAndNext");
    setActionStatus("running", "🔄 正在准备申请计划并提取表单字段...");
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
        setActionStatus("error", "❌ 未检测到可用的申请表单弹窗，请先打开 Easy Apply。");
        return;
      }
      if (await ensurePlanPrepared() && latestPlan) {
        setActionStatus("running", "🔄 正在匹配答案、自动填写并点击下一步...");
        const response = await send({ type: "application.fill-and-next-active", applicationId: latestPlan.application_id });
        if (response.ok) {
          setFillResults(response.fillResults || []);
          setUnansweredFields(response.unansweredFields || []);
          if (response.plan) setLatestPlan(response.plan);
          await inspectForm();
          if (response.stepAdvanced) {
            setActionStatus("success", `✅ 已自动填表并跳至下一步 (${response.actionLabel || "Next"})！`);
            return;
          }
        }
      }
      const res = await executeMoveNext(inspectForm);
      setActionStatus(res.success ? "success" : "error", res.success ? res.message || "已跳转" : res.error || "失败");
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

  const openLinkedIn = () => runAction("open", "🔄 正在尝试打开 Easy Apply 弹窗...", () => executeOpenLinkedIn(inspectForm));
  const moveNext = () => runAction("next", "🔄 正在请求点击下一步...", () => executeMoveNext(inspectForm));
  const movePrevious = () => runAction("previous", "🔄 正在请求返回上一步...", () => executeMovePrevious(inspectForm));

  const submitApplication = useCallback(async () => {
    setLoadingButton("submit");
    setActionStatus("running", "🔄 正在自动完成 Plan 确认并提交 LinkedIn 申请...");
    try {
      let plan = latestPlan ?? (latestInspection?.kind === "job" ? await createPlan() : null);
      if (!plan) return setActionStatus("error", "❌ 提交失败: 尚未创建申请计划。");

      const response = await send({ type: "application.submit-linkedin-active", applicationId: plan.application_id });
      if (!response.ok) return setActionStatus("error", `❌ 提交申请失败: ${response.error}`);
      setActionStatus("success", `🎉 ${response.linkedinApplication?.message || "LinkedIn 申请已成功提交！"}`);
      if (response.plan) setLatestPlan(response.plan);
    } finally {
      setLoadingButton(null);
    }
  }, [latestPlan, latestInspection, createPlan, setActionStatus]);

  const autoRunLinkedIn = useCallback(async () => {
    setLoadingButton("autoRun");
    setActionStatus("running", "⚡ 自动投递启动中，正在连续分析与填表...");
    try {
      const res = await executeAutoRun(latestPlan?.application_id);
      if (!res.success) return setActionStatus("error", res.error || "失败");
      if (res.plan) setLatestPlan(res.plan);
      if (res.fillResults) setFillResults(res.fillResults);
      if (res.unansweredFields) setUnansweredFields(res.unansweredFields);
      setActionStatus(
        res.autoStatus === "paused_for_user" ? "warning" : "success",
        res.autoStatus === "paused_for_user" ? `⏸️ 自动投递暂停: ${res.autoMessage || "请在页面完成字段填写。"}` : `✅ ${res.autoMessage || "自动投递阶段已完成！"}`,
      );
    } finally {
      setLoadingButton(null);
    }
  }, [latestPlan, setActionStatus]);

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
    autoRunLinkedIn,
  };
}
