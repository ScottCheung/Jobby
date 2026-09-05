export type FormScope = Document | HTMLElement | ShadowRoot;
export type QueryScope = FormScope | ShadowRoot;

export const CONTROL_SELECTOR = [
  "input:not([type='hidden']):not([type='button']):not([type='submit']):not([type='reset']):not([type='image'])",
  "select",
  "textarea",
].join(", ");

export const BUTTON_CHOICE_VALUE =
  /^(?:yes|no|true|false|agree|disagree|i agree|prefer not to say)$/i;

export const NOISY_LABEL_TAGS = new Set([
  "INPUT",
  "SELECT",
  "TEXTAREA",
  "BUTTON",
  "IMG",
  "SVG",
  "NOSCRIPT",
  "SCRIPT",
  "STYLE",
]);

export function extractTextWithoutControls(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) {
    return node.textContent || "";
  }
  if (node.nodeType !== Node.ELEMENT_NODE) {
    return "";
  }
  const el = node as HTMLElement;
  if (NOISY_LABEL_TAGS.has(el.tagName)) {
    return "";
  }
  const className = typeof el.className === "string" ? el.className.toLowerCase() : "";
  if (
    className.includes("helper-text") ||
    className.includes("help-block") ||
    className.includes("field-hint") ||
    className.includes("helper") ||
    className.includes("tooltip") ||
    className.includes("error") ||
    className.includes("hint") ||
    className.includes("screen-reader") ||
    className.includes("sr-only") ||
    className.includes("visually-hidden")
  ) {
    return "";
  }
  const role = el.getAttribute("role");
  if (role === "alert" || el.hasAttribute("aria-live")) {
    return "";
  }
  let text = "";
  for (let child = el.firstChild; child; child = child.nextSibling) {
    text += extractTextWithoutControls(child);
  }
  return text;
}

export function labelTextWithoutControl(label: HTMLElement | null | undefined): string {
  if (!label) return "";
  return cleanLabel(extractTextWithoutControls(label));
}

export function cleanText(value: string | null | undefined): string {
  return (value || "").replace(/\s+/g, " ").trim();
}

export function cleanLabel(value: string): string {
  return cleanText(value)
    .replace(/^\s*(?:\(?(?:Required|Optional|必填|选填)\)?|\*)+\s*/gi, "")
    .replace(/\s*(?:\(?(?:Required|Optional|必填|选填)\)?|\*)+\s*$/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function isAuxiliaryFieldLabel(label: string): boolean {
  return /^(?:autofill|apply[-\s]?later|quick[-\s]?apply|resume[-\s]?autofill)$/i.test(
    cleanLabel(label),
  );
}

export function isHoneypotField(element: HTMLElement, label: string): boolean {
  const text = `${label} ${element.getAttribute("aria-label") || ""}`;
  return /(?:for robots? only|do not enter if you(?:'| a)re human|leave (?:this )?field blank|honeypot)/i.test(
    text,
  );
}

/** Help/error copy is useful to the page, but is not part of a field's intent. */
export function isLikelyHelperText(value: string): boolean {
  const text = cleanText(value);
  if (!text) return true;
  return (
    /^(?:optional|required|please (?:enter|select|choose)|this field is|invalid|error:|must be|we(?:'| a)ll use|your information will|by continuing|learn more|privacy (?:policy|notice)|character limit)/i.test(text) ||
    /^(?:accepted formats?|supported formats?|maximum file size|format:|e\.g\.?)/i.test(text) ||
    /(?:is required|is invalid|cannot be empty|can't be blank|is missing|please enter a valid|url is required)$/i.test(text)
  );
}

export function isValidationElement(element: HTMLElement): boolean {
  const className = typeof element.className === "string" ? element.className : "";
  return (
    element.getAttribute("role") === "alert" ||
    element.hasAttribute("aria-live") ||
    /(?:^|[-_\s])(?:error|errors|invalid|validation|helper|hint|text-red)(?:$|[-_\s])/i.test(className) ||
    /(?:error|validation|helper|hint)/i.test(element.id) ||
    isLikelyHelperText(element.textContent || "")
  );
}

export function composedParent(element: HTMLElement): HTMLElement | null {
  if (element.parentElement) return element.parentElement;
  const root = element.getRootNode();
  return root instanceof ShadowRoot && root.host instanceof HTMLElement
    ? root.host
    : null;
}

export function closestComposed(
  element: HTMLElement,
  selector: string,
  maxDepth = 32,
): HTMLElement | null {
  let candidate: HTMLElement | null = element;
  for (let depth = 0; candidate && depth < maxDepth; depth += 1) {
    if (candidate.matches(selector)) return candidate;
    candidate = composedParent(candidate);
  }
  return null;
}

export function scopeFor(element: HTMLElement, fallback: FormScope): QueryScope {
  const root = element.getRootNode();
  return root instanceof Document || root instanceof ShadowRoot ? root : fallback;
}

export function isVisibleElement(element: HTMLElement): boolean {
  if (element.hidden || element.getAttribute("aria-hidden") === "true") return false;

  // getComputedStyle(element) does not expose display:none on an ancestor in
  // every DOM implementation. Walk the composed tree so stale wizard steps,
  // hidden hydration copies, and controls inside hidden shadow hosts never
  // become candidate questions.
  let ancestor = composedParent(element);
  for (let depth = 0; ancestor && depth < 32; depth += 1) {
    if (
      ancestor.hidden ||
      ancestor.hasAttribute("inert") ||
      ancestor.getAttribute("aria-hidden") === "true"
    ) {
      return false;
    }
    const ancestorStyle = window.getComputedStyle(ancestor);
    if (
      ancestorStyle.display === "none" ||
      ancestorStyle.visibility === "hidden" ||
      ancestorStyle.visibility === "collapse" ||
      ancestorStyle.opacity === "0"
    ) {
      return false;
    }
    ancestor = composedParent(ancestor);
  }

  // Fast path for Chromium / modern browser engines: native checkVisibility
  if (typeof (element as any).checkVisibility === "function") {
    if ((element as any).checkVisibility({ checkOpacity: true, checkVisibilityCSS: true })) {
      const rect = element.getBoundingClientRect();
      if (rect.right >= -3000 && rect.left >= -3000) {
        return true;
      }
    }
  }

  const style = window.getComputedStyle(element);
  if (style.display === "none" || style.visibility === "hidden" || style.visibility === "collapse" || style.opacity === "0") {
    return false;
  }

  const rect = element.getBoundingClientRect();
  const hasSize =
    (rect.width > 0 && rect.height > 0) ||
    (element.offsetWidth > 0 && element.offsetHeight > 0);

  if (hasSize && rect.right >= -3000 && rect.left >= -3000) {
    return true;
  }

  const isFormInput =
    element instanceof HTMLInputElement ||
    element instanceof HTMLSelectElement ||
    element instanceof HTMLTextAreaElement;

  if (isFormInput) {
    const container = (element.closest(
      "label, fieldset, form, .form-group, .form-item, .form-field, .field-wrapper, [class*='control' i], [class*='field' i], [class*='radio' i], [class*='checkbox' i], [class*='select' i], [class*='t1-' i], [class*='jobwizard' i], [class*='question' i], [class*='component' i], [class*='item' i], [class*='container' i], [data-testid*='field' i], [data-testid*='question' i], [jobwizard_question_title_id]",
    ) || element.parentElement) as HTMLElement | null;
    if (container) {
      if (typeof (container as any).checkVisibility === "function") {
        if ((container as any).checkVisibility({ checkOpacity: true, checkVisibilityCSS: true })) {
          const cRect = container.getBoundingClientRect();
          if (cRect.left >= -3000) return true;
        }
      } else {
        const containerStyle = window.getComputedStyle(container);
        const containerRect = container.getBoundingClientRect();
        const containerHasSize =
          (containerRect.width > 0 && containerRect.height > 0) ||
          (container.offsetWidth > 0 && container.offsetHeight > 0);
        if (
          containerStyle.display !== "none" &&
          containerStyle.visibility !== "hidden" &&
          containerHasSize &&
          containerRect.left >= -3000
        ) {
          return true;
        }
      }
    }
  }

  return false;
}

export function isDropdownSearchFilter(element: HTMLElement): boolean {
  if (!(element instanceof HTMLInputElement)) return false;
  // Select2 v3 keeps an off-screen focus proxy and a transient search input
  // next to the real application field. JobAdder uses those proxies for its
  // phone-country picker; neither control stores a candidate answer.
  if (
    element.classList.contains("select2-focusser") ||
    element.classList.contains("select2-input") ||
    (element.classList.contains("select2-offscreen") &&
      (Boolean(element.closest(".select2-container, .select2-drop")) ||
        element.id.startsWith("s2id_")))
  ) {
    return true;
  }
  if (
    element.classList.contains("iti__search-input") ||
    Boolean(
      element.closest(
        ".iti__dropdown-content, .iti__country-list, .select2-search, .select2-dropdown, .iti__search, [class*='iti__dropdown' i], [class*='iti__search' i]",
      ),
    )
  ) {
    return true;
  }
  const role = element.getAttribute("role");
  if (
    role === "searchbox" &&
    Boolean(
      element.closest(
        "[role='listbox'], [role='menu'], [class*='dropdown' i], [class*='select' i]",
      ),
    )
  ) {
    return true;
  }
  if (
    Boolean(
      element.closest(
        "[role='listbox'], [role='menu'], ul[class*='country-list' i]",
      ),
    )
  ) {
    return true;
  }
  return false;
}

/**
 * Application pages commonly keep alternate "apply later" or resume
 * autofill controls mounted beside the active form. They are implementation
 * affordances, not questions the candidate should answer. Filtering them at
 * candidate collection time prevents the panel and backend from learning a
 * bogus field just because a site uses a different class name.
 */
export function isAuxiliaryApplicationControl(
  element: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement,
): boolean {
  const identifier = [
    element.id,
    element.getAttribute("name"),
    typeof element.className === "string" ? element.className : "",
    element.getAttribute("data-testid"),
    element.getAttribute("data-automation-id"),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  // A real user-facing field may describe an autofill preference, but it
  // will normally have an explicit label. The controls matched here are the
  // hidden/alternate form implementation itself.
  const hasExplicitQuestion = Boolean(
    element.getAttribute("aria-label") ||
      element.getAttribute("aria-labelledby") ||
      (element.id && element.ownerDocument.querySelector(`label[for='${CSS.escape(element.id)}']`)),
  );
  return (
    !hasExplicitQuestion &&
    /(?:autofill|apply[-_]?later|quick[-_]?apply)/.test(identifier)
  );
}

export function isInspectableControl(
  element: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement,
): boolean {
  return (
    !element.disabled &&
    element.getAttribute("aria-disabled") !== "true" &&
    element.getAttribute("aria-hidden") !== "true" &&
    !isDropdownSearchFilter(element) &&
    !isAuxiliaryApplicationControl(element)
  );
}

export function queryAllInScope<T extends HTMLElement>(scope: FormScope, selector: string): T[] {
  const results: T[] = [];
  const visitedRoots = new Set<Document | HTMLElement | ShadowRoot>();

  const visit = (root: Document | HTMLElement | ShadowRoot) => {
    if (visitedRoots.has(root)) return;
    visitedRoots.add(root);
    results.push(...Array.from(root.querySelectorAll<T>(selector)));
    if (root instanceof HTMLElement && root.shadowRoot) visit(root.shadowRoot);
    const hosts = root.querySelectorAll<HTMLElement>("*");
    for (let i = 0; i < hosts.length; i++) {
      const el = hosts[i];
      if (el && el.shadowRoot) visit(el.shadowRoot);
    }
  };

  visit(scope);
  return results;
}

export function elementsInScope(scope: FormScope): HTMLElement[] {
  const elements: HTMLElement[] = [];
  const visitedRoots = new Set<Document | HTMLElement | ShadowRoot>();

  const visit = (root: Document | HTMLElement | ShadowRoot) => {
    if (visitedRoots.has(root)) return;
    visitedRoots.add(root);
    const descendants = Array.from(root.querySelectorAll<HTMLElement>("*"));
    elements.push(...descendants);
    if (root instanceof HTMLElement && root.shadowRoot) visit(root.shadowRoot);
    descendants.forEach((element) => {
      if (element.shadowRoot) visit(element.shadowRoot);
    });
  };

  visit(scope);
  return elements;
}

export function controlsInScope(
  scope: FormScope,
): Array<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement> {
  return queryAllInScope<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>(
    scope,
    CONTROL_SELECTOR,
  );
}

export function hasVisibleChoiceLabel(element: HTMLInputElement): boolean {
  const type = element.type.toLowerCase();
  if (type !== "radio" && type !== "checkbox") return false;
  return Array.from(element.labels || []).some((label) => isVisibleElement(label));
}

export function visibleControlsInScope(
  scope: FormScope,
): Array<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement> {
  return controlsInScope(scope).filter(
    (element) =>
      (isVisibleElement(element) ||
        (element instanceof HTMLInputElement && hasVisibleChoiceLabel(element))) &&
      isInspectableControl(element),
  );
}
