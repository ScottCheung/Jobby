/** @format */

'use client';
import React, { useEffect, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import type {
  InterviewQuestion,
  PracticeRecord,
  PracticePlan,
  PlanTask,
  InterviewCategory,
  DailyQuest,
  Achievement,
  InterviewTag,
  InterviewCollection,
} from '@/lib/types';
import {
  CheckCircle2,
  TrendingUp,
  Target,
  Plus,
  Trash2,
  Calendar,
  Play,
  Sparkles,
  Search,
  BookOpen,
  Check,
  RotateCcw,
  Sliders,
  ChevronRight,
  Gem,
  Trophy,
  Loader2,
  Coins,
  Compass,
} from 'lucide-react';
import { cn, cleanName } from '@/lib/utils';
import { practiceCache } from './practice/practice-cache';

import { CustomizePlanModal } from './_components/CustomizePlanModal';
import { PlanSetupSection } from './_components/PlanSetupSection';
import { ActivityHeatmap } from './_components/ActivityHeatmap';
import { Button } from '@/components/UI/Button';
import { showGlobalToast } from '@/lib/toast';
import { showCelebrationEvent } from '@/lib/celebration';
import { useConfirmStore } from '@/lib/store/confirm-store';
import { useLayoutStore } from '@/lib/store/layout-store';
import { BatchImportModal } from './library/_components/BatchImportModal';
import { FloatingWelcomeCard } from './_components/FloatingWelcomeCard';
import { CollectionCard } from './collections/_components/CollectionCard';
import { div } from 'framer-motion/client';

const formatShortDate = (value?: string | null) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });
};

const getQuestTheme = (questType: string) => {
  if (questType.startsWith('application')) {
    return {
      chip: 'bg-sky-500/10 text-sky-600 dark:text-sky-300',
      bar: 'bg-sky-500',
      label: 'Apply',
    };
  }
  if (questType.startsWith('streak')) {
    return {
      chip: 'bg-amber-500/10 text-amber-600 dark:text-amber-300',
      bar: 'bg-amber-500',
      label: 'Streak',
    };
  }
  if (questType.startsWith('checkin')) {
    return {
      chip: 'bg-success/10 text-success',
      bar: 'bg-success/10',
      label: 'Check-in',
    };
  }
  return {
    chip: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-300',
    bar: 'bg-emerald-500',
    label: 'Practice',
  };
};

export default function InterviewPrepPage() {
  const router = useRouter();
  const pathname = usePathname();

  // Core Data States
  const [questions, setQuestions] = useState<InterviewQuestion[]>([]);
  const [practiceRecords, setPracticeRecords] = useState<PracticeRecord[]>([]);
  const [categories, setCategories] = useState<InterviewCategory[]>([]);
  const [collections, setCollections] = useState<InterviewCollection[]>([]);
  const [tags, setTags] = useState<InterviewTag[]>([]);
  const [isLoadingCollections, setIsLoadingCollections] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [isBatchImportOpen, setIsBatchImportOpen] = useState(false);
  const [showWelcomeCard, setShowWelcomeCard] = useState(false);

  // Gamification States
  const [dailySummary, setDailySummary] = useState<any>(null);
  const [heatmapData, setHeatmapData] = useState<any>(null);
  const [dailyQuests, setDailyQuests] = useState<DailyQuest[]>([]);
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [isCheckingIn, setIsCheckingIn] = useState(false);
  const [isOpeningBox, setIsOpeningBox] = useState(false);
  const [openedCoins, setOpenedCoins] = useState<number | null>(null);
  const [welcomeCoins, setWelcomeCoins] = useState<number | null>(null);
  const welcomeCheckedRef = useRef(false);

  // Plans & Tasks States
  const [activePlan, setActivePlan] = useState<PracticePlan | null>(null);
  const [planTasks, setPlanTasks] = useState<PlanTask[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreatingPlan, setIsCreatingPlan] = useState(false);

  const confirm = useConfirmStore((state) => state.confirm);
  const addNotification = useLayoutStore(
    (state) => state.actions.addNotification,
  );

  // Plan creation form states
  const [selectedPreset, setSelectedPreset] = useState<
    'sprint' | 'tactical' | 'master'
  >('tactical');
  const [isCustomizeOpen, setIsCustomizeOpen] = useState(false);

  const initData = async (forceRefetch = false, silent = false) => {
    if (practiceCache.questions && !forceRefetch) {
      setQuestions(practiceCache.questions);
      window.dispatchEvent(new CustomEvent('jobby:libraryCountUpdated', { detail: practiceCache.questions.length }));
      setPracticeRecords(practiceCache.records || []);
      setCategories(practiceCache.categories || []);
      setActivePlan(practiceCache.activePlan);
      setPlanTasks(practiceCache.planTasks || []);
      setIsLoading(false);

      // Load gamification data in background (SWR) so dashboard UI loads instantly
      try {
        const [summary, heatmap, quests, achs, colData, tagsData] =
          await Promise.all([
            api.gamificationSummary(),
            api.gamificationHeatmap(),
            api.dailyQuests(),
            api.achievements(),
            api.interviewCollections().catch(() => []),
            api.interviewTags().catch(() => []),
          ]);
        setDailySummary(summary);
        setHeatmapData(heatmap);
        setDailyQuests(quests);
        setAchievements(achs);
        setCollections(colData);
        setTags(tagsData);
      } catch (e) {}
      return;
    }

    if (!silent) {
      setIsLoading(true);
      setIsLoadingCollections(true);
    }
    const startTime = Date.now();
    try {
      const [qs, prs, cats, plans, colData, tagsData] = await Promise.all([
        api.interviewQuestions(),
        api.practiceRecords(),
        api.interviewCategories(),
        api.practicePlans(),
        api.interviewCollections().catch(() => []),
        api.interviewTags().catch(() => []),
      ]);

      practiceCache.questions = qs;
      practiceCache.records = prs;
      practiceCache.categories = cats;

      setQuestions(qs);
      window.dispatchEvent(new CustomEvent('jobby:libraryCountUpdated', { detail: qs.length }));
      setPracticeRecords(prs);
      setCategories(cats);
      setCollections(colData);
      setTags(tagsData);

      let activePlan: PracticePlan | null = null;
      let tasks: PlanTask[] = [];
      if (plans && plans.length > 0) {
        activePlan = plans[0];
        practiceCache.activePlan = activePlan;
        tasks = await api.planTasks(activePlan.id);
        practiceCache.planTasks = tasks;
      } else {
        practiceCache.activePlan = null;
        practiceCache.planTasks = [];
      }

      setActivePlan(activePlan);
      setPlanTasks(tasks);

      try {
        const [summary, heatmap, quests, achs] = await Promise.all([
          api.gamificationSummary(),
          api.gamificationHeatmap(),
          api.dailyQuests(),
          api.achievements(),
        ]);
        setDailySummary(summary);
        setHeatmapData(heatmap);
        setDailyQuests(quests);
        setAchievements(achs);
      } catch (e) {
        console.error('Failed to load gamification data', e);
      }
    } catch (err) {
      console.error('Failed to initialize prep dashboard:', err);
    } finally {
      const elapsed = Date.now() - startTime;
      const minDuration = 500; // 0.5 seconds
      if (!silent && elapsed < minDuration) {
        await new Promise((resolve) =>
          setTimeout(resolve, minDuration - elapsed),
        );
      }
      if (!silent) {
        setIsLoading(false);
        setIsLoadingCollections(false);
      }
    }
  };

  useEffect(() => {
    void initData(true);
  }, [pathname]);

  useEffect(() => {
    const syncDashboard = () => void initData(true, true);
    window.addEventListener('playbookLibraryUpdated', syncDashboard);
    return () =>
      window.removeEventListener('playbookLibraryUpdated', syncDashboard);
  }, []);

  useEffect(() => {
    if (welcomeCheckedRef.current) return;
    welcomeCheckedRef.current = true;
    const claimWelcomeBonus = async () => {
      try {
        const res = await api.welcomeBonus();
        if (!res.awarded) return;
        setWelcomeCoins(res.coins_earned);
        setShowWelcomeCard(true);
        setDailySummary((prev: any) => ({
          ...prev,
          total_coins: (prev?.total_coins || 0) + res.coins_earned,
          coins_gained_today:
            (prev?.coins_gained_today || 0) + res.coins_earned,
        }));
        showGlobalToast(`Welcome bonus: +${res.coins_earned} coins`);
        window.dispatchEvent(new Event('playbookGamificationUpdated'));
      } catch (err) {
        console.error('Failed to claim welcome bonus:', err);
      }
    };
    void claimWelcomeBonus();
  }, []);

  const handleImportOwnQuestions = () => {
    router.push('/interview-prep/library');
  };

  const handleAddCollection = async (collection: InterviewCollection) => {
    setActiveId(collection.id);
    try {
      if (collection.price_coins > 0 && !collection.is_purchased) {
        const ok = await confirm({
          title: 'Purchase collection?',
          message: `This will spend ${collection.price_coins} coins to add ${collection.title} to your library.`,
          confirmLabel: 'Buy & Add',
          cancelLabel: 'Cancel',
        });
        if (!ok) return;
      }
      const result = await api.addCollectionToLibrary(collection.id);
      await initData(true, true);
      window.dispatchEvent(new Event('playbookLibraryUpdated'));
      showGlobalToast(
        result.questions_added > 0 ?
          `${result.questions_added} questions added to your library`
        : 'This collection is already in your library',
      );
    } catch (actionError) {
      showGlobalToast(
        actionError instanceof Error ?
          actionError.message
        : 'Could not add collection.',
      );
    } finally {
      setActiveId(null);
    }
  };

  const handleRemoveCollection = async (collection: InterviewCollection) => {
    const ok = await confirm({
      title: 'Remove Collection from Library?',
      message: `Are you sure you want to remove "${collection.title}" from your library?`,
      confirmLabel: 'Remove from Library',
      cancelLabel: 'Cancel',
    });
    if (!ok) return;

    setActiveId(collection.id);
    try {
      await api.removeCollectionFromLibrary(collection.id);
      await initData(true, true);
      showGlobalToast('Collection removed from your library');
      window.dispatchEvent(new Event('playbookLibraryUpdated'));
    } catch (actionError) {
      showGlobalToast(
        actionError instanceof Error ?
          actionError.message
        : 'Could not remove collection.',
      );
    } finally {
      setActiveId(null);
    }
  };

  const isStep1Done = questions.length > 0;
  const isStep2Done = !!activePlan;
  const showOnboardingStepper = !isStep1Done || !isStep2Done;

  const renderOnboardingStepper = () => {
    return (
      <div className='flex flex-col md:flex-row  justify-between gap-6 panel-xl'>
        <div className='absolute left-0 top-0 w-1.5 h-full bg-primary/40' />
        <div className='flex-1 flex flex-col justify-center max-w-sm shrink-0 border-r border-border/40 pr-6 gap-1'>
          <Sparkles className='w-7 h-7 text-primary mb-2' />
          <h3 className='title-sub flex items-center gap-2'>
            1 Min Quick Start
          </h3>
          <p className='body-sm text-ink-secondary'>
            Follow the 2 steps below to build your question Library and create a
            plan to start practice.
          </p>
        </div>

        <div className='flex-1 flex flex-col gap-6 md:flex-row md:items-start md:gap-2 pl-4 md:pl-0'>
          {/* Step 1 */}
          {/* <div className='hidden md:block w-4 h-12 bg-primary/20 self-end' /> */}
          <div className='flex-1 col'>
            <div
              className={cn(
                'label w-8 h-8 rounded-full flex items-center justify-center shrink-0 border-2 transition-all',
                isStep1Done ?
                  'bg-emerald-500/10 text-emerald-500 border-emerald-500'
                : 'bg-primary/10 text-primary border-primary animate-pulse',
              )}
            >
              {isStep1Done ? '✓' : '1'}
            </div>
            <div className='flex-1 min-w-0'>
              <h4
                className={cn(
                  'label',
                  isStep1Done ?
                    'text-ink-secondary line-through'
                  : 'text-ink-primary',
                )}
              >
                Step 1: Build Your Personal Library
              </h4>
              <p className='body-sm text-ink-secondary mt-1'>
                One-click add recommended question sets or import custom
                questions.
              </p>
              <span
                onClick={() => router.push('/interview-prep/library')}
                className='inline-block text-[10px] text-primary font-bold hover:underline cursor-pointer mt-1.5'
              >
                Manage your question bank in Library →
              </span>
            </div>
          </div>

          {/* Divider */}
          {/* <div className='hidden md:block w-2 h-12 bg-primary/20 self-center' /> */}

          {/* Step 2 */}
          <div className='flex-1 col'>
            <div
              className={cn(
                'label w-8 h-8 rounded-full flex items-center justify-center shrink-0 border-2 transition-all',
                isStep2Done ?
                  'bg-emerald-500/10 text-emerald-500 border-emerald-500'
                : isStep1Done ?
                  'bg-primary/10 text-primary border-primary animate-pulse'
                : 'bg-background-secondary text-ink-muted border-border dark:bg-background-secondary/40',
              )}
            >
              {isStep2Done ? '✓' : '2'}
            </div>
            <div className='flex-1 min-w-0'>
              <h4
                className={cn(
                  'label',
                  isStep2Done ? 'text-ink-secondary line-through'
                  : isStep1Done ? 'text-ink-primary'
                  : 'text-ink-secondary',
                )}
              >
                Step 2: Create Your Learning Plan
              </h4>
              <p className='body-sm text-ink-secondary mt-1'>
                Once your question bank is ready, set your daily goals and study
                cycle.
              </p>
              <span
                onClick={() => router.push('/interview-prep/schedule')}
                className='inline-block text-[10px] text-primary font-bold hover:underline cursor-pointer mt-1.5'
              >
                Manage your plan in Schedule →
              </span>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const handleCreatePlan = async (settings?: {
    name: string;
    duration: number;
    spacedRepetition: boolean;
    questionLimitEnabled: boolean;
    questionLimit: number;
    selectionMethod: 'smart' | 'manual';
    focusedCategories: string[];
    manuallySelectedQuestionIds: string[];
  }) => {
    setIsCreatingPlan(true);
    const isFirstPlan = !activePlan;
    try {
      let planName = '';
      let targetDays = 14;
      let dailyQsCount = 3;
      let planQuestions: InterviewQuestion[] = [];
      let isSpacedRepetition = true;

      if (settings) {
        // Custom Plan Mode
        planName = settings.name;
        targetDays = settings.duration;
        isSpacedRepetition = settings.spacedRepetition;

        let filtered = questions;
        if (settings.focusedCategories.length > 0) {
          filtered = questions.filter(
            (q) =>
              q.category_id &&
              settings.focusedCategories.includes(q.category_id),
          );
        }

        if (settings.selectionMethod === 'manual') {
          planQuestions = questions.filter((q) =>
            settings.manuallySelectedQuestionIds.includes(q.id),
          );
        } else {
          // Smart Select: prioritize by importance
          planQuestions = [...filtered].sort(
            (a, b) => (b.importance_score ?? 0) - (a.importance_score ?? 0),
          );
        }

        // Apply question limit in Custom Mode if enabled
        if (settings.questionLimitEnabled) {
          planQuestions = planQuestions.slice(
            0,
            Math.min(settings.questionLimit, planQuestions.length),
          );
        }

        dailyQsCount = Math.max(
          1,
          Math.ceil(planQuestions.length / targetDays),
        );
      } else {
        // Preset Mode (Sprint, Tactical, Master)
        isSpacedRepetition = true; // Preset plans use spaced repetition by default
        if (selectedPreset === 'sprint') {
          planName = `🚀 7-Day Sprint Interview Prep`;
          targetDays = 7;
          dailyQsCount = 3;
          planQuestions = questions.filter(
            (q) => (q.importance_score ?? 0) >= 4 || q.frequency === 'High',
          );
        } else if (selectedPreset === 'tactical') {
          planName = `🎯 14-Day Tactical Booster`;
          targetDays = 14;
          dailyQsCount = 2;
          planQuestions = [...questions].sort(
            (a, b) => (b.importance_score ?? 0) - (a.importance_score ?? 0),
          );
        } else {
          planName = `🏆 30-Day Interview Master`;
          targetDays = 30;
          dailyQsCount = 2;
          planQuestions = questions;
        }
      }

      if (planQuestions.length === 0) {
        alert(
          'We could not find any questions for the plan. Please select at least one question or check your filters.',
        );
        setIsCreatingPlan(false);
        return;
      }

      // 2. Create the practice plan
      const plan = await api.createPracticePlan({
        name: planName,
        target_days: targetDays,
        daily_questions_count: dailyQsCount,
      });

      // 3. Allocate questions across plan days with Spaced Repetition Review support
      const totalQuestionsCount = planQuestions.length;
      for (let i = 0; i < totalQuestionsCount; i++) {
        const q = planQuestions[i];

        // Find base day index to introduce this question
        const baseDayIndex = Math.min(
          Math.floor(i / dailyQsCount),
          targetDays - 1,
        );

        // Schedule initial practice task
        const scheduledDate = new Date();
        scheduledDate.setDate(scheduledDate.getDate() + baseDayIndex);
        await api.createPlanTask(plan.id, {
          plan_id: plan.id,
          question_id: q.id,
          scheduled_date: scheduledDate.toISOString(),
          status: 'pending',
        });

        // If Spaced Repetition is active, schedule reviews on Day +1, Day +3, Day +7, Day +14 relative to base day
        if (isSpacedRepetition) {
          const reviewIntervals = [1, 3, 7, 14];
          for (const interval of reviewIntervals) {
            const reviewDayIndex = baseDayIndex + interval;
            // Only schedule if within plan timeline bounds
            if (reviewDayIndex < targetDays) {
              const reviewScheduledDate = new Date();
              reviewScheduledDate.setDate(
                reviewScheduledDate.getDate() + reviewDayIndex,
              );

              await api.createPlanTask(plan.id, {
                plan_id: plan.id,
                question_id: q.id,
                scheduled_date: reviewScheduledDate.toISOString(),
                status: 'pending',
              });
            }
          }
        }
      }

      // Reload data
      await initData(true, true);
      window.dispatchEvent(new Event('playbookPlanChanged'));
      if (isFirstPlan) {
        showGlobalToast('Quest and Badges unlocked');
        showCelebrationEvent('quest_unlocked');
      }
      setIsCustomizeOpen(false); // Close custom modal if open
    } catch (err) {
      console.error('Failed to create plan:', err);
    } finally {
      setIsCreatingPlan(false);
    }
  };

  const handleDeletePlan = async () => {
    if (!activePlan) return;
    const confirm = window.confirm(
      'Are you sure you want to delete this prep plan? All progress history on this specific plan timeline will be lost.',
    );
    if (!confirm) return;

    setIsLoading(true);
    try {
      try {
        await api.deletePracticePlan(activePlan.id);
      } catch (err) {
        console.error('Failed to delete primary active plan:', err);
      }

      // Delete any residual/legacy plans from history to ensure setup screen loads properly
      try {
        const remainingPlans = await api.practicePlans();
        if (remainingPlans && remainingPlans.length > 0) {
          for (const p of remainingPlans) {
            try {
              await api.deletePracticePlan(p.id);
            } catch (err) {
              console.error('Failed to delete legacy plan:', p.id, err);
            }
          }
        }
      } catch (err) {
        console.error('Failed to clear residual plans:', err);
      }

      practiceCache.activePlan = null;
      practiceCache.planTasks = [];
      setActivePlan(null);
      setPlanTasks([]);
      window.dispatchEvent(new Event('playbookPlanChanged'));
    } catch (err) {
      console.error('Failed to delete plan:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggleTaskStatus = async (task: PlanTask) => {
    if (!activePlan) return;
    const newStatus = task.status === 'completed' ? 'pending' : 'completed';

    setPlanTasks((prev) => {
      const updated = prev.map((t) =>
        t.id === task.id ? { ...t, status: newStatus } : t,
      );
      practiceCache.planTasks = updated;
      return updated;
    });

    try {
      await api.updatePlanTask(activePlan.id, task.id, { status: newStatus });
    } catch (err) {
      console.error('Failed to update task status:', err);
      setPlanTasks((prev) => {
        const reverted = prev.map((t) =>
          t.id === task.id ? { ...t, status: task.status } : t,
        );
        practiceCache.planTasks = reverted;
        return reverted;
      });
    }
  };

  const masteredCount = practiceRecords.filter(
    (r) => (r.confidence_score ?? 0) >= 4,
  ).length;

  const getTodayTasks = () => {
    if (!activePlan || planTasks.length === 0) return [];

    // Sort tasks to identify review tasks sequentially
    const sortedTasks = [...planTasks].sort(
      (a, b) =>
        new Date(a.scheduled_date).getTime() -
        new Date(b.scheduled_date).getTime(),
    );

    const todayStr = new Date().toDateString();
    const todays = sortedTasks.filter(
      (t) => new Date(t.scheduled_date).toDateString() === todayStr,
    );

    // If today is empty but the plan has pending tasks, return the earliest pending tasks
    if (todays.length === 0) {
      const pendings = sortedTasks.filter((t) => t.status === 'pending');
      if (pendings.length > 0) {
        const earliestDate = new Date(
          Math.min(
            ...pendings.map((t) => new Date(t.scheduled_date).getTime()),
          ),
        ).toDateString();
        return sortedTasks.filter(
          (t) => new Date(t.scheduled_date).toDateString() === earliestDate,
        );
      }
    }
    return todays;
  };

  // Helper to check if a task is a review task (i.e., not the first time this question appears)
  const isReviewTask = (task: PlanTask) => {
    const sorted = [...planTasks].sort(
      (a, b) =>
        new Date(a.scheduled_date).getTime() -
        new Date(b.scheduled_date).getTime(),
    );
    const index = sorted.findIndex((t) => t.id === task.id);
    if (index === -1) return false;

    // Check if there is any earlier task with the same question_id
    for (let i = 0; i < index; i++) {
      if (sorted[i].question_id === task.question_id) {
        return true;
      }
    }
    return false;
  };
  const handleCheckIn = async () => {
    if (isCheckingIn || dailySummary?.has_checked_in_today) return;
    setIsCheckingIn(true);
    try {
      const res = await api.gamificationCheckin();
      // Optimistically update
      setDailySummary((prev: any) => ({
        ...prev,
        has_checked_in_today: true,
        total_xp: (prev?.total_xp || 0) + res.xp_earned,
        loot_boxes: (prev?.loot_boxes || 0) + res.loot_boxes_earned,
        total_coins: (prev?.total_coins || 0) + res.coins_earned,
        coins_gained_today: (prev?.coins_gained_today || 0) + res.coins_earned,
      }));
      if (
        res.xp_earned > 0 ||
        res.coins_earned > 0 ||
        res.loot_boxes_earned > 0
      ) {
        showCelebrationEvent('daily_checkin');
      }
      window.dispatchEvent(new Event('playbookGamificationUpdated'));
    } catch (e) {
      console.error(e);
    } finally {
      setIsCheckingIn(false);
    }
  };

  const handleOpenBox = async () => {
    if (isOpeningBox || (dailySummary?.loot_boxes || 0) <= 0) return;
    setIsOpeningBox(true);
    try {
      const res = await api.openLootBox();
      setOpenedCoins(res.coins_won);
      setDailySummary((prev: any) => ({
        ...prev,
        loot_boxes: Math.max(0, (prev?.loot_boxes || 0) - 1),
        coins_gained_today: (prev?.coins_gained_today || 0) + res.coins_won,
        total_coins: (prev?.total_coins || 0) + res.coins_won,
      }));
      setTimeout(() => setOpenedCoins(null), 3000);
      showCelebrationEvent(
        'loot_box_opened',
        `Loot box: +${res.coins_won} coins`,
      );
      window.dispatchEvent(new Event('playbookGamificationUpdated'));
    } catch (e) {
      console.error(e);
    } finally {
      setIsOpeningBox(false);
    }
  };

  const handleClaimQuest = async (questId: string) => {
    try {
      const res = await api.claimQuest(questId);
      setDailyQuests((quests) =>
        quests.map((q) => (q.id === questId ? { ...q, is_claimed: true } : q)),
      );
      setDailySummary((prev: any) => ({
        ...prev,
        loot_boxes: (prev?.loot_boxes || 0) + res.loot_boxes_earned,
        total_xp: (prev?.total_xp || 0) + res.xp_earned,
        total_coins: (prev?.total_coins || 0) + res.coins_earned,
        coins_gained_today: (prev?.coins_gained_today || 0) + res.coins_earned,
      }));
      if (
        res.xp_earned > 0 ||
        res.coins_earned > 0 ||
        res.loot_boxes_earned > 0
      ) {
        showCelebrationEvent('reward_claimed', 'Quest reward claimed');
      }
      window.dispatchEvent(new Event('playbookGamificationUpdated'));
    } catch (e) {
      console.error(e);
    }
  };

  const handleResetAccount = async () => {
    const confirm = window.confirm(
      'This will permanently delete all data for the current account, including library, questions, practice, gamification, and applications. The protected admin account is not affected. Continue?',
    );
    if (!confirm) return;

    try {
      await api.resetGamification();
      showGlobalToast('Test account reset, including library data.');
      // Force reload data
      window.location.reload();
    } catch (e) {
      console.error(e);
      alert('Failed to reset account data');
    }
  };

  if (isLoading) {
    return <DashboardSkeleton />;
  }

  // Calculate completed stats
  const totalTasksCount = planTasks.length;
  const completedTasksCount = planTasks.filter(
    (t) => t.status === 'completed',
  ).length;
  const unlockedAchievements = achievements.filter(
    (achievement) => achievement.unlocked,
  );
  const recentAchievements = unlockedAchievements.slice(0, 3);
  const progressPercent =
    totalTasksCount > 0 ?
      Math.round((completedTasksCount / totalTasksCount) * 100)
    : 0;

  const InActiveCard =
    'border-ink-secondary/40 dark:border-border/60 bg-background-secondary/10';
  return (
    <div className='flex flex-col gap-6 pb-8 pr-1'>
      {/* Dev Reset Action */}
      <div className='flex justify-end'>
        <button
          onClick={handleResetAccount}
          className='label-sm px-3 py-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 border border-rose-500/20 active:scale-95 transition-transform cursor-pointer'
        >
          Reset All My Data (Dev Only)
        </button>
      </div>

      {showWelcomeCard && welcomeCoins && (
        <FloatingWelcomeCard
          welcomeCoins={welcomeCoins}
          onClose={() => setShowWelcomeCard(false)}
        />
      )}

      {showOnboardingStepper && renderOnboardingStepper()}

      {/* 1. Empty Library State (Curated Collections Grid) */}
      {questions.length === 0 && (
        <div className='panel-xl flex flex-col gap-6 p-6 animate-in fade-in duration-500 text-left'>
          <div className='flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border/40 pb-4'>
            <div>
              <h3 className='title-card flex items-center gap-2'>
                <Compass className='w-5 h-5 text-primary' />
                Your Question Library is Empty
              </h3>
              <p className='body-md text-ink-secondary mt-1'>
                Build your practice base from curated collections below, or
                import your own questions.
              </p>
            </div>

            <div className='col'>
              <Button
                layoutId='Import Questions'
                variant={'outline'}
                onClick={() => setIsBatchImportOpen(true)}
                size='md'
                // className='label flex items-center gap-2 rounded-xl border border-border/60 bg-background px-4! py-2! transition hover:border-primary/30 hover:text-primary'
              >
                Import Questions
              </Button>
              <button
                onClick={() => router.push('/interview-prep/collections')}
                className='label-sm flex items-center gap-1 text-primary hover:underline'
              >
                Browse Collections <ChevronRight className='w-4 h-4' />
              </button>
            </div>
          </div>

          {/* Flex-auto list of Collections */}
          {isLoadingCollections ?
            <div className='body-md flex items-center justify-center py-12 gap-2 text-ink-secondary'>
              <Loader2 className='w-4 h-4 animate-spin text-primary' />
              Loading recommended collections...
            </div>
          : collections.length === 0 ?
            <div className='body-md text-center py-12 text-ink-secondary italic'>
              No recommended collections found.
            </div>
          : <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4'>
              {collections.map((col) => (
                <CollectionCard
                  key={col.id}
                  collection={col}
                  onAdd={handleAddCollection}
                  onRemove={handleRemoveCollection}
                  isLoading={activeId === col.id}
                />
              ))}
            </div>
          }
        </div>
      )}

      {/* 2. Plan Selection / Setup Screen (No Active Plan) */}
      {questions.length > 0 && !activePlan && (
        <div className='panel-xl'>
          <PlanSetupSection
            questions={questions}
            selectedPreset={selectedPreset}
            setSelectedPreset={setSelectedPreset}
            setIsCustomizeOpen={setIsCustomizeOpen}
            handleCreatePlan={handleCreatePlan}
            isCreatingPlan={isCreatingPlan}
          />
        </div>
      )}

      {/* 3. Header Metrics Grid - Gamification UI */}
      <div className='grid grid-cols-2 md:grid-cols-4 gap-6'>
        <div className='card flex flex-col justify-between group relative overflow-hidden'>
          <div className='absolute right-0 top-0 w-24 h-24 bg-amber-500/5 rounded-full blur-2xl group-hover:bg-amber-500/10 transition-colors' />

          <div>
            <div className='flex items-center gap-2 text-ink-secondary mb-1'>
              <span className='title-card'>🔥</span>
              <h3 className='label'>Current Streak</h3>
            </div>
            <div className='flex items-end gap-1'>
              <p className='title-page text-amber-600 dark:text-amber-500'>
                {dailySummary?.current_streak || 0}
              </p>
              <span className='label text-ink-secondary mb-1'>Days</span>
            </div>
          </div>

          <button
            onClick={handleCheckIn}
            disabled={dailySummary?.has_checked_in_today || isCheckingIn}
            className={`mt-4 w-full py-2 rounded-lg label flex justify-center items-center gap-2 transition-all ${
              dailySummary?.has_checked_in_today ?
                'bg-background-secondary/50 text-ink-secondary cursor-not-allowed'
              : 'bg-amber-500 hover:bg-amber-600 text-white shadow-[0_0_15px_rgba(245,158,11,0.3)]'
            }`}
          >
            {isCheckingIn ?
              <Loader2 className='w-4 h-4 animate-spin' />
            : null}
            {dailySummary?.has_checked_in_today ?
              'Checked In'
            : 'Claim Daily Check-in'}
          </button>
        </div>

        <div className='card group'>
          <div className='absolute right-0 top-0 w-24 h-24 bg-primary/5 rounded-full blur-2xl group-hover:bg-primary/10 transition-colors' />
          <div className='flex items-center justify-between mb-1 relative'>
            <div className='flex items-center gap-2 text-ink-secondary'>
              <span className='title-card'>⭐</span>
              <h3 className='label'>Level {dailySummary?.level || 1}</h3>
            </div>
            <span className='label-sm text-primary bg-primary/10 px-2 py-0.5 rounded'>
              {dailySummary?.total_xp || 0} XP
            </span>
          </div>

          <div className='mt-3 relative'>
            <div className='flex items-center justify-between text-[10px] font-bold text-ink-secondary uppercase tracking-wider mb-1.5'>
              <span>Progress</span>
              <span>
                {dailySummary?.total_xp || 0} /{' '}
                {dailySummary?.next_level_xp || 100} XP
              </span>
            </div>
            <div className='h-2 w-full bg-background-secondary rounded-full overflow-hidden'>
              <div
                className='h-full bg-primary rounded-full transition-all duration-500 ease-out relative overflow-hidden'
                style={{
                  width: `${Math.min(100, Math.max(0, ((dailySummary?.total_xp || 0) / (dailySummary?.next_level_xp || 100)) * 100))}%`,
                }}
              >
                <div
                  className='absolute inset-0 bg-white/20'
                  style={{
                    transform: 'skewX(-20deg)',
                    animation: 'shimmer 2s infinite',
                  }}
                />
              </div>
            </div>
          </div>
          {dailySummary?.max_daily_xp_gain != null && (
            <div className='mt-2 relative'>
              <div className='flex items-center justify-between text-[10px] font-bold text-ink-secondary uppercase tracking-wider mb-1'>
                <span>Daily XP Budget</span>
                <span>
                  {dailySummary?.xp_gained_today || 0} /{' '}
                  {dailySummary.max_daily_xp_gain} XP
                </span>
              </div>
              <div className='h-1.5 w-full bg-background-secondary rounded-full overflow-hidden'>
                <div
                  className='h-full rounded-full transition-all duration-500 ease-out'
                  style={{
                    width: `${Math.min(100, Math.max(0, ((dailySummary?.xp_gained_today || 0) / (dailySummary.max_daily_xp_gain || 1)) * 100))}%`,
                    backgroundColor:
                      (
                        (dailySummary?.xp_gained_today || 0) /
                          (dailySummary.max_daily_xp_gain || 1) >=
                        0.9
                      ) ?
                        '#ef4444'
                      : '#22c55e',
                  }}
                />
              </div>
            </div>
          )}
        </div>

        <div className='card group relative overflow-hidden'>
          <div className='absolute right-0 top-0 w-24 h-24 bg-yellow-500/5 rounded-full blur-2xl group-hover:bg-yellow-500/10 transition-colors' />
          <div className='flex items-center gap-2 text-ink-secondary mb-1'>
            <span className='title-card'>🪙</span>
            <h3 className='label'>Total Coins</h3>
          </div>
          <div className='flex items-end justify-between'>
            <p className='title-page text-yellow-600 dark:text-yellow-400'>
              {dailySummary?.total_coins || 0}
            </p>
            {dailySummary?.coins_gained_today > 0 && (
              <span className='label-sm text-emerald-500 mb-1'>
                +{dailySummary.coins_gained_today} today
              </span>
            )}
          </div>
          {dailySummary?.max_daily_coin_gain != null && (
            <div className='mt-2'>
              <div className='flex items-center justify-between text-[10px] font-bold text-ink-secondary uppercase tracking-wider mb-1'>
                <span>Daily Coin Budget</span>
                <span>
                  {dailySummary?.coins_gained_today || 0} /{' '}
                  {dailySummary.max_daily_coin_gain}
                </span>
              </div>
              <div className='h-1.5 w-full bg-background-secondary rounded-full overflow-hidden'>
                <div
                  className='h-full rounded-full transition-all duration-500 ease-out'
                  style={{
                    width: `${Math.min(100, Math.max(0, ((dailySummary?.coins_gained_today || 0) / (dailySummary.max_daily_coin_gain || 1)) * 100))}%`,
                    backgroundColor:
                      (
                        (dailySummary?.coins_gained_today || 0) /
                          (dailySummary.max_daily_coin_gain || 1) >=
                        0.9
                      ) ?
                        '#ef4444'
                      : '#eab308',
                  }}
                />
              </div>
            </div>
          )}
        </div>

        <div className='card'>
          <div className='absolute right-0 top-0 w-24 h-24 bg-purple-500/5 rounded-full blur-2xl group-hover:bg-purple-500/10 transition-colors' />
          <div className='flex items-center gap-2 text-ink-secondary mb-1'>
            <BookOpen className='w-4 h-4 text-purple-500' />
            <h3 className='label'>Library & Mastery</h3>
          </div>
          <div className='label flex flex-col gap-1 mt-1'>
            <div className='flex justify-between items-center'>
              <span className='text-ink-secondary'>Total Qs:</span>
              <span className='text-ink-primary'>{questions.length}</span>
            </div>
            <div className='flex justify-between items-center'>
              <span className='text-ink-secondary'>Mastered:</span>
              <span className='text-purple-600 dark:text-purple-400'>
                {masteredCount}
              </span>
            </div>
          </div>
        </div>
      </div>
      {/* 3. Active Plan Dashboard View */}
      {questions.length > 0 && activePlan && (
        <div className='grid grid-cols-6 gap-6'>
          {/* Column 1 (Span 2): Today's Checklist */}
          <div className='col-span-6 md:col-span-3 lg:col-span-2 flex flex-col gap-6'>
            <div className='panel-xl gap-4 min-h-[350px]'>
              <div className='flex items-start justify-between border-b border-border/40 pb-3'>
                <div className='flex items-start gap-3'>
                  <div>
                    <h3 className='title-card flex items-center gap-2'>
                      Today's Mission
                    </h3>
                  </div>
                </div>
              </div>

              <div className='flex-1 flex flex-col gap-4 '>
                {getTodayTasks().length === 0 ?
                  <div className='flex-1 flex flex-col items-center justify-center text-center p-6 text-ink-primary0 gap-2 border border-dashed border-border/40 rounded-xl bg-background-secondary/20 my-6'>
                    <CheckCircle2 className='w-10 h-10 text-emerald-500 opacity-80' />
                    <p className='title-card'>Mission Accomplished!</p>
                    <p className='body-md text-ink-secondary'>
                      You've completed all scheduled questions for today.
                    </p>
                  </div>
                : <div className='flex flex-col h-full justify-between gap-6'>
                    <div className='flex flex-col gap-3'>
                      {getTodayTasks().map((task, idx) => {
                        const questionObj = questions.find(
                          (q) => q.id === task.question_id,
                        );
                        if (!questionObj) return null;
                        const isCompleted = task.status === 'completed';
                        const isReview = isReviewTask(task);

                        return (
                          <div
                            key={task.id}
                            className={cn(
                              'flex items-center gap-3 p-3 rounded-xl border transition-all',
                              isCompleted ?
                                'bg-background-secondary/30 border-border/40/40 opacity-60'
                              : 'bg-panel border-border dark:border-border',
                            )}
                          >
                            <div className='label-sm w-6 h-6 rounded-full bg-background-secondary flex items-center justify-center shrink-0'>
                              {idx + 1}
                            </div>
                            <div className='flex flex-col flex-1'>
                              <div className='flex items-center gap-2'>
                                <span
                                  className={cn(
                                    'label line-clamp-1',
                                    isCompleted && 'line-through',
                                  )}
                                >
                                  {questionObj.title}
                                </span>
                                {isReview && (
                                  <span className='px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-500/10 text-blue-600 dark:text-blue-400 shrink-0'>
                                    Review
                                  </span>
                                )}
                              </div>
                            </div>
                            {isCompleted && (
                              <CheckCircle2 className='w-5 h-5 text-emerald-500' />
                            )}
                          </div>
                        );
                      })}
                    </div>

                    {getTodayTasks().filter((t) => t.status !== 'completed')
                      .length > 0 && (
                      <Button
                        Icon={Play}
                        onClick={() => {
                          const firstPending = getTodayTasks().find(
                            (t) => t.status !== 'completed',
                          );
                          if (firstPending) {
                            router.push(
                              `/interview-prep/practice/${firstPending.question_id}`,
                            );
                          }
                        }}
                        className='h-[58px] flex items-center justify-center gap-2'
                      >
                        START MISSION{' '}
                        <span className='text-[10px]'>
                          ( Est.{' '}
                          <span className='text-xl'>
                            {getTodayTasks().length * 3}
                          </span>{' '}
                          min )
                        </span>
                      </Button>
                    )}
                  </div>
                }
              </div>
            </div>
          </div>

          {/* Column 2 (Span 1): Progress Stats & Settings */}
          <div className='flex col-span-6 md:col-span-3 lg:col-span-2 flex-col gap-6'>
            <div className='panel-xl flex flex-col gap-5 relative overflow-hidden'>
              <div className='absolute right-0 top-0 w-24 h-24 bg-primary/5 rounded-full blur-2xl' />
              <div className='flex justify-between items-start'>
                <div className='flex flex-col gap-1'>
                  <span className='text-[10px] uppercase font-bold text-primary tracking-wider'>
                    Active Strategy
                  </span>
                  <h2 className='title-card line-clamp-2'>{activePlan.name}</h2>
                </div>
                <button
                  onClick={handleDeletePlan}
                  className='p-2 rounded-xl text-ink-muted hover:text-ink-error hover:bg-error/10 transition-colors shrink-0'
                  title='Delete Plan and Start Over'
                >
                  <Trash2 className='w-4 h-4' />
                </button>
              </div>

              {/* Progress Bar */}
              <div className='flex flex-col gap-2'>
                <div className='body-sm flex justify-between items-center'>
                  <span className='text-ink-secondary font-medium'>
                    Progress Roadmap
                  </span>
                  <span className='font-bold text-primary'>
                    {progressPercent}% ({completedTasksCount}/{totalTasksCount}{' '}
                    tasks)
                  </span>
                </div>
                <div className='w-full bg-background-secondary/60 h-2.5 rounded-full overflow-hidden'>
                  <div
                    className='bg-primary h-full rounded-full transition-all duration-500 ease-out'
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
              </div>

              <div className='body-md flex flex-col gap-3.5 pt-4 border-t border-border/40'>
                <div className='flex justify-between items-center'>
                  <span className='body-sm text-ink-secondary'>
                    Schedule Duration
                  </span>
                  <span className='font-semibold text-ink-primary'>
                    {activePlan.target_days} Days
                  </span>
                </div>
                <div className='flex justify-between items-center'>
                  <span className='body-sm text-ink-secondary'>
                    Daily Base Questions
                  </span>
                  <span className='font-semibold text-ink-primary'>
                    {activePlan.daily_questions_count} Qs/day
                  </span>
                </div>
                <div className='flex justify-between items-center'>
                  <span className='body-sm text-ink-secondary'>
                    Plan Started
                  </span>
                  <span className='font-semibold text-ink-primary'>
                    {new Date(activePlan.created_at || '').toLocaleDateString(
                      undefined,
                      { month: 'short', day: 'numeric', year: 'numeric' },
                    )}
                  </span>
                </div>
              </div>

              <button
                onClick={() => router.push('/interview-prep/schedule')}
                className='label-sm w-full flex items-center justify-center gap-1.5 px-4 py-2.5 text-primary bg-primary/10 hover:bg-primary/15 rounded-xl transition-colors mt-2'
              >
                Open Detailed Roadmap
                <ChevronRight className='w-4 h-4' />
              </button>
            </div>
          </div>
          {/* 4. Heatmap Section */}
          {questions.length > 0 && activePlan && (
            <ActivityHeatmap data={heatmapData} />
          )}
        </div>
      )}

      {/* 4. Gamification Module */}
      {activePlan && (
        <div className='grid grid-cols-1 xl:grid-cols-[1.35fr_1fr] gap-6 mb-2'>
          <div className='panel-lg relative overflow-hidden'>
            <div className='flex flex-col gap-4 border-b border-border/40 pb-4 md:flex-row md:items-start md:justify-between'>
              <div>
                <div className='flex items-center gap-2 mb-1'>
                  <Target className='w-5 h-5 text-emerald-500' />
                  <h3 className='font-bold text-ink-primary'>Quest</h3>
                </div>
                <p className='body-md text-ink-secondary'>
                  Rotating goals across practice, applications, streaks, and
                  check-ins.
                </p>
              </div>
            </div>

            {dailyQuests.length === 0 ?
              <div className='body-md panel-md mt-4 text-ink-secondary'>
                Your quests are being prepared.
              </div>
            : <div className='grid grid-cols-1 lg:grid-cols-2 gap-3 mt-4'>
                {dailyQuests.map((q) => {
                  const theme = getQuestTheme(q.quest_type);
                  const isComplete = q.current_value >= q.target_value;
                  return (
                    <div
                      key={q.id}
                      className='panel-sm flex flex-col gap-3 hover:bg-background-secondary/60 transition-colors'
                    >
                      <div className='flex items-start justify-between gap-3'>
                        <div className='min-w-0'>
                          <div className='flex items-center gap-2 mb-1'>
                            <span
                              className={cn(
                                'rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-wider',
                                theme.chip,
                              )}
                            >
                              {theme.label}
                            </span>
                            <span className='label-sm'>
                              {q.current_value}/{q.target_value}
                            </span>
                          </div>
                          <h4 className='label'>{q.title}</h4>
                          <p className='body-sm text-ink-secondary mt-1'>
                            {q.description}
                          </p>
                        </div>

                        {q.is_claimed ?
                          <span className='shrink-0 rounded-full bg-emerald-500/10 px-2.5 py-1 text-[11px] font-bold text-emerald-600 dark:text-emerald-300'>
                            Claimed
                          </span>
                        : isComplete ?
                          <button
                            onClick={() => handleClaimQuest(q.id)}
                            className='shrink-0 rounded-full bg-primary px-3 py-1.5 text-[11px] font-bold text-white hover:bg-primary-hover'
                          >
                            Claim
                          </button>
                        : <span className='shrink-0 rounded-full bg-background-secondary/60 px-2.5 py-1 text-[11px] font-bold text-ink-secondary'>
                            +1 box
                          </span>
                        }
                      </div>

                      <div className='h-1.5 w-full bg-background-secondary rounded-full overflow-hidden'>
                        <div
                          className={cn(
                            'h-full rounded-full transition-all duration-500',
                            isComplete ? 'bg-emerald-500' : theme.bar,
                          )}
                          style={{
                            width: `${Math.min(100, (q.current_value / q.target_value) * 100)}%`,
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            }
          </div>

          <div className='panel-lg'>
            <div className='flex items-center justify-between gap-3 mb-4'>
              <div className='flex items-center gap-2'>
                <Trophy className='w-5 h-5 text-blue-500' />
                <h3 className='font-bold text-ink-primary'>Badges</h3>
              </div>
              <span className='label-sm rounded-full bg-blue-500/10 px-2.5 py-1 text-blue-600 dark:text-blue-300'>
                {unlockedAchievements.length}/{achievements.length} unlocked
              </span>
            </div>

            <div className='space-y-4'>
              <div className='panel-md'>
                <div className='flex items-center justify-between mb-3'>
                  <h4 className='label'>Recent Achievements</h4>
                  <span className='text-[11px] font-medium text-ink-secondary'>
                    Why you earned them
                  </span>
                </div>

                {recentAchievements.length === 0 ?
                  <div className='body-md text-ink-secondary'>
                    No badges yet. Finish a quest, practice, or submit an
                    application to start collecting them.
                  </div>
                : <div className='space-y-3'>
                    {recentAchievements.map((achievement) => (
                      <div
                        key={achievement.badge_id}
                        className='rounded-xl border border-border/40 bg-background-primary/50 p-3'
                      >
                        <div className='flex items-center justify-between gap-3'>
                          <div className='flex items-center gap-3'>
                            <div className='w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-indigo-600 flex items-center justify-center text-white shadow-inner'>
                              <Trophy className='w-5 h-5' />
                            </div>
                            <div>
                              <h5 className='label'>
                                {achievement.badge_name}
                              </h5>
                              <p className='body-sm text-ink-secondary'>
                                {achievement.unlock_reason ||
                                  achievement.description}
                              </p>
                            </div>
                          </div>
                          {formatShortDate(achievement.unlocked_at) && (
                            <span className='text-[11px] font-medium text-ink-secondary shrink-0'>
                              {formatShortDate(achievement.unlocked_at)}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                }
              </div>

              <div className='panel-md'>
                <h4 className='label mb-3'>All Badges</h4>
                <div className='grid grid-cols-2 gap-3'>
                  {achievements.map((achievement) => (
                    <div
                      key={achievement.badge_id}
                      className={cn(
                        'rounded-xl border p-3 transition-all',
                        achievement.unlocked ?
                          'border-blue-500/30 bg-blue-500/8 shadow-sm'
                        : 'border-border/40 bg-background/35 opacity-55 grayscale-[0.35]',
                      )}
                    >
                      <div
                        className={cn(
                          'w-11 h-11 rounded-full flex items-center justify-center mb-2 border',
                          achievement.unlocked ?
                            'bg-gradient-to-br from-blue-400 to-indigo-600 border-white dark:border-border text-white'
                          : 'bg-background-secondary border-border/50 text-ink-muted',
                        )}
                      >
                        <Trophy className='w-5 h-5' />
                      </div>
                      <h5 className='label-sm'>{achievement.badge_name}</h5>
                      <p className='text-[11px] text-ink-secondary mt-1'>
                        {achievement.description}
                      </p>
                      <span
                        className={cn(
                          'inline-flex mt-2 rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-wider',
                          achievement.unlocked ?
                            'bg-emerald-500/10 text-emerald-600 dark:text-emerald-300'
                          : 'bg-background-secondary/70 text-ink-secondary',
                        )}
                      >
                        {achievement.unlocked ? 'Unlocked' : 'Locked'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Customize Plan Modal Component */}
      <CustomizePlanModal
        isOpen={isCustomizeOpen}
        onClose={() => setIsCustomizeOpen(false)}
        categories={categories}
        questions={questions}
        isSubmitting={isCreatingPlan}
        initialPreset={selectedPreset}
        onSubmit={handleCreatePlan}
      />

      {/* Batch Import Modal Component */}
      <BatchImportModal
        isOpen={isBatchImportOpen}
        onClose={() => setIsBatchImportOpen(false)}
        categories={categories}
        tags={tags}
        selectedCategoryId={null}
        onImportSuccess={async () => {
          await initData(true, true);
        }}
        addNotification={addNotification}
      />
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className='flex flex-col gap-6 h-full pb-8 overflow-hidden animate-pulse'>
      {/* Metrics Grid */}
      <div className='grid grid-cols-2 md:grid-cols-4 gap-4 shrink-0'>
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className='p-6 rounded-2xl bg-panel h-24'>
            <div className='h-4 bg-panel rounded w-2/3 mb-2'></div>
            <div className='h-6 bg-panel rounded w-1/3'></div>
          </div>
        ))}
      </div>

      {/* Middle Section */}
      <div className='grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1 overflow-hidden'>
        {/* Today's Checklist */}
        <div className='lg:col-span-2 p-6 rounded-2xl bg-panel flex flex-col gap-4 min-h-[300px]'>
          <div className='flex items-center justify-between border-b border-border/40 pb-3'>
            Practice Mode Setting
            <div className='h-6 bg-panel rounded w-1/3'></div>
            <div className='h-6 bg-panel rounded w-1/4'></div>
          </div>
          <div className='flex-1 flex flex-col gap-3'>
            <div className='h-12 bg-panel rounded-xl w-full'></div>
            <div className='h-12 bg-panel rounded-xl w-full'></div>
            <div className='h-12 bg-panel rounded-xl w-full'></div>
          </div>
        </div>
        {/* Progress Stats */}
        <div className='p-6 rounded-2xl bg-panel flex flex-col gap-5'>
          <div className='h-5 bg-panel rounded w-1/2'></div>
          <div className='h-12 bg-panel rounded-xl w-full'></div>
          <div className='h-24 bg-panel rounded-xl w-full'></div>
        </div>
      </div>
    </div>
  );
}
