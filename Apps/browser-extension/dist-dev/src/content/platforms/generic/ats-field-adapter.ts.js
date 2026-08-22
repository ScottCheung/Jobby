const ATS_PLATFORMS = /* @__PURE__ */ new Set([
  "workday",
  "greenhouse",
  "lever",
  "ashby",
  "smartrecruiters",
  "taleo"
]);
const IDENTIFIER_LABELS = [
  [/(?:^|[_-])first[_-]?name(?:$|[_-])/i, "First name"],
  [/(?:^|[_-])last[_-]?(?:name|surname)(?:$|[_-])/i, "Last name"],
  [/(?:^|[_-])e?mail(?:address)?(?:$|[_-])/i, "Email"],
  [/(?:^|[_-])(?:mobile|phone|telephone)(?:$|[_-])/i, "Phone"],
  [/(?:work[_-]?(?:authorization|rights)|right[_-]?to[_-]?work)/i, "Work authorization"],
  [/(?:visa[_-]?(?:sponsorship|status|type)|sponsorship)/i, "Visa sponsorship"],
  [/(?:notice[_-]?(?:period|time)|availability)/i, "Notice period"],
  [/(?:city|location|current[_-]?location)/i, "Current location"]
];
function isUsableLabel(label) {
  const normalized = label.replace(/\s+/g, " ").trim().toLowerCase();
  return Boolean(normalized) && !/^(?:unnamed field|question|field|select|choose|enter)$/i.test(normalized);
}
function labelFromIdentifier(field) {
  const identifier = `${field.name || ""} ${field.id || ""}`;
  for (const [pattern, label] of IDENTIFIER_LABELS) {
    if (pattern.test(identifier)) return label;
  }
  return void 0;
}
function dedupeOptions(field) {
  const seen = /* @__PURE__ */ new Set();
  return field.options.filter((option) => {
    const key = `${option.value}\0${option.label}`.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return Boolean(option.label.trim() || option.value.trim());
  });
}
export function adaptAtsFormFields(platform, fields) {
  if (!ATS_PLATFORMS.has(platform)) return fields;
  return fields.map((field) => {
    const inferredLabel = isUsableLabel(field.label) ? void 0 : labelFromIdentifier(field);
    const options = dedupeOptions(field);
    if (!inferredLabel && options.length === field.options.length) return field;
    return {
      ...field,
      ...inferredLabel ? { label: inferredLabel } : {},
      options
    };
  });
}
