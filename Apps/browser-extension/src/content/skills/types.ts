export interface SkillCatalogEntry {
  label: string;
  terms: string[];
}

export interface SkillRule {
  label: string;
  industry: string;
  patterns: RegExp[];
}

export interface SkillMatch {
  label: string;
  industry: string;
  index: number;
  end: number;
  order: number;
}
