// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest';

import { detectAtsPlatform } from './ats-platform';

function locationFor(hostname: string, pathname = '/'): Pick<Location, 'hostname' | 'pathname'> {
  return { hostname, pathname } as Pick<Location, 'hostname' | 'pathname'>;
}

describe('ATS platform detection', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it.each([
    ['tenant.myworkdayjobs.com', '/', 'workday'],
    ['boards.greenhouse.io', '/company/jobs/1', 'greenhouse'],
    ['jobs.lever.co', '/company/role', 'lever'],
    ['jobs.ashbyhq.com', '/company/role', 'ashby'],
    ['jobs.taleo.net', '/careersection/2/jobdetail.ftl', 'taleo'],
    ['careers-acme.icims.com', '/jobs/101', 'icims'],
    ['career4.successfactors.com', '/career', 'successfactors'],
    ['fa.ocs.oraclecloud.com', '/hcmUI/CandidateExperience', 'oracle'],
    ['apply.workable.com', '/acme/j/123', 'workable'],
    ['acme.bamboohr.com', '/careers/456', 'bamboohr'],
  ] as const)('recognises %s', (hostname, pathname, expected) => {
    expect(detectAtsPlatform(locationFor(hostname, pathname))).toBe(expected);
  });

  it('uses SmartRecruiters components when a white-label URL has no hostname hint', () => {
    document.body.innerHTML = '<spl-input label="City"></spl-input>';
    expect(detectAtsPlatform(locationFor('careers.example.com'))).toBe('smartrecruiters');
  });

  it('keeps unknown sites on the generic fallback', () => {
    expect(detectAtsPlatform(locationFor('careers.example.com'))).toBe('generic');
  });
});
