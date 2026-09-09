import {
  inspectVisibleFormFields,
  isVisibleElement,
  queryAllInScope,
  type FormScope,
} from '../../dom/form-inspector';
import { findLinkedInResumeUpload } from './resume-upload';

export type LinkedInApplySurfaceState =
  | 'classic-modal'
  | 'artdeco-modal'
  | 'native-dialog'
  | 'full-page'
  | 'unknown';

export interface LinkedInApplySurface {
  root: HTMLElement;
  fieldRoot: HTMLElement;
  state: LinkedInApplySurfaceState;
  topLayer: boolean;
  candidateCount: number;
}

export const LINKEDIN_APPLICATION_FIELD_SELECTOR =
  "input:not([type='hidden']), select, textarea, [role='radio'], [role='radiogroup'], [role='combobox'], [role='checkbox'], input[type='file']";

const APPLICATION_ROOT_SELECTORS = [
  'form.jobs-easy-apply-form',
  '.jobs-easy-apply-modal',
  '.jobs-easy-apply-content',
  '#artdeco-modal-outlet .artdeco-modal',
  '#artdeco-modal-outlet [role="dialog"]',
  '#artdeco-modal-outlet [data-test-modal]',
  '#artdeco-modal-outlet [data-test-modal-container]',
  '.artdeco-modal',
  'dialog',
  '[role="dialog"]',
  '[aria-modal="true"]',
  '[data-test-modal]',
  '[data-test-modal-container]',
  '[data-testid*="apply" i]',
  '[data-test*="apply" i]',
  '[data-testid*="application" i]',
  '[data-test*="application" i]',
  '[class*="apply" i]',
  '[id*="apply" i]',
  '[class*="application" i]',
  '[id*="application" i]',
];

const FULL_PAGE_SELECTORS = [
  'form',
  'main',
  '[data-testid*="application" i]',
  '[data-test*="application" i]',
  '[data-testid*="apply" i]',
  '[data-test*="apply" i]',
  '[class*="application" i]',
  '[class*="apply" i]',
];

const FIELD_ROOT_SELECTORS = [
  'form.jobs-easy-apply-form',
  'form',
  '[aria-current="step"]',
  '[aria-selected="true"][role="tabpanel"]',
  '[role="tabpanel"]',
  '[data-state="active"]',
  '[data-testid*="step" i]',
  '[data-test*="step" i]',
  '[class*="step" i]',
  '[data-testid*="question" i]',
  '[data-test*="question" i]',
  '[class*="question" i]',
  '.artdeco-modal__content',
  '[class*="form" i]',
  '[class*="content" i]',
  'fieldset',
  'section',
];

const ACTION_SELECTOR =
  "button, input[type='submit'], input[type='button'], [role='button']";
const ACTION_PATTERN =
  /(?:continue|next|review|submit|previous|back|apply|继续|下一步|审核|提交|上一步|返回)/i;
const APPLY_HEADING_PATTERN =
  /(?:^|\b)(?:easy\s+apply|apply\s+to|your\s+application|application\s+questions?|additional\s+questions?|review\s+your\s+application|resume|cover\s+letter|申请|应聘)(?:\b|$)/i;
const NON_APPLICATION_PATTERN =
  /(?:job\s*alert|search\s*alert|create\s*alert|search\s+(?:by|jobs|filters?)|job\s+search|select\s+language|language\s+selector|职位提醒|求职提醒|创建求职通知|搜索职位|搜索地点|选择语言)/i;
const NOISE_FIELD_PATTERN =
  /^(?:search(?:\s+(?:by|jobs))?.*|keywords?.*|city,?\s*state.*|select language|language(?:\s+selector)?|date posted|easy apply|job alert|job search|搜索职位|搜索地点|选择语言|职位提醒|求职提醒)$/i;

function cleanText(value: string | null | undefined): string {
  return (value || '').replace(/\s+/g, ' ').trim();
}

function allElements(root: ParentNode): HTMLElement[] {
  return queryAllInScope<HTMLElement>(root as FormScope, '*');
}

function elementsMatching(
  root: ParentNode,
  selectors: readonly string[],
): HTMLElement[] {
  const seen = new Set<HTMLElement>();
  const result: HTMLElement[] = [];
  const elements = allElements(root);
  for (const selector of selectors) {
    for (const element of elements) {
      if (!element.matches(selector) || seen.has(element)) continue;
      seen.add(element);
      result.push(element);
    }
  }
  return result;
}

function isNativeDialog(element: HTMLElement): boolean {
  return element.tagName === 'DIALOG';
}

function isTopLayerDialog(element: HTMLElement): boolean {
  if (!isNativeDialog(element)) return false;
  try {
    if (element.matches('dialog:modal')) return true;
  } catch {
    // Older engines may not implement :modal.
  }
  // A validated LinkedIn application <dialog> is modal in the fallback case;
  // this keeps test/older engines useful when :modal is unavailable.
  return element.hasAttribute('open');
}

function hasInactiveAncestor(element: HTMLElement): boolean {
  let current: HTMLElement | null = element;
  while (current) {
    if (
      current.hidden ||
      current.hasAttribute('inert') ||
      current.getAttribute('aria-hidden') === 'true' ||
      (isNativeDialog(current) && !current.hasAttribute('open'))
    ) {
      return true;
    }
    const style = window.getComputedStyle(current);
    if (
      style.display === 'none' ||
      style.visibility === 'hidden' ||
      style.visibility === 'collapse' ||
      style.opacity === '0'
    ) {
      return true;
    }
    current = current.parentElement;
  }
  return false;
}

function intersectsViewport(element: HTMLElement): boolean {
  const rect = element.getBoundingClientRect();
  if (rect.width === 0 && rect.height === 0) return true;
  const viewportWidth = window.innerWidth || document.documentElement.clientWidth;
  const viewportHeight = window.innerHeight || document.documentElement.clientHeight;
  if (!viewportWidth || !viewportHeight) return true;
  return (
    rect.right > 0 &&
    rect.bottom > 0 &&
    rect.left < viewportWidth &&
    rect.top < viewportHeight
  );
}

function isActiveElement(element: HTMLElement): boolean {
  return (
    isVisibleElement(element) &&
    !hasInactiveAncestor(element) &&
    intersectsViewport(element)
  );
}

function headingText(root: ParentNode): string {
  return elementsMatching(root, [
    'h1',
    'h2',
    'h3',
    '[role="heading"]',
  ])
    .map((element) => cleanText(element.getAttribute('aria-label') || element.textContent))
    .find((text) => text.length > 0 && text.length <= 180) || '';
}

function applicationLabel(root: HTMLElement): string {
  return cleanText(
    `${root.getAttribute('aria-label') || ''} ${headingText(root)}`,
  );
}

function hasApplicationHeading(root: HTMLElement): boolean {
  return APPLY_HEADING_PATTERN.test(applicationLabel(root));
}

function isRejectedApplicationSurface(root: HTMLElement): boolean {
  const label = applicationLabel(root);
  return NON_APPLICATION_PATTERN.test(label);
}

function actionLabels(root: ParentNode): string[] {
  return elementsMatching(root, [ACTION_SELECTOR])
    .filter(isActiveElement)
    .map((element) =>
      cleanText(
        element.textContent ||
          element.getAttribute('aria-label') ||
          element.getAttribute('value'),
      ),
    )
    .filter(Boolean);
}

function hasApplicationAction(root: ParentNode): boolean {
  return actionLabels(root).some((label) => ACTION_PATTERN.test(label));
}

function visibleApplicationFields(root: FormScope): HTMLElement[] {
  return queryAllInScope<HTMLElement>(root, LINKEDIN_APPLICATION_FIELD_SELECTOR)
    .filter(isActiveElement);
}

function inspectedApplicationFieldCount(root: FormScope): number {
  return inspectVisibleFormFields(root).filter(
    (field) => !NOISE_FIELD_PATTERN.test(cleanText(field.label)),
  ).length;
}

function hasApplicationField(root: FormScope): boolean {
  return visibleApplicationFields(root).length > 0;
}

function isApplicationCandidate(element: HTMLElement, fullPage = false): boolean {
  if (!isActiveElement(element) || isRejectedApplicationSurface(element)) {
    return false;
  }
  const hasFields = hasApplicationField(element);
  const hasAction = hasApplicationAction(element);
  const hasApplicationClass = /(?:apply|application|easy-apply)/i.test(
    `${element.className || ''} ${element.id}`,
  );
  const hasModalSemantics = element.matches(
    'dialog, [role="dialog"], [aria-modal="true"], .artdeco-modal, [data-test-modal], [data-test-modal-container]',
  );
  if (!hasFields && !hasAction) return false;
  if (!hasFields && !(hasApplicationHeading(element) && hasAction)) {
    return false;
  }
  if (fullPage) {
    return (
      hasFields &&
      (hasApplicationHeading(element) || hasApplicationClass || hasAction)
    );
  }
  return (
    hasApplicationHeading(element) ||
    hasApplicationClass ||
    (hasModalSemantics && hasFields && hasAction)
  );
}

function candidateScore(element: HTMLElement): number {
  const fields = inspectedApplicationFieldCount(element);
  const hasAction = hasApplicationAction(element);
  const label = applicationLabel(element);
  const className = `${element.className || ''} ${element.id}`;
  let score = fields * 100;
  if (hasAction) score += 35;
  if (hasApplicationHeading(element)) score += 80;
  if (/(?:easy-apply|application|apply)/i.test(className)) score += 70;
  if (element.matches('dialog, [role="dialog"], [aria-modal="true"]')) score += 50;
  if (element.matches('.artdeco-modal, .jobs-easy-apply-modal')) score += 35;
  if (isTopLayerDialog(element)) score += 30;
  if (NON_APPLICATION_PATTERN.test(label)) score -= 180;
  if (element.querySelector('dialog, [role="dialog"], [aria-modal="true"]')) {
    score -= 300;
  }
  return score;
}

function descendantCount(element: HTMLElement): number {
  return element.querySelectorAll('*').length;
}

function resolveApplicationRoot(
  candidates: HTMLElement[],
): HTMLElement | null {
  const valid = candidates.filter((candidate) => isApplicationCandidate(candidate));
  valid.sort((a, b) => {
    const scoreDifference = candidateScore(b) - candidateScore(a);
    return scoreDifference || descendantCount(a) - descendantCount(b);
  });
  return valid[0] || null;
}

function isCurrentStepContainer(element: HTMLElement): boolean {
  const className = `${element.className || ''} ${element.id}`;
  return (
    element.getAttribute('aria-current') === 'step' ||
    element.getAttribute('aria-selected') === 'true' ||
    element.getAttribute('data-state') === 'active' ||
    /(?:active|current|step|question|tabpanel)/i.test(className) ||
    element.matches('[role="tabpanel"], fieldset, .artdeco-modal__content')
  );
}

function scopeScore(element: HTMLElement, applicationRoot: HTMLElement): number {
  const fields = inspectVisibleFormFields(element).filter(
    (field) => !NOISE_FIELD_PATTERN.test(cleanText(field.label)),
  ).length;
  const rawFields = visibleApplicationFields(element).length;
  if (fields === 0 && rawFields === 0 && !hasApplicationAction(element)) return -1;

  let score = fields * 100;
  if (isCurrentStepContainer(element)) score += 75;
  if (hasApplicationAction(element)) score += 25;
  if (element.matches('form.jobs-easy-apply-form')) score += 1000;
  else if (element.matches('form')) score += 800;
  if (element === applicationRoot) score -= 20;

  const elementText = applicationLabel(element);
  if (NON_APPLICATION_PATTERN.test(elementText)) score -= 150;
  return score;
}

function hasClearlyValidForm(
  form: HTMLElement,
  applicationRoot: HTMLElement,
): boolean {
  if (!isActiveElement(form)) return false;
  const inspectedFields = inspectVisibleFormFields(form).filter(
    (field) => !NOISE_FIELD_PATTERN.test(cleanText(field.label)),
  );
  if (inspectedFields.length === 0) return false;
  return (
    form.matches('form.jobs-easy-apply-form') ||
    hasApplicationHeading(applicationRoot) ||
    hasApplicationAction(form)
  );
}

function resolveFieldRoot(applicationRoot: HTMLElement): HTMLElement {
  if (findLinkedInResumeUpload(applicationRoot) && !applicationRoot.querySelector('input[type="file"]')) {
    return applicationRoot;
  }
  const forms = elementsMatching(applicationRoot, ['form'])
    .filter((form) => hasClearlyValidForm(form, applicationRoot));
  const easyApplyForm = forms.find((form) =>
    form.matches('form.jobs-easy-apply-form'),
  );
  if (easyApplyForm) return easyApplyForm;
  if (forms[0]) return forms[0];

  const stepCandidates = elementsMatching(
    applicationRoot,
    FIELD_ROOT_SELECTORS,
  ).filter((candidate) => isActiveElement(candidate));
  stepCandidates.push(applicationRoot);
  stepCandidates.sort((a, b) => {
    const scoreDifference = scopeScore(b, applicationRoot) - scopeScore(a, applicationRoot);
    return scoreDifference || descendantCount(a) - descendantCount(b);
  });
  return stepCandidates.find((candidate) => scopeScore(candidate, applicationRoot) >= 0) || applicationRoot;
}

function isFullPageApplicationFlow(): boolean {
  try {
    const url = new URL(window.location.href);
    if (
      url.searchParams.get('openSDUIApplyFlow') === 'true' ||
      url.searchParams.get('openSDUIApplyFlow') === '1' ||
      /\/jobs\/view\/[^/]+\/apply(?:[/?#]|$)/i.test(url.pathname)
    ) {
      return true;
    }
  } catch {
    // Continue with DOM signals.
  }
  return Boolean(
    document.querySelector(
      '[data-testid*="application-page" i], [data-test*="application-page" i], [data-testid*="apply-flow" i], [data-test*="apply-flow" i]',
    ),
  );
}

function surfaceState(root: HTMLElement, fullPage: boolean): LinkedInApplySurfaceState {
  if (isNativeDialog(root)) return 'native-dialog';
  if (root.matches('.jobs-easy-apply-modal, .jobs-easy-apply-content')) {
    return 'classic-modal';
  }
  if (root.matches('.artdeco-modal')) return 'artdeco-modal';
  if (fullPage && !root.matches('dialog, [role="dialog"], [aria-modal="true"]')) {
    return 'full-page';
  }
  return 'unknown';
}

export function linkedInApplySurfaceCandidates(): HTMLElement[] {
  return elementsMatching(document, APPLICATION_ROOT_SELECTORS);
}

export function describeLinkedInElement(element: HTMLElement | null | undefined): string {
  if (!element) return 'none';
  const classes = typeof element.className === 'string'
    ? element.className.trim().split(/\s+/).filter(Boolean).slice(0, 3).join('.')
    : '';
  return `${element.tagName.toLowerCase()}${element.id ? `#${element.id}` : ''}${classes ? `.${classes}` : ''}`;
}

export function resolveLinkedInApplySurface(): LinkedInApplySurface | null {
  const candidates = linkedInApplySurfaceCandidates();
  const fullPage = isFullPageApplicationFlow();
  const root = resolveApplicationRoot(candidates);
  const fullPageRoot = root || (fullPage
    ? resolveApplicationRoot(
        elementsMatching(document, FULL_PAGE_SELECTORS).filter((candidate) =>
          isApplicationCandidate(candidate, true),
        ),
      )
    : null);
  if (!fullPageRoot) return null;

  return {
    root: fullPageRoot,
    fieldRoot: resolveFieldRoot(fullPageRoot),
    state: surfaceState(fullPageRoot, fullPage),
    topLayer: isTopLayerDialog(fullPageRoot),
    candidateCount: candidates.length,
  };
}

export function resolveLinkedInOverlayMountTarget(): HTMLElement | null {
  const surface = resolveLinkedInApplySurface();
  return surface?.topLayer ? surface.root : null;
}

export function linkedInFieldDiagnostics(scope: FormScope | null): {
  raw: number;
  accepted: number;
  rejected: number;
  reasons: string;
} {
  if (!scope) return { raw: 0, accepted: 0, rejected: 0, reasons: 'none' };
  const rawElements = queryAllInScope<HTMLElement>(
    scope,
    LINKEDIN_APPLICATION_FIELD_SELECTOR,
  );
  const inspected = inspectVisibleFormFields(scope);
  const accepted = inspected.filter(
    (field) => !NOISE_FIELD_PATTERN.test(cleanText(field.label)),
  );
  const hidden = rawElements.filter((element) => !isActiveElement(element)).length;
  const noise = inspected.filter((field) => NOISE_FIELD_PATTERN.test(cleanText(field.label))).length;
  const disabled = rawElements.filter(
    (element) =>
      element.hasAttribute('disabled') || element.getAttribute('aria-disabled') === 'true',
  ).length;
  const rejected = Math.max(0, rawElements.length - accepted.length);
  const reasons = [
    hidden ? `hidden/inactive ${hidden}` : '',
    disabled ? `disabled ${disabled}` : '',
    noise ? `search/filter ${noise}` : '',
  ].filter(Boolean).join(', ') || 'none observed';
  return { raw: rawElements.length, accepted: accepted.length, rejected, reasons };
}

export function isLinkedInFullPageApplicationFlow(): boolean {
  return isFullPageApplicationFlow();
}
