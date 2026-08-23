/** @format */

import { useCallback, useEffect, useRef, useState } from 'react';
import { notify } from '@jobby/ui/components/UI/toast/toast-store';
import type {
  ExtensionPlanAction,
  ValidatedApplicationPlanResponse,
} from '../../shared/contracts/backend';
import type { FieldFillResult } from '../../shared/contracts/form-actions';
import type { FormInspection } from '../../shared/contracts/form-inspection';
import type { PageInspection } from '../../shared/contracts/page-inspection';
import {
  executeAutoRun,
  executeMoveNext,
  executeMovePrevious,
  executeOpenLinkedIn,
} from '../services/application-actions';
import { send, wait } from '../services/messaging';
import { apiClient } from '../../background/api-client';
import type {
  CareerProfile,
  UserSkill,
} from '../../shared/contracts/tailored-resume';

const MAX_AUTO_PLAN_ATTEMPTS = 3;
const AUTO_PLAN_RETRY_DELAY_MS = 1_500;

function hasResolvedCompany(company: string | undefined): boolean {
  const normalized = company?.trim().toLowerCase();
  return Boolean(
    normalized && normalized !== 'unknown' && normalized !== 'unknown company',
  );
}

export function useApplicationPlan(
  latestInspection: PageInspection | null,
  latestForm: FormInspection | null,
  inspectPage: () => Promise<void>,
  inspectForm: () => Promise<FormInspection | null>,
  reportError: (message: string) => void,
  applyAutofillResults: (
    results: FieldFillResult[],
    form?: FormInspection,
  ) => void,
  authConnected = false,
  onSignIn?: () => void,
) {
  const [latestPlan, setLatestPlan] =
    useState<ValidatedApplicationPlanResponse | null>(null);
  const [fillResults, setFillResults] = useState<FieldFillResult[]>([]);
  const [unansweredFields, setUnansweredFields] = useState<
    Array<{ key: string; label: string; reason: string }>
  >([]);
  const [loadingButton, setLoadingButton] = useState<string | null>(null);
  const [planError, setPlanError] = useState<string>('');
  const [autoPlanRetryNonce, setAutoPlanRetryNonce] = useState(0);
  const lastJobKey = useRef<string | null>(null);
  const autoPlanCreatedRef = useRef<string | null>(null);
  const autoPlanAttemptsRef = useRef(0);
  const autoPlanRetryTimerRef = useRef<number | undefined>(undefined);

  const clearAutoPlanRetry = useCallback(() => {
    if (autoPlanRetryTimerRef.current !== undefined) {
      window.clearTimeout(autoPlanRetryTimerRef.current);
      autoPlanRetryTimerRef.current = undefined;
    }
  }, []);

  useEffect(() => clearAutoPlanRetry, [clearAutoPlanRetry]);

  useEffect(() => {
    const currentJobKey =
      latestInspection?.kind === 'job' ?
        `${latestInspection.snapshot.platform}:${latestInspection.snapshot.externalId}`
      : null;
    if (
      currentJobKey &&
      lastJobKey.current &&
      currentJobKey !== lastJobKey.current
    ) {
      clearAutoPlanRetry();
      autoPlanCreatedRef.current = null;
      autoPlanAttemptsRef.current = 0;
      setLatestPlan(null);
      setFillResults([]);
      setUnansweredFields([]);
      setPlanError('');
    }
    lastJobKey.current = currentJobKey;
  }, [latestInspection]);

  // Automatically create application plan and derive match score upon job identification
  useEffect(() => {
    if (!authConnected) {
      clearAutoPlanRetry();
      autoPlanCreatedRef.current = null;
      autoPlanAttemptsRef.current = 0;
      setPlanError('');
      return;
    }

    const isReadyForEvaluation =
      latestInspection?.kind === 'job' &&
      hasResolvedCompany(latestInspection.snapshot.company);
    if (!isReadyForEvaluation) {
      clearAutoPlanRetry();
      autoPlanCreatedRef.current = null;
      autoPlanAttemptsRef.current = 0;
      setPlanError('');
      return;
    }
    const currentJobKey = `${latestInspection.snapshot.platform}:${latestInspection.snapshot.externalId}`;
    if (autoPlanCreatedRef.current !== currentJobKey && !latestPlan) {
      clearAutoPlanRetry();
      autoPlanCreatedRef.current = currentJobKey;
      setPlanError('');
      void send({
        type: 'application.create-plan-active',
        inspection: latestInspection,
      })
        .then((response) => {
          if (response?.ok && response?.plan) {
            autoPlanAttemptsRef.current = 0;
            setLatestPlan(response.plan);
            void send({
              type: 'content.render-score-card',
              inspection: latestInspection,
              plan: response.plan,
            }).catch(() => undefined);
            return;
          }

          schedulePlanRetry(
            response.ok ?
              'The evaluation service did not return a plan.'
            : response.error,
          );
        })
        .catch((error: unknown) => {
          schedulePlanRetry(
            error instanceof Error ?
              error.message
            : 'Could not contact the evaluation service.',
          );
        });

      function schedulePlanRetry(message: string) {
        if (autoPlanCreatedRef.current !== currentJobKey) return;

        autoPlanAttemptsRef.current += 1;
        if (autoPlanAttemptsRef.current >= MAX_AUTO_PLAN_ATTEMPTS) {
          setPlanError(
            `Technology evaluation could not be completed: ${message}`,
          );
          return;
        }

        autoPlanCreatedRef.current = null;
        setPlanError(
          `Technology evaluation failed. Retrying (${autoPlanAttemptsRef.current}/${MAX_AUTO_PLAN_ATTEMPTS})...`,
        );
        autoPlanRetryTimerRef.current = window.setTimeout(() => {
          autoPlanRetryTimerRef.current = undefined;
          setAutoPlanRetryNonce((value) => value + 1);
        }, AUTO_PLAN_RETRY_DELAY_MS * autoPlanAttemptsRef.current);
      }
    }
  }, [authConnected, autoPlanRetryNonce, clearAutoPlanRetry, latestInspection, latestPlan]);

  const createPlan = useCallback(async () => {
    if (!authConnected) {
      notify.info('Please sign in to Jobby to evaluate job applications.');
      onSignIn?.();
      return null;
    }
    const response = await send({
      type: 'application.create-plan-active',
      ...(latestInspection ? { inspection: latestInspection } : {}),
    });
    if (!response.ok) {
      return null;
    }
    if (response.plan) setLatestPlan(response.plan);
    return response.plan ?? null;
  }, [authConnected, latestInspection, onSignIn]);

  const retryPlan = useCallback(async () => {
    if (latestInspection?.kind !== 'job') return null;
    clearAutoPlanRetry();
    autoPlanCreatedRef.current = null;
    autoPlanAttemptsRef.current = 0;
    setPlanError('');
    return createPlan();
  }, [clearAutoPlanRetry, createPlan, latestInspection]);

  useEffect(() => {
    if (latestInspection?.kind === 'job' && latestPlan) {
      void send({
        type: 'content.render-score-card',
        inspection: latestInspection,
        plan: latestPlan,
      }).catch(() => undefined);
    }
  }, [latestInspection, latestPlan]);

  const applyPlanAction = useCallback(
    async (
      action: ExtensionPlanAction,
      reason?: string,
    ): Promise<ValidatedApplicationPlanResponse | null> => {
      if (!latestPlan) return null;
      const response = await send({
        type: 'application.plan-action-active',
        applicationId: latestPlan.application_id,
        action,
        ...(reason ? { reason } : {}),
      });
      if (response.ok && response.plan) {
        setLatestPlan(response.plan);
        return response.plan;
      }
      return null;
    },
    [latestPlan],
  );

  const ensurePlanPrepared = useCallback(async (): Promise<boolean> => {
    let plan = latestPlan;
    if (!plan && latestInspection?.kind === 'job') {
      await inspectPage();
      plan = await createPlan();
    }
    if (!plan) return false;
    if (
      plan.plan.state === 'planned' ||
      plan.plan.state === 'awaiting_user_review'
    ) {
      await applyPlanAction('prepare');
    }
    return true;
  }, [latestPlan, latestInspection, inspectPage, createPlan, applyPlanAction]);

  const autofillForm = useCallback(async () => {
    if (!authConnected) {
      notify.info('Please sign in to Jobby to autofill forms.');
      onSignIn?.();
      return;
    }
    setLoadingButton('autofill');
    try {
      let form =
        (
          latestForm?.kind === 'application_form' ||
          latestForm?.kind === 'page_input_fields'
        ) ?
          latestForm
        : await inspectForm();
      if (
        !form ||
        (form.kind !== 'application_form' && form.kind !== 'page_input_fields')
      ) {
        await wait(150);
        form = await inspectForm();
      }
      if (
        !form ||
        (form.kind !== 'application_form' && form.kind !== 'page_input_fields')
      ) {
        return;
      }

      const response = await send({ type: 'form.autofill-active' }).catch(
        (error: unknown) => ({
          ok: false as const,
          error:
            error instanceof Error ?
              error.message
            : 'Autofill could not start.',
        }),
      );
      if (!response.ok) {
        setFillResults([]);
        setUnansweredFields([]);
        reportError(response.error);
        return;
      }

      const results = response.fillResults || [];
      const unanswered = response.unansweredFields || [];
      setFillResults(results);
      setUnansweredFields(unanswered);
      applyAutofillResults(results, response.form);
      reportError('');
      await inspectForm();
    } finally {
      setLoadingButton(null);
    }
  }, [authConnected, onSignIn, latestForm, inspectForm, reportError, applyAutofillResults]);

  const fillAndNext = useCallback(async () => {
    if (!authConnected) {
      notify.info('Please sign in to Jobby to use Fill & Next.');
      onSignIn?.();
      return;
    }
    setLoadingButton('fillAndNext');
    try {
      let form =
        latestForm?.kind === 'application_form' ?
          latestForm
        : await inspectForm();
      if (!form || form.kind !== 'application_form') {
        const openRes = await send({
          type: 'application.open-linkedin-active',
        }).catch(() => null);
        if (openRes?.ok) {
          await wait(300);
          form = await inspectForm();
        }
      }
      if (!form || form.kind !== 'application_form') {
        return;
      }
      if ((await ensurePlanPrepared()) && latestPlan) {
        const response = await send({
          type: 'application.fill-and-next-active',
          applicationId: latestPlan.application_id,
        });
        if (response.ok) {
          setFillResults(response.fillResults || []);
          setUnansweredFields(response.unansweredFields || []);
          if (response.plan) setLatestPlan(response.plan);
          await inspectForm();
          if (response.stepAdvanced) {
            return;
          }
        }
      }
      await executeMoveNext(inspectForm);
    } finally {
      setLoadingButton(null);
    }
  }, [authConnected, onSignIn, latestForm, inspectForm, ensurePlanPrepared, latestPlan]);

  const runAction = useCallback(
    async (
      btnName: string,
      fn: () => Promise<{ success: boolean; message?: string; error?: string }>,
    ) => {
      setLoadingButton(btnName);
      try {
        await fn();
      } finally {
        setLoadingButton(null);
      }
    },
    [],
  );

  const openLinkedIn = () =>
    runAction('open', () => executeOpenLinkedIn(inspectForm));
  const moveNext = () => runAction('next', () => executeMoveNext(inspectForm));
  const movePrevious = () =>
    runAction('previous', () => executeMovePrevious(inspectForm));

  const submitApplication = useCallback(async () => {
    if (!authConnected) {
      notify.info('Please sign in to Jobby to submit applications.');
      onSignIn?.();
      return;
    }
    setLoadingButton('submit');
    try {
      let plan =
        latestPlan ??
        (latestInspection?.kind === 'job' ? await createPlan() : null);
      if (!plan) return;

      const response = await send({
        type: 'application.submit-linkedin-active',
        applicationId: plan.application_id,
      });
      if (!response.ok) {
        notify.error(response.error || 'Failed to submit application');
        return;
      }
      if (response.plan) setLatestPlan(response.plan);
      notify.success('Application submitted successfully!');
    } catch (error) {
      notify.error(
        error instanceof Error ? error.message : 'Failed to submit application',
      );
    } finally {
      setLoadingButton(null);
    }
  }, [authConnected, onSignIn, latestPlan, latestInspection, createPlan]);

  const autoRunLinkedIn = useCallback(async () => {
    if (!authConnected) {
      notify.info('Please sign in to Jobby to use Auto Apply.');
      onSignIn?.();
      return;
    }
    setLoadingButton('autoRun');
    try {
      const res = await executeAutoRun(latestPlan?.application_id);
      if (!res.success) {
        if (res.error) notify.error(res.error);
        return;
      }
      if (res.plan) setLatestPlan(res.plan);
      if (res.fillResults) setFillResults(res.fillResults);
      if (res.unansweredFields) setUnansweredFields(res.unansweredFields);
      notify.success('Auto-apply finished successfully!');
    } catch (error) {
      notify.error(
        error instanceof Error ? error.message : 'Auto-apply failed',
      );
    } finally {
      setLoadingButton(null);
    }
  }, [authConnected, onSignIn, latestPlan]);

  const recordApplication = useCallback(async () => {
    if (!authConnected) {
      notify.info('Please sign in to Jobby to record applications.');
      onSignIn?.();
      return;
    }
    setLoadingButton('record');
    try {
      let plan = latestPlan;
      if (!plan && latestInspection?.kind === 'job') {
        plan = await createPlan();
      }
      if (!plan) {
        return;
      }

      const applicationId = plan.application_id;

      // Reconcile plan state transitions so backend accepts mark_submitted
      if (['planned', 'awaiting_user_review'].includes(plan.plan.state)) {
        const prepRes = await send({
          type: 'application.plan-action-active',
          applicationId,
          action: 'prepare',
        }).catch(() => null);
        if (prepRes?.ok && prepRes.plan) plan = prepRes.plan;
      }

      if (plan.plan.state === 'preparing') {
        const markPrepRes = await send({
          type: 'application.plan-action-active',
          applicationId,
          action: 'mark_prepared',
        }).catch(() => null);
        if (markPrepRes?.ok && markPrepRes.plan) plan = markPrepRes.plan;
      }

      if (plan.plan.state === 'awaiting_user_review') {
        const appRes = await send({
          type: 'application.plan-action-active',
          applicationId,
          action: 'approve',
        }).catch(() => null);
        if (appRes?.ok && appRes.plan) plan = appRes.plan;
      }

      const response = await send({
        type: 'application.plan-action-active',
        applicationId,
        action: 'mark_submitted',
        reason: 'Manually recorded via browser extension',
      });

      if (response.ok) {
        if (response.plan) setLatestPlan(response.plan);
        notify.success('Application recorded successfully!');
      } else {
        notify.error(response.error || 'Failed to record application');
      }
    } catch (error) {
      notify.error(
        error instanceof Error ? error.message : 'Failed to record application',
      );
    } finally {
      setLoadingButton(null);
    }
  }, [authConnected, onSignIn, latestPlan, latestInspection, createPlan]);

  const [careerProfiles, setCareerProfiles] = useState<CareerProfile[]>([]);
  const [activeProfile, setActiveProfile] = useState<CareerProfile | null>(null);
  const [profileSkills, setProfileSkills] = useState<UserSkill[]>([]);

  const refreshCareerProfiles = useCallback(async () => {
    if (!authConnected) return null;
    try {
      const [profiles, skills] = await Promise.all([
        apiClient.getCareerProfiles(),
        apiClient.getUserSkills(),
      ]);
      setCareerProfiles(profiles);
      setProfileSkills(skills);
      const primary =
        profiles.find((p) => p.is_default) || profiles[0] || null;
      setActiveProfile(primary);
      return primary;
    } catch {
      return null;
    }
  }, [authConnected]);

  useEffect(() => {
    void refreshCareerProfiles();
  }, [refreshCareerProfiles]);

  const claimSkill = useCallback(
    async (tech: string) => {
      const trimmed = tech.trim();
      if (!trimmed) return;
      if (!authConnected) {
        notify.info('Please sign in to Jobby to manage your skills.');
        onSignIn?.();
        return;
      }

      try {
        // Plugin-claimed skills are stored separately and are scoring-only.
        // Never send resume_data from here: the extension may hold an older
        // profile snapshot and must not overwrite edits made in Settings.
        const addedSkill = await apiClient.addUserSkill(trimmed);
        setProfileSkills((current) => {
          const remaining = current.filter(
            (skill) => skill.id !== addedSkill.id,
          );
          return [...remaining, addedSkill];
        });

        // 1. Optimistic UI update: instantly mark as matched in local state
        setLatestPlan((prev) => {
          if (!prev?.plan) return prev;
          const currentMatched = prev.plan.decision.matched_terms || [];
          const alreadyMatched = currentMatched.some(
            (m) => m.toLowerCase() === trimmed.toLowerCase(),
          );
          if (alreadyMatched) return prev;
          const nextMatched = [...currentMatched, trimmed];
          const prevScore = prev.plan.candidate.match_score ?? 0.75;
          const newMatchScore = Math.min(
            1.0,
            Math.round((prevScore + 0.08) * 10000) / 10000,
          );
          const recency = prev.plan.candidate.recency_factor ?? 1.0;
          return {
            ...prev,
            plan: {
              ...prev.plan,
              candidate: {
                ...prev.plan.candidate,
                match_score: newMatchScore,
                skill_score: Math.min(
                  1.0,
                  (prev.plan.candidate.skill_score ?? 0.8) + 0.1,
                ),
                priority_score: Math.min(
                  1.0,
                  Math.round(newMatchScore * recency * 10000) / 10000,
                ),
              },
              decision: {
                ...prev.plan.decision,
                score: newMatchScore,
                matched_terms: nextMatched,
              },
            },
          };
        });

        notify.success(`Added "${trimmed}" to your profile skills!`);

        // Re-evaluate from backend to get authoritative plan and scores.
        const freshPlan = await createPlan();
        if (freshPlan && latestInspection?.kind === 'job') {
          void send({
            type: 'content.render-score-card',
            inspection: latestInspection,
            plan: freshPlan,
          }).catch(() => undefined);
        }
      } catch (err) {
        notify.error(
          err instanceof Error ? err.message : (
            `Failed to add "${trimmed}" to profile.`
          ),
        );
      }
    },
    [authConnected, onSignIn, createPlan, latestInspection],
  );

  const unclaimSkill = useCallback(
    async (tech: string) => {
      const trimmed = tech.trim();
      if (!trimmed) return;
      if (!authConnected) {
        notify.info('Please sign in to Jobby to manage your skills.');
        onSignIn?.();
        return;
      }

      try {
        await apiClient.deleteUserSkill(trimmed);
        setProfileSkills(await apiClient.getUserSkills());

        // 1. Optimistic UI update: remove from matched terms
        setLatestPlan((prev) => {
          if (!prev?.plan) return prev;
          const nextMatched = (
            prev.plan.decision.matched_terms || []
          ).filter((m) => m.toLowerCase() !== trimmed.toLowerCase());
          return {
            ...prev,
            plan: {
              ...prev.plan,
              decision: {
                ...prev.plan.decision,
                matched_terms: nextMatched,
              },
            },
          };
        });

        notify.success(`Removed "${trimmed}" from your profile.`);

        // Re-evaluate from backend.
        const freshPlan = await createPlan();
        if (freshPlan && latestInspection?.kind === 'job') {
          void send({
            type: 'content.render-score-card',
            inspection: latestInspection,
            plan: freshPlan,
          }).catch(() => undefined);
        }
      } catch (err) {
        notify.error(
          err instanceof Error ? err.message : (
            `Failed to remove "${trimmed}".`
          ),
        );
      }
    },
    [authConnected, onSignIn, createPlan, latestInspection],
  );

  return {
    latestPlan,
    planError,
    retryPlan,
    setLatestPlan,
    fillResults,
    unansweredFields,
    loadingButton,
    createPlan,
    applyPlanAction,
    autofillForm,
    fillAndNext,
    openLinkedIn,
    moveNext,
    movePrevious,
    submitApplication,
    recordApplication,
    autoRunLinkedIn,
    careerProfiles,
    activeProfile,
    profileSkills,
    refreshCareerProfiles,
    claimSkill,
    unclaimSkill,
  };
}
