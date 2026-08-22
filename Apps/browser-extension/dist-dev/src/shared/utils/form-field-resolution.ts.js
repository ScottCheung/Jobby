function normalized(value) {
  return (value || "").replace(/\s+/g, " ").trim().toLowerCase();
}
function identityText(field) {
  return [field.key, field.id, field.name].filter(Boolean).join(" ").toLowerCase();
}
function stableMetadataText(field) {
  return [field.id, field.name].filter(Boolean).join(" ").toLowerCase();
}
function documentPurpose(field) {
  if (field.type !== "file") return "other";
  const metadata = identityText(field);
  const label = normalized(field.label);
  const allText = `${metadata} ${label}`;
  if (/cover[\s_-]*(?:letter|note)|motivation[\s_-]*letter|求职信|自荐信|附言/.test(allText)) {
    return "cover_letter";
  }
  if (/resume|curriculum[\s_-]*vitae|(?:^|[^a-z])cv(?:[^a-z]|$)|简历|履历/.test(allText)) {
    return "resume";
  }
  return "other";
}
function samePhysicalField(left, right) {
  return left.key === right.key || Boolean(left.id && right.id && left.id === right.id) || Boolean(left.name && right.name && left.name === right.name && left.type === right.type);
}
function documentConfidence(field, purpose) {
  const metadata = stableMetadataText(field);
  const key = normalized(field.key);
  const label = normalized(field.label);
  const purposePattern = purpose === "resume" ? /resume|curriculum[\s_-]*vitae|(?:^|[^a-z])cv(?:[^a-z]|$)|简历|履历/ : /cover[\s_-]*(?:letter|note)|motivation[\s_-]*letter|求职信|自荐信|附言/;
  return (purposePattern.test(metadata) ? 100 : 0) + // The inspection key is useful when a page exposes no id/name, but it is
  // normally derived from a label and should not outrank stable DOM metadata.
  (purposePattern.test(key) ? 10 : 0) + (purposePattern.test(label) ? 30 : 0) + (field.required ? 4 : 0) + (field.filled ? 2 : 0);
}
export function canonicalizeFormFields(fields) {
  const physicallyUnique = fields.filter(
    (field, index, allFields) => allFields.findIndex((candidate) => samePhysicalField(candidate, field)) === index
  );
  const keep = /* @__PURE__ */ new Set();
  const documentPurposes = ["resume", "cover_letter"];
  for (const purpose of documentPurposes) {
    const candidates = physicallyUnique.filter(
      (field) => documentPurpose(field) === purpose
    );
    if (candidates.length === 0) continue;
    const winner = candidates.reduce(
      (best, candidate) => documentConfidence(candidate, purpose) > documentConfidence(best, purpose) ? candidate : best
    );
    keep.add(winner);
  }
  return physicallyUnique.filter((field) => {
    const purpose = documentPurpose(field);
    return purpose === "other" || keep.has(field);
  });
}
