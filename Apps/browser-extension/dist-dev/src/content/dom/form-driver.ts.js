import { inspectVisibleFormFields } from "/src/content/dom/form-inspector.ts.js";
function cleanText(value) {
  return (value || "").replace(/\s+/g, " ").trim();
}
function normalized(value) {
  return cleanText(value).toLowerCase();
}
function result(instruction, status, message) {
  return { commandId: instruction.commandId, key: instruction.target.key, status, message };
}
function fieldType(element) {
  if (element instanceof HTMLSelectElement) return "select";
  if (element instanceof HTMLTextAreaElement) return "textarea";
  const type = element.type.toLowerCase();
  if (type === "text" || type === "search") return "text";
  if (["checkbox", "radio", "file", "number", "email", "tel", "url", "date", "password"].includes(type)) {
    return type;
  }
  return "unknown";
}
function labelFor(element, scope) {
  const ariaLabel = cleanText(element.getAttribute("aria-label"));
  if (ariaLabel) return ariaLabel;
  if (element.id) {
    const label = scope.querySelector(`label[for='${CSS.escape(element.id)}']`);
    const text = cleanText(label?.textContent);
    if (text) return text;
  }
  const parentLabel = cleanText(element.closest("label")?.textContent);
  if (parentLabel) return parentLabel;
  const legend = cleanText(element.closest("fieldset")?.querySelector("legend")?.textContent);
  if (legend) return legend;
  return cleanText(element.getAttribute("placeholder")) || cleanText(element.getAttribute("name")) || "Unnamed field";
}
function isVisible(element) {
  const style = window.getComputedStyle(element);
  const rect = element.getBoundingClientRect();
  return style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0;
}
function findElement(target, scope) {
  if (target.id) {
    const element = scope instanceof Document ? scope.getElementById(target.id) : scope.querySelector(`#${CSS.escape(target.id)}`);
    if (element instanceof HTMLInputElement || element instanceof HTMLSelectElement || element instanceof HTMLTextAreaElement) {
      return isVisible(element) ? element : null;
    }
  }
  if (target.name) {
    const elements = Array.from(scope.querySelectorAll(`input[name='${CSS.escape(target.name)}'], select[name='${CSS.escape(target.name)}'], textarea[name='${CSS.escape(target.name)}']`));
    const visibleElements = elements.filter((element) => isVisible(element));
    return visibleElements.find(
      (element) => fieldType(element) === target.type && normalized(labelFor(element, scope)) === normalized(target.label)
    ) || visibleElements[0] || null;
  }
  return null;
}
function setValue(element, value) {
  const prototype = element instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(prototype, "value")?.set;
  if (setter) setter.call(element, value);
  else element.value = value;
}
function emitChange(element) {
  element.dispatchEvent(new Event("focus", { bubbles: true }));
  element.dispatchEvent(new Event("input", { bubbles: true }));
  element.dispatchEvent(new Event("change", { bubbles: true }));
  element.dispatchEvent(new Event("blur", { bubbles: true }));
}
function matchesTarget(element, instruction, scope) {
  const normLabel = normalized(labelFor(element, scope));
  const targetNorm = normalized(instruction.target.label);
  return fieldType(element) === instruction.target.type && (normLabel === targetNorm || normLabel.length > 3 && targetNorm.length > 3 && (normLabel.includes(targetNorm) || targetNorm.includes(normLabel)));
}
function fillSelect(element, value) {
  const normValue = normalized(value);
  const option = Array.from(element.options).find(
    (candidate) => candidate.value === value || normalized(candidate.value) === normValue || normalized(candidate.textContent || "") === normValue || normValue.length > 1 && normalized(candidate.textContent || "").includes(normValue) || normValue.length > 1 && normValue.includes(normalized(candidate.textContent || ""))
  );
  if (!option) return false;
  element.value = option.value;
  return true;
}
function optionLabelFor(element, scope) {
  const ariaLabel = cleanText(element.getAttribute("aria-label"));
  if (ariaLabel) return ariaLabel;
  const id = cleanText(element.id);
  if (id) {
    const label = scope.querySelector(`label[for='${CSS.escape(id)}']`);
    const text = cleanText(label?.textContent);
    if (text) return text;
  }
  const parentLabel = cleanText(element.closest("label")?.textContent);
  if (parentLabel) return parentLabel;
  if (element instanceof HTMLInputElement && element.value) return element.value;
  return "";
}
function fillRadio(element, value, scope) {
  const group = element.name ? Array.from(scope.querySelectorAll(`input[type='radio'][name='${CSS.escape(element.name)}']`)) : [element];
  const targetNorm = normalized(value);
  const selected = group.find(
    (candidate) => candidate.value === value || normalized(candidate.value) === targetNorm || normalized(optionLabelFor(candidate, scope)) === targetNorm || normalized(labelFor(candidate, scope)) === targetNorm || targetNorm.length > 1 && normalized(optionLabelFor(candidate, scope)).includes(targetNorm) || targetNorm.length > 1 && targetNorm.includes(normalized(optionLabelFor(candidate, scope)))
  );
  if (!selected) return false;
  selected.checked = true;
  emitChange(selected);
  return true;
}
export function fillFormField(instruction, scope = document) {
  if (!scope) return result(instruction, "not_found", "No supported application form is open.");
  const element = findElement(instruction.target, scope);
  if (!element) return result(instruction, "not_found", "The targeted field is no longer visible.");
  if (!matchesTarget(element, instruction, scope)) return result(instruction, "rejected", "The field identity changed; no value was written.");
  const type = fieldType(element);
  if (type === "password" || type === "file") {
    return result(instruction, "requires_user_action", "Sensitive fields require explicit user handling.");
  }
  if (type === "unknown") return result(instruction, "rejected", "This field type is not supported.");
  if (type === "checkbox") {
    if (typeof instruction.value !== "boolean") return result(instruction, "rejected", "Checkbox values must be boolean.");
    const checkbox = element;
    if (checkbox.checked === instruction.value) return result(instruction, "already_filled", "Checkbox already has the requested value.");
    checkbox.checked = instruction.value;
    emitChange(checkbox);
    return result(instruction, "filled", "Checkbox value updated.");
  }
  if (type === "radio") {
    if (typeof instruction.value !== "string") return result(instruction, "rejected", "Radio values must be strings.");
    if (!fillRadio(element, instruction.value, scope)) return result(instruction, "rejected", "The requested radio option is unavailable.");
    return result(instruction, "filled", "Radio option selected.");
  }
  if (typeof instruction.value !== "string") return result(instruction, "rejected", "This field requires a string value.");
  if (type === "select") {
    const select = element;
    const previousValue = select.value;
    if (!fillSelect(select, instruction.value)) return result(instruction, "rejected", "The requested select option is unavailable.");
    if (select.value === previousValue) return result(instruction, "already_filled", "Select already has the requested value.");
    emitChange(select);
    return result(instruction, "filled", "Select value updated.");
  }
  const textElement = element;
  if (textElement.value === instruction.value) return result(instruction, "already_filled", "Field already has the requested value.");
  setValue(textElement, instruction.value);
  emitChange(textElement);
  return result(instruction, "filled", "Field value updated.");
}
export function canFillField(instruction, scope = document) {
  return Boolean(scope && inspectVisibleFormFields(scope).some(
    (field) => instruction.target.id && field.id === instruction.target.id || instruction.target.name && field.name === instruction.target.name
  ));
}
export function tryFillDefaultRadioForUnanswered(field, scope = document) {
  if (!scope || field.type !== "radio" || !field.required || field.filled) return false;
  const labelNorm = field.label.toLowerCase();
  let defaultAnswer = "";
  if (/eligible|authorized|work\s+rights|right\s+to\s+work|permit|citizen|pr|residency|legally/i.test(labelNorm)) {
    if (!/sponsorship|require\s+visa|visa\s+sponsorship/i.test(labelNorm)) {
      defaultAnswer = "Yes";
    }
  }
  if (/sponsorship|require\s+visa|visa\s+sponsorship/i.test(labelNorm)) {
    defaultAnswer = "No";
  }
  if (!defaultAnswer) return false;
  const instruction = {
    type: "content.fill-field",
    commandId: `default-radio-${Date.now()}`,
    source: "backend",
    target: { key: field.key, id: field.id, name: field.name, type: "radio", label: field.label },
    value: defaultAnswer
  };
  const res = fillFormField(instruction, scope);
  return res.status === "filled" || res.status === "already_filled";
}
