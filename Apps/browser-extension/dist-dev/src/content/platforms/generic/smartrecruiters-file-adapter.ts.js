const RESUME_CONTAINER_SELECTOR = [
  "oc-resume-upload",
  "[data-test='resume-upload-container']",
  "spl-dropzone[data-test='resume-upload']"
].join(", ");
const EASY_APPLY_SELECTOR = [
  "oc-apply-with-resume",
  "spl-dropzone[data-test='apply-with-resume-container']"
].join(", ");
function cleanText(value) {
  return (value || "").replace(/\s+/g, " ").trim();
}
function composedParent(element) {
  if (element.parentElement) return element.parentElement;
  const root = element.getRootNode();
  return root instanceof ShadowRoot && root.host instanceof HTMLElement ? root.host : null;
}
function closestComposed(element, selector) {
  let current = element;
  for (let depth = 0; current && depth < 32; depth += 1) {
    if (current.matches(selector)) return current;
    current = composedParent(current);
  }
  return null;
}
function queryAllDeep(root, selector) {
  const result = [];
  const visited = /* @__PURE__ */ new Set();
  const visit = (current) => {
    if (visited.has(current)) return;
    visited.add(current);
    const descendants = Array.from(current.querySelectorAll("*"));
    descendants.forEach((element) => {
      if (element.matches(selector)) result.push(element);
      if (element.shadowRoot) visit(element.shadowRoot);
    });
  };
  visit(root);
  return result;
}
function isPresented(element) {
  if (element.hidden || element.getAttribute("aria-hidden") === "true") {
    return false;
  }
  const style = window.getComputedStyle(element);
  if (style.display === "none" || style.visibility === "hidden" || style.visibility === "collapse") {
    return false;
  }
  const rect = element.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0 || element.offsetWidth > 0 || element.offsetHeight > 0;
}
function fieldIdentity(field) {
  return [
    field.key,
    field.label,
    field.id,
    field.name,
    ...field.semanticFeatures || []
  ].filter(Boolean).join(" ").toLowerCase();
}
function isEasyApplyParserField(field) {
  if (field.type !== "file") return false;
  const identity = fieldIdentity(field);
  return /apply[\s_-]*with[\s_-]*resume|autofill.*resume|resume.*autofill/i.test(
    identity
  );
}
function isResumeField(field) {
  if (field.type !== "file" || isEasyApplyParserField(field)) return false;
  const identity = fieldIdentity(field);
  return /resume|curriculum\s*vitae|(?:^|[^a-z])cv(?:[^a-z]|$)/i.test(
    identity
  );
}
function findResumeInput(root) {
  const containers = queryAllDeep(root, RESUME_CONTAINER_SELECTOR);
  for (const container of containers) {
    if (!isPresented(container) || closestComposed(container, EASY_APPLY_SELECTOR)) {
      continue;
    }
    const input = queryAllDeep(container, "input[type='file']").find((candidate) => !candidate.disabled && !closestComposed(candidate, EASY_APPLY_SELECTOR));
    if (input) return input;
  }
  return null;
}
function resumeObservation(input) {
  const container = closestComposed(
    input,
    "[data-test='resume-upload-container'], oc-resume-upload"
  ) || closestComposed(input, RESUME_CONTAINER_SELECTOR);
  const selectedFile = input.files?.[0];
  const required = Boolean(
    input.required || container?.getAttribute("aria-required") === "true" || container && queryAllDeep(
      container,
      "[data-test='section-required-mark'], [data-testid*='required-mark' i]"
    ).length > 0 || /resume\s*\*/i.test(cleanText(container?.textContent))
  );
  return {
    key: "file-resume-upload",
    id: cleanText(input.id) || void 0,
    name: cleanText(input.name) || void 0,
    type: "file",
    label: "Resume",
    required,
    filled: Boolean(selectedFile?.size),
    sensitive: true,
    options: [],
    semanticFeatures: [
      "platform:smartrecruiters",
      "purpose:resume",
      "component:oc-resume-upload"
    ],
    upload: selectedFile?.size ? { state: "ready", filename: selectedFile.name } : { state: "empty" },
    ...selectedFile ? { currentValue: selectedFile.name } : {}
  };
}
export function ensureSmartRecruitersResumeField(platform, fields, root = document) {
  if (platform !== "smartrecruiters") {
    return fields;
  }
  const applicationFields = fields.filter(
    (field) => !isEasyApplyParserField(field)
  );
  if (applicationFields.some(isResumeField)) return applicationFields;
  const input = findResumeInput(root);
  return input ? [...applicationFields, resumeObservation(input)] : applicationFields;
}
