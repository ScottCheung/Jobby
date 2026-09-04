import {
  BUTTON_CHOICE_VALUE,
  cleanLabel,
  cleanText,
  isLikelyHelperText,
  isValidationElement,
  labelTextWithoutControl,
  scopeFor,
  type FormScope,
  type QueryScope,
} from "./visibility";
import { isOptionLabelElement, isPhoneCountryElement } from "./option-reader";

export function precedingQuestionLabel(element: HTMLElement): string {
  let container: HTMLElement | null =
    element.closest<HTMLElement>("[data-testid='field'], [data-testid*='field' i]") ||
    element.parentElement;
  for (let depth = 0; container && depth < 4; depth += 1) {
    let sibling = container.previousElementSibling as HTMLElement | null;
    while (sibling) {
      if (isValidationElement(sibling)) {
        sibling = sibling.previousElementSibling as HTMLElement | null;
        continue;
      }
      const text = cleanText(sibling.textContent);
      if (
        text.length >= 8 &&
        text.length <= 500 &&
        !isLikelyHelperText(text) &&
        !/^(?:search|select|choose)$/i.test(text)
      ) {
        return cleanLabel(text);
      }
      sibling = sibling.previousElementSibling as HTMLElement | null;
    }
    container = container.parentElement;
  }
  return "";
}

export function cleanPlaceholderLabel(placeholder: string): string {
  const cleaned = cleanText(placeholder);
  if (!cleaned) return "";
  const stripped = cleaned
    .replace(
      /^(?:e\.g\.?|eg|example|enter|please enter|type|please type|select|please select|choose|please choose)\s+/i,
      "",
    )
    .replace(/^[.:\s]+|[.:\s]+$/g, "");
  return cleanLabel(stripped || cleaned);
}

export function containerLabelFor(element: HTMLElement): string {
  const root = scopeFor(element, document);

  // Check jobwizard_question_title_id attribute matching element's input id or title_id (used in Rippling ATS)
  const targetId =
    cleanText(element.id) ||
    cleanText(element.getAttribute("jobwizard_question_input_id")) ||
    cleanText(element.getAttribute("extra_data_id"));
  if (targetId) {
    const titleElem = root.querySelector<HTMLElement>(
      `[jobwizard_question_title_id='${CSS.escape(targetId)}']`,
    );
    const titleText = cleanText(titleElem?.textContent);
    if (titleText) return cleanLabel(titleText);
  }

  const titleContainer = element.closest<HTMLElement>("[jobwizard_question_title_id]");
  const titleId = titleContainer?.getAttribute("jobwizard_question_title_id");
  if (titleId) {
    const labelElem =
      root.querySelector<HTMLElement>(
        `#${CSS.escape(titleId)}-label, #${CSS.escape(titleId)}`,
      ) ||
      root.querySelector<HTMLElement>(
        `[jobwizard_question_title_id='${CSS.escape(titleId)}']`,
      );
    const titleText = cleanText(labelElem?.textContent);
    if (titleText) return cleanLabel(titleText);
  }

  let current: HTMLElement | null = element.parentElement;
  for (let depth = 0; current && depth < 6; depth += 1) {
    if (current.matches("body, html")) break;
    // A form contains labels for every question. Once the local wrapper has
    // been exhausted, choosing the first label in the whole form is unsafe.
    if (current.matches("form, [role='form']")) break;

    const labelCandidates = Array.from(
      current.querySelectorAll<HTMLElement>(
        "legend, label, [class*='label' i], [class*='prompt' i], [class*='question' i], [class*='title' i], [class*='name' i], [class*='heading' i], [class*='caption' i], [class*='text' i], [class*='description' i], [class*='t1-' i], [data-label], [data-prompt]",
      ),
    );

    for (const candidate of labelCandidates) {
      if (isOptionLabelElement(candidate, element)) continue;

      const text = labelTextWithoutControl(candidate);
      if (
        text &&
        text.length >= 2 &&
        text.length <= 400 &&
        !isLikelyHelperText(text)
      ) {
        if (!BUTTON_CHOICE_VALUE.test(text)) {
          return cleanLabel(text);
        }
      }
    }

    let sibling = current.previousElementSibling as HTMLElement | null;
    while (sibling) {
      if (!sibling.matches("input, select, textarea, button")) {
        const text = cleanText(sibling.textContent);
        if (
          text &&
          text.length >= 2 &&
          text.length <= 400 &&
          !isLikelyHelperText(text) &&
          !BUTTON_CHOICE_VALUE.test(text)
        ) {
          return cleanLabel(text);
        }
      }
      sibling = sibling.previousElementSibling as HTMLElement | null;
    }

    current = current.parentElement;
  }

  return "";
}

/**
 * Web components commonly keep the native input in a shadow root and put its
 * human label on the host element (for example SmartRecruiters'
 * `<spl-input label="City">`). The input cannot see that label through its
 * own root, so walk out through shadow hosts before falling back to an ID or
 * an anonymous field name.
 */
export function shadowHostLabelFor(element: HTMLElement): string {
  let current: HTMLElement = element;
  for (let depth = 0; depth < 4; depth += 1) {
    const root = current.getRootNode();
    if (!(root instanceof ShadowRoot)) break;
    const host = root.host as HTMLElement;
    const label = cleanText(
      host.getAttribute("aria-label") ||
        host.getAttribute("label") ||
        host.getAttribute("data-label") ||
        host.getAttribute("data-prompt") ||
        host.getAttribute("title"),
    );
    if (label) return cleanLabel(label);

    const hostId = cleanText(host.id);
    const hostRoot = host.getRootNode();
    if (hostId && (hostRoot instanceof Document || hostRoot instanceof ShadowRoot)) {
      const externalLabel = hostRoot.querySelector<HTMLLabelElement>(
        `label[for='${CSS.escape(hostId)}']`,
      );
      const externalLabelText = labelTextWithoutControl(externalLabel);
      if (externalLabelText) return cleanLabel(externalLabelText);
    }
    current = host;
  }
  return "";
}

export function labelledByText(element: HTMLElement, scope: QueryScope): string {
  const ids = cleanText(element.getAttribute("aria-labelledby")).split(/\s+/).filter(Boolean);
  return cleanText(
    ids.map((id) => scope.querySelector(`#${CSS.escape(id)}`)?.textContent).join(" "),
  );
}

export function labelFor(element: HTMLElement, scope: QueryScope): string {
  const isRadio =
    element instanceof HTMLInputElement && element.type.toLowerCase() === "radio";

  if (isRadio) {
    const fieldset = element.closest("fieldset");
    const legend = cleanText(fieldset?.querySelector("legend")?.textContent);
    if (legend) return cleanLabel(legend);

    const radiogroup = element.closest<HTMLElement>("[role='radiogroup']");
    if (radiogroup) {
      const groupLabel =
        labelledByText(radiogroup, scope) || cleanText(radiogroup.getAttribute("aria-label"));
      if (groupLabel) return cleanLabel(groupLabel);
    }

    const questionLabel = precedingQuestionLabel(element);
    if (questionLabel) return questionLabel;
    const containerLabel = containerLabelFor(element);
    if (containerLabel) return containerLabel;
  }

  // Phone dialing country control nested in or near Phone input
  if (isPhoneCountryElement(element)) return "Phone country";

  const labelledByIds = cleanText(element.getAttribute("aria-labelledby"))
    .split(/\s+/)
    .filter(Boolean);
  if (labelledByIds.length > 0) {
    const labelledByTextVal = cleanText(
      labelledByIds
        .map((id) => scope.querySelector(`#${CSS.escape(id)}`)?.textContent || "")
        .join(" "),
    );
    if (labelledByTextVal) return cleanLabel(labelledByTextVal);
  }

  const isGenericActionLabel = (text: string) =>
    /^(?:search|filter|type|select|choose|enter|type to search)$/i.test(text.trim());

  const labelledBy = cleanText(element.getAttribute("aria-label"));
  if (labelledBy && !isGenericActionLabel(labelledBy)) return cleanLabel(labelledBy);

  const dataLabel = cleanText(
    element.getAttribute("data-label") ||
      element.getAttribute("data-prompt") ||
      element.getAttribute("title"),
  );
  if (dataLabel && !isGenericActionLabel(dataLabel)) return cleanLabel(dataLabel);

  const shadowHostLabel = shadowHostLabelFor(element);
  if (shadowHostLabel && !isGenericActionLabel(shadowHostLabel)) return shadowHostLabel;

  if (!isRadio) {
    const id = cleanText(element.id);
    if (id) {
      const label = scope.querySelector<HTMLLabelElement>(`label[for='${CSS.escape(id)}']`);
      const text = labelTextWithoutControl(label);
      if (text) return cleanLabel(text);
    }

    const parentLabel = element.closest("label");
    const parentText = labelTextWithoutControl(parentLabel);
    if (parentText) return cleanLabel(parentText);

    // Immediate previous sibling label: e.g. <label>Last name</label><input>
    let prev = element.previousElementSibling as HTMLElement | null;
    while (prev) {
      if (prev.matches("label, [class*='label' i], [class*='prompt' i], [class*='title' i]")) {
        const text = labelTextWithoutControl(prev);
        if (text && !isLikelyHelperText(text) && !isValidationElement(prev)) {
          return cleanLabel(text);
        }
      }
      prev = prev.previousElementSibling as HTMLElement | null;
    }

    // Direct local container's label if it contains only this input (e.g. <div><label>Last name</label><input></div>)
    const localWrapper = element.parentElement;
    if (
      localWrapper &&
      !localWrapper.matches(
        "form, body, html, [role='form'], [class*='grid' i], [class*='row' i]",
      )
    ) {
      const localLabels = Array.from(
        localWrapper.querySelectorAll<HTMLElement>("label, [class*='label' i]"),
      ).filter((l) => !isOptionLabelElement(l, element) && !isValidationElement(l));
      if (localLabels.length === 1 && localLabels[0]) {
        const text = labelTextWithoutControl(localLabels[0]);
        if (text && !isLikelyHelperText(text)) {
          return cleanLabel(text);
        }
      }
    }
  }

  const fieldset = element.closest("fieldset");
  const legend = cleanText(fieldset?.querySelector("legend")?.textContent);
  if (legend) return cleanLabel(legend);

  // JobAdder nests its Phone/Mobile fields without associating a label to the
  // real input. Use its stable rendered-number identifiers before the broad
  // container fallback can inherit another question's label.
  if (element instanceof HTMLInputElement && element.hasAttribute("data-val-phone")) {
    const identifier = `${element.id} ${element.name}`.toLowerCase();
    if (/(?:candidate)?mobile(?:[._-]|$)/.test(identifier)) return "Mobile";
    if (/(?:candidate)?phone(?:[._-]|$)/.test(identifier)) return "Phone";
  }

  const questionLabel = precedingQuestionLabel(element);
  if (questionLabel) return questionLabel;

  const structuralLabel = containerLabelFor(element);
  if (structuralLabel) return structuralLabel;

  if (isRadio) {
    const id = cleanText(element.id);
    if (id) {
      const label = scope.querySelector<HTMLLabelElement>(`label[for='${CSS.escape(id)}']`);
      const text = labelTextWithoutControl(label);
      if (text && !BUTTON_CHOICE_VALUE.test(text)) return cleanLabel(text);
    }

    const parentLabel = element.closest("label");
    const parentText = labelTextWithoutControl(parentLabel);
    if (parentText && !BUTTON_CHOICE_VALUE.test(parentText)) return cleanLabel(parentText);
  }

  const placeholder = cleanText(element.getAttribute("placeholder"));
  if (placeholder) {
    const cleanedPlaceholder = cleanPlaceholderLabel(placeholder);
    if (cleanedPlaceholder) return cleanedPlaceholder;
  }
  return cleanLabel(element.getAttribute("name") || "") || "Unnamed field";
}

export function requiredFor(element: HTMLElement): boolean {
  if (
    element.hasAttribute("required") ||
    element.getAttribute("aria-required") === "true"
  ) {
    return true;
  }
  const fieldset = element.closest("fieldset");
  if (
    fieldset?.hasAttribute("required") ||
    fieldset?.getAttribute("aria-required") === "true"
  ) {
    return true;
  }

  const root = scopeFor(element, document);
  const explicitLabel = element.id
    ? root.querySelector<HTMLLabelElement>(`label[for='${CSS.escape(element.id)}']`)
    : null;
  const parentLabel = element.closest<HTMLLabelElement>("label");
  const legend = fieldset?.querySelector("legend");
  const labelledByMarker = cleanText(element.getAttribute("aria-labelledby"))
    .split(/\s+/)
    .filter(Boolean)
    .map((id) => cleanText(root.querySelector(`#${CSS.escape(id)}`)?.textContent))
    .filter(Boolean)
    .join(" ");
  const markerContainer = element.closest<HTMLElement>(
    "[data-required], [class~='required'], [class*='form-field' i], [class*='question' i], [data-testid*='field' i]",
  );
  const markerText = cleanText(
    [
      explicitLabel?.textContent,
      parentLabel?.textContent,
      legend?.textContent,
      labelledByMarker,
    ]
      .filter(Boolean)
      .join(" "),
  );
  if (!/\boptional\b|选填/i.test(markerText)) {
    if (/\*|\brequired\b|必填/i.test(markerText)) return true;
    if (
      markerContainer?.getAttribute("data-required") === "true" ||
      markerContainer?.classList.contains("required") ||
      Boolean(
        markerContainer?.querySelector(
          "[data-required='true'], [class~='required-marker'], [data-testid*='required-mark' i]",
        ),
      )
    ) {
      return true;
    }
  }

  const metadata = element
    .closest<HTMLElement>("[data-t1-control]")
    ?.getAttribute("data-t1-control");
  if (metadata) {
    try {
      const parsed = JSON.parse(metadata) as { IsMandatory?: unknown };
      if (parsed.IsMandatory === true) return true;
    } catch {
      // Ignore malformed page metadata and keep the native attribute checks.
    }
  }
  return false;
}
