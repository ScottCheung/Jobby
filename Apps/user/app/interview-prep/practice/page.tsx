/** @format */

'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import type { PlanTask } from '@/lib/types';
import { resolveApiBaseUrl } from '@/lib/runtime';
import { practiceCache } from './practice-cache';
import { PracticeSkeleton } from './_components/PracticeSkeleton';
import { getPlanQueue } from './practice-utils';
import { useConsole } from '@/components/ConsoleContext';

export default function PracticeIndexPage() {
  const router = useRouter();
  const { profile, hasLoadedInitialData } = useConsole();

  useEffect(() => {
    if (!hasLoadedInitialData) return;
    const redirectToFirstQuestion = async () => {
      try {
        const startTime = Date.now();
        
        // Fetch all in parallel to pre-populate the cache
        const [qs, prs, cats, plans, baseUrl] = await Promise.all([
          api.interviewQuestions(),
          api.practiceRecords(),
          api.interviewCategories(),
          api.practicePlans(),
          resolveApiBaseUrl(),
        ]);

        practiceCache.questions = qs;
        practiceCache.records = prs;
        practiceCache.categories = cats;
        practiceCache.apiBaseUrl = baseUrl;

        let planTasks: PlanTask[] = [];
        if (plans && plans.length > 0) {
          const plan = plans[0];
          practiceCache.activePlan = plan;
          planTasks = await api.planTasks(plan.id);
          practiceCache.planTasks = planTasks;
        } else {
          practiceCache.activePlan = null;
          practiceCache.planTasks = [];
        }

        if (qs.length === 0) {
          router.replace('/interview-prep/library');
          return;
        }

        // Restore last practice mode preference or default
        let savedPrefMode = '';
        const savedPref = profile.extra_data?.practiceModePreference;
        if (
          savedPref &&
          typeof savedPref === 'object' &&
          'mode' in savedPref &&
          typeof savedPref.mode === 'string'
        ) {
          savedPrefMode = savedPref.mode;
        }

        const hasPlan = plans && plans.length > 0;
        const mode = savedPrefMode || (hasPlan ? 'plan' : 'free');

        // Determine first question to display
        let targetId = qs[0].id;
        if (mode === 'plan' && planTasks.length > 0) {
          const queue = getPlanQueue(planTasks, qs);
          if (queue.length > 0) {
            targetId = queue[0].id;
          }
        }

        // Enforce minimum 500ms duration for skeleton display
        const elapsed = Date.now() - startTime;
        const minDuration = 500;
        if (elapsed < minDuration) {
          await new Promise((resolve) => setTimeout(resolve, minDuration - elapsed));
        }

        router.replace(`/interview-prep/practice/${targetId}?mode=${mode}`);
      } catch (err) {
        console.error('Failed to redirect to first question:', err);
      }
    };
    void redirectToFirstQuestion();
  }, [hasLoadedInitialData, profile.extra_data, router]);

  return <PracticeSkeleton />;
}
