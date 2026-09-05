/** @format */

// @vitest-environment happy-dom

import { describe, expect, it } from 'vitest';
import { classifyCurrentPage, MAJOR_PLATFORM_RULES } from './page-classifier';

function setLocation(url: string): void {
  Object.defineProperty(window, 'location', {
    configurable: true,
    writable: true,
    value: new URL(url),
  });
}

describe('page-classifier', () => {
  it('identifies SEEK explicit non-job pages as non-job', () => {
    const nonJobPaths = [
      '/login',
      '/account',
      '/sign-in',
      '/profile',
      '/career-advice',
      '/companies',
      '/saved-searches',
      '/saved-jobs',
      '/applied-jobs',
      '/employer',
      '/support',
      '/help',
    ];

    const seekRule = MAJOR_PLATFORM_RULES.find((rule) => rule.name === 'SEEK')!;
    expect(seekRule).toBeDefined();

    for (const pathname of nonJobPaths) {
      const isExplicitNonJob = seekRule.nonJobPatterns.some((pattern) => pattern.test(pathname));
      expect(isExplicitNonJob, `Expected ${pathname} to be matched as non-job`).toBe(true);
    }
  });

  it('classifies current page on SEEK non-job URLs without falsely triggering job patterns', () => {
    setLocation('https://www.seek.com.au/login');
    const result = classifyCurrentPage();
    expect(result.isJobPage).toBe(false);
    expect(result.confidence).toBe(0);
  });

  it('classifies SEEK /saved-jobs as non-job even though it ends with -jobs', () => {
    setLocation('https://www.seek.com.au/saved-jobs');
    const result = classifyCurrentPage();
    expect(result.isJobPage).toBe(false);
  });

  it('classifies SEEK job posting page as a job page', () => {
    setLocation('https://www.seek.com.au/job/78912345');
    const result = classifyCurrentPage();
    expect(result.isJobPage).toBe(true);
    expect(result.confidence).toBeGreaterThanOrEqual(3);
  });
});
