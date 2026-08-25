import { describe, expect, it } from 'vitest';

import { jobMatchLabel } from './JobScoreCard';

describe('job match score card', () => {
  it('keeps the loading and final score labels separate', () => {
    expect(jobMatchLabel(true, true, null)).toBe('Calculating Score...');
    expect(jobMatchLabel(true, false, 82)).toBe('Highly Recommended');
    expect(jobMatchLabel(true, false, null)).toBe('Score unavailable');
  });
});
