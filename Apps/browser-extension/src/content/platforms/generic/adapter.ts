import type { LinkedInApplicationAction, LinkedInApplicationResult } from "../../../shared/contracts/linkedin";
import { elementsInScope, isVisibleElement } from "../../dom/form-inspector";
import { findActiveFormScope } from "../../dom/form-scope";

const ACTION_SELECTOR = [
  "button",
  "input[type='button']",
  "input[type='submit']",
  "[role='button']",
  "a",
  "[class*='button' i]",
  "[class*='btn' i]",
].join(", ");

function cleanText(value: string | null | undefined): string {
  return (value || "").replace(/\s+/g, " ").trim();
}

function isEnabled(element: HTMLElement): boolean {
  if (element.matches(":disabled")) return false;
  if (element.getAttribute("aria-disabled") === "true") return false;
  if (element.hasAttribute("disabled")) return false;
  if (element.classList.contains("disabled") || element.classList.contains("is-disabled")) return false;
  return true;
}

function labelFor(element: HTMLElement): string {
  return cleanText(
    element.getAttribute("aria-label") ||
      element.getAttribute("value") ||
      element.getAttribute("title") ||
      element.textContent,
  );
}

function matchesAction(label: string, action: LinkedInApplicationAction): boolean {
  if (action === "previous") return /(?:back|previous|返回|上一步)/i.test(label);
  if (action === "submit") return /(?:submit|apply|send|finish|complete|confirm|提交|申请|发送|完成|确认)/i.test(label);
  return (
    /(?:continue|next|review|proceed|save|继续|下一步|审核|保存)/i.test(label) &&
    !/(?:submit|apply|send|finish|complete|confirm|提交|申请|发送|完成|确认)/i.test(label)
  );
}

export function getGenericApplicationAction(action: LinkedInApplicationAction): HTMLElement | null {
  const scope = findActiveFormScope() || document;
  const inScope = elementsInScope(scope).find(
    (element): element is HTMLElement =>
      element.matches(ACTION_SELECTOR) &&
      isVisibleElement(element) &&
      isEnabled(element) &&
      matchesAction(labelFor(element), action),
  );
  if (inScope) return inScope;

  if (scope !== document) {
    return (
      elementsInScope(document).find(
        (element): element is HTMLElement =>
          element.matches(ACTION_SELECTOR) &&
          isVisibleElement(element) &&
          isEnabled(element) &&
          matchesAction(labelFor(element), action),
      ) || null
    );
  }

  return null;
}

export async function clickGenericApplicationAction(
  action: LinkedInApplicationAction,
): Promise<LinkedInApplicationResult> {
  const button = getGenericApplicationAction(action);
  if (!button) {
    return {
      status: "unavailable",
      message:
        action === "previous"
          ? "The Back action is not available on this page."
          : action === "next"
            ? "The Continue action is not available on this page."
            : "The Submit action is not available on this page.",
      url: window.location.href,
    };
  }

  const actionLabel = labelFor(button) || undefined;
  try {
    button.scrollIntoView({ block: "center", inline: "nearest" });
  } catch {}

  const eventOptions = { bubbles: true, cancelable: true, composed: true };
  try {
    button.dispatchEvent(new PointerEvent("pointerdown", eventOptions));
  } catch {}
  button.dispatchEvent(new MouseEvent("mousedown", eventOptions));
  try {
    button.dispatchEvent(new PointerEvent("pointerup", eventOptions));
  } catch {}
  button.dispatchEvent(new MouseEvent("mouseup", eventOptions));
  button.click();

  const formElement = button.closest("form") || (button as HTMLButtonElement | HTMLInputElement).form;
  if (formElement && action === "submit") {
    window.setTimeout(() => {
      try {
        if (typeof formElement.requestSubmit === "function") {
          formElement.requestSubmit(button instanceof HTMLInputElement || button instanceof HTMLButtonElement ? button : undefined);
        }
      } catch {}
    }, 100);
  }

  return {
    status: "clicked",
    message:
      action === "previous"
        ? "Application moved to the previous step."
        : action === "next"
          ? "Application continued to the next step."
          : "Application submitted.",
    url: window.location.href,
    ...(actionLabel ? { actionLabel } : {}),
  };
}

const APPLY_BUTTON_SELECTOR = [
  "button",
  "a",
  "input[type='button']",
  "input[type='submit']",
  "[role='button']",
  "[class*='apply' i]",
  "[class*='button' i]",
  "[class*='btn' i]",
].join(", ");

const APPLY_TEXT_REGEX = /(?:apply\s+for\s+this\s+job|apply\s+now|apply\s+online|easy\s+apply|quick\s+apply|start\s+application|apply|申请该职位|申请职位|立即申请|申请)/i;

export function findGenericApplyTrigger(): HTMLElement | null {
  return (
    elementsInScope(document).find((element) => {
      if (!element.matches(APPLY_BUTTON_SELECTOR) || !isVisibleElement(element) || !isEnabled(element)) return false;
      const label = labelFor(element);
      return APPLY_TEXT_REGEX.test(label);
    }) || null
  );
}

export async function openGenericApplication(): Promise<LinkedInApplicationResult> {
  const currentUrl = window.location.href;
  const scope = findActiveFormScope();
  if (scope && scope !== document) {
    return {
      status: "already_open",
      message: "Application form is already open.",
      url: currentUrl,
    };
  }

  const trigger = findGenericApplyTrigger();
  if (!trigger) {
    return {
      status: "unavailable",
      message: "No Apply button was found on this page.",
      url: currentUrl,
    };
  }

  const label = labelFor(trigger);
  try {
    trigger.scrollIntoView({ block: "center", inline: "nearest" });
  } catch {}

  const eventOptions = { bubbles: true, cancelable: true, composed: true };
  try {
    trigger.dispatchEvent(new PointerEvent("pointerdown", eventOptions));
  } catch {}
  trigger.dispatchEvent(new MouseEvent("mousedown", eventOptions));
  try {
    trigger.dispatchEvent(new PointerEvent("pointerup", eventOptions));
  } catch {}
  trigger.dispatchEvent(new MouseEvent("mouseup", eventOptions));
  trigger.click();

  for (let attempt = 0; attempt < 10; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 150));
    const activeScope = findActiveFormScope();
    if (activeScope) {
      return {
        status: "opened",
        message: `Application form opened via "${label}".`,
        url: window.location.href,
      };
    }
  }

  return {
    status: "clicked",
    message: `Clicked "${label}"; waiting for application form to load.`,
    url: window.location.href,
  };
}
