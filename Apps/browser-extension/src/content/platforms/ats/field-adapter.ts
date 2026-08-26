import type {
  FormFieldObservation,
  FormPlatform,
} from '../../../shared/contracts/form-inspection';
import { sharedFormPlatforms } from '../../../shared/contracts/platform';

const ATS_PLATFORMS = new Set<FormPlatform>(sharedFormPlatforms);

const IDENTIFIER_LABELS: ReadonlyArray<[RegExp, string]> = [
  [/(?:^|[_-])first[_-]?name(?:$|[_-])/i, 'First name'],
  [/(?:^|[_-])last[_-]?(?:name|surname)(?:$|[_-])/i, 'Last name'],
  [/(?:^|[_-])e?mail(?:address)?(?:$|[_-])/i, 'Email'],
  [/(?:^|[_-])(?:mobile|phone|telephone)(?:$|[_-])/i, 'Phone'],
  [/(?:work[_-]?(?:authorization|rights)|right[_-]?to[_-]?work)/i, 'Work authorization'],
  [/(?:visa[_-]?(?:sponsorship|status|type)|sponsorship)/i, 'Visa sponsorship'],
  [/(?:notice[_-]?(?:period|time)|availability)/i, 'Notice period'],
  [/(?:city|location|current[_-]?location)/i, 'Current location'],
];

function isUsableLabel(label: string): boolean {
  const normalized = label.replace(/\s+/g, ' ').trim().toLowerCase();
  return Boolean(normalized) && !/^(?:unnamed field|question|field|select|choose|enter)$/i.test(normalized);
}

function labelFromIdentifier(field: FormFieldObservation): string | undefined {
  const identifier = `${field.name || ''} ${field.id || ''}`;
  for (const [pattern, label] of IDENTIFIER_LABELS) {
    if (pattern.test(identifier)) return label;
  }
  return undefined;
}

function dedupeOptions(field: FormFieldObservation): FormFieldObservation['options'] {
  const seen = new Set<string>();
  return field.options.filter((option) => {
    const key = `${option.value}\u0000${option.label}`.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return Boolean(option.label.trim() || option.value.trim());
  });
}

/**
 * Restore reliable labels for common ATS controls after generic DOM
 * inspection. It never replaces an actual question, so a site-specific DOM
 * change degrades to the generic path rather than silently changing intent.
 */
export function adaptAtsFormFields(
  platform: FormPlatform,
  fields: FormFieldObservation[],
): FormFieldObservation[] {
  if (!ATS_PLATFORMS.has(platform)) return fields;
  return fields.map((field) => {
    const inferredLabel = isUsableLabel(field.label) ? undefined : labelFromIdentifier(field);
    const options = dedupeOptions(field);
    if (!inferredLabel && options.length === field.options.length) return field;
    return {
      ...field,
      ...(inferredLabel ? { label: inferredLabel } : {}),
      options,
    };
  });
}
