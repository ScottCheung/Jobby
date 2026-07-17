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

export default function InterviewPrepPage() {
  const router = useRouter();

  // Core Data States
  const [questions, setQuestions] = useState<InterviewQuestion[]>([]);
  const [practiceRecords, setPracticeRecords] = useState<PracticeRecord[]>([]);
  const [categories, setCategories] = useState<InterviewCategory[]>([]);
  
  // Gamification States
  const [dailySummary, setDailySummary] = useState<any>(null);
  const [heatmapData, setHeatmapData] = useState<any>(null);

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
        const summary = await api.gamificationSummary();
        setDailySummary(summary);
        const heatmap = await api.gamificationHeatmap();
        setHeatmapData(heatmap);
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
        console.error("Failed to load gamification data", e);
      }
    } catch (err) {
      console.error('Failed to initialize prep dashboard:', err);
    } finally {
      const elapsed = Date.now() - startTime;
      const minDuration = 500; // 0.5 seconds
      if (elapsed < minDuration) {
        await new Promise((resolve) => setTimeout(resolve, minDuration - elapsed));
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
      const updated = prev.map((t) => (t.id === task.id ? { ...t, status: newStatus } : t));
      practiceCache.planTasks = updated;
      return updated;
    });

    try {
      await api.updatePlanTask(activePlan.id, task.id, { status: newStatus });
    } catch (err) {
      console.error('Failed to update task status:', err);
      setPlanTasks((prev) => {
        const reverted = prev.map((t) => (t.id === task.id ? { ...t, status: task.status } : t));
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
    'border-ink-secondary/40 dark:border-zinc-800/60 bg-zinc-50/10 dark:bg-zinc-900/5';
  return (
    <div className='flex flex-col gap-6 pb-8 pr-1'>
      {/* 1. Header Metrics Grid - Gamification UI */}
      <div className='grid grid-cols-2 md:grid-cols-4 gap-4'>
        <div className='p-6 rounded-2xl bg-panel border border-zinc-100 dark:border-zinc-800/60 flex flex-col gap-2 shadow-sm relative overflow-hidden group hover:border-amber-500/20 transition-colors'>
          <div className='absolute right-0 top-0 w-24 h-24 bg-amber-500/5 rounded-full blur-2xl group-hover:bg-amber-500/10 transition-colors' />
          <div className='flex items-center gap-2 text-ink-secondary mb-1'>
            <span className='text-lg'>🔥</span>
            <h3 className='font-semibold text-ink-primary text-sm'>Current Streak</h3>
          </div>
          <div className='flex items-end gap-1'>
            <p className='text-3xl font-bold text-amber-600 dark:text-amber-500'>
              {dailySummary?.current_streak || 0}
            </p>
            <span className='text-sm text-ink-secondary mb-1 font-medium'>Days</span>
          </div>
        </div>

        <div className='p-6 rounded-2xl bg-panel border border-zinc-100 dark:border-zinc-800/60 flex flex-col gap-2 shadow-sm relative overflow-hidden group hover:border-primary/20 transition-colors'>
          <div className='absolute right-0 top-0 w-24 h-24 bg-primary/5 rounded-full blur-2xl group-hover:bg-primary/10 transition-colors' />
          <div className='flex items-center gap-2 text-ink-secondary mb-1'>
            <span className='text-lg'>⭐</span>
            <h3 className='font-semibold text-ink-primary text-sm'>Level {dailySummary?.level || 1}</h3>
          </div>
          <div className='flex items-end gap-1'>
            <p className='text-3xl font-bold text-primary'>
              {dailySummary?.xp_gained_today ? `+${dailySummary.xp_gained_today}` : '0'}
            </p>
            <span className='text-sm text-ink-secondary mb-1 font-medium'>XP Today</span>
          </div>
        </div>

        <div className='p-6 rounded-2xl bg-panel border border-zinc-100 dark:border-zinc-800/60 flex flex-col gap-2 shadow-sm relative overflow-hidden group hover:border-yellow-500/20 transition-colors'>
          <div className='absolute right-0 top-0 w-24 h-24 bg-yellow-500/5 rounded-full blur-2xl group-hover:bg-yellow-500/10 transition-colors' />
          <div className='flex items-center gap-2 text-ink-secondary mb-1'>
            <span className='text-lg'>🪙</span>
            <h3 className='font-semibold text-ink-primary text-sm'>Total Coins</h3>
          </div>
          <p className='text-3xl font-bold text-yellow-600 dark:text-yellow-400'>
            {dailySummary?.coins_gained_today ? `+${dailySummary.coins_gained_today}` : '0'}
          </p>
        </div>
        
        <div className='p-6 rounded-2xl bg-panel border border-zinc-100 dark:border-zinc-800/60 flex flex-col gap-2 shadow-sm relative overflow-hidden group hover:border-purple-500/20 transition-colors'>
          <div className='absolute right-0 top-0 w-24 h-24 bg-purple-500/5 rounded-full blur-2xl group-hover:bg-purple-500/10 transition-colors' />
          <div className='flex items-center gap-2 text-ink-secondary mb-1'>
            <BookOpen className='w-4 h-4 text-purple-500' />
            <h3 className='font-semibold text-ink-primary text-sm'>Library & Mastery</h3>
          </div>
          <div className='flex flex-col gap-1 mt-1 text-sm font-medium'>
             <div className='flex justify-between items-center'>
               <span className='text-ink-secondary'>Total Qs:</span>
               <span className='text-ink-primary'>{questions.length}</span>
             </div>
             <div className='flex justify-between items-center'>
               <span className='text-ink-secondary'>Mastered:</span>
               <span className='text-purple-600 dark:text-purple-400'>{masteredCount}</span>
             </div>
          </div>
        </div>
      </div>

      {/* 2. Empty Library State Seeder */}
      {questions.length === 0 && (
        <div className='p-8 rounded-2xl border-2 border-dashed border-zinc-200 dark:border-zinc-800 bg-panel flex flex-col items-center text-center gap-4 py-12 shadow-sm'>
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

      {/* 3. Active Plan Dashboard View */}
      {questions.length > 0 && activePlan && (
        <div className='grid grid-cols-1 lg:grid-cols-3 gap-6'>
          {/* Column 1 (Span 2): Today's Checklist */}
          <div className='lg:col-span-2 flex flex-col gap-6'>
            <div className='p-6 rounded-2xl bg-panel border border-zinc-100 dark:border-zinc-800/60 shadow-sm flex flex-col gap-4 min-h-[350px]'>
              <div className='flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800/60 pb-3'>
                <div className='flex items-center gap-3'>
                  <div className='w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center'>
                    <Play className='w-5 h-5 text-primary ml-1' />
                  </div>
                  <div>
                    <h3 className='text-lg font-bold text-ink-primary flex items-center gap-2'>
                      Today's Mission
                    </h3>
                    <p className='text-sm text-ink-secondary'>Complete {getTodayTasks().length} questions</p>
                  </div>
                </div>
                <div className='text-right'>
                  <p className='text-sm font-bold text-ink-primary'>
                     Estimated Time
                  </p>
                  <p className='text-sm text-primary'>{getTodayTasks().length * 3} min</p>
                </div>
              </div>

              <div className='flex-1 flex flex-col gap-4 mt-2'>
                {getTodayTasks().length === 0 ?
                  <div className='flex-1 flex flex-col items-center justify-center text-center p-6 text-zinc-500 gap-2 border border-dashed border-zinc-100 dark:border-zinc-800 rounded-xl bg-zinc-50/20 dark:bg-zinc-900/10 my-6'>
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
                                'bg-zinc-50 dark:bg-zinc-900/30 border-zinc-100 dark:border-zinc-800/40 opacity-60'
                              : 'bg-panel border-zinc-200 dark:border-zinc-800',
                            )}
                          >
                            <div className='w-6 h-6 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-xs font-bold text-ink-secondary shrink-0'>
                              {idx + 1}
                            </div>
                            <div className='flex flex-col flex-1'>
                              <div className='flex items-center gap-2'>
                                <span className={cn('text-sm font-semibold text-ink-primary line-clamp-1', isCompleted && 'line-through')}>
                                  {questionObj.title}
                                </span>
                                {isReview && (
                                  <span className='px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-500/10 text-blue-600 dark:text-blue-400 shrink-0'>
                                    Review
                                  </span>
                                )}
                              </div>
                            </div>
                            {isCompleted && <CheckCircle2 className="w-5 h-5 text-emerald-500" />}
                          </div>
                        );
                      })}
                    </div>
                    
                    {getTodayTasks().filter(t => t.status !== 'completed').length > 0 && (
                      <button
                        onClick={() => {
                          const firstPending = getTodayTasks().find(t => t.status !== 'completed');
                          if (firstPending) {
                            router.push(`/interview-prep/practice/${firstPending.question_id}`);
                          }
                        }}
                        className='w-full py-4 bg-primary hover:opacity-90 transition-opacity text-primary-foreground font-bold text-lg rounded-xl shadow-lg shadow-primary/20 flex justify-center items-center gap-2'
                      >
                        <Play className='w-5 h-5 fill-current' />
                        START MISSION
                      </button>
                    )}
                  </div>
                }
              </div>
            </div>
          </div>

          {/* Column 2 (Span 1): Progress Stats & Settings */}
          <div className='flex flex-col gap-6'>
            <div className='p-6 rounded-2xl bg-panel border border-zinc-100 dark:border-zinc-800/60 shadow-sm flex flex-col gap-5 relative overflow-hidden'>
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
                <div className='w-full bg-zinc-100 dark:bg-zinc-800/60 h-2.5 rounded-full overflow-hidden'>
                  <div
                    className='bg-primary h-full rounded-full transition-all duration-500 ease-out'
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
              </div>

              <div className='flex flex-col gap-3.5 pt-4 border-t border-zinc-100 dark:border-zinc-800/60 text-sm'>
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
        </div>
      )}
      
      {/* 4. Heatmap Section */}
      {questions.length > 0 && activePlan && (
        <ActivityHeatmap data={heatmapData} />
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
          <div className='flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800/60 pb-3'>
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
