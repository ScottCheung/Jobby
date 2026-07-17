/** @format */

'use client';
import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import type {
  InterviewQuestion,
  PracticeRecord,
  PracticePlan,
  PlanTask,
  InterviewCategory,
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
} from 'lucide-react';
import { cn, cleanName } from '@/lib/utils';
import { practiceCache } from './practice/practice-cache';

const DEFAULT_SEED_QUESTIONS = [
  {
    title: 'Tell me about yourself and your background.',
    categoryName: '01 About Yourself',
    importance_score: 5,
    frequency: 'High',
    answer_objective:
      'Provide a concise (2-3 minute) pitch highlighting your professional history, key achievements, and why you are a good fit for this role.',
  },
  {
    title: 'Why do you want to join our company?',
    categoryName: '05 Company Research',
    importance_score: 5,
    frequency: 'High',
    answer_objective:
      "Show that you have researched the company's culture, mission, and products, and explain how your values and goals align with theirs.",
  },
  {
    title: 'Describe your most challenging software engineering project.',
    categoryName: '02 Projects',
    importance_score: 5,
    frequency: 'High',
    answer_objective:
      'Explain the context of the project, the technical challenges faced, the architecture decisions you made, and the quantitative results achieved.',
  },
  {
    title:
      'Tell me about a time you had a technical disagreement with a team member. How did you resolve it?',
    categoryName: '03 Behaviour Stories',
    importance_score: 4,
    frequency: 'Medium',
    answer_objective:
      'Describe a conflict in a professional manner, showing empathy, objective discussion of pros/cons, and how you focused on the best outcome for the project.',
  },
  {
    title:
      'Describe a situation where you had to work under a tight deadline and how you handled it.',
    categoryName: '03 Behaviour Stories',
    importance_score: 4,
    frequency: 'High',
    answer_objective:
      'Focus on prioritization (MOSCOW method), managing expectations, maintaining code quality, and how you delivered the MVP successfully.',
  },
  {
    title: 'What is your greatest professional strength and weakness?',
    categoryName: '01 About Yourself',
    importance_score: 4,
    frequency: 'Medium',
    answer_objective:
      'For strength, give a concrete example with data. For weakness, choose a real technical or soft skill area and explain how you are actively working to improve it.',
  },
  {
    title: 'How do you keep up with new technology and industry trends?',
    categoryName: '07 Interview Tips',
    importance_score: 3,
    frequency: 'Low',
    answer_objective:
      'Mention specific newsletters, blogs, tech podcasts, GitHub contributions, side projects, and tech books you read or follow.',
  },
  {
    title: 'Explain the architectural decisions of your latest project.',
    categoryName: '02 Projects',
    importance_score: 5,
    frequency: 'High',
    answer_objective:
      'Describe the system architecture (e.g. microservices vs monolith, state management, DB choice) and why those specific choices were made.',
  },
  {
    title: 'Describe a time you failed or made a mistake. What did you learn?',
    categoryName: '03 Behaviour Stories',
    importance_score: 4,
    frequency: 'Medium',
    answer_objective:
      'Own up to a genuine mistake, explain the immediate remediation steps taken, and most importantly, detail the preventative measures implemented to ensure it never happens again.',
  },
  {
    title: 'Do you have any questions for us?',
    categoryName: '06 Questions To Ask',
    importance_score: 5,
    frequency: 'High',
    answer_objective:
      'Ask smart, open-ended questions about team engineering culture, technical challenges they are facing, and opportunities for growth.',
  },
  {
    title: 'How do you handle scope creep or changing requirements mid-sprint?',
    categoryName: '04 Professional',
    importance_score: 4,
    frequency: 'Medium',
    answer_objective:
      'Discuss communication with stakeholders, analyzing dependencies/impact on timeline, and negotiating to push non-critical scope to the next sprint.',
  },
  {
    title: 'Explain how you optimize performance in a web application.',
    categoryName: '04 Professional',
    importance_score: 4,
    frequency: 'High',
    answer_objective:
      'Discuss frontend optimization (code splitting, lazy loading, image compression) and backend optimization (caching, DB queries indexing, CDN).',
  },
];

import { CustomizePlanModal } from './_components/CustomizePlanModal';
import { PlanSetupSection } from './_components/PlanSetupSection';
import { ActivityHeatmap } from './_components/ActivityHeatmap';
import { Button } from '@/components/UI/Button';

export default function InterviewPrepPage() {
  const router = useRouter();

  // Core Data States
  const [questions, setQuestions] = useState<InterviewQuestion[]>([]);
  const [practiceRecords, setPracticeRecords] = useState<PracticeRecord[]>([]);
  const [categories, setCategories] = useState<InterviewCategory[]>([]);

  // Gamification States
  const [dailySummary, setDailySummary] = useState<any>(null);
  const [heatmapData, setHeatmapData] = useState<any>(null);
  const [dailyQuests, setDailyQuests] = useState<any[]>([]);
  const [achievements, setAchievements] = useState<any[]>([]);
  const [isCheckingIn, setIsCheckingIn] = useState(false);
  const [isOpeningBox, setIsOpeningBox] = useState(false);
  const [openedCoins, setOpenedCoins] = useState<number | null>(null);

  // Plans & Tasks States
  const [activePlan, setActivePlan] = useState<PracticePlan | null>(null);
  const [planTasks, setPlanTasks] = useState<PlanTask[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSeeding, setIsSeeding] = useState(false);
  const [isCreatingPlan, setIsCreatingPlan] = useState(false);

  // Plan creation form states
  const [selectedPreset, setSelectedPreset] = useState<
    'sprint' | 'tactical' | 'master'
  >('tactical');
  const [isCustomizeOpen, setIsCustomizeOpen] = useState(false);

  const initData = async (forceRefetch = false) => {
    if (practiceCache.questions && !forceRefetch) {
      setQuestions(practiceCache.questions);
      setPracticeRecords(practiceCache.records || []);
      setCategories(practiceCache.categories || []);
      setActivePlan(practiceCache.activePlan);
      setPlanTasks(practiceCache.planTasks || []);
      setIsLoading(false);

      // Load gamification data in background (SWR) so dashboard UI loads instantly
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
      } catch (e) {}
      return;
    }

    setIsLoading(true);
    const startTime = Date.now();
    try {
      const [qs, prs, cats, plans] = await Promise.all([
        api.interviewQuestions(),
        api.practiceRecords(),
        api.interviewCategories(),
        api.practicePlans(),
      ]);

      practiceCache.questions = qs;
      practiceCache.records = prs;
      practiceCache.categories = cats;

      setQuestions(qs);
      setPracticeRecords(prs);
      setCategories(cats);

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
        const summary = await api.gamificationSummary();
        setDailySummary(summary);
        const heatmap = await api.gamificationHeatmap();
        setHeatmapData(heatmap);
      } catch (e) {
        console.error('Failed to load gamification data', e);
      }
    } catch (err) {
      console.error('Failed to initialize prep dashboard:', err);
    } finally {
      const elapsed = Date.now() - startTime;
      const minDuration = 500; // 0.5 seconds
      if (elapsed < minDuration) {
        await new Promise((resolve) =>
          setTimeout(resolve, minDuration - elapsed),
        );
      }
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void initData();
  }, []);

  const handleSeedQuestions = async () => {
    setIsSeeding(true);
    try {
      const cats = await api.interviewCategories();
      setCategories(cats);

      const payload = DEFAULT_SEED_QUESTIONS.map((q) => {
        const matchingCat = cats.find(
          (c) =>
            c.name.toLowerCase().includes(q.categoryName.toLowerCase()) ||
            q.categoryName.toLowerCase().includes(c.name.toLowerCase()),
        );
        return {
          title: q.title,
          category_id: matchingCat ? matchingCat.id : null,
          importance_score: q.importance_score,
          frequency: q.frequency,
          answer_objective: q.answer_objective,
          tags: [],
        };
      });

      await api.batchCreateInterviewQuestions(payload);
      const updatedQuestions = await api.interviewQuestions();
      setQuestions(updatedQuestions);
    } catch (err) {
      console.error('Failed to seed default questions:', err);
    } finally {
      setIsSeeding(false);
    }
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
      await initData(true);
      window.dispatchEvent(new Event('playbookPlanChanged'));
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
      }));
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
      }));
    } catch (e) {
      console.error(e);
    }
  };

  const handleResetAccount = async () => {
    const confirm = window.confirm(
      "Are you sure you want to permanently reset this account? All practice records, gamification status, quests, and achievements will be permanently deleted.",
    );
    if (!confirm) return;

    try {
      await api.resetGamification();
      // Force reload data
      window.location.reload();
    } catch (e) {
      console.error(e);
      alert("Failed to reset account data");
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
          className='px-3 py-1.5 rounded-lg text-xs font-bold bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 border border-rose-500/20 active:scale-95 transition-transform cursor-pointer'
        >
          Reset Test Account (Dev Only)
        </button>
      </div>

      {/* 1. Header Metrics Grid - Gamification UI */}
      <div className='grid grid-cols-2 md:grid-cols-4 gap-4'>
        <div className='card flex flex-col justify-between group relative overflow-hidden'>
          <div className='absolute right-0 top-0 w-24 h-24 bg-amber-500/5 rounded-full blur-2xl group-hover:bg-amber-500/10 transition-colors' />

          <div>
            <div className='flex items-center gap-2 text-ink-secondary mb-1'>
              <span className='text-lg'>🔥</span>
              <h3 className='font-semibold text-ink-primary text-sm'>
                Current Streak
              </h3>
            </div>
            <div className='flex items-end gap-1'>
              <p className='text-3xl font-bold text-amber-600 dark:text-amber-500'>
                {dailySummary?.current_streak || 0}
              </p>
              <span className='text-sm text-ink-secondary mb-1 font-medium'>
                Days
              </span>
            </div>
          </div>

          <button
            onClick={handleCheckIn}
            disabled={dailySummary?.has_checked_in_today || isCheckingIn}
            className={`mt-4 w-full py-2 rounded-lg text-sm font-bold flex justify-center items-center gap-2 transition-all ${
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
              <span className='text-lg'>⭐</span>
              <h3 className='font-semibold text-ink-primary text-sm'>
                Level {dailySummary?.level || 1}
              </h3>
            </div>
            <span className='text-xs font-bold text-primary bg-primary/10 px-2 py-0.5 rounded'>
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
            <div className='h-2 w-full bg-zinc-200 dark:bg-zinc-800 rounded-full overflow-hidden'>
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
        </div>

        <div className='card group relative overflow-hidden'>
          <div className='absolute right-0 top-0 w-24 h-24 bg-yellow-500/5 rounded-full blur-2xl group-hover:bg-yellow-500/10 transition-colors' />
          <div className='flex items-center gap-2 text-ink-secondary mb-1'>
            <span className='text-lg'>🪙</span>
            <h3 className='font-semibold text-ink-primary text-sm'>
              Total Coins
            </h3>
          </div>
          <div className='flex items-end justify-between'>
            <p className='text-3xl font-bold text-yellow-600 dark:text-yellow-400'>
              {dailySummary?.total_coins || 0}
            </p>
            {dailySummary?.coins_gained_today > 0 && (
              <span className='text-xs text-emerald-500 font-bold mb-1'>
                +{dailySummary.coins_gained_today} today
              </span>
            )}
          </div>
        </div>

        <div className='card'>
          <div className='absolute right-0 top-0 w-24 h-24 bg-purple-500/5 rounded-full blur-2xl group-hover:bg-purple-500/10 transition-colors' />
          <div className='flex items-center gap-2 text-ink-secondary mb-1'>
            <BookOpen className='w-4 h-4 text-purple-500' />
            <h3 className='font-semibold text-ink-primary text-sm'>
              Library & Mastery
            </h3>
          </div>
          <div className='flex flex-col gap-1 mt-1 text-sm font-medium'>
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

      {/* 2. Empty Library State Seeder */}
      {questions.length === 0 && (
        <div className='p-8 rounded-2xl border-2 border-dashed border-border dark:border-border bg-panel flex flex-col items-center text-center gap-4 py-12 shadow-sm'>
          <Sparkles className='w-12 h-12 text-primary animate-pulse' />
          <div className='max-w-md flex flex-col gap-1'>
            <h3 className='text-lg font-bold text-ink-primary'>
              Your Question Library is Empty
            </h3>
            <p className='text-sm text-ink-secondary'>
              Prepare for your interviews by seeding official standard questions
              or adding custom ones in the Question Library.
            </p>
          </div>
          <button
            onClick={handleSeedQuestions}
            disabled={isSeeding}
            className='flex items-center gap-2 px-6 py-2.5 text-sm font-semibold text-primary-foreground bg-primary rounded-xl hover:opacity-95 transition-opacity disabled:opacity-50 shadow-md shadow-primary/10'
          >
            {isSeeding ?
              'Importing High-Quality Questions...'
            : 'Import 12 Default Interview Questions'}
          </button>
        </div>
      )}

      {/* 2.5 Gamification Module */}
      <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-2'>
        {/* Loot Box Inventory */}
        <div className='panel-lg relative overflow-hidden'>
          <div className='flex items-center gap-2 mb-4'>
            <Gem className='w-5 h-5 text-purple-500' />
            <h3 className='font-bold text-ink-primary'>Loot Boxes</h3>
          </div>

          <div className='panel-md flex-1 flex flex-col items-center justify-center py-6 relative overflow-hidden'>
            <div className='absolute inset-0 bg-gradient-to-b from-purple-500/5 to-transparent' />
            <div className='relative w-32 h-32 mb-4 group'>
              <img
                src='/loot-box.png'
                alt='Loot Box'
                className={`w-full h-full object-contain ${dailySummary?.loot_boxes > 0 ? 'drop-shadow-[0_0_15px_rgba(168,85,247,0.4)] animate-pulse' : 'opacity-50 grayscale'}`}
              />
              {dailySummary?.loot_boxes > 0 && (
                <span className='absolute -top-2 -right-2 bg-primary text-white text-xs font-bold px-2 py-1 rounded-full shadow-lg border-2 border-background'>
                  x{dailySummary?.loot_boxes}
                </span>
              )}
            </div>

            {openedCoins ?
              <div className='animate-bounce flex items-center gap-2 z-40 text-amber-500 bg-amber-500/10 px-4 py-2 rounded-full font-bold text-lg'>
                <Coins className='w-5 h-5' /> +{openedCoins} Coins!
              </div>
            : <button
                onClick={handleOpenBox}
                disabled={(dailySummary?.loot_boxes || 0) <= 0 || isOpeningBox}
                className={`px-6 py-2 rounded-xl font-bold cursor-pointer z-40 transition-all shadow-sm ${
                  (dailySummary?.loot_boxes || 0) > 0 ?
                    'bg-primary hover:bg-primary-gradient text-white hover:scale-105 active:scale-95 shadow-[0_4px_20px_rgba(147,51,234,0.4)]'
                  : 'bg-background-secondary/50 text-ink-secondary cursor-not-allowed'
                }`}
              >
                {isOpeningBox ?
                  <Loader2 className='w-5 h-5 animate-spin mx-auto' />
                : (dailySummary?.loot_boxes || 0) > 0 ?
                  'Open Box'
                : 'No Boxes'}
              </button>
            }
          </div>
        </div>

        {/* Daily Quests */}
        <div className='panel-lg'>
          <div className='flex items-center gap-2 mb-4'>
            <Target className='w-5 h-5 text-emerald-500' />
            <h3 className='font-bold text-ink-primary'>Daily Quests</h3>
          </div>
          <div className='flex flex-col gap-3'>
            {dailyQuests.map((q, idx) => (
              <div
                key={q.id}
                className='panel-sm flex items-center justify-between group hover:bg-background-secondary/60 transition-colors'
              >
                <div className='flex-1 pr-3'>
                  <h4 className='font-bold text-sm text-ink-primary mb-0.5'>
                    {q.title}
                  </h4>
                  <p className='text-xs text-ink-secondary'>{q.description}</p>

                  <div className='mt-2 h-1.5 w-full bg-zinc-200 dark:bg-zinc-800 rounded-full overflow-hidden'>
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${q.current_value >= q.target_value ? 'bg-emerald-500' : 'bg-primary'}`}
                      style={{
                        width: `${Math.min(100, (q.current_value / q.target_value) * 100)}%`,
                      }}
                    />
                  </div>
                </div>

                <div className='shrink-0 pl-3 border-l border-border/40 flex flex-col items-center justify-center min-w-[70px]'>
                  <span className='text-xs font-bold text-ink-secondary mb-1.5'>
                    {q.current_value}/{q.target_value}
                  </span>
                  {q.is_claimed ?
                    <span className='text-xs font-bold text-emerald-500 flex items-center gap-1'>
                      <CheckCircle2 className='w-3 h-3' /> Claimed
                    </span>
                  : q.current_value >= q.target_value ?
                    <button
                      onClick={() => handleClaimQuest(q.id)}
                      className='text-xs font-bold bg-primary hover:bg-primary-hover text-white px-3 py-1 rounded-md shadow-sm active:scale-95 transition-transform'
                    >
                      Claim
                    </button>
                  : <span className='text-xs font-medium text-ink-tertiary flex items-center gap-1'>
                      <Gem className='w-3 h-3' /> Reward
                    </span>
                  }
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Achievements */}
        <div className='panel-lg'>
          <div className='flex items-center gap-2 mb-4'>
            <Trophy className='w-5 h-5 text-blue-500' />
            <h3 className='font-bold text-ink-primary'>Recent Achievements</h3>
          </div>
          <div className='panel-md flex-1 overflow-y-auto'>
            {achievements.length === 0 ?
              <div className='h-full flex flex-col items-center justify-center text-center text-ink-secondary opacity-60'>
                <Trophy className='w-8 h-8 mb-2 opacity-30' />
                <p className='text-sm'>
                  No badges yet.
                  <br />
                  Start practicing to earn!
                </p>
              </div>
            : <div className='grid grid-cols-2 gap-3'>
                {achievements.map((a, idx) => (
                  <div
                    key={a.id}
                    className='flex flex-col items-center text-center bg-background/50 rounded-xl p-3 border border-border/40 shadow-sm'
                  >
                    <div className='w-12 h-12 rounded-full bg-gradient-to-br from-blue-400 to-indigo-600 flex items-center justify-center shadow-inner mb-2 border-2 border-white dark:border-zinc-800'>
                      <Trophy className='w-6 h-6 text-white' />
                    </div>
                    <h4 className='font-bold text-xs text-ink-primary line-clamp-1'>
                      {a.badge_name}
                    </h4>
                  </div>
                ))}
              </div>
            }
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
                    <h3 className='text-lg font-bold text-ink-primary flex items-center gap-2'>
                      Today's Mission
                    </h3>
                  </div>
                </div>
              </div>

              <div className='flex-1 flex flex-col gap-4 '>
                {getTodayTasks().length === 0 ?
                  <div className='flex-1 flex flex-col items-center justify-center text-center p-6 text-ink-primary0 gap-2 border border-dashed border-border/40 rounded-xl bg-background-secondary/20 my-6'>
                    <CheckCircle2 className='w-10 h-10 text-emerald-500 opacity-80' />
                    <p className='font-bold text-lg text-ink-primary'>
                      Mission Accomplished!
                    </p>
                    <p className='text-sm text-ink-secondary'>
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
                            <div className='w-6 h-6 rounded-full bg-background-secondary flex items-center justify-center text-xs font-bold text-ink-secondary shrink-0'>
                              {idx + 1}
                            </div>
                            <div className='flex flex-col flex-1'>
                              <div className='flex items-center gap-2'>
                                <span
                                  className={cn(
                                    'text-sm font-semibold text-ink-primary line-clamp-1',
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
                  <h2 className='text-lg font-bold text-ink-primary line-clamp-2'>
                    {activePlan.name}
                  </h2>
                </div>
                <button
                  onClick={handleDeletePlan}
                  className='p-2 rounded-xl text-zinc-400 hover:text-rose-500 hover:bg-rose-500/10 transition-colors shrink-0'
                  title='Delete Plan and Start Over'
                >
                  <Trash2 className='w-4 h-4' />
                </button>
              </div>

              {/* Progress Bar */}
              <div className='flex flex-col gap-2'>
                <div className='flex justify-between items-center text-xs'>
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

              <div className='flex flex-col gap-3.5 pt-4 border-t border-border/40 text-sm'>
                <div className='flex justify-between items-center'>
                  <span className='text-xs text-ink-secondary'>
                    Schedule Duration
                  </span>
                  <span className='font-semibold text-ink-primary'>
                    {activePlan.target_days} Days
                  </span>
                </div>
                <div className='flex justify-between items-center'>
                  <span className='text-xs text-ink-secondary'>
                    Daily Base Questions
                  </span>
                  <span className='font-semibold text-ink-primary'>
                    {activePlan.daily_questions_count} Qs/day
                  </span>
                </div>
                <div className='flex justify-between items-center'>
                  <span className='text-xs text-ink-secondary'>
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
                className='w-full flex items-center justify-center gap-1.5 px-4 py-2.5 text-xs font-bold text-primary bg-primary/10 hover:bg-primary/15 rounded-xl transition-colors mt-2'
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

      {/* 5. Plan Selection / Setup Screen (No Active Plan) */}
      {questions.length > 0 && !activePlan && (
        <PlanSetupSection
          questions={questions}
          selectedPreset={selectedPreset}
          setSelectedPreset={setSelectedPreset}
          setIsCustomizeOpen={setIsCustomizeOpen}
          handleCreatePlan={handleCreatePlan}
          isCreatingPlan={isCreatingPlan}
        />
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
