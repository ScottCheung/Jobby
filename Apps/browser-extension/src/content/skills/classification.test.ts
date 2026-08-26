import { describe, expect, it } from 'vitest';
import { classifySkills, getSkillIndustry } from './classification';

describe('classifySkills', () => {
  it('correctly classifies a tech-dominant role into Core IT and Bonus Finance/Workplace', () => {
    const techSkills = [
      'React',
      'C#',
      '.NET',
      'SQL',
      'AWS',
      'Git',
      'CI/CD',
      'Financial Services',
      'Wealth Management',
      'Fintech',
      'Communication Skills',
    ];

    const result = classifySkills(techSkills);

    expect(result.coreGroups.length).toBe(1);
    expect(result.coreGroups[0]?.industry).toBe('information-technology');
    expect(result.allCoreSkills).toEqual([
      'React',
      'C#',
      '.NET',
      'SQL',
      'AWS',
      'Git',
      'CI/CD',
    ]);

    expect(result.bonusGroups.length).toBe(2);
    const bonusIndustries = result.bonusGroups.map((g) => g.industry);
    expect(bonusIndustries).toContain('finance-banking');
    expect(bonusIndustries).toContain('human-resources');
    expect(result.allBonusSkills).toContain('Financial Services');
    expect(result.allBonusSkills).toContain('Wealth Management');
    expect(result.allBonusSkills).toContain('Fintech');
    expect(result.allBonusSkills).toContain('Communication Skills');
  });

  it('identifies Dual-Core for 50/50 hybrid roles (e.g. Quant Dev with IT + Finance)', () => {
    const quantSkills = [
      'C++',
      'Python',
      'SQL',
      'Financial Modeling',
      'Portfolio Management',
      'Derivatives Pricing',
    ];

    const result = classifySkills(quantSkills);

    expect(result.coreGroups.length).toBe(2);
    const coreIndustries = result.coreGroups.map((g) => g.industry);
    expect(coreIndustries).toContain('information-technology');
    expect(coreIndustries).toContain('finance-banking');
    expect(result.bonusGroups.length).toBe(0);
  });

  it('handles finance-dominant roles where Finance is Core and IT is Bonus', () => {
    const financeSkills = [
      'Financial Modeling',
      'DCF',
      'IFRS',
      'Budgeting',
      'Capital Budgeting',
      'Portfolio Management',
      'SQL',
      'Python',
    ];

    const result = classifySkills(financeSkills);

    expect(result.coreGroups.length).toBe(1);
    expect(result.coreGroups[0]?.industry).toBe('finance-banking');
    expect(result.bonusGroups.length).toBe(1);
    expect(result.bonusGroups[0]?.industry).toBe('information-technology');
  });

  it('handles empty or missing input cleanly', () => {
    const result = classifySkills([]);
    expect(result.coreGroups).toEqual([]);
    expect(result.bonusGroups).toEqual([]);
    expect(result.allCoreSkills).toEqual([]);
    expect(result.allBonusSkills).toEqual([]);
  });

  it('looks up skill industry correctly', () => {
    expect(getSkillIndustry('React')).toBe('information-technology');
    expect(getSkillIndustry('Wealth Management')).toBe('finance-banking');
    expect(getSkillIndustry('SEO')).toBe('sales-marketing');
    expect(getSkillIndustry('Figma')).toBe('design-creative');
    expect(getSkillIndustry('Communication Skills')).toBe('human-resources');
    expect(getSkillIndustry('NonExistentCustomSkill123')).toBe('other');
  });
});
