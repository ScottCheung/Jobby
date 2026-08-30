/** @format */

import { INDUSTRY_CATALOGS } from './index';

export const INDUSTRY_DISPLAY_NAMES: Record<string, string> = {
  'information-technology': 'Tech & Engineering',
  'finance-banking': 'Finance & Banking',
  'sales-marketing': 'Sales & Marketing',
  'design-creative': 'Design & Creative',
  'healthcare-medical': 'Healthcare & Medical',
  'engineering-construction': 'Engineering & Construction',
  'human-resources': 'Workplace & Methods',
  'legal-compliance': 'Legal & Compliance',
  'supply-chain-logistics': 'Supply Chain & Logistics',
  'other': 'Other Skills',
};

// Lazy lookup map for skill label/terms -> industry
let skillToIndustryMap: Map<string, string> | null = null;

function getLookupMap(): Map<string, string> {
  if (skillToIndustryMap) return skillToIndustryMap;
  const map = new Map<string, string>();
  for (const [industry, entries] of Object.entries(INDUSTRY_CATALOGS)) {
    for (const entry of entries) {
      map.set(entry.label.toLowerCase(), industry);
      for (const term of entry.terms) {
        const lowerTerm = term.toLowerCase();
        if (!map.has(lowerTerm)) {
          map.set(lowerTerm, industry);
        }
      }
    }
  }
  skillToIndustryMap = map;
  return map;
}

export function getSkillIndustry(skill: string): string {
  const norm = (skill || '').trim().toLowerCase();
  if (!norm) return 'other';
  const map = getLookupMap();
  return map.get(norm) || 'other';
}

export interface SkillCategoryGroup {
  industry: string;
  displayName: string;
  skills: string[];
  isCore: boolean;
}

export interface ClassifiedSkills {
  coreGroups: SkillCategoryGroup[];
  bonusGroups: SkillCategoryGroup[];
  allCoreSkills: string[];
  allBonusSkills: string[];
}

/**
 * Classifies skills into Core (must-have/dominant requirements) and Bonus (domain context / nice-to-have).
 * Applies Scheme A threshold:
 * - Dominant industry is Core.
 * - In hybrid roles (e.g. 50/50 Quant Dev or 40/40/20 Product Design), any industry with >= 35% share is also Core.
 * - Workplace/HR soft skills and minor categories (< 35%) default to Bonus.
 */
export function classifySkills(
  technologies: readonly string[],
): ClassifiedSkills {
  if (!technologies || technologies.length === 0) {
    return {
      coreGroups: [],
      bonusGroups: [],
      allCoreSkills: [],
      allBonusSkills: [],
    };
  }

  const industrySkillMap = new Map<string, string[]>();
  for (const tech of technologies) {
    const industry = getSkillIndustry(tech);
    const list = industrySkillMap.get(industry) || [];
    list.push(tech);
    industrySkillMap.set(industry, list);
  }

  const total = technologies.length;
  const entries = Array.from(industrySkillMap.entries()).sort(
    ([, a], [, b]) => b.length - a.length,
  );

  const domainEntries = entries.filter(
    ([ind]) => ind !== 'human-resources' && ind !== 'other',
  );

  const coreIndustries = new Set<string>();

  if (domainEntries.length > 0) {
    // Top domain industry is always Core
    const [topIndustry] = domainEntries[0]!;
    coreIndustries.add(topIndustry);

    // Multi-Core check for hybrid roles (>= 35% share)
    for (let i = 1; i < domainEntries.length; i += 1) {
      const [ind, skills] = domainEntries[i]!;
      if (skills.length / total >= 0.35) {
        coreIndustries.add(ind);
      }
    }
  } else if (entries.length > 0) {
    // If only soft skills or other exist, the top category is Core
    const [topIndustry] = entries[0]!;
    coreIndustries.add(topIndustry);
  }

  const coreGroups: SkillCategoryGroup[] = [];
  const bonusGroups: SkillCategoryGroup[] = [];

  for (const [industry, skills] of entries) {
    const isCore = coreIndustries.has(industry);
    const group: SkillCategoryGroup = {
      industry,
      displayName: INDUSTRY_DISPLAY_NAMES[industry] || 'Other Skills',
      skills,
      isCore,
    };
    if (isCore) {
      coreGroups.push(group);
    } else {
      bonusGroups.push(group);
    }
  }

  return {
    coreGroups,
    bonusGroups,
    allCoreSkills: coreGroups.flatMap((g) => g.skills),
    allBonusSkills: bonusGroups.flatMap((g) => g.skills),
  };
}
