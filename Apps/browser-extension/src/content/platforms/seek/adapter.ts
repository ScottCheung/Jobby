import type { LinkedInApplicationAction, LinkedInApplicationResult } from "../../../shared/contracts/linkedin";

const ACTION_SELECTOR = "button, input[type='button'], input[type='submit'], [role='button']";

function cleanText(value: string | null | undefined): string {
  return (value || "").replace(/\s+/g, " ").trim();
}

function isVisible(element: HTMLElement): boolean {
  const style = window.getComputedStyle(element);
  const rect = element.getBoundingClientRect();
  return style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0;
}

function isEnabled(element: HTMLElement): boolean {
  return !element.matches(":disabled") && element.getAttribute("aria-disabled") !== "true";
}

function labelFor(element: HTMLElement): string {
  return cleanText(
    element.getAttribute("aria-label") ||
      element.getAttribute("value") ||
      element.textContent,
  );
}

function matchesAction(label: string, action: LinkedInApplicationAction): boolean {
  if (action === "previous") return /(?:back|previous|返回|上一步)/i.test(label);
  if (action === "submit") return /(?:submit|apply|send|finish|提交|申请|发送|完成)/i.test(label);
  return (
    /(?:continue|next|review|proceed|继续|下一步|审核)/i.test(label) &&
    !/(?:submit|apply|send|finish|提交|申请|发送|完成)/i.test(label)
  );
}

export function getSeekApplicationAction(action: LinkedInApplicationAction): HTMLElement | null {
  return Array.from(document.querySelectorAll<HTMLElement>(ACTION_SELECTOR)).find(
    (element) => isVisible(element) && isEnabled(element) && matchesAction(labelFor(element), action),
  ) || null;
}

export function getSeekApplicationActionLabel(): string | undefined {
  const action = getSeekApplicationAction("submit") || getSeekApplicationAction("next") || getSeekApplicationAction("previous");
  return action ? labelFor(action) || undefined : undefined;
}

export function getSeekApplicationActionKind(): "next" | "submit" | undefined {
  if (getSeekApplicationAction("submit")) return "submit";
  if (getSeekApplicationAction("next")) return "next";
  return undefined;
}

export async function clickSeekApplicationAction(action: LinkedInApplicationAction): Promise<LinkedInApplicationResult> {
  const button = getSeekApplicationAction(action);
  if (!button) {
    return {
      status: "unavailable",
      message: action === "previous"
        ? "The SEEK Back action is not available."
        : action === "next"
          ? "The SEEK Continue action is not available."
          : "The SEEK submit action is not available.",
      url: window.location.href,
    };
  }

  const actionLabel = labelFor(button) || undefined;
  button.scrollIntoView({ block: "center", inline: "nearest" });
  button.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true }));
  button.dispatchEvent(new MouseEvent("mouseup", { bubbles: true, cancelable: true }));
  button.click();
  return {
    status: "clicked",
    message: action === "previous"
      ? "SEEK application moved to the previous step."
      : action === "next"
        ? "SEEK application continued to the next step."
        : "SEEK application submitted.",
    url: window.location.href,
    ...(actionLabel ? { actionLabel } : {}),
  };
}
