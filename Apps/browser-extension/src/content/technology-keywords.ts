import skillCatalog from "./skill-catalog.json";

type SkillCatalogEntry = {
  label: string;
  terms: string[];
};

type SkillRule = {
  label: string;
  patterns: RegExp[];
};

type SkillMatch = {
  label: string;
  index: number;
  end: number;
  order: number;
};

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function termPattern(term: string): RegExp {
  const escaped = escapeRegExp(term).replace(/\s+/g, "\\s+");
  return new RegExp(`(?:^|[^A-Za-z0-9])(${escaped})(?=$|[^A-Za-z0-9])`, "i");
}

const SKILL_RULES: readonly SkillRule[] = Object.values(skillCatalog)
  .flatMap((entries) => entries as SkillCatalogEntry[])
  .map((entry) => ({
    label: entry.label,
    patterns: entry.terms.map(termPattern),
  }));

function cleanText(value: string | null | undefined): string {
  return (value || "").replace(/\s+/g, " ").trim();
}

function firstMatch(
  text: string,
  patterns: readonly RegExp[],
): Pick<SkillMatch, "index" | "end"> | undefined {
  let first: Pick<SkillMatch, "index" | "end"> | undefined;

  for (const pattern of patterns) {
    const match = pattern.exec(text);
    const matchedTerm = match?.[1];
    if (!match || !matchedTerm) continue;

    const index = match.index + match[0].indexOf(matchedTerm);
    const end = index + matchedTerm.length;
    if (!first || index < first.index || (index === first.index && end > first.end)) {
      first = { index, end };
    }
  }

  return first;
}

export function extractTechnologyKeywords(value: string | null | undefined): string[] {
  const text = cleanText(value);
  if (!text) return [];

  return SKILL_RULES.map((rule, order) => {
    const match = firstMatch(text, rule.patterns);
    return match ? { label: rule.label, ...match, order } : undefined;
  })
    .filter((item): item is SkillMatch => Boolean(item))
    .sort((left, right) => left.index - right.index || left.order - right.order)
    .filter(
      (item, _index, matches) =>
        !matches.some(
          (other) =>
            other.label !== item.label &&
            other.index <= item.index &&
            other.end >= item.end &&
            other.end - other.index > item.end - item.index,
        ),
    )
    .map((item) => item.label)
    .filter((label, index, labels) => labels.indexOf(label) === index)
    .slice(0, 30);
}
