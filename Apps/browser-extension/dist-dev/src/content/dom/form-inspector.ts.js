const CONTROL_SELECTOR = "input:not([type='hidden']), select, textarea";
function cleanText(value) {
  return (value || "").replace(/\s+/g, " ").trim();
}
function cleanLabel(value) {
  return cleanText(value).replace(/\s*(?:Required|必填|\*)\s*$/gi, "").trim();
}
function isVisible(element) {
  const style = window.getComputedStyle(element);
  const rect = element.getBoundingClientRect();
  return style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0;
}
function fieldType(element) {
  if (element instanceof HTMLSelectElement) return "select";
  if (element instanceof HTMLTextAreaElement) return "textarea";
  const type = element.type.toLowerCase();
  if (type === "text" || type === "search") return "text";
  if (type === "checkbox" || type === "radio" || type === "file") return type;
  if (["number", "email", "tel", "url", "date", "password"].includes(type)) return type;
  return "unknown";
}
function optionLabelFor(element, scope) {
  const ariaLabel = cleanText(element.getAttribute("aria-label"));
  if (ariaLabel) return cleanLabel(ariaLabel);
  const id = cleanText(element.id);
  if (id) {
    const label = scope.querySelector(`label[for='${CSS.escape(id)}']`);
    const text = cleanText(label?.textContent);
    if (text) return cleanLabel(text);
  }
  const parentLabel = cleanText(element.closest("label")?.textContent);
  if (parentTextIsDistinct(parentLabel, element)) return cleanLabel(parentLabel);
  if (element instanceof HTMLInputElement && element.value) return cleanText(element.value);
  return "Option";
}
function parentTextIsDistinct(text, element) {
  if (!text) return false;
  const fieldset = element.closest("fieldset");
  const legend = cleanText(fieldset?.querySelector("legend")?.textContent);
  if (legend && text === legend) return false;
  return true;
}
function labelFor(element, scope) {
  if (element instanceof HTMLInputElement && element.type.toLowerCase() === "radio") {
    const fieldset2 = element.closest("fieldset");
    const legend2 = cleanText(fieldset2?.querySelector("legend")?.textContent);
    if (legend2) return cleanLabel(legend2);
  }
  const labelledBy = cleanText(element.getAttribute("aria-label"));
  if (labelledBy) return cleanLabel(labelledBy);
  const id = cleanText(element.id);
  if (id) {
    const label = scope.querySelector(`label[for='${CSS.escape(id)}']`);
    const text = cleanText(label?.textContent);
    if (text) return cleanLabel(text);
  }
  const parentLabel = element.closest("label");
  const parentText = cleanText(parentLabel?.textContent);
  if (parentText) return cleanLabel(parentText);
  const fieldset = element.closest("fieldset");
  const legend = cleanText(fieldset?.querySelector("legend")?.textContent);
  if (legend) return cleanLabel(legend);
  const placeholder = cleanText(element.getAttribute("placeholder"));
  if (placeholder) return cleanLabel(placeholder);
  return cleanLabel(element.getAttribute("name") || "") || "Unnamed field";
}
function requiredFor(element) {
  if (element.hasAttribute("required") || element.getAttribute("aria-required") === "true") return true;
  const fieldset = element.closest("fieldset");
  return Boolean(fieldset?.hasAttribute("required") || fieldset?.getAttribute("aria-required") === "true");
}
function optionsFor(element, scope) {
  if (element instanceof HTMLSelectElement) {
    return Array.from(element.options).map((option) => ({
      label: cleanText(option.textContent) || option.value,
      value: option.value
    }));
  }
  if (element instanceof HTMLInputElement && element.type.toLowerCase() === "radio" && element.name) {
    return Array.from(scope.querySelectorAll(`input[type='radio'][name='${CSS.escape(element.name)}']`)).map((radio) => ({
      label: optionLabelFor(radio, scope),
      value: radio.value
    }));
  }
  return [];
}
function currentValue(element, type, scope) {
  if (type === "password" || type === "file") return void 0;
  if (element instanceof HTMLInputElement && type === "radio" && element.name) {
    const group = Array.from(scope.querySelectorAll(`input[type='radio'][name='${CSS.escape(element.name)}']`));
    const checkedRadio = group.find((r) => r.checked);
    if (!checkedRadio) return "";
    return optionLabelFor(checkedRadio, scope) || checkedRadio.value || "true";
  }
  if (element instanceof HTMLInputElement && type === "checkbox") {
    return element.checked ? element.value || "true" : "";
  }
  if (element instanceof HTMLSelectElement) {
    return Array.from(element.selectedOptions).map((option) => cleanText(option.textContent)).join(", ");
  }
  return cleanText(element.value);
}
function isFilled(element, type, scope) {
  if (type === "file") return Boolean(element instanceof HTMLInputElement && element.files?.length);
  if (element instanceof HTMLInputElement && type === "radio" && element.name) {
    const group = Array.from(scope.querySelectorAll(`input[type='radio'][name='${CSS.escape(element.name)}']`));
    return group.some((r) => r.checked);
  }
  if (element instanceof HTMLInputElement && type === "checkbox") return element.checked;
  return Boolean(currentValue(element, type, scope));
}
function keyFor(element, index) {
  return cleanText(element.id) || cleanText(element.getAttribute("name")) || `field-${index + 1}`;
}
export function inspectVisibleFormFields(scope = document) {
  const controls = Array.from(scope.querySelectorAll(CONTROL_SELECTOR));
  const visibleControls = controls.filter((element) => isVisible(element));
  const seenRadioNames = /* @__PURE__ */ new Set();
  const result = [];
  for (let index = 0; index < visibleControls.length && result.length < 200; index += 1) {
    const element = visibleControls[index];
    if (!element) continue;
    const type = fieldType(element);
    if (type === "radio" && element instanceof HTMLInputElement && element.name) {
      if (seenRadioNames.has(element.name)) continue;
      seenRadioNames.add(element.name);
    }
    const val = currentValue(element, type, scope);
    result.push({
      key: keyFor(element, index),
      id: cleanText(element.id) || void 0,
      name: cleanText(element.getAttribute("name")) || void 0,
      type,
      label: labelFor(element, scope),
      required: requiredFor(element),
      filled: isFilled(element, type, scope),
      sensitive: type === "password" || type === "file",
      options: optionsFor(element, scope),
      ...val ? { currentValue: val } : {}
    });
  }
  return result;
}
export function readApplicationForm(url, platform, isApplicationPage, submitLabel, scope = document, action) {
  const fields = scope ? inspectVisibleFormFields(scope) : [];
  if (!isApplicationPage || fields.length === 0) {
    return {
      kind: "not_application_form",
      platform,
      url,
      reason: `No visible ${platform === "linkedin" ? "LinkedIn" : "SEEK"} application form was found.`
    };
  }
  return {
    kind: "application_form",
    platform,
    url,
    fields,
    hasSubmitAction: Boolean(submitLabel),
    ...submitLabel ? { submitLabel } : {},
    ...action ? { action } : {}
  };
}
export function readSeekForm(url, isApplicationPage, submitLabel) {
  return readApplicationForm(url, "seek", isApplicationPage, submitLabel);
}
