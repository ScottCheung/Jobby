/** @format */

import type { MasterResumeData } from './types';

export type ResumeTextToken = {
  kind: 'plain' | 'skill' | 'metric';
  value: string;
};

export type ResumeHighlightRules = {
  terms: Set<string>;
  matcher: RegExp | null;
};

const METRIC_PATTERN =
  '\\$\\d[\\d,.]*(?:[kKmMbB])?|\\b\\d+(?:\\.\\d+)?%|\\b\\d{1,3}(?:,\\d{3})+(?:\\.\\d+)?\\b|\\b\\d+(?:\\.\\d+)?(?:x|ms|s|minutes?|hours?|days?|weeks?|months?|years?)\\b';

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const IDENTIFIER_CHARACTER = '[\\p{L}\\p{N}_]';

/**
 * Match a skill as a complete identifier, not as a substring of prose.
 *
 * For example, "Git" must match "Git workflow" but not the middle of
 * "digital". Terms with punctuation (such as ".NET" or "C++") only receive
 * a boundary on the side that starts or ends with an identifier character.
 */
function skillMatcherPart(term: string) {
  const startsWithIdentifier = new RegExp(`^${IDENTIFIER_CHARACTER}`, 'u').test(
    term,
  );
  const endsWithIdentifier = new RegExp(`${IDENTIFIER_CHARACTER}$`, 'u').test(
    term,
  );
  return `${startsWithIdentifier ? `(?<!${IDENTIFIER_CHARACTER})` : ''}${escapeRegExp(term)}${endsWithIdentifier ? `(?!${IDENTIFIER_CHARACTER})` : ''}`;
}

export function createResumeHighlightRules(
  data: MasterResumeData,
): ResumeHighlightRules {
  const terms = new Set(
    [
      ...(data.skills ?? []).flatMap((group) => group.skills ?? []),
      ...(data.experience ?? []).flatMap((item) => item.technologies ?? []),
      ...(data.projects ?? []).flatMap((item) => item.technologies ?? []),
    ]
      .map((value) => value.trim())
      .filter((value) => value.length >= 2),
  );
  const sortedTerms = [...terms].sort(
    (left, right) => right.length - left.length,
  );
  const matcherParts = [...sortedTerms.map(skillMatcherPart), METRIC_PATTERN];

  return {
    terms: new Set([...terms].map((term) => term.toLocaleLowerCase())),
    matcher: matcherParts.length
      ? new RegExp(matcherParts.join('|'), 'giu')
      : null,
  };
}

export function tokenizeResumeText(
  value: string,
  rules: ResumeHighlightRules,
): ResumeTextToken[] {
  if (!rules.matcher || !value) return [{ kind: 'plain', value }];

  const tokens: ResumeTextToken[] = [];
  let cursor = 0;
  rules.matcher.lastIndex = 0;
  for (const match of value.matchAll(rules.matcher)) {
    const index = match.index ?? 0;
    if (index > cursor)
      tokens.push({ kind: 'plain', value: value.slice(cursor, index) });
    const matchedValue = match[0];
    tokens.push({
      kind: rules.terms.has(matchedValue.toLocaleLowerCase())
        ? 'skill'
        : 'metric',
      value: matchedValue,
    });
    cursor = index + matchedValue.length;
  }
  if (cursor < value.length)
    tokens.push({ kind: 'plain', value: value.slice(cursor) });
  return tokens;
}
