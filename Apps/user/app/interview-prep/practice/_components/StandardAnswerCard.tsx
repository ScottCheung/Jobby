/** @format */

'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  BookOpenCheck,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  Copy,
  Crown,
  Edit3,
  Layers3,
  LightbulbIcon,
  LockKeyhole,
  MessageSquareQuote,
  Sparkles,
  Star,
  StarOff,
  Tag,
  Target,
  Trash2,
  UserCheck,
  Users,
  Zap,
} from 'lucide-react';
import { cn, formatInterviewDuration } from '@/lib/utils';
import type { InterviewQuestion, QuestionAnswer } from '@/lib/types';
import { Tooltip } from '@/components/UI/tooltip';
import { div } from 'framer-motion/client';

export type AnswerTypeTab = 'ai' | 'author' | 'community' | 'mine';

// ─── Structured Content Types ─────────────────────────────────────────────────

type AiAnswerSection = {
  key: string;
  heading: string;
  icon?: string;
  color?: string;
  content: string[];
  example?: string;
  tip?: string;
  duration_hint?: string;
};

type StructuredAiContent = {
  summary: string;
  answerKind: string;
  difficulty?: 'easy' | 'medium' | 'hard';
  estimatedDuration?: number;
  sections: AiAnswerSection[];
  keyPhrases?: string[];
  commonMistakes?: string[];
};

// ─── Colour palette ───────────────────────────────────────────────────────────

const SECTION_PALETTES: Record<
  string,
  {
    ring: string;
    bg: string;
    icon: string;
    heading: string;
    bullet: string;
    tip: string;
    tipBorder: string;
    exampleBg: string;
  }
> = {
  blue: {
    ring: 'border-blue-500/20',
    bg: 'bg-blue-500/[0.06]',
    icon: 'bg-blue-500/20 text-blue-600 dark:text-blue-300',
    heading: 'text-blue-700 dark:text-blue-300',
    bullet: 'text-blue-500',
    tip: 'bg-blue-500/[0.07]',
    tipBorder: 'border-blue-500/20',
    exampleBg: 'bg-blue-500/[0.04] border-blue-500/15',
  },
  amber: {
    ring: 'border-amber-500/20',
    bg: 'bg-amber-500/[0.06]',
    icon: 'bg-amber-500/20 text-amber-600 dark:text-amber-300',
    heading: 'text-amber-700 dark:text-amber-300',
    bullet: 'text-amber-500',
    tip: 'bg-amber-500/[0.07]',
    tipBorder: 'border-amber-500/20',
    exampleBg: 'bg-amber-500/[0.04] border-amber-500/15',
  },
  emerald: {
    ring: 'border-emerald-500/20',
    bg: 'bg-emerald-500/[0.06]',
    icon: 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-300',
    heading: 'text-emerald-700 dark:text-emerald-300',
    bullet: 'text-emerald-500',
    tip: 'bg-emerald-500/[0.07]',
    tipBorder: 'border-emerald-500/20',
    exampleBg: 'bg-emerald-500/[0.04] border-emerald-500/15',
  },
  violet: {
    ring: 'border-violet-500/20',
    bg: 'bg-violet-500/[0.06]',
    icon: 'bg-violet-500/20 text-violet-600 dark:text-violet-300',
    heading: 'text-violet-700 dark:text-violet-300',
    bullet: 'text-violet-500',
    tip: 'bg-violet-500/[0.07]',
    tipBorder: 'border-violet-500/20',
    exampleBg: 'bg-violet-500/[0.04] border-violet-500/15',
  },
  rose: {
    ring: 'border-rose-500/20',
    bg: 'bg-rose-500/[0.06]',
    icon: 'bg-rose-500/20 text-rose-600 dark:text-rose-300',
    heading: 'text-rose-700 dark:text-rose-300',
    bullet: 'text-rose-500',
    tip: 'bg-rose-500/[0.07]',
    tipBorder: 'border-rose-500/20',
    exampleBg: 'bg-rose-500/[0.04] border-rose-500/15',
  },
  teal: {
    ring: 'border-teal-500/20',
    bg: 'bg-teal-500/[0.06]',
    icon: 'bg-teal-500/20 text-teal-600 dark:text-teal-300',
    heading: 'text-teal-700 dark:text-teal-300',
    bullet: 'text-teal-500',
    tip: 'bg-teal-500/[0.07]',
    tipBorder: 'border-teal-500/20',
    exampleBg: 'bg-teal-500/[0.04] border-teal-500/15',
  },
  sky: {
    ring: 'border-sky-500/20',
    bg: 'bg-sky-500/[0.06]',
    icon: 'bg-sky-500/20 text-sky-600 dark:text-sky-300',
    heading: 'text-sky-700 dark:text-sky-300',
    bullet: 'text-sky-500',
    tip: 'bg-sky-500/[0.07]',
    tipBorder: 'border-sky-500/20',
    exampleBg: 'bg-sky-500/[0.04] border-sky-500/15',
  },
};
const DEFAULT_COLOURS = [
  'blue',
  'amber',
  'emerald',
  'violet',
  'rose',
  'teal',
  'sky',
] as const;

const DIFFICULTY_MAP = {
  easy: {
    label: 'Easy',
    dot: 'bg-emerald-400',
    text: 'text-emerald-600 dark:text-emerald-400',
    ring: 'border-emerald-500/25 bg-emerald-500/8',
  },
  medium: {
    label: 'Medium',
    dot: 'bg-amber-400',
    text: 'text-amber-600   dark:text-amber-400',
    ring: 'border-amber-500/25   bg-amber-500/8',
  },
  hard: {
    label: 'Hard',
    dot: 'bg-rose-400',
    text: 'text-rose-600    dark:text-rose-400',
    ring: 'border-rose-500/25    bg-rose-500/8',
  },
};

// ─── KeyPhrases ───────────────────────────────────────────────────────────────

function KeyPhrasesModule({ phrases }: { phrases: string[] }) {
  const [copied, setCopied] = useState<string | null>(null);
  if (!phrases.length) return null;

  return (
    <div className='panel-md space-y-2.5'>
      <div className='flex items-center gap-2'>
        <span className='flex h-5 w-5 items-center justify-center rounded-lg bg-violet-500/15'>
          <Zap className='h-3 w-3 text-violet-600 dark:text-violet-400' />
        </span>
        <p className='label-overline text-violet-600 dark:text-violet-400'>
          Key Phrases
        </p>
      </div>
      <div className='flex flex-wrap gap-1.5'>
        {phrases.map((phrase, i) => (
          <button
            key={i}
            type='button'
            onClick={() => {
              navigator.clipboard.writeText(phrase).catch(() => {});
              setCopied(phrase);
              setTimeout(() => setCopied(null), 1600);
            }}
            className={cn(
              'group inline-flex items-center gap-1.5 rounded-full border px-2.5 py-[3px] text-[11px] font-semibold transition-all duration-150 active:scale-95',
              copied === phrase ?
                'border-emerald-500/30 bg-emerald-500/12 text-emerald-700 dark:text-emerald-300'
              : 'border-violet-500/20 bg-violet-500/8 text-violet-700 dark:text-violet-300 hover:border-violet-500/40 hover:bg-violet-500/15',
            )}
          >
            {copied === phrase ?
              <CheckCircle2 className='h-2.5 w-2.5 shrink-0' />
            : <Copy className='h-2.5 w-2.5 shrink-0 opacity-60 group-hover:opacity-100' />
            }
            {phrase}
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── CommonMistakes ───────────────────────────────────────────────────────────

function CommonMistakesModule({ mistakes }: { mistakes: string[] }) {
  const [open, setOpen] = useState(false);
  if (!mistakes.length) return null;

  return (
    <div className='rounded-xl border border-amber-500/20 bg-amber-500/[0.05] overflow-hidden'>
      <button
        type='button'
        onClick={() => setOpen((p) => !p)}
        className='flex w-full items-center gap-2 px-3.5 py-2.5 text-left transition-colors hover:bg-amber-500/8'
      >
        <span className='flex h-5 w-5 shrink-0 items-center justify-center rounded-lg bg-amber-500/15'>
          <AlertTriangle className='h-3 w-3 text-amber-600 dark:text-amber-400' />
        </span>
        <p className='label-overline flex-1 text-amber-600 dark:text-amber-400'>
          Common Mistakes · {mistakes.length}
        </p>
        {open ?
          <ChevronUp className='h-3.5 w-3.5 text-amber-500 shrink-0' />
        : <ChevronDown className='h-3.5 w-3.5 text-amber-500 shrink-0' />}
      </button>
      {open && (
        <div className='border-t border-amber-500/15 px-3.5 pb-3 pt-2.5 space-y-1.5'>
          {mistakes.map((m, i) => (
            <div
              key={i}
              className='flex items-start gap-2 text-xs text-ink-secondary leading-relaxed'
            >
              <span className='mt-0.5 font-bold text-amber-500 shrink-0'>
                ✕
              </span>
              <span>{m}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── SectionCard ─────────────────────────────────────────────────────────────

function SectionCard({
  section,
  palette,
}: {
  section: AiAnswerSection;
  palette: (typeof SECTION_PALETTES)[string];
}) {
  const [showExample, setShowExample] = useState(false);

  return (
    <div
      className={cn(
        'rounded-xl border p-3.5 space-y-2.5 transition-all shadow-xs',
        palette.ring,
        palette.bg,
      )}
    >
      {/* Card Header */}
      <div className='flex items-center justify-between gap-2'>
        <div className='flex items-center gap-2.5 min-w-0'>
          <span
            className={cn(
              'flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-lg text-[10px] font-extrabold',
              palette.icon,
            )}
          >
            {section.icon ?? section.heading.trim()[0] ?? '·'}
          </span>
          <span
            className={cn('text-xs font-bold leading-tight', palette.heading)}
          >
            {section.heading}
          </span>
        </div>
        {section.duration_hint && (
          <span className='shrink-0 inline-flex items-center gap-1 rounded-full bg-background-secondary/60 border border-border/40 px-2 py-0.5 text-[10px] font-semibold text-ink-secondary'>
            <Clock className='h-2.5 w-2.5' />
            {section.duration_hint}
          </span>
        )}
      </div>

      {/* Bullets */}
      {section.content.length > 0 && (
        <ul className='space-y-1.5 pl-0.5'>
          {section.content.map((b, i) => (
            <li
              key={i}
              className='flex items-start gap-2 text-xs text-ink-secondary leading-relaxed'
            >
              <span
                className={cn(
                  'mt-0.5 text-sm leading-none shrink-0 font-bold',
                  palette.bullet,
                )}
              >
                ›
              </span>
              <span>{b}</span>
            </li>
          ))}
        </ul>
      )}

      {/* Actionable Tip */}
      {section.tip && (
        <div
          className={cn(
            'flex items-start gap-2 rounded-lg border p-2',
            palette.tip,
            palette.tipBorder,
          )}
        >
          <LightbulbIcon
            className={cn('h-3 w-3 mt-0.5 shrink-0', palette.heading)}
          />
          <p className='text-[11px] text-ink-secondary leading-relaxed'>
            {section.tip}
          </p>
        </div>
      )}

      {/* Spoken Example */}
      {section.example && (
        <div>
          <button
            type='button'
            onClick={() => setShowExample((p) => !p)}
            className={cn(
              'flex items-center gap-1 text-[11px] font-semibold transition-opacity hover:opacity-70',
              palette.heading,
            )}
          >
            <MessageSquareQuote className='h-3 w-3' />
            {showExample ? 'Hide example' : 'Show example'}
            {showExample ?
              <ChevronUp className='h-3 w-3' />
            : <ChevronDown className='h-3 w-3' />}
          </button>
          {showExample && (
            <p
              className={cn(
                'mt-1.5 text-[11px] text-ink-secondary leading-relaxed italic rounded-lg border px-3 py-2',
                palette.exampleBg,
              )}
            >
              &ldquo;{section.example}&rdquo;
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface StandardAnswerCardProps {
  currentQuestion: InterviewQuestion | null;
  shouldShowAnswer: boolean;
  onShowAnswerToggle: () => void;
  isEditingAnswer: boolean;
  onStartEditing: () => void;
  onCancelEditing: () => void;
  onSaveAnswer: (editedText: string) => Promise<void>;
  onCreateContributorAnswer?: (text: string) => Promise<void>;
  onUpdateContributorAnswer?: (answerId: string, text: string) => Promise<void>;
  onDeleteContributorAnswer?: (answerId: string) => Promise<void>;
  isSavingAnswer: boolean;
  isAnswersLoading?: boolean;
  featuredAnswers?: QuestionAnswer[];
  allCommunityAnswers?: QuestionAnswer[];
  aiAnswers?: QuestionAnswer[];
  authorAnswers?: QuestionAnswer[];
  myAnswer?: QuestionAnswer | null;
  isGeneratingAiAnswer?: boolean;
  isGeneratingQuestionMetadata?: boolean;
  isQuestionContributor?: boolean;
  onGenerateAiAnswer?: (
    regenerate?: boolean,
  ) => Promise<QuestionAnswer | undefined>;
  onGenerateQuestionMetadata?: () => Promise<void>;
  onUnlockAiAnswer?: (answerId: string) => Promise<void>;
  onToggleFeaturedAnswer?: (
    answerId: string,
    currentIsRecommended: boolean,
  ) => Promise<void>;
}

function dedupeById<T extends { id: string }>(items: T[]): T[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    if (!item?.id || seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function StandardAnswerCard({
  currentQuestion,
  shouldShowAnswer,
  onShowAnswerToggle,
  isEditingAnswer,
  onStartEditing,
  onCancelEditing,
  onSaveAnswer,
  onCreateContributorAnswer,
  onUpdateContributorAnswer,
  onDeleteContributorAnswer,
  isSavingAnswer,
  isAnswersLoading = false,
  featuredAnswers = [],
  allCommunityAnswers = [],
  aiAnswers = [],
  authorAnswers = [],
  myAnswer = null,
  isGeneratingAiAnswer = false,
  isGeneratingQuestionMetadata = false,
  isQuestionContributor = false,
  onGenerateAiAnswer,
  onGenerateQuestionMetadata,
  onUnlockAiAnswer,
  onToggleFeaturedAnswer,
}: StandardAnswerCardProps) {
  const [activeTab, setActiveTab] = useState<AnswerTypeTab>('ai');
  const [editedText, setEditedText] = useState(myAnswer?.body ?? '');
  const [selectedAiAnswerId, setSelectedAiAnswerId] = useState<string | null>(
    null,
  );
  const [showAllCommunity, setShowAllCommunity] = useState(false);
  const [togglingAnswerId, setTogglingAnswerId] = useState<string | null>(null);
  const [isCreatingContributorAnswer, setIsCreatingContributorAnswer] =
    useState(false);
  const [authorAnswerText, setContributorAnswerText] = useState('');
  const [editingContributorAnswerId, setEditingContributorAnswerId] = useState<
    string | null
  >(null);
  const [editingContributorAnswerText, setEditingContributorAnswerText] =
    useState('');

  const safeAiAnswers = useMemo(() => dedupeById(aiAnswers), [aiAnswers]);
  const safeContributorAnswers = useMemo(
    () => dedupeById(authorAnswers),
    [authorAnswers],
  );
  const safeFeaturedAnswers = useMemo(
    () => dedupeById(featuredAnswers),
    [featuredAnswers],
  );
  const safeAllCommunityAnswers = useMemo(
    () => dedupeById(allCommunityAnswers),
    [allCommunityAnswers],
  );

  // Auto-select tab
  useEffect(() => {
    if (safeAiAnswers.length > 0) setActiveTab('ai');
    else if (
      safeFeaturedAnswers.length > 0 ||
      safeAllCommunityAnswers.length > 0
    )
      setActiveTab('community');
    else if (safeContributorAnswers.length > 0) setActiveTab('author');
    else setActiveTab('ai');
  }, [
    currentQuestion?.id,
    safeAiAnswers.length,
    safeFeaturedAnswers.length,
    safeAllCommunityAnswers.length,
    safeContributorAnswers.length,
  ]);

  // Selected AI answer
  const selectedAiAnswer = useMemo(
    () =>
      safeAiAnswers.find((a) => a.id === selectedAiAnswerId) ??
      safeAiAnswers[safeAiAnswers.length - 1] ??
      null,
    [safeAiAnswers, selectedAiAnswerId],
  );

  // Direct 1:1 Parse DeepSeek JSON content (Zero guessing)
  const structured = useMemo((): StructuredAiContent | null => {
    const content =
      selectedAiAnswer?.structured_content ??
      selectedAiAnswer?.metadata?.content;
    if (!content || typeof content !== 'object') return null;
    const r = content as Record<string, unknown>;

    const sections: AiAnswerSection[] =
      Array.isArray(r.sections) ?
        r.sections
          .filter((s): s is Record<string, unknown> =>
            Boolean(s && typeof s === 'object'),
          )
          .map((s, idx) => {
            const rawHeading =
              s.heading ?? s.title ?? s.name ?? s.key ?? `Section ${idx + 1}`;
            let headingStr = String(rawHeading).trim();
            if (headingStr.toLowerCase() === 'situation')
              headingStr = 'S - Situation';
            else if (headingStr.toLowerCase() === 'task')
              headingStr = 'T - Task';
            else if (headingStr.toLowerCase() === 'action')
              headingStr = 'A - Action';
            else if (headingStr.toLowerCase() === 'result')
              headingStr = 'R - Result';

            return {
              key: String(s.key ?? `sec-${idx}`),
              heading: headingStr,
              icon:
                typeof s.icon === 'string' && s.icon ? s.icon : String(idx + 1),
              color:
                typeof s.color === 'string' && s.color ?
                  s.color
                : DEFAULT_COLOURS[idx % DEFAULT_COLOURS.length],
              content: Array.isArray(s.content) ? s.content.map(String) : [],
              example: typeof s.example === 'string' ? s.example : undefined,
              tip: typeof s.tip === 'string' ? s.tip : undefined,
              duration_hint:
                typeof s.duration_hint === 'string' ?
                  s.duration_hint
                : undefined,
            };
          })
      : [];

    return {
      summary: typeof r.summary === 'string' ? r.summary : '',
      answerKind:
        typeof r.answer_kind === 'string' ? r.answer_kind : 'Answer Framework',
      difficulty:
        (
          r.difficulty === 'easy' ||
          r.difficulty === 'medium' ||
          r.difficulty === 'hard'
        ) ?
          r.difficulty
        : undefined,
      estimatedDuration:
        typeof r.estimated_duration === 'number' ?
          r.estimated_duration
        : undefined,
      sections,
      keyPhrases: Array.isArray(r.key_phrases) ? r.key_phrases.map(String) : [],
      commonMistakes:
        Array.isArray(r.common_mistakes) ? r.common_mistakes.map(String) : [],
    };
  }, [selectedAiAnswer]);

  // Edit text sync
  useEffect(() => {
    if (isEditingAnswer) setEditedText(myAnswer?.body ?? '');
  }, [isEditingAnswer, myAnswer?.body]);

  const handleSave = async (e: React.MouseEvent) => {
    e.stopPropagation();
    await onSaveAnswer(editedText);
  };
  const handleStart = (e: React.MouseEvent) => {
    e.stopPropagation();
    onStartEditing();
  };
  const handleCancel = (e: React.MouseEvent) => {
    e.stopPropagation();
    onCancelEditing();
  };
  const handleToggleClick = () => {
    if (isEditingAnswer) return;
    onShowAnswerToggle();
  };
  const handleToggleRecommend = async (
    id: string,
    isRec: boolean,
    e: React.MouseEvent,
  ) => {
    e.stopPropagation();
    if (!onToggleFeaturedAnswer) return;
    setTogglingAnswerId(id);
    try {
      await onToggleFeaturedAnswer(id, isRec);
    } finally {
      setTogglingAnswerId(null);
    }
  };

  if (!currentQuestion) return null;

  const rawCommunity =
    (
      showAllCommunity ||
      (isQuestionContributor && safeFeaturedAnswers.length === 0)
    ) ?
      safeAllCommunityAnswers
    : safeFeaturedAnswers.length > 0 ? safeFeaturedAnswers
    : safeAllCommunityAnswers;

  const displayCommunity = useMemo(
    () => dedupeById(rawCommunity),
    [rawCommunity],
  );

  const questionMetadata = currentQuestion.ai_metadata;
  const canGenerateMoreAiAnswers = safeAiAnswers.length < 3;
  const questionDifficultyKey = (
    questionMetadata?.difficulty ||
    currentQuestion.difficulty ||
    structured?.difficulty ||
    'medium'
  ).toLowerCase();
  const displayDifficultyKey =
    (
      questionDifficultyKey === 'easy' ||
      questionDifficultyKey === 'medium' ||
      questionDifficultyKey === 'hard'
    ) ?
      questionDifficultyKey
    : 'medium';
  const displayDifficulty = DIFFICULTY_MAP[displayDifficultyKey];
  const displayDurationSeconds =
    currentQuestion.estimated_duration_seconds ||
    questionMetadata?.estimated_duration ||
    structured?.estimatedDuration ||
    120;
  const displayDurationLabel = formatInterviewDuration(displayDurationSeconds);

  const TABS = [
    {
      id: 'ai' as const,
      label: 'AI Reference',
      Icon: Sparkles,
      active: 'text-violet-600 dark:text-violet-300',
      badge: safeAiAnswers.length > 0 ? safeAiAnswers.length : undefined,
      badgeCls: 'bg-violet-500/15 text-violet-700 dark:text-violet-300',
    },
    {
      id: 'author' as const,
      label: 'Contributor',
      Icon: UserCheck,
      active: 'text-blue-600 dark:text-blue-400',
      badge:
        safeContributorAnswers.length > 0 ?
          safeContributorAnswers.length
        : undefined,
      badgeCls: 'bg-blue-500/15 text-blue-700 dark:text-blue-300',
    },
    {
      id: 'community' as const,
      label: 'Community',
      Icon: Crown,
      active: 'text-amber-600 dark:text-amber-400',
      badge:
        safeFeaturedAnswers.length > 0 ? safeFeaturedAnswers.length : undefined,
      badgeCls: 'bg-amber-500/15 text-amber-700 dark:text-amber-300',
    },
    {
      id: 'mine' as const,
      label: 'My Answer',
      Icon: Target,
      active: 'text-emerald-600 dark:text-emerald-400',
      badge: myAnswer ? 'Done' : undefined,
      badgeCls: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
    },
  ];

  return (
    <div
      onClick={handleToggleClick}
      className=' transition-all duration-200 ease-out flex flex-col justify-between'
    >
      {/* ── Tab Row ── */}
      <div
        onClick={(e) => e.stopPropagation()}
        className='flex items-center justify-between gap-2 mb-3 '
      >
        <div className='flex items-center gap-0.5 rounded-xl bg-background-secondary/60 p-1'>
          {TABS.map(({ id, label, Icon, active, badge, badgeCls }, idx) => (
            <button
              key={id}
              type='button'
              onClick={() => setActiveTab(id)}
              className={cn(
                'flex items-center gap-1.5 rounded-full  px-2.5 overflow-hidden py-1 text-xs font-semibold transition-all',
                // idx === TABS.length - 1 ? 'rounded-r-full! '
                // : idx === 0 ? 'rounded-l-full!'
                // : null,
                activeTab === id ?
                  cn('bg-panel shadow-sm font-bold', active)
                : 'text-ink-secondary hover:text-ink-primary',
              )}
            >
              <Icon
                className={cn(
                  'h-3.5 w-3.5',
                  activeTab === id ? active : 'text-current',
                )}
              />
              {label}
              {badge !== undefined && (
                <span
                  className={cn(
                    'rounded-full px-1.5 py-px text-[10px] font-bold',
                    badgeCls,
                  )}
                >
                  {badge}
                </span>
              )}
            </button>
          ))}
        </div>

        <div className='flex items-center gap-2 shrink-0'>
          {activeTab === 'mine' && shouldShowAnswer && !isEditingAnswer && (
            <button
              onClick={handleStart}
              className='label-sm text-primary hover:underline flex items-center gap-1 transition-colors active:scale-95'
            >
              <Edit3 className='w-3 h-3' /> Edit
            </button>
          )}
          {activeTab === 'ai' &&
            onGenerateAiAnswer &&
            canGenerateMoreAiAnswers && (
              <div className='col items-center'>
                <button
                  type='button'
                  onClick={async (e) => {
                    e.stopPropagation();
                    const a = await onGenerateAiAnswer(true);
                    if (a) setSelectedAiAnswerId(a.id);
                  }}
                  disabled={isGeneratingAiAnswer}
                  className='inline-flex items-center gap-1.5 rounded-lg bg-violet-600/10 px-2.5 py-1 text-xs font-semibold text-violet-700 dark:text-violet-300 hover:bg-violet-600/20 active:scale-95 disabled:opacity-50 transition-all'
                >
                  <Sparkles
                    className={cn(
                      'h-3.5 w-3.5',
                      isGeneratingAiAnswer && 'animate-spin',
                    )}
                  />
                  {isGeneratingAiAnswer ? 'Generating...' : 'Regenerate'}
                </button>
                <label className=' text-ink-secondary text-[7px]! text-center'>
                  New version · up to 5 coins
                </label>
              </div>
            )}
        </div>
      </div>

      {/* ── Body ── */}
      {shouldShowAnswer ?
        isEditingAnswer && activeTab === 'mine' ?
          <div
            className='flex flex-col gap-2'
            onClick={(e) => e.stopPropagation()}
          >
            <Tooltip content='Private to you. Write your practice answer and notes here; others cannot view or comment on it.'>
              <textarea
                value={editedText}
                onChange={(e) => setEditedText(e.target.value)}
                placeholder='Write or edit your personal answer...'
                className='textarea h-36 text-xs'
              />
            </Tooltip>
            <div className='flex justify-end gap-2'>
              <button
                onClick={handleCancel}
                disabled={isSavingAnswer}
                className='px-3 py-1.5 rounded-lg border border-border text-ink-secondary text-xs font-bold hover:bg-background-secondary transition-colors active:scale-95'
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={isSavingAnswer}
                className='px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-bold hover:opacity-90 disabled:opacity-50 transition-all active:scale-95'
              >
                {isSavingAnswer ? 'Saving...' : 'Save Answer'}
              </button>
            </div>
          </div>
        : <div className='flex flex-col gap-3'>
            {/* ══════════════════════════════════════════ TAB: AI ══════════════════════════════════════════ */}
            {activeTab === 'ai' && (
              <div className='space-y-3' onClick={(e) => e.stopPropagation()}>
                {/* Answers Loading Skeleton (quiet placeholder during question switch) */}
                {isAnswersLoading ?
                  <div className='rounded-xl border border-border/40 bg-background-secondary/30 p-4 space-y-3 min-h-[300px] animate-text-shimmer-primary animate-text-shimmer'>
                    <div className='flex items-center gap-2'>
                      <div className='h-4 w-28 bg-muted/60 rounded-md' />
                    </div>
                    <div className='space-y-2.5 pt-1'>
                      {[5, 4, 3, 4, 3].map((w, i) => (
                        <div
                          key={i}
                          className={`h-2.5 w-${w}/5 bg-muted/40 rounded-full`}
                        />
                      ))}
                    </div>
                  </div>
                : /* Generating skeleton */
                isGeneratingAiAnswer ?
                  <div className='rounded-xl border border-violet-500/20 bg-violet-500/[0.05] p-4 space-y-3'>
                    <div className='flex items-center gap-2'>
                      <Sparkles className='h-4 w-4 animate-text-shimmer-primary animate-text-shimmer text-violet-500' />
                      <span className='text-sm font-semibold text-ink-primary'>
                        AI is generating a structured answer...
                      </span>
                    </div>
                    <div className='space-y-2 pl-1'>
                      {[4, 5, 3, 3].map((w, i) => (
                        <div
                          key={i}
                          className={`h-2 w-${w}/5 animate-text-shimmer-primary animate-text-shimmer rounded-full bg-violet-500/20`}
                        />
                      ))}
                    </div>
                  </div>
                : /* Empty state */
                aiAnswers.length === 0 ?
                  <div className='flex flex-col items-center gap-3 rounded-xl border border-dashed border-border bg-background-secondary/20 px-4 py-8 text-center'>
                    <span className='flex h-10 w-10 items-center justify-center rounded-2xl bg-violet-500/10'>
                      <Sparkles className='h-5 w-5 text-violet-500' />
                    </span>
                    <div className='space-y-1'>
                      <p className='text-xs font-semibold text-ink-primary'>
                        No AI answer yet
                      </p>
                      <p className='text-xs text-ink-secondary max-w-[220px]'>
                        Generate a structured reference answer when you need
                        one. Unlocking it costs up to 5 coins.
                      </p>
                    </div>
                    {onGenerateAiAnswer && (
                      <button
                        type='button'
                        onClick={async () => {
                          const a = await onGenerateAiAnswer();
                          if (a) setSelectedAiAnswerId(a.id);
                        }}
                        className='inline-flex items-center gap-1.5 rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-violet-700 active:scale-95 transition-all shadow-sm'
                      >
                        <Sparkles className='h-3.5 w-3.5' /> Generate AI Answer
                      </button>
                    )}
                  </div>
                : <>
                    {/* Version pills */}
                    {safeAiAnswers.length > 1 && (
                      <div className='flex gap-1.5 overflow-x-auto custom-scrollbar-primary'>
                        {safeAiAnswers.map((a, idx) => (
                          <button
                            key={`${a.id}-${idx}`}
                            type='button'
                            onClick={() => setSelectedAiAnswerId(a.id)}
                            className={cn(
                              'shrink-0 rounded-lg border px-3 py-1 text-xs font-semibold transition-all',
                              selectedAiAnswer?.id === a.id ?
                                'border-violet-500 bg-violet-600 text-white shadow-sm'
                              : 'border-border text-ink-secondary hover:border-violet-400 hover:bg-background-secondary',
                            )}
                          >
                            Version {idx + 1}
                            {a.is_locked ? ' 🔒' : ''}
                          </button>
                        ))}
                      </div>
                    )}
                    {!questionMetadata &&
                      aiAnswers.length > 0 &&
                      onGenerateQuestionMetadata && (
                        <button
                          type='button'
                          onClick={() => void onGenerateQuestionMetadata()}
                          disabled={isGeneratingQuestionMetadata}
                          className='inline-flex items-center gap-1.5 rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition-all hover:bg-violet-700 active:scale-95 disabled:opacity-50'
                        >
                          {' '}
                          <Sparkles
                            className={cn(
                              'h-3.5 w-3.5',
                              isGeneratingQuestionMetadata && 'animate-spin',
                            )}
                          />{' '}
                          {isGeneratingQuestionMetadata ?
                            'Analyzing...'
                          : 'Using AI Add Question Details ( Free Feature )'
                          }{' '}
                        </button>
                      )}

                    {/* Locked state */}
                    {selectedAiAnswer?.is_locked ?
                      <div className='panel-md space-y-2.5 border-violet-500/20 bg-violet-500/[0.05]'>
                        <div className='flex items-center gap-2 text-sm font-semibold text-ink-primary'>
                          <LockKeyhole className='h-4 w-4 text-violet-600' />{' '}
                          This version is locked
                        </div>
                        <p className='text-xs text-ink-secondary'>
                          Unlock once to view all AI reference answers for this
                          question.
                        </p>
                        <button
                          type='button'
                          onClick={() =>
                            onUnlockAiAnswer &&
                            void onUnlockAiAnswer(selectedAiAnswer.id)
                          }
                          className='inline-flex items-center gap-1.5 rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-violet-700 active:scale-95 transition-all'
                        >
                          <LockKeyhole className='h-3.5 w-3.5' /> Unlock all AI
                          answers for this question (
                          {selectedAiAnswer.unlock_cost ?? 5} coins)
                        </button>
                      </div>
                    : /* ─── Full AI Answer (Direct 1:1 render of DeepSeek Sections) ─── */
                      <div className='space-y-3'>
                        {/* Answer Header Card */}
                        <div className='rounded-xl border border-violet-500/20 bg-violet-500/[0.06] px-4 py-3'>
                          <div className='flex items-start justify-between gap-3'>
                            <div className='min-w-0 flex-1'>
                              <div className='flex items-center gap-2 mb-1'>
                                <BookOpenCheck className='h-3.5 w-3.5 text-violet-600 shrink-0' />
                                <span className='text-xs font-bold text-ink-primary truncate'>
                                  {selectedAiAnswer?.title ??
                                    'AI Reference Answer'}
                                </span>
                              </div>
                              {structured?.summary && (
                                <p className='text-xs text-ink-secondary leading-relaxed'>
                                  {structured.summary}
                                </p>
                              )}
                            </div>
                            <div className='flex flex-col items-end gap-1.5 shrink-0'>
                              <div className='flex items-center gap-1.5'>
                                <span
                                  className={cn(
                                    'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold',
                                    displayDifficulty.ring,
                                    displayDifficulty.text,
                                  )}
                                >
                                  <span
                                    className={cn(
                                      'h-1.5 w-1.5 rounded-full',
                                      displayDifficulty.dot,
                                    )}
                                  />
                                  {displayDifficulty.label}
                                </span>
                                <span className='inline-flex items-center gap-1 rounded-full bg-background-secondary/60 border border-border/40 px-2 py-0.5 text-[10px] font-semibold text-ink-secondary'>
                                  <Clock className='h-2.5 w-2.5' />
                                  {displayDurationLabel}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* KeyPhrases */}
                        {(structured?.keyPhrases?.length ?? 0) > 0 && (
                          <KeyPhrasesModule phrases={structured!.keyPhrases!} />
                        )}

                        {/* Direct 1:1 Rendering of DeepSeek Sections as Cards */}
                        {structured?.sections.length ?
                          <div className='space-y-2.5'>
                            {structured.sections.map((section, idx) => {
                              const colourKey =
                                (
                                  section.color &&
                                  SECTION_PALETTES[section.color]
                                ) ?
                                  section.color
                                : DEFAULT_COLOURS[idx % DEFAULT_COLOURS.length];
                              const palette = SECTION_PALETTES[colourKey];
                              return (
                                <SectionCard
                                  key={section.key || idx}
                                  section={section}
                                  palette={palette}
                                />
                              );
                            })}
                          </div>
                        : <div className='space-y-1.5 panel-md'>
                            {(selectedAiAnswer?.body ?? '')
                              .split('\n')
                              .filter(Boolean)
                              .map((line, i) => (
                                <p
                                  key={i}
                                  className='text-xs text-ink-secondary leading-relaxed'
                                >
                                  {line}
                                </p>
                              ))}
                          </div>
                        }

                        {/* Common Mistakes */}
                        {(structured?.commonMistakes?.length ?? 0) > 0 && (
                          <CommonMistakesModule
                            mistakes={structured!.commonMistakes!}
                          />
                        )}
                      </div>
                    }
                  </>
                }
              </div>
            )}

            {/* ══════════════════════════════════════════ TAB: AUTHOR ══════════════════════════════════════════ */}
            {activeTab === 'author' && (
              <div className='space-y-3' onClick={(e) => e.stopPropagation()}>
                {isQuestionContributor &&
                  onCreateContributorAnswer &&
                  (isCreatingContributorAnswer ?
                    <div className='space-y-2 border-b border-blue-500/15 pb-3'>
                      <textarea
                        value={authorAnswerText}
                        onChange={(e) =>
                          setContributorAnswerText(e.target.value)
                        }
                        placeholder='Write an official reference answer...'
                        className='textarea h-32 text-xs'
                      />
                      <div className='flex justify-end gap-2'>
                        <button
                          type='button'
                          onClick={() => {
                            setContributorAnswerText('');
                            setIsCreatingContributorAnswer(false);
                          }}
                          disabled={isSavingAnswer}
                          className='px-3 py-1.5 rounded-lg border border-border text-ink-secondary text-xs font-bold hover:bg-background-secondary transition-colors'
                        >
                          Cancel
                        </button>
                        <button
                          type='button'
                          onClick={async () => {
                            await onCreateContributorAnswer(authorAnswerText);
                            setContributorAnswerText('');
                            setIsCreatingContributorAnswer(false);
                          }}
                          disabled={isSavingAnswer || !authorAnswerText.trim()}
                          className='inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 active:scale-95 transition-all disabled:opacity-50'
                        >
                          <UserCheck className='h-3.5 w-3.5' />
                          {isSavingAnswer ? 'Saving...' : 'Add author answer'}
                        </button>
                      </div>
                    </div>
                  : <button
                      type='button'
                      onClick={() => setIsCreatingContributorAnswer(true)}
                      className='inline-flex items-center gap-1.5 text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline'
                    >
                      <UserCheck className='h-3.5 w-3.5' /> Add author answer
                    </button>)}

                {safeContributorAnswers.length > 0 ?
                  <div className='space-y-3 max-h-[480px] overflow-y-auto custom-scrollbar-primary pr-0.5'>
                    {safeContributorAnswers.map((ans, idx) => (
                      <div
                        key={`${ans.id}-${idx}`}
                        className='rounded-xl border border-blue-500/15 bg-blue-500/[0.05] p-3.5 space-y-2'
                      >
                        <div className='flex items-center gap-2 pb-2 border-b border-blue-500/10'>
                          <span className='flex h-5 w-5 shrink-0 items-center justify-center rounded-lg bg-blue-500/15'>
                            <UserCheck className='h-3 w-3 text-blue-600 dark:text-blue-400' />
                          </span>
                          <span className='label-overline flex-1 text-blue-600 dark:text-blue-400'>
                            Official Reference Answer
                          </span>
                          {isQuestionContributor &&
                            onUpdateContributorAnswer &&
                            onDeleteContributorAnswer && (
                              <div className='flex items-center gap-1'>
                                <Tooltip content='Edit author answer'>
                                  <button
                                    type='button'
                                    aria-label='Edit author answer'
                                    onClick={() => {
                                      setEditingContributorAnswerId(ans.id);
                                      setEditingContributorAnswerText(
                                        ans.body ?? '',
                                      );
                                    }}
                                    className='inline-flex h-6 w-6 items-center justify-center text-blue-600 hover:bg-blue-500/10 dark:text-blue-400'
                                  >
                                    <Edit3 className='h-3.5 w-3.5' />
                                  </button>
                                </Tooltip>
                                <Tooltip content='Delete author answer'>
                                  <button
                                    type='button'
                                    aria-label='Delete author answer'
                                    onClick={async () => {
                                      if (
                                        window.confirm(
                                          'Delete this author answer?',
                                        )
                                      ) {
                                        await onDeleteContributorAnswer(ans.id);
                                      }
                                    }}
                                    disabled={isSavingAnswer}
                                    className='inline-flex h-6 w-6 items-center justify-center text-rose-600 hover:bg-rose-500/10 disabled:opacity-50'
                                  >
                                    <Trash2 className='h-3.5 w-3.5' />
                                  </button>
                                </Tooltip>
                              </div>
                            )}
                        </div>
                        {editingContributorAnswerId === ans.id ?
                          <div className='space-y-2'>
                            <textarea
                              value={editingContributorAnswerText}
                              onChange={(e) =>
                                setEditingContributorAnswerText(e.target.value)
                              }
                              className='textarea h-32 text-xs'
                            />
                            <div className='flex justify-end gap-2'>
                              <button
                                type='button'
                                onClick={() => {
                                  setEditingContributorAnswerId(null);
                                  setEditingContributorAnswerText('');
                                }}
                                disabled={isSavingAnswer}
                                className='px-3 py-1.5 rounded-lg border border-border text-ink-secondary text-xs font-bold hover:bg-background-secondary transition-colors'
                              >
                                Cancel
                              </button>
                              <button
                                type='button'
                                onClick={async () => {
                                  await onUpdateContributorAnswer?.(
                                    ans.id,
                                    editingContributorAnswerText,
                                  );
                                  setEditingContributorAnswerId(null);
                                  setEditingContributorAnswerText('');
                                }}
                                disabled={
                                  isSavingAnswer ||
                                  !editingContributorAnswerText.trim()
                                }
                                className='px-3 py-1.5 rounded-lg bg-blue-600 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50'
                              >
                                {isSavingAnswer ? 'Saving...' : 'Save'}
                              </button>
                            </div>
                          </div>
                        : <div className='space-y-1.5 text-xs text-ink-secondary leading-relaxed'>
                            {(ans.body ?? '').split('\n').map((p, i) => (
                              <p key={i}>{p}</p>
                            ))}
                          </div>
                        }
                      </div>
                    ))}
                  </div>
                : !isCreatingContributorAnswer && (
                    <div className='flex flex-col items-center gap-2.5 rounded-xl border border-dashed border-border bg-background-secondary/20 px-4 py-8 text-center'>
                      <span className='flex h-9 w-9 items-center justify-center rounded-xl bg-blue-500/10'>
                        <UserCheck className='h-4.5 w-4.5 text-blue-400' />
                      </span>
                      <p className='text-xs font-semibold text-ink-primary'>
                        No author answer yet
                      </p>
                      <p className='text-xs text-ink-secondary max-w-[220px]'>
                        The question author has not added a reference answer.
                      </p>
                    </div>
                  )
                }
              </div>
            )}

            {/* ══════════════════════════════════════════ TAB: COMMUNITY ══════════════════════════════════════════ */}
            {activeTab === 'community' && (
              <div onClick={(e) => e.stopPropagation()}>
                {displayCommunity.length > 0 ?
                  <div className='space-y-3 max-h-[480px] overflow-y-auto custom-scrollbar-primary pr-0.5'>
                    {displayCommunity.map((answer, idx) => {
                      const isRec = Boolean(answer.is_recommended);
                      return (
                        <div
                          key={`${answer.id}-${idx}`}
                          className={cn(
                            'rounded-xl border p-3.5 space-y-2.5 transition-all',
                            isRec ?
                              'border-amber-500/25 bg-amber-500/[0.04]'
                            : 'border-border bg-panel hover:border-amber-500/20',
                          )}
                        >
                          <div className='flex items-center justify-between gap-2 pb-2 border-b border-border/40'>
                            <div className='flex items-center gap-1.5'>
                              <Crown
                                className={cn(
                                  'h-3.5 w-3.5 shrink-0',
                                  isRec ? 'text-amber-500' : (
                                    'text-ink-secondary/40'
                                  ),
                                )}
                              />
                              <span className='font-bold text-ink-primary'>
                                {answer.author_name ?? 'Community contributor'}
                              </span>
                              {isRec && (
                                <span className='rounded-full bg-amber-500/15 px-2 py-px text-[10px] font-bold text-amber-600 dark:text-amber-300'>
                                  Featured
                                </span>
                              )}
                            </div>
                            {isQuestionContributor &&
                              onToggleFeaturedAnswer && (
                                <button
                                  type='button'
                                  disabled={togglingAnswerId === answer.id}
                                  onClick={(e) =>
                                    handleToggleRecommend(answer.id, isRec, e)
                                  }
                                  className={cn(
                                    'inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-semibold transition-all active:scale-95',
                                    isRec ?
                                      'bg-rose-500/10 text-rose-600 hover:bg-rose-500/20'
                                    : 'bg-amber-500/10 text-amber-600 hover:bg-amber-500/20',
                                  )}
                                >
                                  {isRec ?
                                    <>
                                      <StarOff className='h-3 w-3' />
                                      Remove feature
                                    </>
                                  : <>
                                      <Star className='h-3 w-3 fill-current' />
                                      Feature answer
                                    </>
                                  }
                                </button>
                              )}
                          </div>
                          <div className='space-y-1.5 text-xs text-ink-secondary leading-relaxed'>
                            {(answer.body ?? '').split('\n').map((p, i) => (
                              <p key={i}>{p}</p>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                : <div className='flex flex-col items-center gap-2.5 rounded-xl border border-dashed border-border bg-background-secondary/20 px-4 py-8 text-center'>
                    <span className='flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500/10'>
                      <Users className='h-4.5 w-4.5 text-amber-400' />
                    </span>
                    <p className='text-xs font-semibold text-ink-primary'>
                      No featured community answers
                    </p>
                    <p className='text-xs text-ink-secondary max-w-[220px]'>
                      {isQuestionContributor ?
                        'As the question author, you can feature strong community answers.'
                      : 'Answers featured by the author or an admin will appear here.'
                      }
                    </p>
                  </div>
                }
              </div>
            )}

            {/* ══════════════════════════════════════════ TAB: MINE ══════════════════════════════════════════ */}
            {activeTab === 'mine' && (
              <div onClick={(e) => e.stopPropagation()}>
                {myAnswer?.body?.trim() ?
                  <div className='rounded-xl border border-emerald-500/20 bg-emerald-500/[0.03] p-3.5 space-y-2.5 max-h-[480px] overflow-y-auto custom-scrollbar-primary pr-0.5'>
                    <div className='flex items-center justify-between gap-2 pb-2 border-b border-emerald-500/10'>
                      <div className='flex items-center gap-2'>
                        <span className='flex h-5 w-5 shrink-0 items-center justify-center rounded-lg bg-emerald-500/15'>
                          <Target className='h-3 w-3 text-emerald-600 dark:text-emerald-400' />
                        </span>
                        <span className='label-overline text-emerald-600 dark:text-emerald-400'>
                          My Answer Notes
                        </span>
                      </div>
                      <button
                        onClick={handleStart}
                        className='label-sm text-primary hover:underline flex items-center gap-1 transition-colors'
                      >
                        <Edit3 className='w-3 h-3' /> Edit
                      </button>
                    </div>
                    <div className='space-y-1.5 text-xs text-ink-secondary leading-relaxed'>
                      {myAnswer.body.split('\n').map((p, i) => (
                        <p key={i}>{p}</p>
                      ))}
                    </div>
                  </div>
                : <div className='flex flex-col items-center gap-2.5 rounded-xl border border-dashed border-border bg-background-secondary/20 px-4 py-8 text-center'>
                    <span className='flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/10'>
                      <Edit3 className='h-4.5 w-4.5 text-emerald-400' />
                    </span>
                    <p className='text-xs font-semibold text-ink-primary'>
                      No personal answer yet
                    </p>
                    <p className='text-xs text-ink-secondary max-w-[220px]'>
                      Capture your own answer points for review and practice.
                    </p>
                    <button
                      type='button'
                      onClick={handleStart}
                      className='inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 active:scale-95 transition-all shadow-sm'
                    >
                      <Edit3 className='h-3.5 w-3.5' /> Write My Answer
                    </button>
                  </div>
                }
              </div>
            )}
          </div>

      : <p className='body-sm text-ink-secondary italic py-1 text-xs'>
          Answers are hidden. Click here or use the eye button to reveal them.
        </p>
      }
    </div>
  );
}
