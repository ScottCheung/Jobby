/** @format */

import { describe, expect, it } from 'vitest';
import { isAuthUrl } from './popup-handler';

describe('isAuthUrl', () => {
  it('correctly identifies authentication and OAuth URLs', () => {
    // Google Auth
    expect(isAuthUrl('https://accounts.google.com/o/oauth2/v2/auth?client_id=123')).toBe(true);

    // Microsoft Auth
    expect(isAuthUrl('https://login.microsoftonline.com/common/oauth2/v2.0/authorize')).toBe(true);
    expect(isAuthUrl('https://login.live.com/oauth20_authorize.srf')).toBe(true);

    // Apple Auth
    expect(isAuthUrl('https://appleid.apple.com/auth/authorize')).toBe(true);

    // LinkedIn Auth
    expect(isAuthUrl('https://www.linkedin.com/oauth/v2/authorization')).toBe(true);
    expect(isAuthUrl('https://www.linkedin.com/login')).toBe(true);
    expect(isAuthUrl('https://www.linkedin.com/checkpoint/challenge/')).toBe(true);

    // Facebook & Github Auth
    expect(isAuthUrl('https://www.facebook.com/v12.0/dialog/oauth')).toBe(true);
    expect(isAuthUrl('https://github.com/login/oauth/authorize')).toBe(true);

    // Okta / Auth0 / Supabase
    expect(isAuthUrl('https://example.okta.com/oauth2/v1/authorize')).toBe(true);
    expect(isAuthUrl('https://auth.example.com/oauth/authorize')).toBe(true);
    expect(isAuthUrl('https://xyz.supabase.co/auth/v1/authorize')).toBe(true);
    expect(isAuthUrl('https://supabase.com/dashboard/project/abc/auth')).toBe(true);

    // Localhost development auth callback
    expect(isAuthUrl('http://localhost:3000/login')).toBe(true);
    expect(isAuthUrl('http://localhost:3000/auth/callback')).toBe(true);
    expect(isAuthUrl('http://127.0.0.1:3001/auth')).toBe(true);
  });

  it('correctly identifies non-authentication URLs as false', () => {
    // Normal Job portals and ATS URLs
    expect(isAuthUrl('https://careers.fctgcareers.com/cw/en/job/531675/junior-software-engineer-south-bank-qld')).toBe(false);
    expect(isAuthUrl('https://boards.greenhouse.io/company/jobs/12345')).toBe(false);
    expect(isAuthUrl('https://jobs.lever.co/company/abcdef')).toBe(false);
    expect(isAuthUrl('https://www.google.com/search?q=jobs')).toBe(false);
    
    // Normal LinkedIn page (not login/auth)
    expect(isAuthUrl('https://www.linkedin.com/jobs/view/123456789/')).toBe(false);

    // Localhost normal page
    expect(isAuthUrl('http://localhost:3000/dashboard')).toBe(false);
    expect(isAuthUrl('http://127.0.0.1:3001/jobs')).toBe(false);

    // Invalid URLs
    expect(isAuthUrl('')).toBe(false);
    expect(isAuthUrl('not-a-url')).toBe(false);
  });
});
