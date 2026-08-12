import { elementsInScope, inspectVisibleFormFields, isVisibleElement } from "/src/content/dom/form-inspector.ts.js";
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
  "section"
].join(", ");
const ACTION_SELECTOR = [
  "button",
  "input[type='button']",
  "input[type='submit']",
  "[role='button']",
  "a",
  "[class*='button' i]",
  "[class*='btn' i]"
].join(", ");
function cleanText(value) {
  return (value || "").replace(/\s+/g, " ").trim();
}
function isModalLike(element) {
  return element.matches("dialog, [role='dialog'], [aria-modal='true'], [data-modal], [data-testid*='modal' i], [class*='modal' i]");
}
function isFormContainerLike(element) {
  return element.matches(
    "[class*='apply' i], [class*='form' i], [class*='career' i], [class*='wizard' i], [class*='stage' i], [class*='t1-' i], [id*='apply' i], [id*='form' i], [id*='wizard' i], [id*='t1-' i], [data-testid*='apply' i], [data-testid*='form' i], [data-testid*='wizard' i]"
  );
}
function actionLabel(element) {
  return cleanText(
    element.textContent || element.getAttribute("aria-label") || element.getAttribute("value") || element.getAttribute("title")
  );
}
const SUBMIT_ACTION_REGEX = /(?:submit|apply|send|finish|complete|confirm|提交|申请|发送|完成|确认)/i;
const NEXT_ACTION_REGEX = /(?:continue|next|review|proceed|save|继续|下一步|审核|保存)/i;
const PREVIOUS_ACTION_REGEX = /(?:back|previous|返回|上一步)/i;
function hasFormAction(scope) {
  return elementsInScope(scope).some((element) => {
    if (!element.matches(ACTION_SELECTOR) || !isVisibleElement(element)) return false;
    const label = actionLabel(element);
    return SUBMIT_ACTION_REGEX.test(label) || NEXT_ACTION_REGEX.test(label);
  });
}
function scoreCandidate(candidate) {
  const fields = inspectVisibleFormFields(candidate);
  if (fields.length === 0) return -1;
  let score = fields.length * 25;
  if (candidate.matches("form")) score += 70;
  if (isModalLike(candidate)) score += 90;
  if (isFormContainerLike(candidate)) score += 40;
  if (hasFormAction(candidate)) score += 20;
  if (isVisibleElement(candidate)) score += 10;
  return score;
}
export function findActiveFormScope(root = document) {
  const candidates = elementsInScope(root).filter((element) => element.matches(CANDIDATE_SELECTOR)).slice(-120);
  let best = null;
  let bestScore = -1;
  for (const candidate of candidates) {
    const score = scoreCandidate(candidate);
    if (score > bestScore) {
      best = candidate;
      bestScore = score;
    }
  }
  if (!best) {
    const docFields = inspectVisibleFormFields(root);
    if (docFields.length > 0) return root;
  }
  return best;
}
export function readGenericAction(scope) {
  let actions = elementsInScope(scope).filter((element) => element.matches(ACTION_SELECTOR) && isVisibleElement(element)).map(actionLabel).filter(Boolean);
  let submit = actions.find((label) => SUBMIT_ACTION_REGEX.test(label));
  if (submit) return { label: submit, action: "submit" };
  if (scope !== document) {
    const docActions = elementsInScope(document).filter((element) => element.matches(ACTION_SELECTOR) && isVisibleElement(element)).map(actionLabel).filter(Boolean);
    submit = docActions.find((label) => SUBMIT_ACTION_REGEX.test(label));
    if (submit) return { label: submit, action: "submit" };
    actions = docActions;
  }
  const next = actions.find((label) => NEXT_ACTION_REGEX.test(label));
  return next ? { label: next, action: "next" } : {};
}
export function hasGenericBackAction(scope) {
  const check = (s) => elementsInScope(s).some((element) => {
    if (!element.matches(ACTION_SELECTOR) || !isVisibleElement(element)) return false;
    return PREVIOUS_ACTION_REGEX.test(actionLabel(element));
  });
  return check(scope) || (scope !== document ? check(document) : false);
}
