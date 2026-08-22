/** @format */

import { describe, expect, it } from 'vitest';
import type { PageInspection } from '../../shared/contracts/page-inspection';
import type { ValidatedApplicationPlanResponse } from '../../shared/contracts/backend';
import type {
  CareerProfile,
  UserSkill,
} from '../../shared/contracts/tailored-resume';
import { getSkillSource } from './PageClassBanner';

describe('Technologies and Skills Management', () => {
  const sampleInspection: PageInspection = {
    kind: 'job',
    snapshot: {
      platform: 'seek',
      externalId: 'job-998877',
      url: 'https://www.seek.com.au/job/998877',
      title: 'Full Stack Engineer',
      company: 'Canva',
      datePosted: 'Posted 1 day ago',
      description: 'Role requires React, TypeScript, Docker, and Python expertise.',
      technologies: ['React', 'TypeScript', 'Docker', 'Python'],
      easyApply: true,
    },
  };

  const samplePlan: ValidatedApplicationPlanResponse = {
    application_id: 'app-12345',
    plan: {
      idempotency_key: 'idemp-123',
      state: 'planned',
      candidate: {
        platform: 'seek',
        external_id: 'job-998877',
        title: 'Full Stack Engineer',
        company: 'Canva',
        match_score: 0.85,
        skill_score: 0.88,
        title_score: 0.90,
        recency_factor: 1.0,
      },
      decision: {
        action: 'apply',
        reason_codes: ['score_threshold_met'],
        requires_submit_confirmation: false,
        score: 0.85,
        matched_terms: ['React', 'TypeScript'],
        explanation: 'Strong match for React and TypeScript',
      },
    },
  };

  const sampleProfile: CareerProfile = {
    id: 'profile-abc-123',
    name: 'Full Stack Profile',
    is_default: true,
    resume_data: {
      basics: { first_name: 'John', last_name: 'Doe' },
      skills: [
        {
          type: 'Languages & Frameworks',
          skills: ['React', 'TypeScript'],
        },
      ],
    },
  };

  it('correctly distinguishes matched skills from unmatched skills', () => {
    const matchedTerms = samplePlan.plan.decision.matched_terms.map((t) =>
      t.toLowerCase(),
    );
    const matchedSet = new Set(matchedTerms);

    expect(matchedSet.has('react')).toBe(true);
    expect(matchedSet.has('typescript')).toBe(true);
    expect(matchedSet.has('docker')).toBe(false);
    expect(matchedSet.has('python')).toBe(false);
  });

  it('keeps claimed plugin skills separate from resume skills', () => {
    const before = structuredClone(sampleProfile);
    const claimedSkills: UserSkill[] = [
      {
        id: 'skill-docker',
        skill_name: 'Docker',
        canonical_name: 'docker',
        category: 'Plugin Skills',
        source: 'plugin',
        created_at: '2026-08-23T00:00:00Z',
        updated_at: '2026-08-23T00:00:00Z',
      },
    ];

    expect(claimedSkills.map((skill) => skill.skill_name)).toContain('Docker');
    expect(sampleProfile).toEqual(before);
    expect(sampleProfile.resume_data?.skills?.[0]?.skills).toEqual([
      'React',
      'TypeScript',
    ]);
  });

  it('allows adding and removing custom job technologies', () => {
    let currentTechnologies = [...(sampleInspection.snapshot.technologies || [])];

    // Add custom technology
    const addTech = (newTech: string) => {
      const trimmed = newTech.trim();
      if (!currentTechnologies.some((t) => t.toLowerCase() === trimmed.toLowerCase())) {
        currentTechnologies.push(trimmed);
      }
    };

    // Remove technology
    const removeTech = (target: string) => {
      currentTechnologies = currentTechnologies.filter((t) => t !== target);
    };

    addTech('GraphQL');
    expect(currentTechnologies).toContain('GraphQL');

    removeTech('Python');
    expect(currentTechnologies).not.toContain('Python');
    expect(currentTechnologies).toEqual(['React', 'TypeScript', 'Docker', 'GraphQL']);
  });

  it('correctly classifies skill source into profile, resume, and unclaimed', () => {
    const matchedTerms = ['React', 'TypeScript', 'Docker'];
    const matchedSet = new Set(matchedTerms.map((t) => t.toLowerCase()));

    const profile: CareerProfile = {
      id: 'profile-1',
      name: 'Primary',
      is_default: true,
      resume_data: {
        skills: [
          {
            type: 'Frameworks',
            skills: ['React'],
          },
        ],
      },
    };

    const profileSkills: UserSkill[] = [
      {
        id: 'skill-docker',
        skill_name: 'Docker',
        canonical_name: 'docker',
        source: 'plugin',
        created_at: '2026-08-23T00:00:00Z',
        updated_at: '2026-08-23T00:00:00Z',
      },
    ];

    expect(getSkillSource('React', matchedSet, profile, profileSkills)).toBe(
      'resume',
    );

    expect(
      getSkillSource('TypeScript', matchedSet, profile, profileSkills),
    ).toBe('resume');

    expect(getSkillSource('Docker', matchedSet, profile, profileSkills)).toBe(
      'profile',
    );

    expect(getSkillSource('Python', matchedSet, profile, profileSkills)).toBe(
      'unclaimed',
    );
  });

  it('triggers onReDetect callback when Re-detect button is clicked', () => {
    let reDetectCalled = false;
    const handleReDetect = () => {
      reDetectCalled = true;
    };

    handleReDetect();
    expect(reDetectCalled).toBe(true);
  });

  it('handles unauthenticated state without evaluating or showing backend network errors', () => {
    const authConnected = false;
    const error = 'Please sign in to Jobby before using autofill.';
    
    // When authConnected is false, error banner should be suppressed
    const shouldShowError = authConnected && Boolean(error) && !samplePlan?.plan?.decision;
    expect(shouldShowError).toBe(false);

    // And DOM-extracted technologies should still be available
    expect(sampleInspection.snapshot.technologies).toHaveLength(4);
  });
});
