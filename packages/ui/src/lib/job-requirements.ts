/** @format */

const REQUIREMENT_LANGUAGE =
  /\b(?:require(?:s|d)?|requirement|mandatory|essential|must|only|limited to|restricted to|will only be considered|eligible to apply|need(?:s)? to|has to|have to)\b/i;

const NEGATED_REQUIREMENT =
  /\bno\b.{0,80}\b(?:required|requirement|mandatory|essential|needed)\b|\bnot\b.{0,40}\b(?:required|requirement|mandatory|essential|needed)\b|\b(?:preferred|desirable|advantageous|encouraged)\b/i;

const CLEARANCE_PREFERENCE =
  /\b(?:preferred|desirable|advantageous|nice\s+to\s+have)\b/i;
const NEGATED_CLEARANCE =
  /\b(?:no|not)\b.{0,80}\b(?:security\s+)?clearance\b.{0,40}\b(?:required|mandatory|needed)\b/i;
const MANDATORY_REQUIREMENT_SECTION =
  /\b(?:mandatory|minimum|essential)\s+(?:requirements?|qualifications?|criteria)\b/i;

const CITIZEN = /\bcitizen(?:s|ship)?\b/i;
const PERMANENT_RESIDENT =
  /\bpermanent\s+residen(?:t|ts|cy)\b|\bPR\b/i;

type ClearanceRequirement = {
  pattern: RegExp;
  label: string;
  searchTerms: string[];
};

export type JobRequirement = {
  label: string;
  searchTerms: string[];
  priority?: 'required' | 'preferred';
};

const CLEARANCE_REQUIREMENTS: ClearanceRequirement[] = [
  {
    pattern: /\bbaseline(?:\s+or\s+higher)?(?:\s+security)?\s+clearance\b/i,
    label: 'Baseline Clearance Required',
    searchTerms: [
      'baseline clearance',
      'baseline security clearance',
      'baseline or higher security clearance',
    ],
  },
  {
    pattern:
      /\bNV\s*1(?:\s+security)?\s+clearance\b|\bnegative\s+vetting\s*(?:level\s*)?1\b/i,
    label: 'NV1 Clearance Required',
    searchTerms: ['NV1', 'NV 1', 'negative vetting 1'],
  },
  {
    pattern:
      /\bNV\s*2(?:\s+security)?\s+clearance\b|\bnegative\s+vetting\s*(?:level\s*)?2\b/i,
    label: 'NV2 Clearance Required',
    searchTerms: ['NV2', 'NV 2', 'negative vetting 2'],
  },
  {
    pattern:
      /\bpositive\s+vetting(?:\s+security)?\s+clearance\b|\bPV\s+clearance\b/i,
    label: 'Positive Vetting Clearance Required',
    searchTerms: ['positive vetting clearance', 'PV clearance'],
  },
  {
    pattern:
      /\btop\s+secret(?:\s*\/\s*SCI)?(?:\s+security)?\s+clearance\b|\bTS\s*\/\s*SCI\b/i,
    label: 'Top Secret Clearance Required',
    searchTerms: ['top secret clearance', 'TS/SCI'],
  },
  {
    pattern: /\bsecret(?:\s+security)?\s+clearance\b/i,
    label: 'Secret Clearance Required',
    searchTerms: ['secret clearance'],
  },
  {
    pattern: /\bsecurity\s+clearance\b/i,
    label: 'Security Clearance Required',
    searchTerms: ['security clearance'],
  },
];

function requirementClauses(description: string): string[] {
  return description
    .replace(/\r/g, '\n')
    .split(/(?:\n+|[.!?;]+)\s*/)
    .map((clause) => clause.trim())
    .filter(Boolean)
    .filter(
      (clause) =>
        REQUIREMENT_LANGUAGE.test(clause) && !NEGATED_REQUIREMENT.test(clause),
    );
}

function clearanceClauses(description: string): Array<{
  text: string;
  inMandatorySection: boolean;
}> {
  let inMandatorySection = false;

  return description
    .replace(/\r/g, '\n')
    .split('\n')
    .flatMap((line) => {
      const text = line.trim();
      if (!text) {
        inMandatorySection = false;
        return [];
      }

      if (MANDATORY_REQUIREMENT_SECTION.test(text)) {
        inMandatorySection = true;
        return [];
      }

      return text
        .split(/[.!?;]+\s*/)
        .map((clause) => clause.trim())
        .filter(Boolean)
        .map((clause) => ({ text: clause, inMandatorySection }));
    });
}

/**
 * Returns explicit eligibility restrictions and explicitly preferred clearances.
 * Incidental and negated mentions are deliberately ignored.
 */
export function extractJobRequirements(description?: string): JobRequirement[] {
  if (!description?.trim()) return [];

  const clauses = requirementClauses(description);
  const requirements: JobRequirement[] = [];

  if (clauses.some((clause) => CITIZEN.test(clause))) {
    requirements.push({
      label: 'Citizen Required',
      searchTerms: ['citizenship', 'citizen'],
    });
  }

  if (clauses.some((clause) => PERMANENT_RESIDENT.test(clause))) {
    requirements.push({
      label: 'PR Required',
      searchTerms: ['permanent resident', 'permanent residency', 'PR'],
    });
  }

  const clearanceRequirements = new Map<string, JobRequirement>();
  for (const { text: clause, inMandatorySection } of clearanceClauses(description)) {
    if (NEGATED_CLEARANCE.test(clause)) continue;

    const specificClearance = CLEARANCE_REQUIREMENTS.find((requirement) =>
      requirement.pattern.test(clause),
    );
    const isExplicitRequirement =
      REQUIREMENT_LANGUAGE.test(clause) || inMandatorySection;
    const isPreferred = CLEARANCE_PREFERENCE.test(clause);
    if (specificClearance && (isExplicitRequirement || isPreferred)) {
      const label = isPreferred ?
        specificClearance.label.replace(' Required', ' Preferred')
      : specificClearance.label;
      clearanceRequirements.set(label, {
        label,
        searchTerms: specificClearance.searchTerms,
        priority: isPreferred ? 'preferred' : 'required',
      });
    }
  }

  requirements.push(...Array.from(clearanceRequirements.values()));
  return requirements;
}
