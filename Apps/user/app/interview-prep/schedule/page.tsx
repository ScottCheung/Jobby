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
import { WaterfallLayout } from '@/components/layout/waterfallLayout';
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
} from 'lucide-react';
import { cn, cleanName } from '@/lib/utils';
import { practiceCache } from '../practice/practice-cache';
import { motion, AnimatePresence } from 'framer-motion';
import { PlanSetupSection } from '../_components/PlanSetupSection';
import { CustomizePlanModal } from '../_components/CustomizePlanModal';
import { Modal } from '@/components/layout/modal';
import { Button } from '@/components/UI/Button';

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────
type ViewMode = '3d' | 'flat';

interface DragState {
  taskId: string | null;
  sourceDayNum: number | null;
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

  const [questions, setQuestions] = useState<InterviewQuestion[]>([]);
  const [categories, setCategories] = useState<InterviewCategory[]>([]);
  const [activePlan, setActivePlan] = useState<PracticePlan | null>(null);
  const [planTasks, setPlanTasks] = useState<PlanTask[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [isResetOpen, setIsResetOpen] = useState(false);
  const [selectedPreset, setSelectedPreset] = useState<
    'sprint' | 'tactical' | 'master'
  >('tactical');
  const [isCustomizeOpen, setIsCustomizeOpen] = useState(false);
  const [isCreatingPlan, setIsCreatingPlan] = useState(false);

  const [viewMode, setViewMode] = useState<ViewMode>('3d');
  useEffect(() => {
    const stored = localStorage.getItem('scheduleViewMode') as ViewMode | null;
    if (stored === 'flat' || stored === '3d') setViewMode(stored);
  }, []);
  const toggleViewMode = () => {
    setViewMode((prev) => {
      const next = prev === '3d' ? 'flat' : '3d';
      localStorage.setItem('scheduleViewMode', next);
      return next;
    });
  };

  const [dragState, setDragState] = useState<DragState>({
    taskId: null,
    sourceDayNum: null,
    overDayNum: null,
    overIndex: null,
  });

  const initData = async (forceRefetch = false) => {
    if (practiceCache.questions && !forceRefetch) {
      setQuestions(practiceCache.questions);
      setCategories(practiceCache.categories || []);
      setActivePlan(practiceCache.activePlan);
      setPlanTasks(practiceCache.planTasks || []);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    const startTime = Date.now();
    try {
      const [qs, plans, cats] = await Promise.all([
        api.interviewQuestions(),
        api.practicePlans(),
        api.interviewCategories(),
      ]);
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
      } else {
        practiceCache.activePlan = null;
        practiceCache.planTasks = [];
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
  ) => {
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', taskId);
    setDragState({ taskId, sourceDayNum, overDayNum: null, overIndex: null });
  };
  const handleDragEnd = () =>
    setDragState({
      taskId: null,
      sourceDayNum: null,
      overDayNum: null,
      overIndex: null,
    });

  const handleDrop = async (
    e: React.DragEvent,
    targetDayNum: number,
    insertIndex: number,
  ) => {
    e.preventDefault();
    const taskId = e.dataTransfer.getData('text/plain') || dragState.taskId;
    setDragState({
      taskId: null,
      sourceDayNum: null,
      overDayNum: null,
      overIndex: null,
    });
    if (!taskId || !activePlan) return;
    const planStart = new Date(activePlan.created_at || new Date());
    const targetDate = new Date(planStart);
    targetDate.setDate(planStart.getDate() + (targetDayNum - 1));
    targetDate.setHours(9, Math.max(0, insertIndex), 0, 0);
    setPlanTasks((prev) => {
      const updated = prev.map((t) =>
        t.id === taskId ?
          { ...t, scheduled_date: targetDate.toISOString() }
        : t,
      );
      practiceCache.planTasks = updated;
      return updated;
    });
    try {
      await api.updatePlanTask(activePlan.id, taskId, {
        scheduled_date: targetDate.toISOString(),
      });
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
          className='label mt-2 px-5 py-2 text-primary-foreground bg-primary rounded-xl hover:opacity-90 transition-opacity'
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
        setDragState={setDragState}
        handleDrop={handleDrop}
        handleToggleTaskStatus={handleToggleTaskStatus}
        router={router}
      />
    ),
  );

  return (
    <div className='relative flex flex-col gap-5 pb-12 pr-1'>
      {/* Header */}
      <div className='flex flex-col md:flex-row justify-between items-start md:items-center gap-3 border-b border-border/60 pb-4 shrink-0'>
        <div className='flex flex-col gap-0.5'>
          <div className='flex items-center gap-2 flex-wrap'>
            <h2 className='title-section'>{activePlan.name}</h2>
            <Button
              onClick={handleDeletePlan}
              className='flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold text-rose-500 bg-rose-500/8 hover:bg-rose-500/15 rounded-lg transition-colors'
            >
              <Trash2 className='w-3 h-3' />
              Delete
            </Button>
            <Button
              layoutId='Prepare Your Practice Plan'
              onClick={() => setIsResetOpen(true)}
              className='flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold text-primary bg-primary/10 hover:bg-primary/15 rounded-lg transition-colors'
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
            className='h-full bg-primary rounded-full'
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
              setDragState={setDragState}
              handleDrop={handleDrop}
              handleToggleTaskStatus={handleToggleTaskStatus}
              router={router}
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
            'w-10 h-10 rounded-2xl flex items-center justify-center shadow-xl transition-colors duration-200',
            viewMode === '3d' ?
              'bg-primary text-ink-primary shadow-primary/30'
            : 'bg-panel border border-border text-ink-secondary hover:text-ink-primary',
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
        onClose={() => setIsResetOpen(false)}
        className='w-[92vw] max-w-4xl max-h-[90vh] overflow-y-auto'
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
  handleDragStart: (e: React.DragEvent, taskId: string, dayNum: number) => void;
  handleDragEnd: () => void;
  setDragState: React.Dispatch<React.SetStateAction<DragState>>;
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
  setDragState,
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
    dragState.overIndex === taskIdx &&
    dragState.taskId !== task.id;

  return (
    <React.Fragment>
      {showPlaceholder && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 32 }}
          className='rounded-lg border-2 border-dashed border-primary/50 bg-primary/5 flex items-center justify-center'
        >
          <span className='text-[9px] text-primary/70 font-semibold'>
            Drop here
          </span>
        </motion.div>
      )}
      <div
        draggable
        onDragStart={(e) => handleDragStart(e, task.id, dayNum)}
        onDragEnd={handleDragEnd}
        onDragOver={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setDragState((p) => ({
            ...p,
            overDayNum: dayNum,
            overIndex: taskIdx,
          }));
        }}
        className={cn(
          'group px-2.5 py-2 rounded-xl border flex items-start gap-2 cursor-grab active:cursor-grabbing transition-all duration-150',
          isDraggingThis && 'opacity-30 scale-[0.97]',
          isCompleted ?
            'border-border/40 bg-transparent'
          : 'border-border bg-panel shadow-sm hover:border-primary/25 hover:shadow-md',
        )}
      >
        <GripVertical className='w-3 h-3 text-ink-muted/40 shrink-0 mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity' />
        <button
          className={cn(
            'w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0 mt-0.5 transition-all cursor-default',
            isCompleted ?
              'bg-emerald-500 border-emerald-500 text-ink-primary'
            : 'border-border hover:border-primary',
          )}
        >
          {isCompleted && <Check className='w-2 h-2' />}
        </button>
        <div
          onClick={() => router.push(`/interview-prep/practice/${qObj.id}`)}
          className='flex flex-col flex-1 min-w-0 cursor-pointer'
        >
          <span
            className={cn(
              'text-[11px] font-medium text-ink-primary leading-snug hover:text-primary transition-colors line-clamp-2',
              isCompleted && 'line-through text-ink-secondary',
            )}
          >
            {qObj.title}
          </span>
          <div className='flex items-center gap-1 mt-0.5 flex-wrap'>
            <span className='text-[8px] text-ink-secondary/70 font-medium'>
              {qObj.category?.name ? cleanName(qObj.category.name) : 'General'}
            </span>
            {isReview && (
              <span className='text-[8px] bg-blue-500/10 text-blue-500 dark:text-blue-400 px-1 rounded font-bold'>
                ↩ Review
              </span>
            )}
          </div>
        </div>
      </div>
    </React.Fragment>
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
  setDragState,
  handleDrop,
  handleToggleTaskStatus,
  router,
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
  handleDragStart: (e: React.DragEvent, id: string, d: number) => void;
  handleDragEnd: () => void;
  setDragState: React.Dispatch<React.SetStateAction<DragState>>;
  handleDrop: (e: React.DragEvent, d: number, i: number) => void;
  handleToggleTaskStatus: (t: PlanTask) => void;
  router: ReturnType<typeof useRouter>;
}) {
  const isDraggedOver = dragState.overDayNum === dayNum;
  const completedCount = dayTasks.filter(
    (t) => t.status === 'completed',
  ).length;

  return (
    <div
      className={cn(
        'rounded-2xl flex flex-col gap-2.5 p-3.5 min-h-[140px] transition-all duration-200 select-none',
        isToday ?
          'bg-primary/10 border border-primary/25 shadow-md shadow-primary/10'
        : isDraggedOver ? 'bg-primary/8 border border-primary/30 scale-[1.01]'
        : dayCompleted ? 'bg-emerald-500/8 border border-emerald-500/15'
        : isPast ? 'bg-background-secondary/40 border border-border/40'
        : 'bg-panel border border-border/50',
      )}
      onDragOver={(e) => {
        e.preventDefault();
        setDragState((p) => ({
          ...p,
          overDayNum: dayNum,
          overIndex: dayTasks.length,
        }));
      }}
      onDrop={(e) =>
        handleDrop(e, dayNum, dragState.overIndex ?? dayTasks.length)
      }
    >
      {/* Header */}
      <div className='flex items-center justify-between'>
        <div className='flex items-center gap-1.5'>
          <span
            className={cn(
              'label-sm',
              isToday ? 'text-primary' : 'text-ink-primary',
            )}
          >
            Day {dayNum}
          </span>
          {isToday && (
            <span className='text-[8px] px-1.5 py-0.5 bg-primary text-ink-primary rounded-full font-bold tracking-wider'>
              TODAY
            </span>
          )}
          {dayCompleted && (
            <CheckCircle2 className='w-3 h-3 text-emerald-500' />
          )}
        </div>
        <div className='flex items-center gap-1.5'>
          <span className='text-[9px] text-ink-secondary'>
            {getDayFormattedDate(dayNum)}
          </span>
          {dayTasks.length > 0 && (
            <span
              className={cn(
                'text-[9px] font-bold px-1.5 py-0.5 rounded-full',
                dayCompleted ?
                  'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                : 'bg-background-secondary text-ink-secondary',
              )}
            >
              {completedCount}/{dayTasks.length}
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
            setDragState={setDragState}
            handleToggleTaskStatus={handleToggleTaskStatus}
            router={router}
          />
        ))}

        {/* End placeholder */}
        {dragState.taskId !== null &&
          dragState.overDayNum === dayNum &&
          dragState.overIndex === dayTasks.length && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 32 }}
              className='rounded-lg border-2 border-dashed border-primary/50 bg-primary/5 flex items-center justify-center'
            >
              <span className='text-[9px] text-primary/70 font-semibold'>
                Drop here
              </span>
            </motion.div>
          )}

        {dayTasks.length === 0 && (
          <div className='py-3 flex items-center justify-center border border-dashed border-border/50 rounded-xl text-[9px] text-ink-muted italic'>
            {dragState.taskId ? 'Drop here' : 'Empty'}
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// 3D Roadmap View
// ─────────────────────────────────────────────
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
  handleDragStart: (e: React.DragEvent, id: string, d: number) => void;
  handleDragEnd: () => void;
  setDragState: React.Dispatch<React.SetStateAction<DragState>>;
  handleDrop: (e: React.DragEvent, d: number, i: number) => void;
  handleToggleTaskStatus: (t: PlanTask) => void;
  router: ReturnType<typeof useRouter>;
}

function Roadmap3DView({
  dayDataArr,
  dragState,
  questions,
  getDayFormattedDate,
  isReviewTask,
  handleDragStart,
  handleDragEnd,
  setDragState,
  handleDrop,
  handleToggleTaskStatus,
  router,
}: Roadmap3DViewProps) {
  return (
    <div className='fixed w-full top-0 bottom-0 left-0 z-20 h-screen  overflow-hidden'>
      {/* Background Image */}
      <div
        className='absolute inset-0 bg-cover bg-center bg-no-repeat transition-transform duration-1000'
        style={{ backgroundImage: 'url("/game-map-bg.jpeg")' }}
      />
      {/* Overlay for contrast */}
      <div className='absolute inset-0  dark:bg-black/50 ' />

      {/* Scrollable Container */}
      <div className='absolute inset-0 overflow-x-auto overflow-y-hidden custom-scrollbar pb-6'>
        <div className='flex items-center min-w-max h-full px-24 gap-[180px] relative pt-10'>
          {/* Decorative Path Line Behind Nodes */}
          <svg
            className='absolute top-1/2 left-0 w-full h-[200px] -translate-y-1/2 pointer-events-none'
            preserveAspectRatio='none'
          >
            <path
              d={`M 0 100 ${dayDataArr.map((_, i) => `Q ${i * 500 + 250} ${i % 2 === 0 ? -100 : 300}, ${i * 500 + 500} 100`).join(' ')}`}
              fill='none'
              stroke='rgba(255,255,255,0.2)'
              strokeWidth='4'
              strokeDasharray='12 12'
            />
          </svg>

          {dayDataArr.map((dayData, idx) => {
            const { dayNum, dayTasks, dayCompleted, isToday, isPast } = dayData;
            const isUp = idx % 2 === 0;
            const yOffset = isUp ? -50 : 70;
            const isDraggedOver = dragState.overDayNum === dayNum;
            const completedCount = dayTasks.filter(
              (t) => t.status === 'completed',
            ).length;

            return (
              <motion.div
                key={dayNum}
                animate={{ y: [yOffset, yOffset - 12, yOffset] }}
                transition={{
                  repeat: Infinity,
                  duration: 4,
                  ease: 'easeInOut',
                  delay: idx * 0.4,
                }}
                className='relative w-[340px] shrink-0'
              >
                {/* Node marker (Level Circle) */}
                <div
                  className={cn(
                    'title-page absolute -top-7 left-1/2 -translate-x-1/2 w-[72px] h-[72px] rounded-full flex items-center justify-center z-20 shadow-xl border-4 transition-all duration-300',
                    isToday ?
                      'bg-primary border-white text-ink-primary shadow-primary/60 shadow-[0_0_40px_rgba(var(--color-primary),0.6)]'
                    : dayCompleted ?
                      'bg-emerald-500 border-white text-ink-primary shadow-emerald-500/50 shadow-[0_0_30px_rgba(16,185,129,0.5)]'
                    : isPast ? 'bg-zinc-800 border-zinc-500 text-zinc-300'
                    : 'bg-black/60 backdrop-blur-xl border-white/40 text-ink-primary',
                  )}
                >
                  {dayNum}
                </div>

                {/* Glass Card */}
                <div
                  className={cn(
                    'relative rounded-3xl p-6 transition-all duration-300 mt-6',
                    'bg-white/10 backdrop-blur-xl border-t border-l border-white/30 shadow-2xl',
                    isToday &&
                      'ring-2 ring-primary/80 shadow-[0_0_50px_rgba(var(--color-primary),0.3)] bg-white/15',
                    dayCompleted &&
                      'ring-2 ring-emerald-500/60 shadow-[0_0_40px_rgba(16,185,129,0.2)] bg-emerald-500/10',
                    isDraggedOver &&
                      'ring-4 ring-primary scale-105 bg-primary/20',
                  )}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDragState((p) => ({
                      ...p,
                      overDayNum: dayNum,
                      overIndex: dayTasks.length,
                    }));
                  }}
                  onDrop={(e) =>
                    handleDrop(
                      e,
                      dayNum,
                      dragState.overIndex ?? dayTasks.length,
                    )
                  }
                >
                  {/* Header */}
                  <div className='flex justify-between items-end mb-5 pt-8 border-b border-white/10 pb-3'>
                    <div className='flex flex-col'>
                      <span className='text-[10px] text-ink-primary/70 font-bold tracking-[0.15em] uppercase'>
                        {getDayFormattedDate(dayNum)}
                      </span>
                      {isToday && (
                        <span className='label-overline text-primary mt-1.5'>
                          Current Level
                        </span>
                      )}
                      {dayCompleted && !isToday && (
                        <span className='label-overline text-emerald-400 mt-1.5 flex items-center gap-1'>
                          <Trophy className='w-3.5 h-3.5' /> Cleared
                        </span>
                      )}
                    </div>
                    {dayTasks.length > 0 && (
                      <div className='flex items-center gap-1.5 bg-background-primary/80 px-2.5 py-1 rounded-full'>
                        <Zap
                          className={cn(
                            'w-3.5 h-3.5',
                            dayCompleted ? 'text-emerald-400' : 'text-primary',
                          )}
                        />
                        <span className='label-sm'>
                          {completedCount}/{dayTasks.length}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Tasks / Quests */}
                  <div className='flex flex-col gap-2.5 min-h-[140px]'>
                    {dayTasks.length === 0 ?
                      <div className='h-full flex-1 flex flex-col items-center justify-center border-2 border-dashed border-white/20 rounded-2xl py-8 opacity-70'>
                        <span className='label-sm text-ink-primary/60'>
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
                          <React.Fragment key={task.id}>
                            {showPlaceholder && (
                              <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: 48 }}
                                className='rounded-xl border-2 border-dashed border-primary bg-primary/20 flex items-center justify-center shrink-0'
                              >
                                <span className='text-[10px] text-primary font-bold tracking-wider uppercase'>
                                  Drop Here
                                </span>
                              </motion.div>
                            )}
                            <div
                              draggable
                              onDragStart={(e) =>
                                handleDragStart(e, task.id, dayNum)
                              }
                              onDragEnd={handleDragEnd}
                              onDragOver={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                setDragState((p) => ({
                                  ...p,
                                  overDayNum: dayNum,
                                  overIndex: taskIdx,
                                }));
                              }}
                              onClick={() =>
                                router.push(
                                  `/interview-prep/practice/${qObj.id}`,
                                )
                              }
                              className={cn(
                                'group flex items-start gap-3 p-3.5 rounded-xl cursor-grab active:cursor-grabbing transition-all border',
                                isDraggingThis && 'opacity-30 scale-95',
                                isCompleted ?
                                  'bg-black/30 border-white/10'
                                : 'bg-white/15 hover:bg-white/25 border-white/30 hover:border-white/50 backdrop-blur-md shadow-lg',
                              )}
                            >
                              <button
                                className={cn(
                                  'w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-all mt-0.5 cursor-default',
                                  isCompleted ?
                                    'bg-emerald-500 border-emerald-500 text-ink-primary'
                                  : 'border-white/60 hover:border-white text-ink-primary',
                                )}
                              >
                                {isCompleted && <Check className='w-3 h-3' />}
                              </button>
                              <div className='flex flex-col min-w-0 flex-1'>
                                <span
                                  className={cn(
                                    'label leading-tight',
                                    isCompleted &&
                                      'line-through text-ink-primary/50',
                                  )}
                                >
                                  {qObj.title}
                                </span>
                                {isReview && (
                                  <span className='text-[9px] text-blue-300 font-black mt-1.5 uppercase tracking-widest'>
                                    ↩ Review Quest
                                  </span>
                                )}
                              </div>
                            </div>
                          </React.Fragment>
                        );
                      })
                    }

                    {/* End drop zone */}
                    {dragState.taskId !== null &&
                      dragState.overDayNum === dayNum &&
                      dragState.overIndex === dayTasks.length && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 48 }}
                          className='rounded-xl border-2 border-dashed border-primary bg-primary/20 flex items-center justify-center shrink-0 mt-2'
                          onDragOver={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setDragState((p) => ({
                              ...p,
                              overDayNum: dayNum,
                              overIndex: dayTasks.length,
                            }));
                          }}
                        >
                          <span className='text-[10px] text-primary font-bold tracking-wider uppercase'>
                            Drop Here
                          </span>
                        </motion.div>
                      )}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Skeleton
// ─────────────────────────────────────────────
function RoadmapSkeleton() {
  return (
    <div className='flex flex-col gap-5 animate-pulse pb-8'>
      <div className='flex justify-between items-center pb-4 border-b border-border/60'>
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
            className='rounded-2xl bg-panel border border-border/40 p-4'
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
