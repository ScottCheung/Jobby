import type { ValidatedApplicationPlanResponse } from "../../shared/contracts/backend";
import type { FieldFillResult } from "../../shared/contracts/form-actions";
import type { FormInspection } from "../../shared/contracts/form-inspection";
import { send, wait } from "./messaging";

export interface ApplicationActionResult {
  success: boolean;
  message?: string;
  error?: string;
  plan?: ValidatedApplicationPlanResponse;
  fillResults?: FieldFillResult[];
  unansweredFields?: Array<{ key: string; label: string; reason: string }>;
  autoStatus?: string;
  autoMessage?: string;
}

export async function executeOpenLinkedIn(
  inspectForm: () => Promise<FormInspection | null>,
): Promise<ApplicationActionResult> {
  const response = await send({ type: "application.open-linkedin-active" });
  if (!response.ok) {
    return { success: false, error: `❌ 打开发生错误: ${response.error}` };
  }
  let form: FormInspection | null = null;
  for (let attempt = 0; attempt < 12; attempt += 1) {
    await wait(attempt === 0 ? 100 : 150);
    form = await inspectForm();
    if (form?.kind === "application_form") break;
  }
  if (form?.kind === "application_form" || response.linkedinApplication?.status === "opened") {
    return {
      success: true,
      message:
        form?.kind === "application_form"
          ? "✅ Easy Apply 申请弹窗和表单已就绪！"
          : "✅ Easy Apply 申请弹窗已打开，表单字段仍在加载，请再次检测表单。",
    };
  }
  return {
    success: false,
    error:
      form?.kind === "not_application_form"
        ? form.reason
        : response.linkedinApplication?.message || "未检测到可用的 Easy Apply 按钮。",
  };
}

export async function executeMoveNext(
  inspectForm: () => Promise<FormInspection | null>,
): Promise<ApplicationActionResult> {
  const response = await send({ type: "application.linkedin-action-active", action: "next" });
  if (!response.ok) {
    return { success: false, error: `❌ 点击下一步失败: ${response.error}` };
  }
  await wait(80);
  await inspectForm();
  return { success: true, message: `✅ ${response.linkedinApplication?.message || "已移动至下一步。"}` };
}

export async function executeMovePrevious(
  inspectForm: () => Promise<FormInspection | null>,
): Promise<ApplicationActionResult> {
  const response = await send({ type: "application.linkedin-action-active", action: "previous" });
  if (!response.ok) {
    return { success: false, error: `❌ 返回上一步失败: ${response.error}` };
  }
  await wait(80);
  await inspectForm();
  return { success: true, message: `✅ ${response.linkedinApplication?.message || "已返回上一步。"}` };
}

export async function executeAutoRun(
  latestPlanId?: string,
): Promise<ApplicationActionResult> {
  const response = await send({
    type: "application.auto-run-linkedin-active",
    ...(latestPlanId ? { applicationId: latestPlanId } : {}),
  });
  if (!response.ok) {
    return { success: false, error: `❌ 自动投递中断: ${response.error}` };
  }
  return {
    success: true,
    plan: response.plan,
    fillResults: response.fillResults,
    unansweredFields: response.unansweredFields,
    autoStatus: response.autoStatus,
    autoMessage: response.autoMessage,
  };
}
