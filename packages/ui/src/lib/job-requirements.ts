/** @format */

export type JobRequirement = {
  label: string;
  searchTerms: string[];
  priority?: 'required' | 'preferred';
};

type ClearanceDefinition = {
  id: string;
  pattern: RegExp;
  label: string;
  searchTerms: string[];
};

const REQUIREMENT_LANGUAGE =
  /\b(?:require(?:s|d)?|requirement|mandatory|essential|must|only|limited to|restricted to|will only be considered|eligible to apply|need(?:s)? to|has to|have to|prerequisite|criteria|hold|holds|holding|possess|possessing|obtain|maintaining|maintain|cleared|active|current|valid|eligib(?:le|ility)(?:\s+(?:to\s+obtain|for))?|ability\s+to\s+obtain|willing(?:ness)?\s+to\s+obtain|clearance\s*[:=-])\b/i;

const REQUIREMENT_SECTION_HEADER =
  /\b(?:mandatory|minimum|essential|required|key|selection|role|job|position|candidate|applicant|prerequisite|core)\s+(?:requirements?|qualifications?|criteria|skills?|experience|capabilities|eligibility|prerequisites?)\b|\b(?:requirements?|qualifications?|eligibility|prerequisites?|selection\s+criteria|essential\s+criteria|key\s+criteria|what\s+you(?:'ll|\s+will)?\s+(?:need|bring)|what\s+we(?:'re|\s+are)?\s+looking\s+for|about\s+you|who\s+you\s+are|must\s+haves?|must-haves?|skills?\s*(?:&|and)\s*experience|role\s+overview|job\s+details)\s*[:：]?$|\b(?:security\s+clearance|clearance\s+level|clearance|work\s+rights|citizenship\s*(?:&|and)\s*clearance)\s*[:：]?$/i;

const PREFERRED_SECTION_HEADER =
  /\b(?:preferred|desirable|advantageous|nice\s+to\s+have|bonus|optional|good\s+to\s+have)\s*(?:requirements?|qualifications?|criteria|skills?|experience|capabilities)?\s*[:：]?$|\b(?:desirable\s+criteria|preferred\s+qualifications?|nice\s+to\s+have|bonus\s+points?)\s*[:：]?$/i;

const OTHER_SECTION_HEADER =
  /\b(?:benefits?|perks?|about\s+(?:us|the\s+company|our\s+team)|company\s+overview|how\s+to\s+apply|salary|remuneration|equal\s+opportunity)\s*[:：]?$/i;

const NEGATED_REQUIREMENT =
  /\bno\b.{0,80}\b(?:required|requirement|mandatory|essential|needed)\b|\bnot\b.{0,40}\b(?:required|requirement|mandatory|essential|needed)\b|\b(?:preferred\s+but\s+not\s+required|encouraged\s+to\s+apply)\b/i;

const CLEARANCE_PREFERENCE =
  /\b(?:preferred|desirable|advantageous|nice\s+to\s+have|bonus|ideal|plus|highly\s+regarded|beneficial|optional|not\s+essential|favourably\s+considered)\b/i;

const NEGATED_CLEARANCE =
  /\b(?:no|not|without|don't\s+need|do\s+not\s+need)\b.{0,80}\b(?:security\s+)?clearance\b|\b(?:security\s+)?clearance\b.{0,40}\b(?:is\s+)?(?:not\s+required|not\s+mandatory|not\s+needed|not\s+essential)\b|\b(?:no|not|without|does\s+not\s+require|doesn't\s+require)\b.{0,40}\b(?:baseline|nv\s*[-_.]?\s*[12]|pv|tspv|top\s+secret|secret)\b/i;

const CITIZEN = /\b(?:Australian\s+)?citizen(?:s|ship)?\b/i;
const PERMANENT_RESIDENT =
  /\bpermanent\s+residen(?:t|ts|cy)\b|\bPR\b/i;

const SPECIFIC_CLEARANCE_DEFINITIONS: ClearanceDefinition[] = [
  {
    id: 'baseline',
    pattern:
      /\b(?:AGSVA\s+)?baseline(?:\s+or\s+higher)?(?:\s+level)?(?:\s+security)?\s+clearance\b|\bAGSVA\s+baseline\b|\bbaseline\s+(?:vetted|cleared)\b|\b(?:clearance|clearance\s+level|security\s+clearance)\s*[:=-]?\s*baseline\b|\bbaseline\s*(?:\/|or|,|\+)\s*(?:nv\s*[-_.]?\s*[12]|pv|ts|tspv|negative\s+vetting)\b|\b(?:nv\s*[-_.]?\s*[12]|pv|ts|tspv|negative\s+vetting)\s*(?:\/|or|,|\+)\s*baseline\b|\b(?:hold|holds|holding|possess|possessing|obtain|maintaining|maintain|active|current|valid|eligible\s+(?:for|to\s+obtain)|ability\s+to\s+obtain|willing\s+to\s+obtain|undergo)\s+(?:a\s+|an\s+)?(?:minimum\s+of\s+)?(?:AGSVA\s+)?baseline\b|\bbaseline\s+or\s+higher\b/i,
    label: 'Baseline Clearance Required',
    searchTerms: [
      'baseline or higher security clearance',
      'baseline security clearance',
      'baseline or higher clearance',
      'baseline or higher',
      'baseline clearance',
      'agsva baseline',
      'baseline vetted',
      'baseline cleared',
      'baseline',
    ],
  },
  {
    id: 'nv1',
    pattern:
      /\bNV\s*[-_.]?\s*1(?:\s+or\s+higher)?(?:\s+level)?(?:\s+security)?(?:\s+clearance)?\b|\bnegative\s+vetting\s*(?:[-_.]|level\s*)?1\b|\bAGSVA\s+NV\s*[-_.]?\s*1\b/i,
    label: 'NV1 Clearance Required',
    searchTerms: [
      'negative vetting level 1 (nv1)',
      'negative vetting level 1',
      'negative vetting level-1',
      'negative vetting (level 1)',
      'negative vetting (nv1)',
      'negative vetting 1 (nv1)',
      'negative vetting 1',
      'negative vetting-1',
      'nv1 security clearance',
      'nv1 clearance',
      'nv-1 clearance',
      'nv 1 clearance',
      'agsva nv1',
      'nv1 or higher',
      'nv1 cleared',
      'nv1 vetted',
      'nv1',
      'nv-1',
      'nv 1',
    ],
  },
  {
    id: 'nv2',
    pattern:
      /\bNV\s*[-_.]?\s*2(?:\s+or\s+higher)?(?:\s+level)?(?:\s+security)?(?:\s+clearance)?\b|\bnegative\s+vetting\s*(?:[-_.]|level\s*)?2\b|\bAGSVA\s+NV\s*[-_.]?\s*2\b/i,
    label: 'NV2 Clearance Required',
    searchTerms: [
      'negative vetting level 2 (nv2)',
      'negative vetting level 2',
      'negative vetting level-2',
      'negative vetting (level 2)',
      'negative vetting (nv2)',
      'negative vetting 2 (nv2)',
      'negative vetting 2',
      'negative vetting-2',
      'nv2 security clearance',
      'nv2 clearance',
      'nv-2 clearance',
      'nv 2 clearance',
      'agsva nv2',
      'nv2 or higher',
      'nv2 cleared',
      'nv2 vetted',
      'nv2',
      'nv-2',
      'nv 2',
    ],
  },
  {
    id: 'pv',
    pattern:
      /\b(?:top\s+secret\s+)?positive\s+vetting(?:\s+level)?(?:\s+security)?(?:\s+clearance)?\b|\bTS\s*[-_/]?\s*PV\b|\bPV\s+(?:clearance|cleared|security|vetted)\b|\b(?:clearance|clearance\s+level|security\s+clearance)\s*[:=-]?\s*PV\b|\b(?:hold|holds|possess|obtain|maintain|active|current|eligible)\s+(?:a\s+|an\s+)?PV\b|\b(?:NV\s*[-_.]?\s*[12]|baseline)\s*(?:\/|or|,|\+)\s*PV\b|\bPV\s*(?:\/|or|,|\+)\s*(?:NV\s*[-_.]?\s*[12]|baseline)\b/i,
    label: 'Positive Vetting Clearance Required',
    searchTerms: [
      'top secret positive vetting (tspv)',
      'top secret positive vetting',
      'positive vetting security clearance',
      'positive vetting clearance',
      'positive vetting (pv)',
      'positive vetting',
      'tspv clearance',
      'tspv',
      'ts-pv',
      'ts/pv',
      'ts pv',
      'pv clearance',
      'pv security clearance',
      'pv',
    ],
  },
  {
    id: 'top_secret',
    pattern:
      /\btop\s+secret(?:\s*[-_/]\s*SCI)?(?:\s+level)?(?:\s+security)?(?:\s+clearance)?\b|\bTS\s*[-_/]\s*SCI\b|\bTS\s+clearance\b/i,
    label: 'Top Secret Clearance Required',
    searchTerms: [
      'top secret / sci clearance',
      'top secret / sci',
      'top secret/sci',
      'top secret security clearance',
      'top secret clearance',
      'top secret',
      'ts/sci clearance',
      'ts/sci',
      'ts-sci',
      'ts clearance',
    ],
  },
  {
    id: 'secret',
    pattern:
      /\bsecret(?:\s+level)?(?:\s+security)?\s+clearance\b|\bconfidential\s+clearance\b/i,
    label: 'Secret Clearance Required',
    searchTerms: [
      'secret security clearance',
      'secret clearance',
      'secret',
      'confidential clearance',
    ],
  },
  {
    id: 'public_trust',
    pattern:
      /\bpublic\s+trust(?:\s+security)?\s+(?:clearance|position)\b/i,
    label: 'Public Trust Clearance Required',
    searchTerms: [
      'public trust clearance',
      'public trust position',
      'public trust',
    ],
  },
];

const GENERIC_CLEARANCE_DEFINITION: ClearanceDefinition = {
  id: 'generic_clearance',
  pattern:
    /\b(?:national\s+security|commonwealth|defence|government|AGSVA)\s+(?:security\s+)?clearance\b|\bsecurity\s+clearance\b|\bsecurity\s+cleared\b|\bclearance\s*[:=-]\s*(?:required|mandatory|essential)\b/i,
  label: 'Security Clearance Required',
  searchTerms: [
    'national security clearance',
    'commonwealth security clearance',
    'government security clearance',
    'defence security clearance',
    'defence clearance',
    'agsva security clearance',
    'agsva clearance',
    'security clearance',
    'security cleared',
    'clearance required',
    'clearance',
  ],
};

type ParsedClause = {
  text: string;
  section: 'required' | 'preferred' | 'other' | 'none';
};

function isBulletLine(line: string): boolean {
  return /^[•\-*–—\d+.)]/.test(line);
}

function parseLineToClauses(
  cleanLine: string,
  section: 'required' | 'preferred' | 'other' | 'none',
): ParsedClause[] {
  const clauses: ParsedClause[] = [];

  const sentences = cleanLine
    .split(/(?:[.!?;]+|\s+[•\-*–—]\s+)(?:\s+|$)/)
    .map((s) => s.trim())
    .filter(Boolean);

  for (const sentence of sentences) {
    const parenMatch = sentence.match(/^(.*?)\((.*?)\)(.*)$/);
    if (parenMatch) {
      const [, before, inside, after] = parenMatch;
      const beforeText = `${before} ${after}`.trim();
      const insideText = inside.trim();

      const insideHasClearance = SPECIFIC_CLEARANCE_DEFINITIONS.some((def) =>
        def.pattern.test(insideText),
      );

      if (insideHasClearance) {
        if (beforeText) {
          clauses.push({ text: beforeText, section });
        }
        clauses.push({ text: insideText, section });
      } else {
        clauses.push({ text: sentence, section });
      }
    } else {
      clauses.push({ text: sentence, section });
    }
  }

  return clauses;
}

function parseClauses(description: string): ParsedClause[] {
  let section: 'required' | 'preferred' | 'other' | 'none' = 'none';
  const lines = description.replace(/\r/g, '\n').split('\n');
  const clauses: ParsedClause[] = [];

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) {
      continue;
    }

    const isBullet = isBulletLine(line);

    if (!isBullet && line.length <= 80) {
      if (PREFERRED_SECTION_HEADER.test(line)) {
        section = 'preferred';
        continue;
      }
      if (REQUIREMENT_SECTION_HEADER.test(line)) {
        section = 'required';
        continue;
      }
      if (OTHER_SECTION_HEADER.test(line)) {
        section = 'other';
        continue;
      }
    }

    const cleanLine = line.replace(/^[•\-*–—\d+.)\s]+/, '').trim();
    if (!cleanLine) continue;

    clauses.push(...parseLineToClauses(cleanLine, section));
  }

  return clauses;
}

/**
 * Returns explicit eligibility restrictions and explicitly preferred clearances.
 * Incidental and negated mentions are deliberately ignored.
 */
export function extractJobRequirements(description?: string): JobRequirement[] {
  if (!description?.trim()) return [];

  const clauses = parseClauses(description);
  const requirements: JobRequirement[] = [];

  const citizenClauses = clauses.filter(
    (c) =>
      c.section !== 'other' &&
      CITIZEN.test(c.text) &&
      !NEGATED_REQUIREMENT.test(c.text),
  );
  if (
    citizenClauses.some(
      (c) => c.section === 'required' || REQUIREMENT_LANGUAGE.test(c.text),
    )
  ) {
    requirements.push({
      label: 'Citizen Required',
      searchTerms: [
        'australian citizenship',
        'australian citizen',
        'citizenship',
        'citizen',
      ],
    });
  }

  const prClauses = clauses.filter(
    (c) =>
      c.section !== 'other' &&
      PERMANENT_RESIDENT.test(c.text) &&
      !NEGATED_REQUIREMENT.test(c.text),
  );
  if (
    prClauses.some(
      (c) => c.section === 'required' || REQUIREMENT_LANGUAGE.test(c.text),
    )
  ) {
    requirements.push({
      label: 'PR Required',
      searchTerms: [
        'permanent resident',
        'permanent residency',
        'permanent residents',
        'PR',
      ],
    });
  }

  const clearanceMap = new Map<string, JobRequirement>();

  for (const clause of clauses) {
    if (clause.section === 'other') continue;
    if (NEGATED_CLEARANCE.test(clause.text)) continue;

    let matchedSpecific = false;
    const matchedIds = new Set<string>();

    for (const def of SPECIFIC_CLEARANCE_DEFINITIONS) {
      if (!def.pattern.test(clause.text)) continue;

      // If Positive Vetting / TSPV matched, ignore Top Secret for the same TSPV phrase
      if (
        def.id === 'top_secret' &&
        matchedIds.has('pv') &&
        !/\btop\s+secret(?!\s*(?:positive\s+vetting|\/\s*PV|\bPV\b))\b/i.test(clause.text)
      ) {
        continue;
      }

      matchedSpecific = true;
      matchedIds.add(def.id);

      const isPreferred =
        clause.section === 'preferred' ||
        CLEARANCE_PREFERENCE.test(clause.text);

      const label = isPreferred ?
        def.label.replace(' Required', ' Preferred')
      : def.label;

      const existing = clearanceMap.get(label);
      if (!existing || (existing.priority === 'preferred' && !isPreferred)) {
        clearanceMap.set(label, {
          label,
          searchTerms: def.searchTerms,
          priority: isPreferred ? 'preferred' : 'required',
        });
      }
    }

    if (!matchedSpecific) {
      if (GENERIC_CLEARANCE_DEFINITION.pattern.test(clause.text)) {
        const isPreferred =
          clause.section === 'preferred' ||
          CLEARANCE_PREFERENCE.test(clause.text);
        const isExplicit =
          clause.section === 'required' ||
          REQUIREMENT_LANGUAGE.test(clause.text);

        if (isExplicit || isPreferred) {
          const label = isPreferred ?
            GENERIC_CLEARANCE_DEFINITION.label.replace(' Required', ' Preferred')
          : GENERIC_CLEARANCE_DEFINITION.label;

          const existing = clearanceMap.get(label);
          if (!existing || (existing.priority === 'preferred' && !isPreferred)) {
            clearanceMap.set(label, {
              label,
              searchTerms: GENERIC_CLEARANCE_DEFINITION.searchTerms,
              priority: isPreferred ? 'preferred' : 'required',
            });
          }
        }
      }
    }
  }

  requirements.push(...Array.from(clearanceMap.values()));
  return requirements;
}

