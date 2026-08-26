/** @format */

import type { SkillCatalogEntry, SkillMatch, SkillRule } from './types';

import itSkills from './industries/information-technology.json';
import financeSkills from './industries/finance-banking.json';
import salesSkills from './industries/sales-marketing.json';
import designSkills from './industries/design-creative.json';
import legalSkills from './industries/legal-compliance.json';
import healthcareSkills from './industries/healthcare-medical.json';
import engineeringSkills from './industries/engineering-construction.json';
import hrSkills from './industries/human-resources.json';
import supplyChainSkills from './industries/supply-chain-logistics.json';

export const INDUSTRY_CATALOGS: Record<string, SkillCatalogEntry[]> = {
  'information-technology': itSkills as SkillCatalogEntry[],
  'finance-banking': financeSkills as SkillCatalogEntry[],
  'sales-marketing': salesSkills as SkillCatalogEntry[],
  'design-creative': designSkills as SkillCatalogEntry[],
  'legal-compliance': legalSkills as SkillCatalogEntry[],
  'healthcare-medical': healthcareSkills as SkillCatalogEntry[],
  'engineering-construction': engineeringSkills as SkillCatalogEntry[],
  'human-resources': hrSkills as SkillCatalogEntry[],
  'supply-chain-logistics': supplyChainSkills as SkillCatalogEntry[],
};

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function termPattern(term: string): RegExp {
  const escaped = escapeRegExp(term).replace(/\s+/g, '\\s+');
  return new RegExp(`(?:^|[^A-Za-z0-9])(${escaped})(?=$|[^A-Za-z0-9])`, 'gi');
}

const SKILL_RULES: readonly SkillRule[] = Object.entries(
  INDUSTRY_CATALOGS,
).flatMap(([industry, entries]) =>
  entries.map((entry) => ({
    label: entry.label,
    industry,
    patterns: entry.terms.map(termPattern),
  })),
);

function cleanText(value: string | null | undefined): string {
  return (value || '').replace(/\s+/g, ' ').trim();
}

export function getSkillSearchTerms(skill: string): string[] {
  const value = cleanText(skill);
  if (!value) return [];

  const normalized = value.toLowerCase();
  const entries = Object.values(INDUSTRY_CATALOGS).flat();
  const entry =
    entries.find((candidate) => candidate.label.toLowerCase() === normalized) ||
    entries.find((candidate) =>
      candidate.terms.some((term) => term.toLowerCase() === normalized),
    );
  if (!entry) return [value];

  return Array.from(
    new Map(
      [value, entry.label, ...entry.terms].map((term) => [
        term.toLowerCase(),
        term,
      ]),
    ).values(),
  );
}

export function extractTechnologyKeywords(
  value: string | null | undefined,
): string[] {
  const text = cleanText(value);
  if (!text) return [];

  const allMatches: SkillMatch[] = [];
  for (let order = 0; order < SKILL_RULES.length; order += 1) {
    const rule = SKILL_RULES[order];
    if (!rule) continue;
    for (const pattern of rule.patterns) {
      pattern.lastIndex = 0;
      let match: RegExpExecArray | null;
      while ((match = pattern.exec(text)) !== null) {
        const matchedTerm = match[1];
        if (!matchedTerm) break;
        const index = match.index + match[0].indexOf(matchedTerm);
        const end = index + matchedTerm.length;
        allMatches.push({
          label: rule.label,
          industry: rule.industry,
          index,
          end,
          order,
        });
        if (pattern.lastIndex === match.index) {
          pattern.lastIndex += 1;
        }
      }
    }
  }

  const filtered = allMatches.filter(
    (item) =>
      !allMatches.some(
        (other) =>
          other.label !== item.label &&
          other.index <= item.index &&
          other.end >= item.end &&
          other.end - other.index > item.end - item.index,
      ),
  );

  const labelEarliest = new Map<string, { index: number; order: number }>();
  for (const match of filtered) {
    const existing = labelEarliest.get(match.label);
    if (!existing || match.index < existing.index) {
      labelEarliest.set(match.label, {
        index: match.index,
        order: match.order,
      });
    }
  }

  return Array.from(labelEarliest.entries())
    .sort(([, a], [, b]) => a.index - b.index || a.order - b.order)
    .map(([label]) => label)
    .slice(0, 50);
}

export function normalizeOrPreserveSkill(
  raw: string | null | undefined,
): string {
  const cleaned = cleanText(raw);
  if (!cleaned) return '';
  const matched = extractTechnologyKeywords(cleaned);
  if (matched.length > 0) {
    const exact = matched.find(
      (m) => m.toLowerCase() === cleaned.toLowerCase(),
    );
    return exact || matched[0] || cleaned;
  }
  return cleaned;
}

export function mergeSkills(
  explicitSkills: readonly (string | null | undefined)[],
  textKeywords: readonly string[],
): string[] {
  const result: string[] = [];
  const seen = new Set<string>();

  for (const raw of explicitSkills) {
    const norm = normalizeOrPreserveSkill(raw);
    const key = norm.toLowerCase();
    if (norm && !seen.has(key)) {
      seen.add(key);
      result.push(norm);
    }
  }

  for (const kw of textKeywords) {
    const key = kw.toLowerCase();
    if (kw && !seen.has(key)) {
      seen.add(key);
      result.push(kw);
    }
  }

  return result.slice(0, 50);
}

export * from './classification';
