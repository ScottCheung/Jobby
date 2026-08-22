/** @format */

'use client';
import React, { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import type {
  InterviewQuestion,
  PracticePlan,
  PlanTask,
  InterviewCategory,
} from '@/lib/types';
import { Button, Modal, WaterfallLayout } from '@jobby/ui';
import * as LucideIcons from 'lucide-react';
import {
  Trash2,
  Check,
  Calendar,
  GripVertical,
  CheckCircle2,
  Map,
  LayoutGrid,
  Trophy,
  Zap,
  ChevronRight,
  RefreshCw,
  Navigation,
  Lock,
  Crown,
  Sparkles,
  Package,
  Gift,
} from 'lucide-react';
import { cn, cleanName } from '@/lib/utils';
import { practiceCache } from '../practice/practice-cache';
import { motion, AnimatePresence } from 'framer-motion';
import dynamic from 'next/dynamic';

const PlanSetupSection = dynamic(
  () =>
    import('../_components/PlanSetupSection').then(
      (mod) => mod.PlanSetupSection,
    ),
  { ssr: false },
);
const CustomizePlanModal = dynamic(
  () =>
    import('../_components/CustomizePlanModal').then(
      (mod) => mod.CustomizePlanModal,
    ),
  { ssr: false },
);
const InventoryModal = dynamic(
  () =>
    import('../_components/InventoryModal').then((mod) => mod.InventoryModal),
  { ssr: false },
);

import { showCelebrationEvent } from '@/lib/celebration';
import { useConsole } from '@/components/ConsoleContext';

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────
type ViewMode = '3d' | 'flat';

interface DragState {
  taskId: string | null;
  sourceDayNum: number | null;
  sourceIndex: number | null;
  overDayNum: number | null;
  overIndex: number | null;
}

// ─────────────────────────────────────────────
// Icon helper (same pattern as IconSelector.tsx)
// ─────────────────────────────────────────────
const kebabToPascal = (str: string) =>
  str
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join('');

const getLucideIcon = (name: string): React.ElementType =>
  (LucideIcons as any)[kebabToPascal(name)] ?? LucideIcons.HelpCircle;

// ─────────────────────────────────────────────
// Main Page Component
// ─────────────────────────────────────────────
export default function PracticeRoadmapPage() {
  const router = useRouter();
  const { profile, hasLoadedInitialData, updateProfileExtra } = useConsole();

  const [questions, setQuestions] = useState<InterviewQuestion[]>([]);
  const [categories, setCategories] = useState<InterviewCategory[]>([]);
  const [activePlan, setActivePlan] = useState<PracticePlan | null>(null);
  const [planTasks, setPlanTasks] = useState<PlanTask[]>([]);
  const [claimedStageDays, setClaimedStageDays] = useState<number[]>([]);
  const [isInventoryOpen, setIsInventoryOpen] = useState(false);
  const [claimingDayNum, setClaimingDayNum] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const [isResetOpen, setIsResetOpen] = useState(false);
  const [selectedPreset, setSelectedPreset] = useState<
    'sprint' | 'tactical' | 'master'
  >('tactical');
  const [isCustomizeOpen, setIsCustomizeOpen] = useState(false);
  const [isCreatingPlan, setIsCreatingPlan] = useState(false);

  const [viewMode, setViewMode] = useState<ViewMode>('3d');
  useEffect(() => {
    if (!hasLoadedInitialData) return;
    const stored = profile.extra_data?.scheduleViewMode as ViewMode | undefined;
    if (stored === 'flat' || stored === '3d') setViewMode(stored);
  }, [hasLoadedInitialData, profile.extra_data]);
  const toggleViewMode = () => {
    setViewMode((prev) => {
      const next = prev === '3d' ? 'flat' : '3d';
      void updateProfileExtra({ scheduleViewMode: next });
      return next;
    });
  };

  const [dragState, setDragState] = useState<DragState>({
    taskId: null,
    sourceDayNum: null,
    sourceIndex: null,
    overDayNum: null,
    overIndex: null,
  });

  const initData = async (forceRefetch = false) => {
    if (practiceCache.questions && !forceRefetch) {
      setQuestions(practiceCache.questions);
      setCategories(practiceCache.categories || []);
      setActivePlan(practiceCache.activePlan);
      setPlanTasks(practiceCache.planTasks || []);
      setClaimedStageDays(practiceCache.activePlan?.claimed_stage_days || []);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    const startTime = Date.now();
    try {
      const [qsRes, plans, cats] = await Promise.all([
        api.interviewQuestions(),
        api.practicePlans(),
        api.interviewCategories(),
      ]);
      const qs = qsRes.items || [];
      practiceCache.questions = qs;
      practiceCache.categories = cats;
      setQuestions(qs);
      setCategories(cats);
      let activePlan: PracticePlan | null = null;
      let tasks: PlanTask[] = [];
      if (plans && plans.length > 0) {
        activePlan = plans[0];
        practiceCache.activePlan = activePlan;
        tasks = await api.planTasks(activePlan.id);
        practiceCache.planTasks = tasks;
        setClaimedStageDays(activePlan.claimed_stage_days || []);
      } else {
        practiceCache.activePlan = null;
        practiceCache.planTasks = [];
        setClaimedStageDays([]);
      }
      setActivePlan(activePlan);
      setPlanTasks(tasks);
    } catch (err) {
      console.error('Failed to initialize roadmap page:', err);
    } finally {
      const elapsed = Date.now() - startTime;
      if (elapsed < 500) await new Promise((r) => setTimeout(r, 500 - elapsed));
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void initData();
  }, []);

  const handleClaimStageReward = async (dayNum: number) => {
    if (!activePlan) return;
    setClaimingDayNum(dayNum);
    try {
      const res = await api.claimStageReward(activePlan.id, dayNum);
      const updatedClaimed = res.claimed_stage_days || [];
      setClaimedStageDays(updatedClaimed);
      if (practiceCache.activePlan) {
        practiceCache.activePlan.claimed_stage_days = updatedClaimed;
      }
      setActivePlan((prev) =>
        prev ? { ...prev, claimed_stage_days: updatedClaimed } : prev,
      );
      showCelebrationEvent(
        'reward_claimed',
        `Stage ${dayNum} Reward Claimed: ${res.reward.badge}!`,
      );
    } catch (err: any) {
      console.error('Failed to claim stage reward:', err);
      alert(err?.message || 'Failed to claim stage reward');
    } finally {
      setClaimingDayNum(null);
    }
  };

  const handleDeletePlan = async () => {
    if (!activePlan) return;
    const ok = window.confirm(
      'Are you sure you want to delete this prep plan?',
    );
    if (!ok) return;
    setIsLoading(true);
    try {
      await api.deletePracticePlan(activePlan.id);
      const remaining = await api.practicePlans();
      if (remaining?.length > 0)
        for (const p of remaining) await api.deletePracticePlan(p.id);
      practiceCache.activePlan = null;
      practiceCache.planTasks = [];
      window.dispatchEvent(new Event('playbookPlanChanged'));
      router.push('/interview-prep');
    } catch (err) {
      console.error('Failed to delete plan:', err);
      setIsLoading(false);
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
    if (!questions.length) return;
    setIsCreatingPlan(true);
    try {
      // 1. Delete active plan if it exists
      if (activePlan) {
        await api.deletePracticePlan(activePlan.id);
      }

      // 2. Setup config variables
      let planName = '';
      let targetDays = 14;
      let dailyQsCount = 3;
      let planQuestions: InterviewQuestion[] = [];
      let isSpacedRepetition = true;

      if (settings) {
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
        if (selectedPreset === 'sprint') {
          targetDays = 7;
          isSpacedRepetition = true;
          planName = '7-Day Sprint Prep';
          const sprintQuestions = questions.filter(
            (q) => (q.importance_score ?? 0) >= 4 || q.frequency === 'High',
          );
          planQuestions = sprintQuestions;
          dailyQsCount = Math.max(1, Math.ceil(sprintQuestions.length / 7));
        } else if (selectedPreset === 'master') {
          targetDays = 30;
          isSpacedRepetition = true;
          planName = '30-Day Interview Master';
          planQuestions = questions;
          dailyQsCount = Math.max(1, Math.ceil(questions.length / 30));
        } else {
          targetDays = 14;
          isSpacedRepetition = true;
          planName = '14-Day Tactical Booster';
          planQuestions = questions;
          dailyQsCount = Math.max(1, Math.ceil(questions.length / 14));
        }
      }

      if (planQuestions.length === 0) {
        alert(
          'We could not find any questions for the plan. Please select at least one question or check your filters.',
        );
        setIsCreatingPlan(false);
        return;
      }

      // 3. Create plan
      const plan = await api.createPracticePlan({
        name: planName,
        target_days: targetDays,
        daily_questions_count: dailyQsCount,
      });

      // 4. Create tasks
      const totalQuestionsCount = planQuestions.length;
      for (let i = 0; i < totalQuestionsCount; i++) {
        const q = planQuestions[i];
        const baseDayIndex = Math.min(
          Math.floor(i / dailyQsCount),
          targetDays - 1,
        );

        const scheduledDate = new Date();
        scheduledDate.setDate(scheduledDate.getDate() + baseDayIndex);
        await api.createPlanTask(plan.id, {
          plan_id: plan.id,
          question_id: q.id,
          scheduled_date: scheduledDate.toISOString(),
          status: 'pending',
        });

        if (isSpacedRepetition) {
          const reviewIntervals = [1, 3, 7, 14];
          for (const interval of reviewIntervals) {
            const reviewDayIndex = baseDayIndex + interval;
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

      // Reload
      await initData(true);
      window.dispatchEvent(new Event('playbookPlanChanged'));
      setIsResetOpen(false);
      setIsCustomizeOpen(false);
    } catch (err) {
      console.error('Failed to reset plan:', err);
    } finally {
      setIsCreatingPlan(false);
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
    } catch {
      setPlanTasks((prev) => {
        const reverted = prev.map((t) =>
          t.id === task.id ? { ...t, status: task.status } : t,
        );
        practiceCache.planTasks = reverted;
        return reverted;
      });
    }
  };

  // ─── Drag ───────────────────────────────────
  const handleDragStart = (
    e: React.DragEvent,
    taskId: string,
    sourceDayNum: number,
    sourceIndex: number,
  ) => {
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', taskId);
    setDragState({
      taskId,
      sourceDayNum,
      sourceIndex,
      overDayNum: null,
      overIndex: null,
    });
  };
  const handleDragEnd = () =>
    setDragState({
      taskId: null,
      sourceDayNum: null,
      sourceIndex: null,
      overDayNum: null,
      overIndex: null,
    });

  const updateDragTarget = useCallback((dayNum: number, index: number) => {
    setDragState((current) => {
      if (
        !current.taskId ||
        (current.overDayNum === dayNum && current.overIndex === index)
      ) {
        return current;
      }
      return { ...current, overDayNum: dayNum, overIndex: index };
    });
  }, []);

  const handleDrop = async (
    e: React.DragEvent,
    targetDayNum: number,
    insertIndex: number,
  ) => {
    e.preventDefault();
    e.stopPropagation();
    const taskId = e.dataTransfer.getData('text/plain') || dragState.taskId;
    const sourceDayNum = dragState.sourceDayNum;
    const sourceIndex = dragState.sourceIndex;
    setDragState({
      taskId: null,
      sourceDayNum: null,
      sourceIndex: null,
      overDayNum: null,
      overIndex: null,
    });
    if (!taskId || !activePlan) return;

    const targetTasks = getTasksByDayIndex(targetDayNum);
    const draggedTask = planTasks.find((task) => task.id === taskId);
    if (!draggedTask) return;

    const targetWithoutDragged = targetTasks.filter(
      (task) => task.id !== taskId,
    );
    const correctedIndex =
      (
        sourceDayNum === targetDayNum &&
        sourceIndex !== null &&
        sourceIndex < insertIndex
      ) ?
        insertIndex - 1
      : insertIndex;
    const safeIndex = Math.max(
      0,
      Math.min(correctedIndex, targetWithoutDragged.length),
    );
    const reorderedTasks = [...targetWithoutDragged];
    reorderedTasks.splice(safeIndex, 0, draggedTask);

    const targetDayStart = getDayDate(targetDayNum);
    targetDayStart.setHours(9, 0, 0, 0);
    const scheduleUpdates = reorderedTasks.map((task, index) => {
      const scheduledDate = new Date(targetDayStart);
      scheduledDate.setMinutes(index);
      return { id: task.id, scheduled_date: scheduledDate.toISOString() };
    });
    const scheduleByTaskId = new globalThis.Map(
      scheduleUpdates.map((update) => [update.id, update.scheduled_date]),
    );
    setPlanTasks((current) => {
      const updated = current.map((task) => {
        const scheduledDate = scheduleByTaskId.get(task.id);
        return scheduledDate ?
            { ...task, scheduled_date: scheduledDate }
          : task;
      });
      practiceCache.planTasks = updated;
      return updated;
    });
    try {
      await Promise.all(
        scheduleUpdates.map((update) =>
          api.updatePlanTask(activePlan.id, update.id, {
            scheduled_date: update.scheduled_date,
          }),
        ),
      );
    } catch {
      const fresh = await api.planTasks(activePlan.id);
      practiceCache.planTasks = fresh;
      setPlanTasks(fresh);
    }
  };

  // ─── Helpers ─────────────────────────────────
  const getSortedTasks = useCallback(
    () =>
      [...planTasks].sort(
        (a, b) =>
          new Date(a.scheduled_date).getTime() -
          new Date(b.scheduled_date).getTime(),
      ),
    [planTasks],
  );

  const getUniqueDates = useCallback(() => {
    const dates: string[] = [];
    getSortedTasks().forEach((t) => {
      const ds = new Date(t.scheduled_date).toDateString();
      if (!dates.includes(ds)) dates.push(ds);
    });
    return dates;
  }, [getSortedTasks]);

  const getTasksByDayIndex = useCallback(
    (dayIdx: number) => {
      if (!activePlan || planTasks.length === 0) return [];
      const sorted = getSortedTasks();
      const dates = getUniqueDates();
      if (dayIdx <= dates.length && dayIdx > 0) {
        return sorted.filter(
          (t) =>
            new Date(t.scheduled_date).toDateString() === dates[dayIdx - 1],
        );
      }
      return [];
    },
    [activePlan, planTasks, getSortedTasks, getUniqueDates],
  );

  const getDayCount = () => {
    if (!activePlan) return 0;
    const dates = new Set<string>();
    planTasks.forEach((t) =>
      dates.add(new Date(t.scheduled_date).toDateString()),
    );
    return Math.max(activePlan.target_days, dates.size);
  };

  const isReviewTask = useCallback(
    (task: PlanTask) => {
      const sorted = getSortedTasks();
      const idx = sorted.findIndex((t) => t.id === task.id);
      if (idx === -1) return false;
      for (let i = 0; i < idx; i++)
        if (sorted[i].question_id === task.question_id) return true;
      return false;
    },
    [getSortedTasks],
  );

  const getDayFormattedDate = (dayIdx: number) => {
    if (!activePlan) return '';
    const start = new Date(activePlan.created_at || new Date());
    const d = new Date(start);
    d.setDate(start.getDate() + (dayIdx - 1));
    return d.toLocaleDateString(undefined, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
  };

  const getDayDate = (dayIdx: number): Date => {
    const start =
      activePlan ? new Date(activePlan.created_at || new Date()) : new Date();
    const d = new Date(start);
    d.setDate(start.getDate() + (dayIdx - 1));
    return d;
  };

  if (isLoading) return <RoadmapSkeleton />;

  if (!activePlan) {
    return (
      <div className='flex flex-col items-center justify-center h-full text-ink-secondary text-center p-6 gap-3'>
        <Calendar className='w-12 h-12 opacity-30 mb-1' />
        <h3 className='title-card'>No Active Prep Plan Found</h3>
        <p className='body-md max-w-md'>
          Create a practice plan on the Dashboard to see your roadmap.
        </p>
        <button
          onClick={() => router.push('/interview-prep')}
          className='label mt-2 px-5 py-2 text-primary-foreground bg-primary rounded-xl hover:opacity-90 opacity'
        >
          Go to Dashboard
        </button>
      </div>
    );
  }

  const totalPlanDays = getDayCount();
  const completedCount = planTasks.filter(
    (t) => t.status === 'completed',
  ).length;
  const progressPct =
    planTasks.length > 0 ?
      Math.round((completedCount / planTasks.length) * 100)
    : 0;

  const dayDataArr = Array.from({ length: totalPlanDays }).map((_, idx) => {
    const dayNum = idx + 1;
    const dayTasks = getTasksByDayIndex(dayNum);
    const dayCompleted =
      dayTasks.length > 0 && dayTasks.every((t) => t.status === 'completed');
    const dayDate = getDayDate(dayNum);
    const isToday = dayDate.toDateString() === new Date().toDateString();
    const isPast = dayDate < new Date() && !isToday;
    return { dayNum, dayTasks, dayCompleted, dayDate, isToday, isPast };
  });

  // Flat view cards
  const flatCards = dayDataArr.map(
    ({ dayNum, dayTasks, dayCompleted, isToday, isPast }) => (
      <FlatDayCard
        key={dayNum}
        dayNum={dayNum}
        dayTasks={dayTasks}
        dayCompleted={dayCompleted}
        isToday={isToday}
        isPast={isPast}
        dragState={dragState}
        questions={questions}
        getDayFormattedDate={getDayFormattedDate}
        isReviewTask={isReviewTask}
        handleDragStart={handleDragStart}
        handleDragEnd={handleDragEnd}
        updateDragTarget={updateDragTarget}
        handleDrop={handleDrop}
        handleToggleTaskStatus={handleToggleTaskStatus}
        router={router}
        claimedStageDays={claimedStageDays}
        onClaimStageReward={handleClaimStageReward}
        claimingDayNum={claimingDayNum}
        activePlanId={activePlan.id}
      />
    ),
  );

  return (
    <div className='relative flex flex-col gap-5  pr-1'>
      {/* Header */}
      <div className='flex flex-col md:flex-row justify-between items-start md:items-center gap-3 -b -/60 pb-4 shrink-0'>
        <div className='flex flex-col gap-0.5'>
          <div className='flex items-center gap-2 flex-wrap'>
            <h2 className='title-section'>{activePlan.name}</h2>
            <Button
              onClick={() => setIsInventoryOpen(true)}
              className='flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold text-purple-400 bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/20 rounded-lg colors'
            >
              <Package className='w-3.5 h-3.5' />
              Backpack / Items
            </Button>
            <Button
              onClick={handleDeletePlan}
              className='flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold text-rose-500 bg-rose-500/8 hover:bg-rose-500/15 rounded-lg colors'
            >
              <Trash2 className='w-3 h-3' />
              Delete
            </Button>
            <Button
              layoutId='Reset Plan'
              onClick={() => setIsResetOpen(true)}
              className='flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold text-primary bg-primary/10 hover:bg-primary/15 rounded-lg colors'
            >
              <RefreshCw className='w-3 h-3' />
              Reset Plan
            </Button>
          </div>
          <p className='body-sm text-ink-secondary'>
            {progressPct}% complete · {completedCount}/{planTasks.length}{' '}
            questions done
          </p>
        </div>
        {/* Progress bar */}
        <div className='w-full md:w-48 h-1.5 bg-background-secondary rounded-full overflow-hidden'>
          <motion.div
            className='h-full bg-primary rounded-full rounded-full'
            initial={{ width: 0 }}
            animate={{ width: `${progressPct}%` }}
            transition={{ duration: 1, ease: [0.22, 1, 0.36, 1] }}
          />
        </div>
      </div>

      {/* View Content */}
      <AnimatePresence mode='wait'>
        {viewMode === 'flat' ?
          <motion.div
            key='flat'
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            className='min-h-[450px]'
          >
            <WaterfallLayout
              gap={12}
              minColumnWidth={{ sm: 240, md: 250, lg: 270, xl: 290 }}
              itemClassName='p-1.5'
            >
              {flatCards}
            </WaterfallLayout>
          </motion.div>
        : <motion.div
            key='3d'
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
          >
            <Roadmap3DView
              dayDataArr={dayDataArr}
              dragState={dragState}
              questions={questions}
              getDayFormattedDate={getDayFormattedDate}
              isReviewTask={isReviewTask}
              handleDragStart={handleDragStart}
              handleDragEnd={handleDragEnd}
              updateDragTarget={updateDragTarget}
              handleDrop={handleDrop}
              handleToggleTaskStatus={handleToggleTaskStatus}
              router={router}
              activePlanId={activePlan.id}
              claimedStageDays={claimedStageDays}
              onClaimStageReward={handleClaimStageReward}
              claimingDayNum={claimingDayNum}
            />
          </motion.div>
        }
      </AnimatePresence>

      {/* ── Floating View Toggle (bottom-right, icon only) ── */}
      <div className='fixed bottom-6 right-6 z-50'>
        <motion.button
          onClick={toggleViewMode}
          whileHover={{ scale: 1.08 }}
          whileTap={{ scale: 0.94 }}
          className={cn(
            'w-10 h-10 rounded-2xl flex items-center justify-center  colors duration-200',
            viewMode === '3d' ?
              'bg-primary text-ink-primary '
            : 'bg-panel  - text-ink-secondary hover:text-ink-primary',
          )}
          title={viewMode === '3d' ? 'Switch to Flat Grid' : 'Switch to 3D Map'}
        >
          <AnimatePresence mode='wait'>
            {viewMode === '3d' ?
              <motion.span
                key='flat-icon'
                initial={{ opacity: 0, rotate: -60 }}
                animate={{ opacity: 1, rotate: 0 }}
                exit={{ opacity: 0, rotate: 60 }}
                transition={{ duration: 0.18 }}
              >
                {React.createElement(getLucideIcon('layout-grid'), {
                  className: 'w-4 h-4',
                })}
              </motion.span>
            : <motion.span
                key='3d-icon'
                initial={{ opacity: 0, rotate: 60 }}
                animate={{ opacity: 1, rotate: 0 }}
                exit={{ opacity: 0, rotate: -60 }}
                transition={{ duration: 0.18 }}
              >
                {React.createElement(getLucideIcon('map'), {
                  className: 'w-4 h-4',
                })}
              </motion.span>
            }
          </AnimatePresence>
        </motion.button>
      </div>

      {/* Reset Plan Modal (Prepare Practice Plan card popup) */}
      <Modal
        isOpen={isResetOpen}
        layoutId='Reset Plan'
        onClose={() => setIsResetOpen(false)}
        className='w-[92vw] max-w-5xl max-h-[90vh] md:overflow-hidden  '
      >
        <div className='p-1'>
          <PlanSetupSection
            questions={questions}
            selectedPreset={selectedPreset}
            setSelectedPreset={setSelectedPreset}
            setIsCustomizeOpen={setIsCustomizeOpen}
            handleCreatePlan={handleCreatePlan}
            isCreatingPlan={isCreatingPlan}
          />
        </div>
      </Modal>

      {/* Customize Plan Modal */}
      <CustomizePlanModal
        isOpen={isCustomizeOpen}
        onClose={() => setIsCustomizeOpen(false)}
        categories={categories}
        questions={questions}
        isSubmitting={isCreatingPlan}
        initialPreset={selectedPreset}
        onSubmit={handleCreatePlan}
      />

      {/* Inventory / Backpack Modal */}
      <InventoryModal
        isOpen={isInventoryOpen}
        onClose={() => setIsInventoryOpen(false)}
        onInventoryUpdated={() => void initData(true)}
      />
    </div>
  );
}

// ─────────────────────────────────────────────
// Task Item (shared)
// ─────────────────────────────────────────────
interface TaskItemProps {
  task: PlanTask;
  taskIdx: number;
  dayNum: number;
  dragState: DragState;
  questions: InterviewQuestion[];
  isReviewTask: (t: PlanTask) => boolean;
  handleDragStart: (
    e: React.DragEvent,
    taskId: string,
    dayNum: number,
    taskIndex: number,
  ) => void;
  handleDragEnd: () => void;
  updateDragTarget: (dayNum: number, index: number) => void;
  handleDrop: (e: React.DragEvent, dayNum: number, index: number) => void;
  handleToggleTaskStatus: (task: PlanTask) => void;
  router: ReturnType<typeof useRouter>;
}

function TaskItem({
  task,
  taskIdx,
  dayNum,
  dragState,
  questions,
  isReviewTask,
  handleDragStart,
  handleDragEnd,
  updateDragTarget,
  handleDrop,
  handleToggleTaskStatus,
  router,
}: TaskItemProps) {
  const qObj = questions.find((q) => q.id === task.question_id);
  if (!qObj) return null;
  const isCompleted = task.status === 'completed';
  const isReview = isReviewTask(task);
  const isDraggingThis = dragState.taskId === task.id;
  const showPlaceholder =
    dragState.taskId !== null &&
    dragState.overDayNum === dayNum &&
    dragState.overIndex === taskIdx + 1 &&
    dragState.taskId !== task.id;

  return (
    <div className='relative'>
      <div
        draggable
        onDragStart={(e) => handleDragStart(e, task.id, dayNum, taskIdx)}
        onDragEnd={handleDragEnd}
        onDragOver={(e) => {
          e.preventDefault();
          e.stopPropagation();
          updateDragTarget(dayNum, taskIdx + 1);
        }}
        onDrop={(e) => handleDrop(e, dayNum, taskIdx)}
        className={cn(
          'group relative flex items-start gap-2 rounded-md px-2.5 py-2 colors duration-150 cursor-grab active:cursor-grabbing',

          isDraggingThis && 'opacity-30',
          isCompleted ?
            '-/40 bg-transparent'
          : '- bg-primary/10 hover:-primary/25 ',
        )}
      >
        <div className=' absolute -left-2 -top-2 bg-primary p-1 rounded-full opacity-0 group-hover:opacity-100 '>
          <GripVertical className='w-3 h-3 text-primary-foreground shrink-0  opacity' />
        </div>

        <div
          onClick={() => router.push(`/interview-prep/practice/${qObj.id}`)}
          className='flex flex-col flex-1 min-w-0 cursor-pointer'
        >
          <span
            className={cn(
              'text-[11px] font-medium text-ink-primary leading-snug hover:text-primary colors line-clamp-2',
              isCompleted && 'line-through text-ink-secondary',
            )}
          >
            {qObj.title}
          </span>
          <div className='flex items-center gap-1 mt-0.5 flex-wrap'>
            <span className='text-[8px] text-ink-secondary/70 font-medium'>
              {qObj.category?.name ? cleanName(qObj.category.name) : 'General'}
            </span>
            {isCompleted && <Check className='w-2 h-2' />}
            {isReview && (
              <span className='text-[8px] bg-blue-500/10 text-blue-500 dark:text-blue-400 px-1 rounded font-bold'>
                Review
              </span>
            )}
          </div>
        </div>
      </div>
      {showPlaceholder && (
        <div className='group relative mt-2 truncate w-full line-clamp-2 flex items-center gap-2 rounded-md px-2.5 py-2 bg-primary/10 text-primary/50 colors text-[10px] duration-150 cursor-grab active:cursor-grabbing'>
          <span className='w-2 h-2 bg-primary-foreground rounded-full mr-1'></span>
          Drop here
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// Flat view DayCard
// ─────────────────────────────────────────────
function FlatDayCard({
  dayNum,
  dayTasks,
  dayCompleted,
  isToday,
  isPast,
  dragState,
  questions,
  getDayFormattedDate,
  isReviewTask,
  handleDragStart,
  handleDragEnd,
  updateDragTarget,
  handleDrop,
  handleToggleTaskStatus,
  router,
  claimedStageDays = [],
  onClaimStageReward,
  claimingDayNum,
  activePlanId,
}: {
  dayNum: number;
  dayTasks: PlanTask[];
  dayCompleted: boolean;
  isToday: boolean;
  isPast: boolean;
  dragState: DragState;
  questions: InterviewQuestion[];
  getDayFormattedDate: (d: number) => string;
  isReviewTask: (t: PlanTask) => boolean;
  handleDragStart: (
    e: React.DragEvent,
    id: string,
    dayNum: number,
    taskIndex: number,
  ) => void;
  handleDragEnd: () => void;
  updateDragTarget: (dayNum: number, index: number) => void;
  handleDrop: (e: React.DragEvent, d: number, i: number) => void;
  handleToggleTaskStatus: (t: PlanTask) => void;
  router: ReturnType<typeof useRouter>;
  claimedStageDays?: number[];
  onClaimStageReward?: (dayNum: number) => void;
  claimingDayNum?: number | null;
  activePlanId?: string;
}) {
  const isDraggedOver = dragState.overDayNum === dayNum;
  const completedCount = dayTasks.filter(
    (t) => t.status === 'completed',
  ).length;
  const isClaimed = claimedStageDays.includes(dayNum);
  const canClaim = dayCompleted && !isClaimed;
  const reward = getStageReward(dayNum, activePlanId);

  return (
    <div
      className={cn(
        'rounded-2xl flex flex-col gap-2.5 p-3.5 min-h-[140px] colors duration-150 select-none',
        isToday ? 'bg-primary/10  -primary/25 '
        : isDraggedOver ? 'bg-primary/8  -primary/30 ring-2 ring-primary/30'
        : dayCompleted ? 'bg-emerald-500/8  -emerald-500/15'
        : isPast ? 'bg-background-secondary/40  -/40'
        : 'bg-panel  -/50',
      )}
      onDragOver={(e) => {
        e.preventDefault();
        updateDragTarget(dayNum, dayTasks.length);
      }}
      onDrop={(e) =>
        handleDrop(e, dayNum, dragState.overIndex ?? dayTasks.length)
      }
    >
      {/* Header */}
      <div className='flex items-start justify-between'>
        <div className='flex items-center gap-1.5'>
          <span
            className={cn(
              'text-3xl font-semibold',
              isToday ? 'text-primary' : 'text-ink-primary/20',
            )}
          >
            Day {dayNum}
          </span>
          {isToday && (
            <span className='text-[8px] px-1.5 py-0.5 bg-primary text-primary-foreground! rounded-full font-bold tracking-wider'>
              TODAY
            </span>
          )}
          {dayCompleted && (
            <CheckCircle2 className='w-3 h-3 text-emerald-500' />
          )}
        </div>
        <div className='flex items-start gap-1.5'>
          {dayTasks.length > 0 && (
            <span
              className={cn(
                'text-[9px] font-bold px-3 py-1.5 rounded-full',
                dayCompleted ?
                  'bg-emerald-500 text-primary-foreground dark:text-emerald-400'
                : 'bg-background-secondary/50 text-ink-secondary',
              )}
            >
              {completedCount} / {dayTasks.length}
            </span>
          )}
        </div>
      </div>

      {/* Tasks */}
      <div className='flex flex-col gap-1.5'>
        {dayTasks.map((task, idx) => (
          <TaskItem
            key={task.id}
            task={task}
            taskIdx={idx}
            dayNum={dayNum}
            dragState={dragState}
            questions={questions}
            isReviewTask={isReviewTask}
            handleDragStart={handleDragStart}
            handleDragEnd={handleDragEnd}
            updateDragTarget={updateDragTarget}
            handleDrop={handleDrop}
            handleToggleTaskStatus={handleToggleTaskStatus}
            router={router}
          />
        ))}

        <div
          onDragOver={(e) => {
            e.preventDefault();
            e.stopPropagation();
            updateDragTarget(dayNum, dayTasks.length);
          }}
          onDrop={(e) => handleDrop(e, dayNum, dayTasks.length)}
          className={cn(
            'group relative truncate w-full line-clamp-2 flex ',
            dragState.taskId !== null &&
              dragState.overDayNum === dayNum &&
              dragState.overIndex === dayTasks.length &&
              'bg-primary text-primary/50 items-center gap-2 rounded-md px-2.5 py-2 colors text-[10px] duration-150 cursor-grab active:cursor-grabbing - bg-primary/10 hover:-primary/25',
          )}
        />

        {dayTasks.length === 0 && (
          <div className='py-3 flex items-center justify-center  -dashed -/50 rounded-xl text-[9px] text-ink-muted italic'>
            {dragState.taskId ? 'Drop here' : 'Empty'}
          </div>
        )}
      </div>

      {/* Stage Reward Banner */}
      <div
        className={cn(
          'mt-2 pt-2 border-t flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-xl text-xs colors',
          isClaimed ?
            'bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-300'
          : canClaim ?
            'bg-amber-500/10 border-amber-500/30 text-amber-600 dark:text-amber-300'
          : 'bg-background-secondary/30 border-primary/20 text-ink-secondary',
        )}
      >
        <div className='flex items-center gap-2 min-w-0'>
          <img
            src={reward.icon}
            alt={reward.name}
            className='w-6 h-6 object-contain shrink-0'
          />
          <div className='flex flex-col min-w-0'>
            <span className='text-[8px] font-bold uppercase opacity-60'>
              {isClaimed ?
                'CLAIMED'
              : canClaim ?
                'REWARD UNLOCKED'
              : 'STAGE REWARD'}
            </span>
            <span className='text-[10px] font-extrabold truncate text-ink-primary'>
              {reward.badge}
            </span>
          </div>
        </div>
        {isClaimed ?
          <span className='text-[8px] bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider shrink-0 flex items-center gap-0.5 border border-emerald-500/30'>
            <Check className='w-2.5 h-2.5 stroke-[3]' /> CLAIMED
          </span>
        : canClaim && onClaimStageReward ?
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            disabled={claimingDayNum === dayNum}
            onClick={(e) => {
              e.stopPropagation();
              onClaimStageReward(dayNum);
            }}
            className='px-2.5 py-1 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-black font-black text-[9px] uppercase tracking-wider shadow-md shadow-emerald-500/30 animate-text-shimmer-primary animate-text-shimmer flex items-center gap-1 cursor-pointer shrink-0'
          >
            <Gift className='w-3 h-3' />
            {claimingDayNum === dayNum ? 'Claiming...' : 'Claim'}
          </motion.button>
        : <span className='text-[8px] bg-background-secondary text-ink-secondary px-2 py-0.5 rounded-full font-semibold uppercase tracking-wider shrink-0'>
            {reward.type === 'loot_box' ? 'RARE' : 'BONUS'}
          </span>
        }
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// 3D Roadmap View
// ─────────────────────────────────────────────
// ─────────────────────────────────────────────
// Rewards Pool & Helpers
// ─────────────────────────────────────────────
const REWARD_POOL = [
  {
    type: 'loot_box',
    name: 'Mystic Loot Box',
    badge: '🧰 Mystery Loot Box',
    icon: '/loot-box.png',
  },
  {
    type: 'gold_coins',
    name: '100 Gold Coins',
    badge: '🪙 +100 Gold Coins',
    icon: '/gold-coin.png',
  },
  {
    type: 'streak_card',
    name: 'Streak Saver Card',
    badge: '🔥 Streak Saver',
    icon: '/streak-card.png',
  },
  {
    type: 'double_xp',
    name: '2X XP Booster Card',
    badge: '⚡ 2X XP Booster',
    icon: '/double-xp-card.png',
  },
  {
    type: 'vip_days',
    name: '3-Day VIP Pass',
    badge: '👑 3-Day VIP Pass',
    icon: '/vip-card.png',
  },
];

function getStageReward(dayNum: number, planId: string = 'default') {
  let hash = dayNum * 37;
  for (let i = 0; i < planId.length; i++) {
    hash = (hash << 5) - hash + planId.charCodeAt(i);
    hash |= 0;
  }
  const index = Math.abs(hash) % REWARD_POOL.length;
  return REWARD_POOL[index];
}

const CIRCLE_GRADIENTS = [
  'bg-gradient-to-br from-amber-400 via-orange-500 to-amber-600 text-black border-amber-200 shadow-amber-500/40',
  'bg-gradient-to-br from-emerald-400 via-teal-500 to-emerald-600 text-white border-emerald-200 shadow-emerald-500/40',
  'bg-gradient-to-br from-cyan-400 via-blue-500 to-indigo-600 text-white border-cyan-200 shadow-cyan-500/40',
  'bg-gradient-to-br from-purple-500 via-fuchsia-500 to-indigo-700 text-white border-purple-200 shadow-purple-500/40',
  'bg-gradient-to-br from-rose-400 via-pink-500 to-red-600 text-white border-rose-200 shadow-rose-500/40',
  'bg-gradient-to-br from-lime-400 via-emerald-500 to-teal-600 text-black border-lime-200 shadow-lime-500/40',
  'bg-gradient-to-br from-yellow-300 via-amber-500 to-orange-600 text-black border-yellow-100 shadow-yellow-500/40',
  'bg-gradient-to-br from-indigo-400 via-purple-600 to-pink-600 text-white border-indigo-200 shadow-indigo-500/40',
];

interface Roadmap3DViewProps {
  dayDataArr: {
    dayNum: number;
    dayTasks: PlanTask[];
    dayCompleted: boolean;
    dayDate: Date;
    isToday: boolean;
    isPast: boolean;
  }[];
  dragState: DragState;
  questions: InterviewQuestion[];
  getDayFormattedDate: (d: number) => string;
  isReviewTask: (t: PlanTask) => boolean;
  handleDragStart: (
    e: React.DragEvent,
    id: string,
    dayNum: number,
    taskIndex: number,
  ) => void;
  handleDragEnd: () => void;
  updateDragTarget: (dayNum: number, index: number) => void;
  handleDrop: (e: React.DragEvent, d: number, i: number) => void;
  handleToggleTaskStatus: (t: PlanTask) => void;
  router: ReturnType<typeof useRouter>;
  activePlanId?: string;
  claimedStageDays?: number[];
  onClaimStageReward?: (dayNum: number) => void;
  claimingDayNum?: number | null;
}

function Roadmap3DView({
  dayDataArr,
  dragState,
  questions,
  getDayFormattedDate,
  isReviewTask,
  handleDragStart,
  handleDragEnd,
  updateDragTarget,
  handleDrop,
  handleToggleTaskStatus,
  router,
  activePlanId,
  claimedStageDays = [],
  onClaimStageReward,
  claimingDayNum,
}: Roadmap3DViewProps) {
  const todayRef = React.useRef<HTMLDivElement | null>(null);

  const handleJumpToToday = () => {
    if (todayRef.current) {
      todayRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      if (todayRef.current) {
        todayRef.current.scrollIntoView({
          behavior: 'smooth',
          block: 'center',
        });
      }
    }, 200);
    return () => clearTimeout(timer);
  }, [dayDataArr.length]);

  // Calculate dynamic node circle positions in center corridor (alternating 38% and 62%)
  // Dynamic vertical gap stretches dynamically if cards have many tasks!
  const nodePositions = React.useMemo(() => {
    let currentY = 240; // Generous top padding space so stage 1 doesn't collide with page header
    return dayDataArr.map((dayData, i) => {
      const isLeft = i % 2 === 0;
      const xPercent = isLeft ? 38 : 62;
      const yPos = currentY;
      const circleCenterY = yPos + 44; // 88px circle pin center

      const taskCount = dayData.dayTasks.length;
      // Base gap 290 + 55px for each extra task beyond 2
      const dynamicGap = 290 + Math.max(0, (taskCount - 2) * 55);
      currentY += dynamicGap;

      return {
        xPercent,
        yPos,
        svgX: xPercent * 10,
        svgY: circleCenterY,
        isLeft,
        dynamicGap,
      };
    });
  }, [dayDataArr]);

  const TOTAL_HEIGHT = React.useMemo(() => {
    if (nodePositions.length === 0) return 750;
    const lastNode = nodePositions[nodePositions.length - 1];
    return Math.max(lastNode.yPos + 350, 750);
  }, [nodePositions]);

  // Construct ultra-smooth Bezier spline through center corridor
  const pathD = React.useMemo(() => {
    if (nodePositions.length === 0) return '';
    if (nodePositions.length === 1) {
      return `M ${nodePositions[0].svgX} ${nodePositions[0].svgY}`;
    }

    let d = `M ${nodePositions[0].svgX} ${nodePositions[0].svgY}`;
    for (let i = 0; i < nodePositions.length - 1; i++) {
      const curr = nodePositions[i];
      const next = nodePositions[i + 1];

      const segmentHeight = next.svgY - curr.svgY;
      const cp1x = curr.svgX;
      const cp1y = curr.svgY + segmentHeight * 0.5;
      const cp2x = next.svgX;
      const cp2y = next.svgY - segmentHeight * 0.5;

      d += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${next.svgX} ${next.svgY}`;
    }
    return d;
  }, [nodePositions]);

  return (
    <div
      style={{
        maskImage:
          'linear-gradient(to bottom, transparent, black 64px, black calc(100% - 24px), transparent), linear-gradient(to left, black 0px, transparent 0px)',
        WebkitMaskImage:
          'linear-gradient(to bottom, transparent, black 64px, black calc(100% - 24px), transparent), linear-gradient(to left, black 0px, transparent 0px)',
        maskSize: '100% 100%',
        WebkitMaskSize: '100% 100%',
        maskPosition: '0 0, 100% 0',
        WebkitMaskPosition: '0 0, 100% 0',
        maskRepeat: 'no-repeat, no-repeat',
        WebkitMaskRepeat: 'no-repeat, no-repeat',
        transform: 'none',
      }}
      className='fixed inset-0 z-20 h-screen overflow-y-auto overflow-x-hidden custom-scrollbar  text-white'
    >
      <style>{`
        @keyframes pathDashFlow {
          from { stroke-dashoffset: 0; }
          to { stroke-dashoffset: -48; }
        }
        .animate-game-path {
          animation: pathDashFlow 2s linear infinite;
        }
      `}</style>

      {/* Background Image */}
      <div
        className='fixed inset-0 bg-cover bg-center bg-no-repeat opacity-100 transform duration-1000 pointer-events-none'
        style={{ backgroundImage: 'url("/game-map-bg.jpeg")' }}
      />
      <div className='fixed inset-0  bg-white/20 dark:bg-black/50 z-10 h-full w-full pointer-events-none' />
      <div className='fixed inset-0 bg-linear-to-b from-white via-white  dark:from-black dark:via-black/70 to-transparent z-40 h-[100px] w-full pointer-events-none' />

      {/* Jump to Today Floating Button */}
      <div className='fixed bottom-20 right-6 z-50'>
        <motion.button
          onClick={handleJumpToToday}
          whileHover={{ scale: 1.08 }}
          whileTap={{ scale: 0.94 }}
          className='flex items-center gap-2 px-4 py-2.5 rounded-full bg-primary text-primary-foreground font-bold shadow-2xl shadow-primary/40 border border-white/20 backdrop-blur-xl text-xs hover:opacity-95 all'
          title='Jump to current level'
        >
          <Navigation className='w-4 h-4 animate-text-shimmer-primary animate-text-shimmer' />
          <span>Jump to Today</span>
        </motion.button>
      </div>

      {/* Scrollable Game Roadmap Canvas */}
      <div
        className='relative w-full max-w-6xl mx-auto px-4 md:px-8'
        style={{ height: `${TOTAL_HEIGHT}px` }}
      >
        {/* Animated Dashed Game Path (ONLY passes through circle centers in the middle corridor) */}
        <svg
          className='absolute top-0 left-0 w-full h-full pointer-events-none z-0'
          viewBox={`0 0 1000 ${TOTAL_HEIGHT}`}
          preserveAspectRatio='none'
        >
          <defs>
            <linearGradient id='gamePathGrad' x1='0%' y1='0%' x2='0%' y2='100%'>
              <stop offset='0%' stopColor='#3b82f6' stopOpacity='0.95' />
              <stop offset='33%' stopColor='#10b981' stopOpacity='0.95' />
              <stop offset='66%' stopColor='#f59e0b' stopOpacity='0.95' />
              <stop offset='100%' stopColor='#ec4899' stopOpacity='0.95' />
            </linearGradient>
            <filter id='pathGlow' x='-20%' y='-20%' width='140%' height='140%'>
              <feGaussianBlur stdDeviation='5' result='blur' />
              <feComposite in='SourceGraphic' in2='blur' operator='over' />
            </filter>
          </defs>

          {/* Path shadow line */}
          <path
            d={pathD}
            fill='none'
            stroke='rgba(0, 0, 0, 0.7)'
            strokeWidth='10'
            vectorEffect='non-scaling-stroke'
          />

          {/* Outer dashed track border */}
          <path
            d={pathD}
            fill='none'
            stroke='rgba(255, 255, 255, 0.3)'
            strokeWidth='7'
            strokeDasharray='14 10'
            vectorEffect='non-scaling-stroke'
          />

          {/* Vibrant Animated Glowing Game Dashed Line */}
          <path
            d={pathD}
            fill='none'
            stroke='url(#gamePathGrad)'
            strokeWidth='5'
            strokeDasharray='14 10'
            vectorEffect='non-scaling-stroke'
            className='animate-game-path'
            filter='url(#pathGlow)'
          />
        </svg>

        {dayDataArr.map((dayData, idx) => {
          const { dayNum, dayTasks, dayCompleted, isToday, isPast } = dayData;
          const pos = nodePositions[idx] || {
            xPercent: 50,
            yPos: 160,
            isLeft: true,
          };
          const isDraggedOver = dragState.overDayNum === dayNum;
          const completedCount = dayTasks.filter(
            (t) => t.status === 'completed',
          ).length;
          const gradientClass =
            CIRCLE_GRADIENTS[(dayNum - 1) % CIRCLE_GRADIENTS.length];
          const reward = getStageReward(dayNum, activePlanId);
          const isClaimed = claimedStageDays.includes(dayNum);
          const canClaim = dayCompleted && !isClaimed;

          return (
            <div
              key={dayNum}
              ref={isToday ? todayRef : null}
              className='absolute -translate-x-1/2 flex items-start z-10'
              style={{
                left: `${pos.xPercent}%`,
                top: `${pos.yPos}px`,
              }}
            >
              {/* Level Circle Pin (Vibrant colorful background with ✔ checkmark for completed) */}
              <motion.div
                whileHover={{ scale: 1.15, rotate: pos.isLeft ? -5 : 5 }}
                className={cn(
                  'relative w-18 h-18 sm:w-22 sm:h-22 rounded-full flex flex-col items-center justify-center cursor-pointer shadow-2xl all duration-300 border-4 select-none shrink-0 z-20',
                  isToday ?
                    'bg-primary text-primary-foreground border-white ring-8 ring-primary/40  scale-105'
                  : dayCompleted ?
                    'bg-emerald-500 text-white border-emerald-300 ring-4 ring-emerald-500/40 shadow-emerald-500/50'
                  : isPast ? 'bg-zinc-800/90 text-zinc-300 border-zinc-600'
                  : cn(gradientClass, 'hover:scale-110'),
                )}
              >
                {isToday && (
                  <span className='absolute -top-9 px-2.5 py-0.5 text-[9px] font-black bg-primary text-primary-foreground rounded-full shadow-lg uppercase tracking-wider animate-bounce border border-white/30'>
                    Current
                  </span>
                )}
                {dayCompleted ?
                  <div className='flex flex-col items-center justify-center '>
                    <Check className='w-8 h-8 sm:w-10 sm:h-10 text-white stroke-[3.5] drop-shadow-md' />
                    <span className='text-[8px] font-black tracking-tighter uppercase opacity-95'>
                      DAY {dayNum}
                    </span>
                  </div>
                : <>
                    <span className='text-[9px] font-extrabold uppercase tracking-widest opacity-85'>
                      Stage
                    </span>
                    <span className='text-2xl sm:text-3xl font-black leading-none tracking-tight'>
                      {dayNum}
                    </span>
                  </>
                }
              </motion.div>

              {/* Stage Card (Positioned to Outer Left or Outer Right of circle, completely decoupled without touching lines!) */}
              <motion.div
                whileHover={{
                  scale: 1.02,
                  rotateX: 2,
                  rotateY: pos.isLeft ? -3 : 3,
                }}
                transition={{ duration: 0.2 }}
                className={cn(
                  'absolute w-[270px] sm:w-[310px] md:w-[350px] rounded-3xl p-4 md:p-5 all duration-200 border text-white shadow-2xl z-10',
                  'bg-black/90 backdrop-blur-2xl border-white/15',
                  pos.isLeft ?
                    'right-full mr-6 sm:mr-10'
                  : 'left-full ml-6 sm:ml-10',
                  isToday &&
                    'ring-2 ring-primary border-transparent bg-primary/95 shadow-primary/20',
                  dayCompleted &&
                    'ring-2 ring-emerald-500/80 border-emerald-500/40',
                  isDraggedOver &&
                    'ring-4 ring-primary border-primary bg-primary/20',
                )}
                onDragOver={(e) => {
                  e.preventDefault();
                  updateDragTarget(dayNum, dayTasks.length);
                }}
                onDrop={(e) =>
                  handleDrop(e, dayNum, dragState.overIndex ?? dayTasks.length)
                }
              >
                {/* Card Header */}
                <div className='flex items-center justify-between pb-3 mb-3 border-b border-white/10'>
                  <div className='flex flex-col'>
                    <span className='text-[10px] text-white/70 font-bold uppercase tracking-widest'>
                      {getDayFormattedDate(dayNum)}
                    </span>
                    <div className='flex items-center gap-1.5 mt-0.5'>
                      {isToday ?
                        <span className='text-xs font-bold text-primary-foreground flex items-center gap-1'>
                          <Sparkles className='w-3.5 h-3.5' /> Today's Quest
                        </span>
                      : dayCompleted ?
                        <span className='text-xs font-bold text-emerald-400 flex items-center gap-1'>
                          <Trophy className='w-3.5 h-3.5' /> Cleared
                        </span>
                      : <span className='text-xs font-semibold text-white/90'>
                          Level {dayNum}
                        </span>
                      }
                    </div>
                  </div>
                  {dayTasks.length > 0 && (
                    <div className='flex items-center gap-1 bg-white/10 px-2.5 py-1 rounded-full border border-white/10'>
                      <Zap
                        className={cn(
                          'w-3.5 h-3.5',
                          dayCompleted ? 'text-emerald-400' : 'text-primary',
                        )}
                      />
                      <span className='text-xs font-bold'>
                        {completedCount}/{dayTasks.length}
                      </span>
                    </div>
                  )}
                </div>

                {/* Tasks List (Unclipped full list, height stretches dynamically!) */}
                <div className='flex flex-col gap-2 pr-1'>
                  {dayTasks.length === 0 ?
                    <div className='py-6 flex flex-col items-center justify-center border-2 border-dashed border-white/15 rounded-2xl opacity-60'>
                      <span className='text-xs font-medium text-white/60'>
                        {dragState.taskId ?
                          'DROP QUEST HERE'
                        : 'NO QUESTS SCHEDULED'}
                      </span>
                    </div>
                  : dayTasks.map((task, taskIdx) => {
                      const qObj = questions.find(
                        (q) => q.id === task.question_id,
                      );
                      if (!qObj) return null;
                      const isCompleted = task.status === 'completed';
                      const isReview = isReviewTask(task);
                      const isDraggingThis = dragState.taskId === task.id;
                      const showPlaceholder =
                        dragState.taskId !== null &&
                        dragState.overDayNum === dayNum &&
                        dragState.overIndex === taskIdx &&
                        dragState.taskId !== task.id;

                      return (
                        <div key={task.id} className='relative'>
                          <div
                            draggable
                            onDragStart={(e) =>
                              handleDragStart(e, task.id, dayNum, taskIdx)
                            }
                            onDragEnd={handleDragEnd}
                            onDragOver={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              updateDragTarget(dayNum, taskIdx);
                            }}
                            onDrop={(e) => handleDrop(e, dayNum, taskIdx)}
                            onClick={() =>
                              router.push(`/interview-prep/practice/${qObj.id}`)
                            }
                            className={cn(
                              'group relative flex items-start gap-2.5 rounded-xl p-2.5 all cursor-pointer border select-none',
                              isDraggingThis && 'opacity-30',
                              isCompleted ?
                                'bg-white/5 border-white/5 opacity-70 hover:opacity-100'
                              : 'bg-white/10 hover:bg-white/70 border-white/15 backdrop-blur-md',
                            )}
                          >
                            <div className='flex flex-col min-w-0 flex-1 cursor-pointer'>
                              <span
                                className={cn(
                                  'text-xs font-semibold text-white leading-snug line-clamp-2 group-hover:text-primary colors',
                                  isCompleted && 'line-through opacity-60',
                                )}
                              >
                                {qObj.title}
                              </span>
                              <div className='flex items-center gap-1.5 mt-1 flex-wrap'>
                                <span className='text-[9px] bg-white/10 px-1.5 py-0.5 rounded text-white/70 font-medium'>
                                  {qObj.category?.name ?
                                    cleanName(qObj.category.name)
                                  : 'General'}
                                </span>
                                {isReview && (
                                  <span className='text-[9px] bg-blue-500/20 text-blue-300 border border-blue-500/30 px-1.5 py-0.5 rounded font-extrabold uppercase tracking-wider'>
                                    Review
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                          {showPlaceholder && (
                            <div className='mt-2 truncate w-full flex items-center gap-2 rounded-xl p-2.5 bg-primary/20 border border-primary/50 text-primary text-xs'>
                              <span className='w-2 h-2 bg-primary rounded-full animate-ping' />
                              Drop quest here
                            </div>
                          )}
                        </div>
                      );
                    })
                  }

                  <div
                    onDragOver={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      updateDragTarget(dayNum, dayTasks.length);
                    }}
                    onDrop={(e) => handleDrop(e, dayNum, dayTasks.length)}
                    className={cn(
                      'h-2 shrink-0 rounded-full colors',
                      dragState.taskId !== null &&
                        dragState.overDayNum === dayNum &&
                        dragState.overIndex === dayTasks.length &&
                        'bg-primary',
                    )}
                  />
                </div>

                {/* Stage Reward Banner (Visualized randomized 3D item reward) */}
                <div
                  className={cn(
                    'mt-3.5 pt-3 border-t flex items-center justify-between gap-2 px-3 py-2 rounded-2xl all',
                    isClaimed ?
                      'bg-emerald-500/20 border-emerald-500/40 text-emerald-300'
                    : canClaim ?
                      'bg-amber-500/20 border-amber-500/40 text-amber-300'
                    : 'bg-white/5 border-white/10 text-amber-300',
                  )}
                >
                  <div className='flex items-center gap-2.5 min-w-0'>
                    <div className='relative w-9 h-9 shrink-0 flex items-center justify-center bg-black/50 rounded-xl p-1 border border-white/15 shadow-inner'>
                      <img
                        src={reward.icon}
                        alt={reward.name}
                        className={cn(
                          'w-full h-full object-contain filter drop-shadow-md transform duration-300',
                          dayCompleted ? 'scale-110' : 'hover:scale-110',
                        )}
                      />
                    </div>
                    <div className='flex flex-col min-w-0'>
                      <span className='text-[9px] text-white/60 font-bold uppercase tracking-wider'>
                        {isClaimed ?
                          'STAGE REWARD CLAIMED'
                        : canClaim ?
                          'REWARD UNLOCKED!'
                        : 'STAGE REWARD'}
                      </span>
                      <span className='text-xs font-black truncate text-white'>
                        {reward.badge}
                      </span>
                    </div>
                  </div>
                  {isClaimed ?
                    <span className='text-[9px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 px-2.5 py-1 rounded-full font-black uppercase tracking-wider shrink-0 flex items-center gap-1'>
                      <Check className='w-3 h-3 stroke-[3]' /> CLAIMED
                    </span>
                  : canClaim && onClaimStageReward ?
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      disabled={claimingDayNum === dayNum}
                      onClick={(e) => {
                        e.stopPropagation();
                        onClaimStageReward(dayNum);
                      }}
                      className='px-3 py-1.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-black font-black text-[10px] uppercase tracking-wider shadow-lg shadow-emerald-500/40 animate-text-shimmer-primary animate-text-shimmer flex items-center gap-1 cursor-pointer shrink-0 border border-emerald-300'
                    >
                      <Gift className='w-3.5 h-3.5' />
                      {claimingDayNum === dayNum ?
                        'Claiming...'
                      : 'Claim Reward'}
                    </motion.button>
                  : <span className='text-[9px] bg-white/10 text-white/80 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider shrink-0'>
                      {reward.type === 'loot_box' ? 'RARE' : 'BONUS'}
                    </span>
                  }
                </div>
              </motion.div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Skeleton
// ─────────────────────────────────────────────
function RoadmapSkeleton() {
  return (
    <div className='flex flex-col gap-5 animate-text-shimmer-primary animate-text-shimmer pb-8'>
      <div className='flex justify-between items-center pb-4 -b -/60'>
        <div className='flex flex-col gap-1.5'>
          <div className='h-5 bg-panel rounded-lg w-48' />
          <div className='h-3 bg-panel rounded w-36' />
        </div>
        <div className='h-1.5 bg-panel rounded-full w-36' />
      </div>
      <div className='flex flex-col gap-0 ml-0'>
        {[1, 0.84, 0.72, 0.62].map((s, i) => (
          <div
            key={i}
            className='rounded-2xl bg-panel  -/40 p-4'
            style={{
              transform: `scaleY(${s})`,
              transformOrigin: 'top center',
              marginBottom: i < 3 ? -12 : 0,
              zIndex: 4 - i,
            }}
          >
            <div className='flex gap-4 ml-10'>
              <div className='flex flex-col gap-1 w-20'>
                <div className='h-4 bg-background-secondary rounded w-14' />
                <div className='h-2.5 bg-background-secondary/60 rounded w-20' />
              </div>
              <div className='flex gap-2 flex-1'>
                <div className='h-7 bg-background-secondary/60 rounded-xl w-32' />
                <div className='h-7 bg-background-secondary/60 rounded-xl w-40' />
                <div className='h-7 bg-background-secondary/60 rounded-xl w-28' />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
