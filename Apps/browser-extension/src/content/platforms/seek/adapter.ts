import type { ApplicationAction, ApplicationActionResult } from "../../../shared/contracts/application-navigation";
import type { FormNavigation } from "../../../shared/contracts/form-inspection";
import type { FormScope } from "../../dom/form-inspector";

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

function matchesAction(label: string, action: ApplicationAction): boolean {
  if (action === "previous") return /(?:back|previous|返回|上一步)/i.test(label);
  if (action === "submit") return /(?:submit|apply|send|finish|提交|申请|发送|完成)/i.test(label);
  return (
    /(?:continue|next|review|proceed|继续|下一步|审核)/i.test(label) &&
    !/(?:submit|apply|send|finish|提交|申请|发送|完成)/i.test(label)
  );
}

export function getSeekApplicationAction(
  action: ApplicationAction,
  scope: FormScope | null = document,
): HTMLElement | null {
  if (!scope) return null;
  return Array.from(scope.querySelectorAll<HTMLElement>(ACTION_SELECTOR)).find(
    (element) => isVisible(element) && matchesAction(labelFor(element), action),
  ) || null;
}

export function getSeekApplicationActionKind(
  scope: FormScope | null = document,
): "next" | "submit" | undefined {
  if (getSeekApplicationAction("submit", scope)) return "submit";
  if (getSeekApplicationAction("next", scope)) return "next";
  return undefined;
}

export function getSeekApplicationNavigation(
  scope: FormScope | null = document,
): FormNavigation {
  const previous = getSeekApplicationAction("previous", scope);
  const forwardKind = getSeekApplicationActionKind(scope);
  const forward = forwardKind
    ? getSeekApplicationAction(forwardKind, scope)
    : null;
  return {
    ...(previous
      ? {
          back: {
            kind: "previous" as const,
            label: labelFor(previous),
            visible: true,
            enabled: isEnabled(previous),
          },
        }
      : {}),
    ...(forward
      ? {
          forward: {
            kind:
              /(?:review|审核)/i.test(labelFor(forward))
                ? ("review" as const)
                : forwardKind || "next",
            label: labelFor(forward),
            visible: true,
            enabled: isEnabled(forward),
          },
        }
      : {}),
  };
}

export async function clickSeekApplicationAction(
  action: ApplicationAction,
  scope: FormScope | null = document,
): Promise<ApplicationActionResult> {
  const button = getSeekApplicationAction(action, scope);
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
  if (!isEnabled(button)) {
    return {
      status: "unavailable",
      message: "The SEEK application action is not enabled yet.",
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
        : "SEEK submission click was dispatched, but confirmation is unavailable.",
    url: window.location.href,
    ...(actionLabel ? { actionLabel } : {}),
    ...(action === "submit" ? { verified: false } : {}),
  };
}
