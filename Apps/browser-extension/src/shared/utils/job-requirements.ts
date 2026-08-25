/** @format */

const REQUIREMENT_LANGUAGE =
  /\b(?:require(?:s|d)?|requirement|mandatory|essential|must|only|limited to|restricted to|will only be considered|eligible to apply|need(?:s)? to|has to|have to)\b/i;

const NEGATED_REQUIREMENT =
  /\bno\b.{0,80}\b(?:required|requirement|mandatory|essential|needed)\b|\bnot\b.{0,40}\b(?:required|requirement|mandatory|essential|needed)\b|\b(?:preferred|desirable|advantageous|encouraged)\b/i;

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
};

const CLEARANCE_REQUIREMENTS: ClearanceRequirement[] = [
  {
    pattern: /\bbaseline(?:\s+security)?\s+clearance\b/i,
    label: 'Baseline Clearance Required',
    searchTerms: ['baseline clearance', 'baseline security clearance'],
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

/**
 * Returns only explicit eligibility restrictions stated in the job description.
 * Incidental, preferred, and negated mentions are deliberately ignored.
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
  for (const clause of clauses) {
    const specificClearance = CLEARANCE_REQUIREMENTS.find((requirement) =>
      requirement.pattern.test(clause),
    );
    if (specificClearance) {
      clearanceRequirements.set(specificClearance.label, {
        label: specificClearance.label,
        searchTerms: specificClearance.searchTerms,
      });
    }
  }

  requirements.push(...Array.from(clearanceRequirements.values()));
  return requirements;
}
