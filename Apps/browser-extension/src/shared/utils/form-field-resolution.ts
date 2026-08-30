import type { FormFieldObservation } from '../contracts/form-inspection';

type DocumentPurpose = 'resume' | 'cover_letter' | 'other';

function normalized(value: string | undefined): string {
  return (value || '').replace(/\s+/g, ' ').trim().toLowerCase();
}

function identityText(field: FormFieldObservation): string {
  return [field.key, field.id, field.name]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

function stableMetadataText(field: FormFieldObservation): string {
  return [field.id, field.name]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

function documentPurpose(field: FormFieldObservation): DocumentPurpose {
  if (field.type !== 'file') return 'other';
  const metadata = identityText(field);
  const label = normalized(field.label);
  const allText = `${metadata} ${label}`;
  if (/cover[\s_-]*(?:letter|note)|motivation[\s_-]*letter|求职信|自荐信|附言/.test(allText)) {
    return 'cover_letter';
  }
  if (/resume|curriculum[\s_-]*vitae|(?:^|[^a-z])cv(?:[^a-z]|$)|简历|履历/.test(allText)) {
    return 'resume';
  }
  return 'other';
}

function samePhysicalField(
  left: FormFieldObservation,
  right: FormFieldObservation,
): boolean {
  const distinctWorkdayEntries = Boolean(
    left.id &&
    right.id &&
    left.id !== right.id &&
    /^(?:workExperience|education|certification|language)-.+--/i.test(left.id) &&
    /^(?:workExperience|education|certification|language)-.+--/i.test(right.id),
  );
  return (
    left.key === right.key ||
    Boolean(left.id && right.id && left.id === right.id) ||
    Boolean(
      !distinctWorkdayEntries &&
      left.name &&
      right.name &&
      left.name === right.name &&
      left.type === right.type,
    )
  );
}

function documentConfidence(field: FormFieldObservation, purpose: DocumentPurpose): number {
  const metadata = stableMetadataText(field);
  const key = normalized(field.key);
  const label = normalized(field.label);
  const purposePattern = purpose === 'resume'
    ? /resume|curriculum[\s_-]*vitae|(?:^|[^a-z])cv(?:[^a-z]|$)|简历|履历/
    : /cover[\s_-]*(?:letter|note)|motivation[\s_-]*letter|求职信|自荐信|附言/;
  return (
    (purposePattern.test(metadata) ? 100 : 0) +
    // The inspection key is useful when a page exposes no id/name, but it is
    // normally derived from a label and should not outrank stable DOM metadata.
    (purposePattern.test(key) ? 10 : 0) +
    (purposePattern.test(label) ? 30 : 0) +
    (field.required ? 4 : 0) +
    (field.filled ? 2 : 0)
  );
}

/**
 * Resolve a raw DOM field list into the candidate-facing form model.
 *
 * Modern application pages routinely mount duplicate upload controls during
 * hydration or expose an upload shortcut alongside the actual field. Their
 * DOM ids may differ, so physical-id dedupe alone is insufficient. For the
 * two document purposes where one candidate answer is meaningful, retain the
 * highest-confidence control based on stable identifiers and human labels.
 */
export function canonicalizeFormFields(
  fields: FormFieldObservation[],
): FormFieldObservation[] {
  const physicallyUnique = fields.filter(
    (field, index, allFields) =>
      allFields.findIndex((candidate) => samePhysicalField(candidate, field)) === index,
  );

  const keep = new Set<FormFieldObservation>();
  const documentPurposes: DocumentPurpose[] = ['resume', 'cover_letter'];
  for (const purpose of documentPurposes) {
    const candidates = physicallyUnique.filter(
      (field) => documentPurpose(field) === purpose,
    );
    if (candidates.length === 0) continue;
    const winner = candidates.reduce((best, candidate) =>
      documentConfidence(candidate, purpose) > documentConfidence(best, purpose)
        ? candidate
        : best,
    );
    keep.add(winner);
  }

  return physicallyUnique.filter((field) => {
    const purpose = documentPurpose(field);
    return purpose === 'other' || keep.has(field);
  });
}
