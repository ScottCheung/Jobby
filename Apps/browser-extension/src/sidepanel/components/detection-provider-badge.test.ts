import { describe, expect, it } from 'vitest';

import {
  getPlatformBadgeStyle,
  getPlatformDomain,
  isGenericDetection,
} from '@jobby/ui/components/UI/job-analysis/DetectionProviderBadge';

describe('DetectionProviderBadge', () => {
  it('marks only generic provider results as needing review', () => {
    expect(isGenericDetection('generic')).toBe(true);
    expect(isGenericDetection('Generic')).toBe(true);
    expect(isGenericDetection('seek')).toBe(false);
    expect(isGenericDetection(undefined)).toBe(false);
  });

  it('resolves domain correctly from URL and platform fallback', () => {
    expect(
      getPlatformDomain('https://www.linkedin.com/jobs/view/123', 'linkedin'),
    ).toBe('www.linkedin.com');
    expect(
      getPlatformDomain('https://boards.greenhouse.io/company/jobs/456'),
    ).toBe('boards.greenhouse.io');
    expect(getPlatformDomain(undefined, 'seek')).toBe('seek.com.au');
    expect(getPlatformDomain(undefined, 'workday')).toBe('workday.com');
    expect(getPlatformDomain(undefined, 'icims')).toBe('icims.com');
    expect(getPlatformDomain(undefined, 'successfactors')).toBe('successfactors.com');
    expect(getPlatformDomain(undefined, 'oracle')).toBe('oracle.com');
    expect(getPlatformDomain(undefined, 'workable')).toBe('workable.com');
    expect(getPlatformDomain(undefined, 'bamboohr')).toBe('bamboohr.com');
    expect(getPlatformDomain(undefined, 'jora')).toBe('jora.com');
    expect(getPlatformDomain(undefined, 'ziprecruiter')).toBe('ziprecruiter.com');
    expect(getPlatformDomain(undefined, 'adzuna')).toBe('adzuna.com.au');
    expect(getPlatformDomain(undefined, 'wellfound')).toBe('wellfound.com');
    expect(getPlatformDomain(undefined, 'dice')).toBe('dice.com');
    expect(getPlatformDomain(undefined, 'simplyhired')).toBe('simplyhired.com.au');
    expect(getPlatformDomain(undefined, 'unknown')).toBe(null);
    expect(getPlatformDomain(undefined, undefined)).toBe(null);
  });

  it('returns distinct brand style for known platforms and fallbacks', () => {
    expect(getPlatformBadgeStyle('generic', true)).toContain('border-warning');
    expect(getPlatformBadgeStyle(undefined, false, true)).toContain(
      'border-border/40',
    );
    expect(getPlatformBadgeStyle('linkedin')).toContain('#0A66C2');
    expect(getPlatformBadgeStyle('seek')).toContain('#E60278');
    expect(getPlatformBadgeStyle('workday')).toContain('#E25225');
    expect(getPlatformBadgeStyle('ashby')).toContain('#7C3AED');
    expect(getPlatformBadgeStyle('icims')).toContain('#007ea7');
    expect(getPlatformBadgeStyle('successfactors')).toContain('#0070f2');
    expect(getPlatformBadgeStyle('oracle')).toContain('#b91c1c');
    expect(getPlatformBadgeStyle('workable')).toContain('#00756a');
    expect(getPlatformBadgeStyle('bamboohr')).toContain('#658800');
    expect(getPlatformBadgeStyle('jora')).toContain('#15A449');
    expect(getPlatformBadgeStyle('ziprecruiter')).toContain('#1F8435');
    expect(getPlatformBadgeStyle('adzuna')).toContain('#1E88E5');
    expect(getPlatformBadgeStyle('wellfound')).toContain('#141413');
    expect(getPlatformBadgeStyle('dice')).toContain('#E01A22');
    expect(getPlatformBadgeStyle('simplyhired')).toContain('#205493');
    expect(getPlatformBadgeStyle('custom_ats')).toContain('border-primary');
  });
});

