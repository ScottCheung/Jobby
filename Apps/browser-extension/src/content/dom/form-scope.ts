import type { FormScope } from "./form-inspector";
import { inspectVisibleFormFields, isVisibleElement } from "./form-inspector";
import type { FormNavigation } from "../../shared/contracts/form-inspection";

const CANDIDATE_SELECTOR = [
  "form",
  "dialog",
  "[role='dialog']",
  "[aria-modal='true']",
  "[data-modal]",
  "[data-testid*='modal' i]",
  "[class*='modal' i]",
  "[class*='apply' i]",
  "[class*='form' i]",
  "[class*='career' i]",
  "[class*='wizard' i]",
  "[class*='stage' i]",
  "[class*='t1-' i]",
  "[id*='apply' i]",
  "[id*='form' i]",
  "[id*='wizard' i]",
  "[id*='t1-' i]",
  "[data-testid*='apply' i]",
  "[data-testid*='form' i]",
  "[data-testid*='wizard' i]",
  "main",
  "section",
].join(", ");

const CONTROL_SIGNAL_SELECTOR = [
  "input:not([type='hidden']):not([type='button']):not([type='submit'])",
  "select",
  "textarea",
  "[role='combobox']",
  "[role='checkbox']",
].join(", ");

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

function isModalLike(element: HTMLElement): boolean {
  return element.matches("dialog, [role='dialog'], [aria-modal='true'], [data-modal], [data-testid*='modal' i], [class*='modal' i]");
}

function isFormContainerLike(element: HTMLElement): boolean {
  return element.matches(
    "[class*='apply' i], [class*='form' i], [class*='career' i], [class*='wizard' i], [class*='stage' i], [class*='t1-' i], [id*='apply' i], [id*='form' i], [id*='wizard' i], [id*='t1-' i], [data-testid*='apply' i], [data-testid*='form' i], [data-testid*='wizard' i]",
  );
}

function actionLabel(element: HTMLElement): string {
  return cleanText(
    element.textContent ||
      element.getAttribute("aria-label") ||
      element.getAttribute("value") ||
      element.getAttribute("title"),
  );
}

const SUBMIT_ACTION_REGEX = /(?:submit|apply|send|finish|complete|confirm|提交|申请|发送|完成|确认)/i;
const NEXT_ACTION_REGEX = /(?:continue|next|review|proceed|save|继续|下一步|审核|保存)/i;
const PREVIOUS_ACTION_REGEX = /(?:back|previous|返回|上一步)/i;
const APPLICATION_INTENT_REGEX = /(?:application questions?|apply for (?:this|the) (?:job|role)|candidate (?:details|information)|resume|curriculum vitae|cover letter|work authori[sz]ation|right to work|sponsorship|employment history|work experience)/i;

function isEnabled(element: HTMLElement): boolean {
  return !element.matches(":disabled") && element.getAttribute("aria-disabled") !== "true";
}

function hasFormAction(scope: FormScope): boolean {
  const actions = Array.from(scope.querySelectorAll<HTMLElement>(ACTION_SELECTOR));
  return actions.some((element) => {
    if (!isVisibleElement(element)) return false;
    const label = actionLabel(element);
    return SUBMIT_ACTION_REGEX.test(label) || NEXT_ACTION_REGEX.test(label);
  });
}

function scoreCandidate(candidate: HTMLElement): number {
  if (candidate.matches("body, html")) {
    return -1;
  }

  // Fast check: avoid expensive inspectVisibleFormFields if candidate has no inputs/controls
  const hasControls = Boolean(candidate.querySelector(CONTROL_SIGNAL_SELECTOR));
  if (!hasControls && !candidate.matches("form, dialog, [role='dialog'], [aria-modal='true']")) {
    return -1;
  }

  const fields = inspectVisibleFormFields(candidate);
  if (fields.length === 0) return -1;

  let score = Math.min(fields.length, 6) * 25;
  if (candidate.matches("form")) score += 70;
  if (isModalLike(candidate)) score += 90;
  if (isFormContainerLike(candidate)) score += 40;
  if (hasFormAction(candidate)) score += 20;
  const candidateText = cleanText(candidate.textContent);
  if (APPLICATION_INTENT_REGEX.test(candidateText)) score += 60;
  if (candidate.closest("nav, header, footer, aside, [role='navigation'], [role='complementary']")) score -= 80;
  if (candidate.querySelector("dialog, [role='dialog'], [aria-modal='true'], [data-modal], .artdeco-modal")) {
    score -= 100;
  }
  if (isVisibleElement(candidate)) score += 10;
  return score;
}

export function findActiveFormScope(root: Document | ShadowRoot = document): FormScope | null {
  const allCandidates = Array.from(root.querySelectorAll<HTMLElement>(CANDIDATE_SELECTOR));
  const candidates = allCandidates
    .filter((el) => isVisibleElement(el) && (el.matches("form, dialog, [role='dialog'], [aria-modal='true']") || Boolean(el.querySelector(CONTROL_SIGNAL_SELECTOR))))
    .slice(-20);

  let best: HTMLElement | null = null;
  let bestScore = -1;
  for (const candidate of candidates) {
    const score = scoreCandidate(candidate);
    if (score > bestScore) {
      best = candidate;
      bestScore = score;
    }
  }
  if (!best && root === document) {
    const hasAnyControls = Boolean(document.querySelector(CONTROL_SIGNAL_SELECTOR));
    if (hasAnyControls) {
      const docFields = inspectVisibleFormFields(root);
      if (docFields.length > 0) return root;
    }
  }
  return best;
}

function genericForwardKind(label: string): "next" | "review" | "submit" | undefined {
  if (SUBMIT_ACTION_REGEX.test(label)) return "submit";
  if (/(?:review|审核)/i.test(label)) return "review";
  if (NEXT_ACTION_REGEX.test(label)) return "next";
  return undefined;
}

function visibleActionEntries(scope: FormScope) {
  return Array.from(scope.querySelectorAll<HTMLElement>(ACTION_SELECTOR))
    .filter((element) => isVisibleElement(element))
    .map((element) => ({
      element,
      label: actionLabel(element),
      enabled: isEnabled(element),
    }))
    .filter((entry) => Boolean(entry.label));
}

export function readGenericNavigation(scope: FormScope): FormNavigation {
  const actions = visibleActionEntries(scope);
  const back = actions.find((entry) => PREVIOUS_ACTION_REGEX.test(entry.label));
  const submit = actions.find((entry) => SUBMIT_ACTION_REGEX.test(entry.label));
  const next = actions.find((entry) => NEXT_ACTION_REGEX.test(entry.label));
  const forward = submit || next;
  return {
    ...(back
      ? {
          back: {
            kind: "previous" as const,
            label: back.label,
            visible: true,
            enabled: back.enabled,
          },
        }
      : {}),
    ...(forward
      ? {
          forward: {
            kind: genericForwardKind(forward.label) || "next",
            label: forward.label,
            visible: true,
            enabled: forward.enabled,
          },
        }
      : {}),
  };
}

export function readGenericAction(scope: FormScope): {
  label?: string;
  action?: "next" | "submit";
  enabled?: boolean;
} {
  const forward = readGenericNavigation(scope).forward;
  if (!forward) return {};
  return {
    label: forward.label,
    action: forward.kind === "submit" ? "submit" : "next",
    enabled: forward.enabled,
  };
}
