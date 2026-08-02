import type { FormScope } from "./form-inspector";
import { elementsInScope, inspectVisibleFormFields, isVisibleElement } from "./form-inspector";

const CANDIDATE_SELECTOR = [
  "form",
  "dialog",
  "[role='dialog']",
  "[aria-modal='true']",
  "[data-modal]",
  "[data-testid*='modal' i]",
  "[class*='modal' i]",
].join(", ");

const ACTION_SELECTOR = "button, input[type='submit'], [role='button']";

function cleanText(value: string | null | undefined): string {
  return (value || "").replace(/\s+/g, " ").trim();
}

function isModalLike(element: HTMLElement): boolean {
  return element.matches("dialog, [role='dialog'], [aria-modal='true'], [data-modal], [data-testid*='modal' i], [class*='modal' i]");
}

function actionLabel(element: HTMLElement): string {
  return cleanText(element.textContent || element.getAttribute("aria-label") || element.getAttribute("value"));
}

function hasFormAction(scope: FormScope): boolean {
  return elementsInScope(scope).some((element) => {
    if (!element.matches(ACTION_SELECTOR) || !isVisibleElement(element)) return false;
    return /submit|continue|next|review|apply|finish|save|send|提交|继续|下一步|审核|申请|完成|保存/i.test(actionLabel(element));
  });
}

function scoreCandidate(candidate: HTMLElement): number {
  const fields = inspectVisibleFormFields(candidate);
  if (fields.length === 0) return -1;

  let score = fields.length * 25;
  if (candidate.matches("form")) score += 70;
  if (isModalLike(candidate)) score += 90;
  if (hasFormAction(candidate)) score += 20;
  if (isVisibleElement(candidate)) score += 10;
  return score;
}

export function findActiveFormScope(root: Document | ShadowRoot = document): FormScope | null {
  const candidates = elementsInScope(root)
    .filter((element) => element.matches(CANDIDATE_SELECTOR))
    .slice(-120);

  let best: HTMLElement | null = null;
  let bestScore = -1;
  for (const candidate of candidates) {
    const score = scoreCandidate(candidate);
    if (score > bestScore) {
      best = candidate;
      bestScore = score;
    }
  }
  return best;
}

export function readGenericAction(scope: FormScope): { label?: string; action?: "next" | "submit" } {
  const actions = elementsInScope(scope)
    .filter((element) => element.matches(ACTION_SELECTOR) && isVisibleElement(element))
    .map(actionLabel)
    .filter(Boolean);
  const submit = actions.find((label) => /submit|apply|finish|send|提交|申请|完成/i.test(label));
  if (submit) return { label: submit, action: "submit" };
  const next = actions.find((label) => /continue|next|review|save|继续|下一步|审核|保存/i.test(label));
  return next ? { label: next, action: "next" } : {};
}

export function hasGenericBackAction(scope: FormScope): boolean {
  return elementsInScope(scope).some((element) => {
    if (!element.matches(ACTION_SELECTOR) || !isVisibleElement(element)) return false;
    return /back|previous|返回|上一步/i.test(actionLabel(element));
  });
}
