import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { notify } from '@jobby/ui/components/UI/toast/toast-store';

import { apiClient } from '../../background/api-client';
import type { JobMatchEvaluation } from '../../shared/contracts/job-match';
import type { PageInspection } from '../../shared/contracts/page-inspection';
import type {
  CareerProfile,
  UserSkill,
} from '../../shared/contracts/tailored-resume';

function evaluationKey(inspection: PageInspection | null): string {
  if (inspection?.kind !== 'job') return '';
  const job = inspection.snapshot;
  return JSON.stringify([
    job.platform,
    job.externalId,
    job.title,
    job.company,
    job.description,
    job.lastPostedAt,
    job.technologies,
  ]);
}

export function useJobMatch(
  latestInspection: PageInspection | null,
  authConnected = false,
  onSignIn?: () => void,
) {
  const [evaluation, setEvaluation] = useState<JobMatchEvaluation | null>(null);
  const [error, setError] = useState('');
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [activeProfile, setActiveProfile] = useState<CareerProfile | null>(null);
  const [profileSkills, setProfileSkills] = useState<UserSkill[]>([]);
  const requestSequence = useRef(0);
  const key = useMemo(() => evaluationKey(latestInspection), [latestInspection]);

  const evaluate = useCallback(async () => {
    const sequence = ++requestSequence.current;
    if (!authConnected || latestInspection?.kind !== 'job') {
      setEvaluation(null);
      setError('');
      setIsEvaluating(false);
      return null;
    }

    setEvaluation(null);
    setError('');
    setIsEvaluating(true);
    try {
      const result = await apiClient.evaluateJobMatch(latestInspection.snapshot);
      if (requestSequence.current !== sequence) return null;
      setEvaluation(result);
      return result;
    } catch (caught) {
      if (requestSequence.current !== sequence) return null;
      setError(
        caught instanceof Error ?
          caught.message
        : 'Could not calculate the job match score.',
      );
      return null;
    } finally {
      if (requestSequence.current === sequence) setIsEvaluating(false);
    }
  }, [authConnected, key]);

  useEffect(() => {
    void evaluate();
    return () => {
      requestSequence.current += 1;
    };
  }, [evaluate]);

  const refreshProfile = useCallback(async () => {
    if (!authConnected) {
      setActiveProfile(null);
      setProfileSkills([]);
      return;
    }
    const [profiles, skills] = await Promise.all([
      apiClient.getCareerProfiles(),
      apiClient.getUserSkills(),
    ]);
    setActiveProfile(profiles.find((profile) => profile.is_default) || profiles[0] || null);
    setProfileSkills(skills);
  }, [authConnected]);

  useEffect(() => {
    void refreshProfile().catch(() => undefined);
  }, [refreshProfile]);

  const claimSkill = useCallback(
    async (technology: string) => {
      if (!authConnected) {
        notify.info('Please sign in to Jobby to manage your skills.');
        onSignIn?.();
        return;
      }
      const skill = technology.trim();
      if (!skill) return;
      try {
        await apiClient.addUserSkill(skill);
        await refreshProfile();
        await evaluate();
        notify.success(`Added "${skill}" to your profile skills.`);
      } catch (caught) {
        notify.error(caught instanceof Error ? caught.message : `Could not add "${skill}".`);
      }
    },
    [authConnected, evaluate, onSignIn, refreshProfile],
  );

  const unclaimSkill = useCallback(
    async (technology: string) => {
      if (!authConnected) {
        notify.info('Please sign in to Jobby to manage your skills.');
        onSignIn?.();
        return;
      }
      const skill = technology.trim();
      if (!skill) return;
      try {
        await apiClient.deleteUserSkill(skill);
        await refreshProfile();
        await evaluate();
        notify.success(`Removed "${skill}" from your profile skills.`);
      } catch (caught) {
        notify.error(caught instanceof Error ? caught.message : `Could not remove "${skill}".`);
      }
    },
    [authConnected, evaluate, onSignIn, refreshProfile],
  );

  return {
    evaluation,
    error,
    isEvaluating,
    retry: evaluate,
    activeProfile,
    profileSkills,
    claimSkill,
    unclaimSkill,
  };
}
