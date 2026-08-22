import {
  checkboxIsChecked,
  checkboxPresentationElements,
  comboboxCurrentValue,
  comboboxOptionsFor,
  elementsInScope,
  fieldKeyFor,
  findButtonChoiceOption,
  inspectVisibleFormFields,
  isSelectableCombobox,
  isAutofillResumeInput,
  jobAdderPhoneCountryControls,
  labelFor,
  visibleControlsInScope
} from "/src/content/dom/form-inspector.ts.js";
import {
  inspectPageCombobox,
  selectPageCombobox
} from "/src/content/dom/combobox-bridge.ts.js";
function markAutofillWrite(element, _source) {
  element.dataset.jobbyAutofillUntil = String(Date.now() + 3e3);
  window.setTimeout(() => delete element.dataset.jobbyAutofillUntil, 3100);
}
function cleanText(value) {
  return (value || "").replace(/\s+/g, " ").trim();
}
function normalized(value) {
  return cleanText(value).toLowerCase();
}
function result(instruction, status, message) {
  return {
    commandId: instruction.commandId,
    key: instruction.target.key,
    status,
    message
  };
}
function fieldType(element) {
  if (element instanceof HTMLSelectElement) return "select";
  if (element instanceof HTMLTextAreaElement) return "textarea";
  if (isSelectableCombobox(element)) return "select";
  const type = element.type.toLowerCase();
  if (type === "text" && element.hasAttribute("data-val-phone")) return "tel";
  if (type === "text" || type === "search") return "text";
  if ([
    "checkbox",
    "radio",
    "file",
    "number",
    "email",
    "tel",
    "url",
    "date",
    "password"
  ].includes(type)) {
    return type;
  }
  return "unknown";
}
function labelTextWithoutControl(label) {
  if (!label) return "";
  const copy = label.cloneNode(true);
  copy.querySelectorAll("input,select,textarea,button,img,svg,noscript,script,style").forEach((node) => node.remove());
  return cleanText(copy.textContent);
}
function checkboxChoiceGroupFor(element, scope) {
  const name = cleanText(element.name);
  if (element.type.toLowerCase() !== "checkbox" || !name || !name.startsWith("question_") || !name.endsWith("[]")) {
    return null;
  }
  const container = element.closest("fieldset");
  const label = cleanText(container?.querySelector("legend")?.textContent);
  if (!container || !label) return null;
  const root = element.getRootNode();
  const queryScope = root instanceof Document || root instanceof ShadowRoot ? root : scope;
  const options = Array.from(
    queryScope.querySelectorAll(
      `input[type='checkbox'][name='${CSS.escape(name)}']`
    )
  ).filter(
    (candidate) => isVisible(candidate) && candidate.closest("fieldset") === container
  );
  return options.length >= 2 ? { container, options, label } : null;
}
function isCheckboxChoiceGroupForTarget(element, target, scope) {
  if (!(element instanceof HTMLInputElement) || target.type !== "radio")
    return false;
  const group = checkboxChoiceGroupFor(element, scope);
  if (!group) return false;
  const currentLabel = normalized(group.label);
  const targetLabel = normalized(target.label);
  return currentLabel === targetLabel || currentLabel.length > 3 && targetLabel.length > 3 && (currentLabel.includes(targetLabel) || targetLabel.includes(currentLabel));
}
function isVisible(element) {
  const style = window.getComputedStyle(element);
  const rect = element.getBoundingClientRect();
  return style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0;
}
function ariaCheckboxLabel(element, scope) {
  const labelledBy = cleanText(element.getAttribute("aria-labelledby")).split(/\s+/).filter(Boolean).map((id) => cleanText(scope.querySelector(`#${CSS.escape(id)}`)?.textContent)).filter(Boolean).join(" ");
  return cleanText(
    labelledBy || element.getAttribute("aria-label") || labelTextWithoutControl(element.closest("label")) || element.getAttribute("name") || element.id
  );
}
function ariaCheckboxIsChecked(element) {
  return element.getAttribute("aria-checked") === "true" || element.getAttribute("data-state") === "checked" || element.classList.contains("checked") || element.classList.contains("selected");
}
function findAriaCheckbox(target, scope) {
  const candidates = elementsInScope(scope).filter(
    (element) => element.matches("[role='checkbox']") && isVisible(element)
  );
  return candidates.find(
    (element) => target.id && element.id === target.id || target.name && element.getAttribute("name") === target.name || normalized(ariaCheckboxLabel(element, scope)) === normalized(target.label)
  ) || null;
}
function findAriaCombobox(target, scope) {
  const candidates = elementsInScope(scope).filter(
    (element) => !(element instanceof HTMLInputElement) && element.getAttribute("role") === "combobox" && isVisible(element) && element.getAttribute("aria-disabled") !== "true"
  );
  const targetLabel = normalized(target.label);
  return candidates.find(
    (element) => target.id && element.id === target.id || target.name && element.getAttribute("name") === target.name || normalized(labelFor(element, scope)) === targetLabel
  ) || null;
}
function labelsMatchTarget(element, target, scope) {
  const checkboxGroup = element instanceof HTMLInputElement ? checkboxChoiceGroupFor(element, scope) : null;
  const rawCurrent = isCheckboxChoiceGroupForTarget(element, target, scope) ? checkboxGroup?.label || "" : labelFor(element, scope);
  const currentLabel = normalized(rawCurrent).replace(/^\s*(?:\(?(?:required|optional|必填|选填)\)?|\*)+\s*/gi, "").replace(/\s*(?:\(?(?:required|optional|必填|选填)\)?|\*)+\s*$/gi, "").trim();
  const targetLabel = normalized(target.label).replace(/^\s*(?:\(?(?:required|optional|必填|选填)\)?|\*)+\s*/gi, "").replace(/\s*(?:\(?(?:required|optional|必填|选填)\)?|\*)+\s*$/gi, "").trim();
  return (fieldType(element) === target.type || isCheckboxChoiceGroupForTarget(element, target, scope)) && (currentLabel === targetLabel || currentLabel.length >= 2 && targetLabel.length >= 2 && (currentLabel.includes(targetLabel) || targetLabel.includes(currentLabel)));
}
export function findFormElement(target, scope) {
  const controls = visibleControlsInScope(scope);
  const keyed = controls.find(
    (element, index) => fieldKeyFor(element, index) === target.key
  );
  if (keyed) {
    return keyed;
  }
  if (target.id) {
    const element = controls.find((candidate) => candidate.id === target.id);
    if (element instanceof HTMLInputElement || element instanceof HTMLSelectElement || element instanceof HTMLTextAreaElement) {
      return isVisible(element) ? element : null;
    }
  }
  if (target.name) {
    const elements = controls.filter(
      (element) => element.getAttribute("name") === target.name
    );
    const visibleElements = elements.filter((element) => isVisible(element));
    return visibleElements.find(
      (element) => labelsMatchTarget(element, target, scope)
    ) || visibleElements[0] || null;
  }
  return controls.find((element) => labelsMatchTarget(element, target, scope)) || null;
}
function findFileInput(target, scope) {
  const allFiles = elementsInScope(scope).filter(
    (element) => element instanceof HTMLInputElement && element.type.toLowerCase() === "file"
  );
  const files = allFiles.filter((element) => !isAutofillResumeInput(element));
  const keyed = files.find(
    (element) => fieldKeyFor(
      element,
      visibleControlsInScope(scope).length + allFiles.indexOf(element)
    ) === target.key
  );
  if (keyed && (!target.id || keyed.id === target.id) && (!target.name || keyed.name === target.name) && (Boolean(target.id || target.name) || fileInputMatchesTarget(keyed, target, scope))) {
    return keyed;
  }
  if (target.id)
    return files.find((element) => element.id === target.id) || null;
  if (target.name)
    return files.find((element) => element.name === target.name) || null;
  return files.find((element) => fileInputMatchesTarget(element, target, scope)) || null;
}
function fileUploadTrigger(input, scope) {
  const root = input.getRootNode();
  const queryScope = root instanceof Document || root instanceof ShadowRoot ? root : scope;
  const explicitTrigger = (input.id ? queryScope.querySelector(
    `label[for='${CSS.escape(input.id)}']`
  ) : null) || (input.id ? queryScope.querySelector(
    `[aria-controls='${CSS.escape(input.id)}']`
  ) : null);
  if (explicitTrigger && isVisible(explicitTrigger)) return explicitTrigger;
  let container = input.parentElement;
  for (let depth = 0; container && depth < 5; depth += 1) {
    const visibleControl = Array.from(
      container.querySelectorAll("button, [role='button'], label")
    ).find((candidate) => {
      if (!isVisible(candidate)) return false;
      return /upload|browse|choose|attach|resume|cv|file/.test(
        normalized(
          candidate.textContent || candidate.getAttribute("aria-label") || ""
        )
      );
    });
    if (visibleControl) return visibleControl;
    container = container.parentElement;
  }
  return explicitTrigger || input;
}
function nearbyFileLabelText(input) {
  let container = input.parentElement;
  for (let depth = 0; container && depth < 5; depth += 1) {
    const children = Array.from(container.children);
    const inputBranchIndex = children.findIndex((child) => child.contains(input));
    const siblingText = children.slice(0, inputBranchIndex).map((child) => cleanText(child.textContent)).filter(Boolean).join(" ");
    if (siblingText) return siblingText;
    container = container.parentElement;
  }
  return "";
}
function fileInputMatchesTarget(input, target, scope) {
  const targetLabel = normalized(target.label);
  const trigger = fileUploadTrigger(input, scope);
  const uploadGroup = input.closest(
    "[role='group'][aria-labelledby], .file-upload, [class*='file-upload' i]"
  );
  const root = input.getRootNode();
  const queryScope = root instanceof Document || root instanceof ShadowRoot ? root : scope;
  const groupLabel = cleanText(
    uploadGroup?.getAttribute("aria-labelledby")?.split(/\s+/).map((id) => queryScope.querySelector(`#${CSS.escape(id)}`)?.textContent).join(" ")
  );
  const context = normalized(
    [
      groupLabel,
      nearbyFileLabelText(input),
      input.getAttribute("aria-label"),
      input.getAttribute("name"),
      trigger.getAttribute("aria-label"),
      trigger.textContent,
      trigger.closest("fieldset, section, [role='group'], div")?.textContent
    ].filter(Boolean).join(" ")
  );
  return context.includes(targetLabel) || targetLabel.length > 3 && context.includes(targetLabel.replace(/\s*\*+\s*$/, ""));
}
function selectExistingDocument(input, optionId, scope) {
  const root = input.getRootNode();
  const queryScope = root instanceof Document || root instanceof ShadowRoot ? root : scope;
  const option = queryScope.querySelector(
    `input[type='radio'][id='${CSS.escape(optionId)}']`
  );
  if (!option) return "not_found";
  if (option.checked) return "already_selected";
  clickRadioOption(option, scope);
  return option.checked ? "selected" : "not_found";
}
function formatValueForInput(element, value) {
  if (element instanceof HTMLInputElement) {
    const placeholder = (element.getAttribute("placeholder") || "").toLowerCase();
    const ariaLabel = (element.getAttribute("aria-label") || "").toLowerCase();
    const isIsoDate = /^\d{4}-\d{2}-\d{2}$/.test(value.trim());
    if (isIsoDate) {
      const [year, month, day] = value.trim().split("-");
      if (placeholder.includes("mm/dd/yyyy") || ariaLabel.includes("mm/dd/yyyy")) {
        return `${month}/${day}/${year}`;
      }
      if (placeholder.includes("dd/mm/yyyy") || ariaLabel.includes("dd/mm/yyyy")) {
        return `${day}/${month}/${year}`;
      }
    }
  }
  return value;
}
function setValue(element, value) {
  const formattedValue = formatValueForInput(element, value);
  const tracker = element._valueTracker;
  if (tracker) {
    tracker.setValue(formattedValue);
  }
  const prototype = element instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(prototype, "value")?.set;
  if (setter) setter.call(element, formattedValue);
  else element.value = formattedValue;
}
function findJobAdderPhoneCountryControl(target, scope) {
  return jobAdderPhoneCountryControls(scope).find(
    (control) => target.key === control.countryCode.id || target.key === control.countryCode.name || target.id && target.id === control.countryCode.id || target.name && target.name === control.countryCode.name
  ) || null;
}
function fillJobAdderPhoneCountry(instruction, scope) {
  if (instruction.target.type !== "select" || typeof instruction.value !== "string") return null;
  const control = findJobAdderPhoneCountryControl(instruction.target, scope);
  if (!control) return null;
  const requestedValue = instruction.value;
  const requested = requestedValue.trim().toUpperCase();
  const option = control.options.find(
    (candidate) => candidate.value.toUpperCase() === requested || normalized(candidate.label) === normalized(requestedValue)
  );
  if (!option && requestedValue !== "") {
    return result(instruction, "rejected", "The requested phone country is unavailable.");
  }
  const nextValue = option?.value || "";
  if (normalized(control.countryCode.value) === normalized(nextValue)) {
    return result(instruction, "already_filled", "Phone country already has the requested value.");
  }
  markAutofillWrite(control.countryList, instruction.source);
  setValue(control.countryList, nextValue);
  emitChange(control.countryList);
  if (normalized(control.countryCode.value) !== normalized(nextValue)) {
    setValue(control.countryCode, nextValue);
    emitChange(control.countryCode);
  }
  return result(
    instruction,
    normalized(control.countryCode.value) === normalized(nextValue) ? "filled" : "rejected",
    normalized(control.countryCode.value) === normalized(nextValue) ? "Phone country updated." : "The webpage did not accept the phone country update."
  );
}
function emitChange(element) {
  const eventOptions = { bubbles: true, composed: true };
  try {
    element.dispatchEvent(
      new InputEvent("input", { ...eventOptions, inputType: "insertText" })
    );
  } catch {
    element.dispatchEvent(new Event("input", eventOptions));
  }
  element.dispatchEvent(new Event("change", eventOptions));
  element.dispatchEvent(new FocusEvent("focusout", eventOptions));
  element.dispatchEvent(new FocusEvent("blur", eventOptions));
}
function emitInput(element) {
  const eventOptions = { bubbles: true, composed: true };
  try {
    element.dispatchEvent(
      new InputEvent("input", { ...eventOptions, inputType: "insertText" })
    );
  } catch {
    element.dispatchEvent(new Event("input", eventOptions));
  }
}
function decodeBase64(contentBase64) {
  try {
    const binary = atob(contentBase64);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1)
      bytes[index] = binary.charCodeAt(index);
    return bytes;
  } catch {
    return null;
  }
}
export async function uploadFormFile(instruction, scope = document) {
  if (!scope)
    return {
      commandId: instruction.commandId,
      key: instruction.target.key,
      status: "not_found",
      message: "No supported application form is open."
    };
  const input = findFileInput(instruction.target, scope);
  if (!input)
    return {
      commandId: instruction.commandId,
      key: instruction.target.key,
      status: "not_found",
      message: "The upload control is no longer available."
    };
  const bytes = decodeBase64(instruction.contentBase64);
  if (!bytes)
    return {
      commandId: instruction.commandId,
      key: instruction.target.key,
      status: "rejected",
      message: "The resume file could not be decoded."
    };
  const accepted = input.accept.split(",").map((value) => value.trim().toLowerCase()).filter(Boolean);
  const extensionStart = instruction.filename.lastIndexOf(".");
  const extension = extensionStart >= 0 ? instruction.filename.slice(extensionStart).toLowerCase() : "";
  const acceptedByInput = accepted.length === 0 || accepted.some(
    (value) => value === instruction.mimeType.toLowerCase() || value === extension || value.endsWith("/*") && instruction.mimeType.toLowerCase().startsWith(value.slice(0, -1))
  );
  if (!acceptedByInput) {
    return {
      commandId: instruction.commandId,
      key: instruction.target.key,
      status: "rejected",
      message: `This upload control does not accept ${instruction.filename}.`
    };
  }
  try {
    const scrollPosition = { left: window.scrollX, top: window.scrollY };
    const file = new File(
      [bytes.slice().buffer],
      instruction.filename,
      { type: instruction.mimeType }
    );
    const transfer = new DataTransfer();
    transfer.items.add(file);
    const setter = Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "files"
    )?.set;
    if (setter) setter.call(input, transfer.files);
    else input.files = transfer.files;
    emitChange(input);
    await waitForUploadUiToSettle(input, instruction.filename);
    restoreScrollAfterRerender(scrollPosition);
  } catch {
    return {
      commandId: instruction.commandId,
      key: instruction.target.key,
      status: "rejected",
      message: "The webpage blocked automatic file assignment."
    };
  }
  const selected = input.files?.[0];
  if (!selected || selected.name !== instruction.filename || selected.size === 0) {
    return {
      commandId: instruction.commandId,
      key: instruction.target.key,
      status: "rejected",
      message: "The webpage did not accept the resume file."
    };
  }
  return {
    commandId: instruction.commandId,
    key: instruction.target.key,
    status: "filled",
    message: `${instruction.filename} uploaded.`
  };
}
function waitForUploadUiToSettle(input, filename) {
  return new Promise((resolve) => {
    let settled = false;
    let timer;
    const finish = () => {
      if (settled) return;
      settled = true;
      observer.disconnect();
      if (timer !== void 0) window.clearTimeout(timer);
      resolve();
    };
    const observer = new MutationObserver(() => {
      const text = cleanText(input.closest("form, section, div")?.textContent);
      if (!input.isConnected || text.includes(filename)) finish();
    });
    observer.observe(document.documentElement, {
      childList: true,
      subtree: true
    });
    timer = window.setTimeout(finish, 900);
  });
}
function restoreScrollAfterRerender(position) {
  const restore = () => {
    if (position.top > 80 && window.scrollY < 80) {
      window.scrollTo({
        left: position.left,
        top: position.top,
        behavior: "auto"
      });
    }
  };
  restore();
  [80, 260, 700].forEach((delay) => window.setTimeout(restore, delay));
}
function findFileRemoveButton(input) {
  let container = input.parentElement;
  for (let depth = 0; container && depth < 6; depth += 1) {
    const candidateButtons = Array.from(
      container.querySelectorAll(
        "button, [role='button'], a, svg, span.dismiss, .remove-file, .delete-file, [aria-label*='remove' i], [aria-label*='delete' i], [aria-label*='clear' i], [aria-label*='trash' i], [aria-label*='删除' i], [aria-label*='移除' i], [aria-label*='清除' i]"
      )
    );
    const removeBtn = candidateButtons.find((candidate) => {
      if (!isVisible(candidate) || candidate === input) return false;
      const text = normalized(
        candidate.textContent || candidate.getAttribute("aria-label") || candidate.getAttribute("title") || candidate.className || ""
      );
      return /delete|remove|clear|trash|dismiss|cancel|detach|remove-file|delete-file|删除|移除|清除/.test(
        text
      ) || candidate.querySelector("svg") !== null;
    });
    if (removeBtn) return removeBtn;
    container = container.parentElement;
  }
  return null;
}
export function clearFormFile(input, instruction) {
  const scrollPosition = { left: window.scrollX, top: window.scrollY };
  const removeBtn = findFileRemoveButton(input);
  if (removeBtn) {
    clickControl(removeBtn);
  }
  try {
    const setter = Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "files"
    )?.set;
    const emptyTransfer = new DataTransfer();
    if (setter) setter.call(input, emptyTransfer.files);
    else input.files = emptyTransfer.files;
  } catch {
  }
  setValue(input, "");
  emitChange(input);
  restoreScrollAfterRerender(scrollPosition);
  return result(instruction, "filled", "File upload cleared.");
}
function matchesTarget(element, instruction, scope) {
  if (instruction.target.id && element.id === instruction.target.id) return true;
  if (instruction.target.name && element.getAttribute("name") === instruction.target.name) return true;
  return labelsMatchTarget(element, instruction.target, scope);
}
function setSelectValue(element, value) {
  const normVal = normalized(value);
  const matchedOpt = Array.from(element.options).find(
    (opt) => opt.value === value || normalized(opt.value) === normVal || normalized(opt.textContent || "") === normVal || normVal.length > 1 && normalized(opt.textContent || "").includes(normVal)
  );
  if (matchedOpt) {
    Array.from(element.options).forEach((opt) => {
      opt.selected = opt === matchedOpt;
    });
  }
  const setter = Object.getOwnPropertyDescriptor(
    HTMLSelectElement.prototype,
    "value"
  )?.set;
  if (setter) setter.call(element, matchedOpt?.value || value);
  else element.value = matchedOpt?.value || value;
}
function clickControl(target) {
  const eventOptions = { bubbles: true, cancelable: true, composed: true };
  target.dispatchEvent(new PointerEvent("pointerdown", eventOptions));
  target.dispatchEvent(new MouseEvent("mousedown", eventOptions));
  target.dispatchEvent(new PointerEvent("pointerup", eventOptions));
  target.dispatchEvent(new MouseEvent("mouseup", eventOptions));
  target.click();
}
function checkboxInteractionTargets(checkbox, scope) {
  const visiblePresentation = checkboxPresentationElements(
    checkbox,
    scope
  ).filter((candidate) => candidate !== checkbox && isVisible(candidate));
  return [...visiblePresentation, checkbox];
}
function updateCheckbox(checkbox, checked, scope) {
  const scrollPosition = { left: window.scrollX, top: window.scrollY };
  for (const target of checkboxInteractionTargets(checkbox, scope)) {
    if (checkboxIsChecked(checkbox, scope) === checked) return true;
    clickControl(target);
    if (checkboxIsChecked(checkbox, scope) === checked) {
      restoreScrollAfterRerender(scrollPosition);
      return true;
    }
  }
  return checkboxIsChecked(checkbox, scope) === checked;
}
function visibleOptionMatch(root, value) {
  const targetValue = normalized(value);
  const selector = "[role='option'], [role='listbox'] button, [role='listbox'] li, [data-value], [data-option-value], [class*='t1-' i], [class*='option' i], [class*='item' i], [class*='suggestion' i], [class*='result' i], [class*='row' i]";
  const candidates = root instanceof Document || root instanceof HTMLElement || root instanceof ShadowRoot ? elementsInScope(root).filter(
    (element) => element.matches(selector) || element.tagName.toLowerCase().endsWith("-option") || element.parentElement?.getAttribute("role") === "listbox"
  ) : Array.from(root.querySelectorAll(selector));
  return candidates.find((candidate) => {
    if (!isVisible(candidate) || candidate.getAttribute("aria-disabled") === "true" || candidate instanceof HTMLInputElement || candidate instanceof HTMLSelectElement)
      return false;
    const candidateValue = normalized(
      candidate.getAttribute("data-value") || candidate.getAttribute("data-option-value") || candidate.getAttribute("aria-label") || candidate.textContent || candidate.getAttribute("value") || ""
    );
    return candidateValue === targetValue || targetValue.length > 1 && (candidateValue.includes(targetValue) || targetValue.includes(candidateValue));
  }) || null;
}
function optionInteractionTarget(option) {
  return option.shadowRoot?.querySelector(
    "[role='option'], button, [role='button']"
  ) || option;
}
async function clickVisualSelectOption(element, value, scope) {
  const root = element.getRootNode();
  const queryScope = root instanceof Document || root instanceof ShadowRoot ? root : scope;
  const fieldContainer = element.closest(
    "label, [role='combobox'], [data-automation], [data-testid], .field, .input-group"
  ) || element.parentElement;
  const trigger = fieldContainer?.querySelector(
    "[role='combobox'], button[aria-haspopup='listbox'], [aria-controls][role='button']"
  );
  if (!trigger) return false;
  clickControl(trigger);
  const startedAt = Date.now();
  let option = null;
  while (!option && Date.now() - startedAt < 900) {
    option = visibleOptionMatch(queryScope, value) || (queryScope !== document ? visibleOptionMatch(document, value) : null);
    if (!option) await new Promise((resolve) => window.setTimeout(resolve, 40));
  }
  if (!option) return false;
  clickControl(optionInteractionTarget(option));
  return true;
}
function comboboxListbox(element, scope) {
  const root = element.getRootNode();
  const queryScope = root instanceof Document || root instanceof ShadowRoot ? root : scope;
  const id = cleanText(element.getAttribute("aria-controls"));
  if (!id) return null;
  const localMatch = queryScope.querySelector(`#${CSS.escape(id)}`) || (queryScope !== document ? document.querySelector(`#${CSS.escape(id)}`) : null);
  if (localMatch) return localMatch;
  return elementsInScope(scope).find((candidate) => candidate.id === id) || (scope !== document ? elementsInScope(document).find((candidate) => candidate.id === id) : null) || null;
}
function matchingComboboxLabel(element, value, scope) {
  const targetValue = normalized(value);
  const root = element.getRootNode();
  const queryScope = root instanceof Document || root instanceof ShadowRoot ? root : scope;
  const matchingOption = comboboxOptionsFor(element, queryScope).find(
    (option) => {
      const optionValue = normalized(option.value);
      const optionLabel = normalized(option.label);
      return optionValue === targetValue || optionLabel === targetValue || targetValue.length > 1 && (optionValue.includes(targetValue) || targetValue.includes(optionValue)) || targetValue.length > 1 && (optionLabel.includes(targetValue) || targetValue.includes(optionLabel));
    }
  );
  return matchingOption?.label || value;
}
function comboboxSelectionMatches(element, value) {
  const selected = normalized(comboboxCurrentValue(element) || element.value);
  const expected = normalized(value);
  return Boolean(
    selected && (selected === expected || expected.length > 1 && (selected.includes(expected) || expected.includes(selected)))
  );
}
const COMBOBOX_OPTION_WAIT_MS = 2500;
const COMBOBOX_COMMIT_WAIT_MS = 1200;
function comboboxHasCommittedSelection(element, scope, value, typedQuery) {
  const expected = normalized(value);
  const bridgedValue = normalized(inspectPageCombobox(element)?.currentValue || "");
  if (bridgedValue && (bridgedValue === expected || bridgedValue.includes(expected) || expected.includes(bridgedValue))) {
    return true;
  }
  const listbox = comboboxListbox(element, scope);
  const selectedOption = listbox ? elementsInScope(listbox).find(
    (candidate) => candidate.getAttribute("aria-selected") === "true" || candidate.getAttribute("aria-checked") === "true" || candidate.getAttribute("data-state") === "selected" || candidate.getAttribute("data-state") === "checked"
  ) : void 0;
  if (selectedOption) {
    const selectedValue = normalized(
      selectedOption.getAttribute("data-value") || selectedOption.getAttribute("data-option-value") || selectedOption.getAttribute("aria-label") || selectedOption.textContent
    );
    if (selectedValue === expected || selectedValue.includes(expected) || expected.includes(selectedValue)) {
      return true;
    }
  }
  if (!comboboxSelectionMatches(element, value)) return false;
  const valueChangedAfterChoice = normalized(element.value) !== normalized(typedQuery);
  const listboxClosed = element.getAttribute("aria-expanded") === "false" || !listbox || !isVisible(listbox);
  return valueChangedAfterChoice || listboxClosed;
}
function waitForComboboxCommit(element, scope, value, typedQuery, timeoutMs = COMBOBOX_COMMIT_WAIT_MS) {
  return new Promise((resolve) => {
    const startedAt = Date.now();
    const verify = () => {
      if (comboboxHasCommittedSelection(element, scope, value, typedQuery)) {
        resolve(true);
        return;
      }
      if (Date.now() - startedAt >= timeoutMs) {
        resolve(false);
        return;
      }
      window.setTimeout(verify, 40);
    };
    verify();
  });
}
function waitForComboboxOption(element, scope, value) {
  return new Promise((resolve) => {
    const startedAt = Date.now();
    const find = () => {
      const listbox = comboboxListbox(element, scope);
      const option = listbox && visibleOptionMatch(listbox, value) || visibleOptionMatch(document, value);
      if (option) {
        resolve(option);
        return;
      }
      if (Date.now() - startedAt >= COMBOBOX_OPTION_WAIT_MS) {
        resolve(null);
        return;
      }
      window.setTimeout(find, 40);
    };
    find();
  });
}
async function fillCombobox(element, value, scope) {
  const label = matchingComboboxLabel(element, value, scope);
  if (comboboxSelectionMatches(element, label)) return true;
  const bridged = await selectPageCombobox(element, value);
  if (bridged?.ok && comboboxSelectionMatches(element, label)) return true;
  try {
    element.focus({ preventScroll: true });
  } catch {
  }
  if (element.getAttribute("aria-expanded") !== "true") clickControl(element);
  setValue(element, label);
  emitInput(element);
  const typedQuery = element.value;
  const option = await waitForComboboxOption(element, scope, label);
  if (option) {
    clickControl(optionInteractionTarget(option));
    if (await waitForComboboxCommit(element, scope, label, typedQuery)) {
      return true;
    }
  }
  const dispatchKey = (key, keyCode) => {
    const keyOptions = { key, code: key, keyCode, which: keyCode, bubbles: true, cancelable: true };
    element.dispatchEvent(new KeyboardEvent("keydown", keyOptions));
    element.dispatchEvent(new KeyboardEvent("keyup", keyOptions));
  };
  dispatchKey("ArrowDown", 40);
  dispatchKey("Enter", 13);
  if (await waitForComboboxCommit(element, scope, label, typedQuery)) return true;
  dispatchKey("Tab", 9);
  return waitForComboboxCommit(element, scope, label, typedQuery, 500);
}
async function fillAriaCombobox(element, value) {
  const before = normalized(element.textContent || "");
  clickControl(element);
  const startedAt = Date.now();
  let option = null;
  while (!option && Date.now() - startedAt < 900) {
    option = visibleOptionMatch(document, value);
    if (!option) await new Promise((resolve) => window.setTimeout(resolve, 40));
  }
  if (!option) return false;
  clickControl(optionInteractionTarget(option));
  await new Promise((resolve) => window.setTimeout(resolve, 150));
  const after = normalized(element.textContent || "");
  const expected = normalized(value);
  return after !== before || after === expected || after.includes(expected) || expected.includes(after);
}
async function fillSelect(element, value, scope) {
  const normValue = normalized(value);
  const option = Array.from(element.options).find(
    (candidate) => candidate.value === value || normalized(candidate.value) === normValue || normalized(candidate.textContent || "") === normValue || normValue.length > 1 && normalized(candidate.textContent || "").includes(normValue) || normValue.length > 1 && normValue.includes(normalized(candidate.textContent || ""))
  );
  if (!option) return { matched: false, changed: false };
  const previousValue = element.value;
  const visualSelected = await clickVisualSelectOption(
    element,
    option.value || option.textContent || value,
    scope
  );
  if (element.value === option.value) {
    return { matched: true, changed: previousValue !== option.value || visualSelected };
  }
  setSelectValue(element, option.value);
  return {
    matched: element.value === option.value || visualSelected,
    changed: previousValue !== option.value || visualSelected
  };
}
function optionLabelFor(element, scope) {
  const root = element.getRootNode();
  const queryScope = root instanceof Document || root instanceof ShadowRoot ? root : scope;
  const ariaLabel = cleanText(element.getAttribute("aria-label"));
  if (ariaLabel) return ariaLabel;
  const labelledBy = cleanText(element.getAttribute("aria-labelledby")).split(/\s+/).filter(Boolean).map((id2) => cleanText(queryScope.querySelector(`#${CSS.escape(id2)}`)?.textContent)).filter(Boolean).join(" ");
  if (labelledBy) return labelledBy;
  const dataLabel = cleanText(element.getAttribute("data-label") || element.getAttribute("data-value"));
  if (dataLabel) return dataLabel;
  const id = cleanText(element.id);
  if (id) {
    const label = queryScope.querySelector(
      `label[for='${CSS.escape(id)}']`
    );
    const text = labelTextWithoutControl(label);
    if (text) return text;
  }
  const parentLabel = labelTextWithoutControl(element.closest("label"));
  if (parentLabel) return parentLabel;
  const siblingText = cleanText(
    element.nextElementSibling?.textContent || element.parentElement?.textContent || ""
  );
  if (siblingText && siblingText.length <= 50) return siblingText;
  const previousText = cleanText(element.previousElementSibling?.textContent || "");
  if (previousText && previousText.length <= 50) return previousText;
  if (element instanceof HTMLInputElement && element.value)
    return element.value;
  return "";
}
function isSeekHost() {
  const hostname = window.location.hostname.toLowerCase();
  return hostname === "seek.com" || hostname.endsWith(".seek.com") || hostname === "seek.com.au" || hostname.endsWith(".seek.com.au");
}
function clickRadioOption(element, scope) {
  if (isSeekHost()) {
    element.focus({ preventScroll: true });
    element.click();
    if (element.checked) return;
  }
  const root = element.getRootNode();
  const queryScope = root instanceof Document || root instanceof ShadowRoot ? root : scope;
  const explicitLabel = element.id ? queryScope.querySelector(
    `label[for='${CSS.escape(element.id)}']`
  ) : null;
  const target = explicitLabel || element.closest("label, [role='radio']") || element;
  clickControl(target);
}
function fillRadio(element, value, scope) {
  const root = element.getRootNode();
  const queryScope = root instanceof Document || root instanceof ShadowRoot ? root : scope;
  let group = element.name ? Array.from(
    queryScope.querySelectorAll(
      `input[type='radio'][name='${CSS.escape(element.name)}']`
    )
  ) : [];
  if (group.length <= 1) {
    let container = element.parentElement;
    for (let depth = 0; container && depth < 8; depth += 1) {
      const containerRadios = Array.from(container.querySelectorAll("input[type='radio']"));
      if (containerRadios.length >= 2) {
        group = containerRadios;
        break;
      }
      container = container.parentElement;
    }
  }
  if (group.length === 0) group = [element];
  const targetNorm = normalized(value);
  const targetAliases = /* @__PURE__ */ new Set([targetNorm]);
  if (["yes", "true", "authorized", "eligible"].includes(targetNorm)) {
    targetAliases.add("y");
    targetAliases.add("yes");
    targetAliases.add("true");
    targetAliases.add("1");
  } else if (["no", "false"].includes(targetNorm)) {
    targetAliases.add("n");
    targetAliases.add("no");
    targetAliases.add("false");
    targetAliases.add("0");
  }
  const selected = group.find((candidate) => {
    const candVal = normalized(candidate.value);
    const candLabel = normalized(optionLabelFor(candidate, scope));
    if (candidate.value === value || targetAliases.has(candVal) || targetAliases.has(candLabel)) {
      return true;
    }
    return targetNorm.length > 1 && (candLabel.includes(targetNorm) || targetNorm.includes(candLabel)) || targetNorm.length > 1 && (candVal.includes(targetNorm) || targetNorm.includes(candVal));
  });
  if (!selected) return false;
  const scrollPosition = { left: window.scrollX, top: window.scrollY };
  clickRadioOption(selected, scope);
  if (!selected.checked) {
    try {
      selected.click();
    } catch {
    }
  }
  if (!selected.checked) {
    try {
      selected.checked = true;
      selected.dispatchEvent(new Event("change", { bubbles: true, composed: true }));
      selected.dispatchEvent(new Event("input", { bubbles: true, composed: true }));
    } catch {
    }
  }
  if (!selected.checked) {
    return false;
  }
  restoreScrollAfterRerender(scrollPosition);
  return true;
}
function fillCheckboxChoiceGroup(element, value, scope) {
  const group = checkboxChoiceGroupFor(element, scope);
  if (!group) return false;
  const targetValue = normalized(value);
  const selected = group.options.find((option) => {
    const optionLabel = normalized(optionLabelFor(option, scope));
    return option.value === value || normalized(option.value) === targetValue || optionLabel === targetValue || targetValue.length > 1 && (optionLabel.includes(targetValue) || targetValue.includes(optionLabel));
  });
  if (!selected) return false;
  const scrollPosition = { left: window.scrollX, top: window.scrollY };
  for (const option of group.options) {
    if (option !== selected && checkboxIsChecked(option, scope) && !updateCheckbox(option, false, scope))
      return false;
  }
  if (!checkboxIsChecked(selected, scope) && !updateCheckbox(selected, true, scope))
    return false;
  restoreScrollAfterRerender(scrollPosition);
  return checkboxIsChecked(selected, scope);
}
export async function fillFormField(instruction, scope = document) {
  if (!scope)
    return result(
      instruction,
      "not_found",
      "No supported application form is open."
    );
  const jobAdderCountryResult = fillJobAdderPhoneCountry(instruction, scope);
  if (jobAdderCountryResult) return jobAdderCountryResult;
  if (instruction.target.type === "file") {
    const input = findFileInput(instruction.target, scope);
    if (!input)
      return result(
        instruction,
        "not_found",
        "The upload control is no longer available."
      );
    if (typeof instruction.value === "string" && instruction.source === "panel") {
      if (instruction.value === "") {
        return clearFormFile(input, instruction);
      }
      const selection = selectExistingDocument(input, instruction.value, scope);
      if (selection === "selected")
        return result(instruction, "filled", "Existing document selected.");
      if (selection === "already_selected")
        return result(
          instruction,
          "already_filled",
          "This document is already selected."
        );
      return result(
        instruction,
        "rejected",
        "The selected document is no longer available."
      );
    }
    return result(
      instruction,
      "requires_user_action",
      "Choose a local file through the browser file picker."
    );
  }
  const ariaCheckbox = instruction.target.type === "checkbox" ? findAriaCheckbox(instruction.target, scope) : null;
  if (ariaCheckbox) {
    if (typeof instruction.value !== "boolean")
      return result(instruction, "rejected", "Checkbox values must be boolean.");
    if (ariaCheckboxIsChecked(ariaCheckbox) === instruction.value)
      return result(instruction, "already_filled", "Checkbox already has the requested value.");
    if (instruction.value) clickControl(ariaCheckbox);
    if (!instruction.value && ariaCheckboxIsChecked(ariaCheckbox)) clickControl(ariaCheckbox);
    return result(
      instruction,
      ariaCheckboxIsChecked(ariaCheckbox) === instruction.value ? "filled" : "rejected",
      ariaCheckboxIsChecked(ariaCheckbox) === instruction.value ? "Checkbox value updated." : "The webpage did not accept this checkbox change. Please tick it directly on the webpage."
    );
  }
  const ariaCombobox = instruction.target.type === "select" ? findAriaCombobox(instruction.target, scope) : null;
  if (ariaCombobox) {
    if (typeof instruction.value !== "string")
      return result(instruction, "rejected", "Dropdown values must be strings.");
    const current = normalized(ariaCombobox.textContent || "");
    const expected = normalized(instruction.value);
    if (current && (current === expected || current.includes(expected) || expected.includes(current))) {
      return result(instruction, "already_filled", "Dropdown already has the requested value.");
    }
    const filled = await fillAriaCombobox(ariaCombobox, instruction.value);
    return result(
      instruction,
      filled ? "filled" : "rejected",
      filled ? "Dropdown value updated." : "The requested dropdown option is unavailable."
    );
  }
  let element = findFormElement(instruction.target, scope);
  if (!element && instruction.target.type !== "radio") {
    await new Promise((resolve) => window.setTimeout(resolve, 200));
    element = findFormElement(instruction.target, scope);
  }
  if (!element) {
    if (instruction.target.type === "radio" && typeof instruction.value === "string") {
      const choice = findButtonChoiceOption(
        scope,
        instruction.target.label,
        instruction.value
      );
      if (!choice)
        return result(
          instruction,
          "not_found",
          "The targeted field is no longer visible."
        );
      const scrollPosition = { left: window.scrollX, top: window.scrollY };
      clickControl(choice);
      restoreScrollAfterRerender(scrollPosition);
      return result(instruction, "filled", "Button choice selected.");
    }
    return result(
      instruction,
      "not_found",
      "The targeted field is no longer visible."
    );
  }
  if (instruction.source !== "panel" && !matchesTarget(element, instruction, scope)) {
    return result(
      instruction,
      "rejected",
      "The field identity changed; no value was written."
    );
  }
  const type = fieldType(element);
  markAutofillWrite(element, instruction.source);
  if (instruction.target.type === "radio" && element instanceof HTMLInputElement && checkboxChoiceGroupFor(element, scope)) {
    if (typeof instruction.value !== "string")
      return result(instruction, "rejected", "Choice values must be strings.");
    if (!fillCheckboxChoiceGroup(element, instruction.value, scope)) {
      return result(
        instruction,
        "rejected",
        "The requested option is unavailable."
      );
    }
    return result(instruction, "filled", "Choice selected.");
  }
  if (type === "password") {
    return result(
      instruction,
      "requires_user_action",
      "Sensitive fields require explicit user handling."
    );
  }
  if (type === "unknown")
    return result(instruction, "rejected", "This field type is not supported.");
  if (type === "checkbox") {
    if (typeof instruction.value !== "boolean")
      return result(
        instruction,
        "rejected",
        "Checkbox values must be boolean."
      );
    const checkbox = element;
    if (checkboxIsChecked(checkbox, scope) === instruction.value) {
      return result(
        instruction,
        "already_filled",
        "Checkbox already has the requested value."
      );
    }
    if (!updateCheckbox(checkbox, instruction.value, scope)) {
      return result(
        instruction,
        "rejected",
        "The webpage did not accept this checkbox change. Please tick it directly on the webpage."
      );
    }
    return result(instruction, "filled", "Checkbox value updated.");
  }
  if (type === "radio") {
    if (typeof instruction.value !== "string")
      return result(instruction, "rejected", "Radio values must be strings.");
    if (!fillRadio(element, instruction.value, scope))
      return result(
        instruction,
        "rejected",
        "The requested radio option is unavailable."
      );
    return result(instruction, "filled", "Radio option selected.");
  }
  if (typeof instruction.value !== "string")
    return result(
      instruction,
      "rejected",
      "This field requires a string value."
    );
  if (type === "select") {
    if (element instanceof HTMLInputElement && isSelectableCombobox(element)) {
      const combobox = element;
      const previousValue2 = comboboxCurrentValue(combobox);
      if (!await fillCombobox(combobox, instruction.value, scope)) {
        return result(
          instruction,
          "rejected",
          "The requested dropdown option is unavailable."
        );
      }
      await new Promise((res) => window.setTimeout(res, 150));
      if (normalized(comboboxCurrentValue(combobox)) === normalized(previousValue2)) {
        return result(
          instruction,
          "already_filled",
          "Dropdown already has the requested value."
        );
      }
      return result(instruction, "filled", "Dropdown value updated.");
    }
    const select = element;
    const previousValue = select.value;
    const selection = await fillSelect(select, instruction.value, scope);
    if (!selection.matched)
      return result(
        instruction,
        "rejected",
        "The requested select option is unavailable."
      );
    emitChange(select);
    await new Promise((res) => window.setTimeout(res, 150));
    if (!selection.changed && select.value === previousValue)
      return result(
        instruction,
        "already_filled",
        "Select already has the requested value."
      );
    return result(instruction, "filled", "Select value updated.");
  }
  const textElement = element;
  if (textElement.value === instruction.value)
    return result(
      instruction,
      "already_filled",
      "Field already has the requested value."
    );
  try {
    textElement.focus({ preventScroll: true });
  } catch {
  }
  const focusEventOptions = { bubbles: true, composed: true, cancelable: true };
  textElement.dispatchEvent(new PointerEvent("pointerdown", focusEventOptions));
  textElement.dispatchEvent(new MouseEvent("mousedown", focusEventOptions));
  textElement.dispatchEvent(
    new FocusEvent("focusin", { bubbles: true, composed: true })
  );
  textElement.dispatchEvent(
    new FocusEvent("focus", { bubbles: true, composed: true })
  );
  setValue(textElement, instruction.value);
  textElement.dispatchEvent(
    new KeyboardEvent("keydown", { key: "a", code: "KeyA", bubbles: true, cancelable: true, composed: true })
  );
  textElement.dispatchEvent(
    new KeyboardEvent("keyup", { key: "a", code: "KeyA", bubbles: true, cancelable: true, composed: true })
  );
  emitChange(textElement);
  try {
    textElement.blur();
  } catch {
  }
  return result(instruction, "filled", "Field value updated.");
}
export function fillFormFieldValue(target, value, scope = document) {
  const safeKey = target.key.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 32);
  const commandId = `panel-${Date.now()}-${safeKey}`.slice(0, 64);
  return fillFormField(
    {
      type: "content.fill-field",
      commandId,
      source: "panel",
      target,
      value
    },
    scope
  );
}
function questionContainerFor(element) {
  const semanticContainer = element.closest(
    [
      "fieldset",
      "[role='group']",
      ".fb-dash-form-element",
      ".jobs-easy-apply-form-element",
      ".jobs-document-upload",
      ".jobs-document-upload-redesign-card",
      "[data-test-form-element]",
      "[data-test-form-element-container]",
      ".artdeco-text-input--container",
      ".artdeco-dropdown",
      ".artdeco-toggle"
    ].join(", ")
  );
  if (semanticContainer) return semanticContainer;
  const wrappingLabel = element.closest("label");
  if (wrappingLabel) return wrappingLabel;
  let candidate = element;
  for (let depth = 0; depth < 4; depth += 1) {
    const parent = candidate.parentElement;
    if (!parent || !isVisible(parent)) break;
    const rect = parent.getBoundingClientRect();
    const hasQuestionText = Boolean(
      parent.querySelector("label, legend, [aria-label]")
    );
    if (hasQuestionText && rect.height > element.getBoundingClientRect().height + 8 && rect.height < 420) {
      return parent;
    }
    candidate = parent;
  }
  return element;
}
function scrollAndHighlightQuestion(element) {
  const question = questionContainerFor(element);
  question.scrollIntoView({
    behavior: "smooth",
    block: "center",
    inline: "nearest"
  });
  const highlight = document.createElement("div");
  Object.assign(highlight.style, {
    position: "fixed",
    background: "rgba(250, 204, 21, 0.30)",
    border: "2px solid rgba(202, 138, 4, 0.95)",
    borderRadius: "14px",
    padding: "7px",
    margin: "-7px",
    pointerEvents: "none",
    zIndex: "2147483647",
    transition: "opacity 1000ms ease",
    opacity: "0"
  });
  document.documentElement.appendChild(highlight);
  let revealed = false;
  const positionHighlight = () => {
    const rect = question.getBoundingClientRect();
    Object.assign(highlight.style, {
      left: `${Math.max(0, rect.left - 7)}px`,
      top: `${Math.max(0, rect.top - 7)}px`,
      width: `${rect.width + 14}px`,
      height: `${rect.height + 14}px`
    });
  };
  const revealAfterScroll = () => {
    if (revealed) return;
    revealed = true;
    document.removeEventListener("scrollend", revealAfterScroll, true);
    positionHighlight();
    highlight.style.opacity = "1";
  };
  document.addEventListener("scrollend", revealAfterScroll, true);
  window.setTimeout(revealAfterScroll, 750);
  window.setTimeout(() => {
    highlight.style.opacity = "0";
    window.setTimeout(() => highlight.remove(), 260);
  }, 1900);
}
export function focusFormField(target, scope = document) {
  if (!scope)
    return {
      key: target.key,
      status: "not_found",
      message: "No active form scope."
    };
  if (target.type === "file") {
    const input = findFileInput(target, scope);
    if (!input)
      return {
        key: target.key,
        status: "not_found",
        message: "The upload control is no longer available."
      };
    const trigger = fileUploadTrigger(input, scope);
    scrollAndHighlightQuestion(trigger);
    return {
      key: target.key,
      status: "focused",
      message: "Upload control highlighted. Click the upload button on the webpage to choose a local file."
    };
  }
  const element = findFormElement(target, scope);
  if (!element)
    return {
      key: target.key,
      status: "not_found",
      message: "The field is no longer visible."
    };
  const focusTarget = target.type === "radio" && element instanceof HTMLInputElement && checkboxChoiceGroupFor(element, scope) ? checkboxChoiceGroupFor(element, scope)?.container || element : target.type === "checkbox" && element instanceof HTMLInputElement ? checkboxPresentationElements(element, scope).find(
    (candidate) => candidate !== element && isVisible(candidate)
  ) || element : element;
  if (focusTarget === element) element.focus({ preventScroll: true });
  scrollAndHighlightQuestion(focusTarget);
  return { key: target.key, status: "focused", message: "Field focused." };
}
export function canFillField(instruction, scope = document) {
  return Boolean(
    scope && inspectVisibleFormFields(scope).some(
      (field) => instruction.target.id && field.id === instruction.target.id || instruction.target.name && field.name === instruction.target.name
    )
  );
}
export async function tryFillDefaultRadioForUnanswered(field, scope = document) {
  if (!scope || field.type !== "radio" || !field.required || field.filled)
    return false;
  const labelNorm = field.label.toLowerCase();
  let defaultAnswer = "";
  if (/eligible|authorized|work\s+rights|working\s+rights|right\s+to\s+work|permit|citizen|pr|residency|legally/i.test(
    labelNorm
  )) {
    if (!/sponsorship|require\s+visa|visa\s+sponsorship|on\s+a\s+work\s+visa/i.test(labelNorm)) {
      defaultAnswer = "Yes";
    }
  }
  if (/sponsorship|require\s+visa|visa\s+sponsorship/i.test(labelNorm)) {
    defaultAnswer = "No";
  }
  if (/on\s+a\s+work\s+visa|work\s+visa|current\s+visa|visa\s+holder/i.test(labelNorm)) {
    defaultAnswer = "No";
  }
  if (!defaultAnswer) return false;
  const instruction = {
    type: "content.fill-field",
    commandId: `default-radio-${Date.now()}`,
    source: "backend",
    target: {
      key: field.key,
      id: field.id,
      name: field.name,
      type: "radio",
      label: field.label
    },
    value: defaultAnswer
  };
  const res = await fillFormField(instruction, scope);
  return res.status === "filled" || res.status === "already_filled";
}
