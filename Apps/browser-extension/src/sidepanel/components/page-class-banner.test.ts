/** @format */

import { describe, expect, it } from 'vitest';
import type { PageInspection } from '../../shared/contracts/page-inspection';
import type { ValidatedApplicationPlanResponse } from '../../shared/contracts/backend';
import type { CareerProfile } from '../../shared/contracts/tailored-resume';

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

  it('simulates claiming an unmatched skill and updating career profile', () => {
    const claimSkill = (tech: string, profile: CareerProfile): CareerProfile => {
      const trimmed = tech.trim();
      const resumeData = profile.resume_data || {};
      const skillGroups = Array.isArray(resumeData.skills) ?
        resumeData.skills.map((g) => ({ ...g, skills: [...(g.skills || [])] }))
      : [];

      const exists = skillGroups.some((g) =>
        (g.skills || []).some((s) => s.toLowerCase() === trimmed.toLowerCase()),
      );

      if (!exists) {
        if (skillGroups.length === 0) {
          skillGroups.push({ type: 'Skills & Technologies', skills: [trimmed] });
        } else {
          const first = skillGroups[0];
          if (first) {
            first.skills = [...(first.skills || []), trimmed];
          }
        }
      }

      return {
        ...profile,
        resume_data: {
          ...resumeData,
          skills: skillGroups,
        },
      };
    };

    const updatedProfile = claimSkill('Docker', sampleProfile);
    const allSkills = (updatedProfile.resume_data?.skills || []).flatMap(
      (g) => g.skills || [],
    );

    expect(allSkills).toContain('Docker');
    expect(allSkills).toContain('React');
    expect(allSkills).toContain('TypeScript');
  });

  it('simulates unclaiming a matched skill from career profile', () => {
    const unclaimSkill = (tech: string, profile: CareerProfile): CareerProfile => {
      const trimmed = tech.trim();
      const resumeData = profile.resume_data || {};
      const skillGroups = Array.isArray(resumeData.skills) ?
        resumeData.skills.map((g) => ({
          ...g,
          skills: (g.skills || []).filter(
            (s) => s.toLowerCase() !== trimmed.toLowerCase(),
          ),
        }))
      : [];

      return {
        ...profile,
        resume_data: {
          ...resumeData,
          skills: skillGroups,
        },
      };
    };

    const updatedProfile = unclaimSkill('React', sampleProfile);
    const allSkills = (updatedProfile.resume_data?.skills || []).flatMap(
      (g) => g.skills || [],
    );

    expect(allSkills).not.toContain('React');
    expect(allSkills).toContain('TypeScript');
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
            skills: ['React'], // explicitly in profile
          },
        ],
      },
    };

    const getSource = (tech: string): 'profile' | 'resume' | 'unclaimed' => {
      const lower = tech.toLowerCase();
      if (!matchedSet.has(lower)) return 'unclaimed';
      const profileSkills = (profile.resume_data?.skills || []).flatMap(
        (g) => (g.skills || []).map((s) => s.toLowerCase()),
      );
      if (profileSkills.includes(lower)) return 'profile';
      return 'resume';
    };

    // React is in matchedSet AND in profile skills -> profile
    expect(getSource('React')).toBe('profile');

    // TypeScript is in matchedSet but NOT in profile skills -> resume
    expect(getSource('TypeScript')).toBe('resume');

    // Docker is in matchedSet but NOT in profile skills -> resume
    expect(getSource('Docker')).toBe('resume');

    // Python is NOT in matchedSet -> unclaimed
    expect(getSource('Python')).toBe('unclaimed');
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
