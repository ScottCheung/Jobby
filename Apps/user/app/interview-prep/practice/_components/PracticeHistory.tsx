/** @format */

import React, { useEffect, useState } from 'react';
import {
  Award,
  ArrowRight,
  CheckCircle,
  ClipboardList,
  FileText,
  Lightbulb,
  ListChecks,
  Target,
  Save,
  Sparkles,
  Trash2,
} from 'lucide-react';
import type { PracticeEvaluation, PracticeRecord } from '@/lib/types';
import { api } from '@/lib/api';
import { showGlobalToast } from '@/lib/toast';
import { formatRelativeDate } from '@/components/ConsoleUtils';
import { InteractiveTranscript } from './InteractiveTranscript';
import { motion } from 'framer-motion';

const normalizePlayback = (audio: HTMLAudioElement) => {
  audio.defaultPlaybackRate = 1;
  audio.playbackRate = 1;
  const pitchSafeAudio = audio as HTMLAudioElement & {
    preservePitch?: boolean;
    mozPreservesPitch?: boolean;
    webkitPreservesPitch?: boolean;
  };
  pitchSafeAudio.preservePitch = true;
  pitchSafeAudio.mozPreservesPitch = true;
  pitchSafeAudio.webkitPreservesPitch = true;
};

const resolveAudioSrc = (apiBaseUrl: string, urlPath: string) => {
  if (/^https?:\/\//i.test(urlPath)) {
    return urlPath;
  }
  return `${apiBaseUrl}${urlPath}`;
};

interface PracticeHistoryProps {
  attempts: PracticeRecord[];
  apiBaseUrl: string;
  onDeleteAttempt: (id: string) => void;
  onUpdateAttempt?: (
    id: string,
    updatedRecord: Partial<PracticeRecord>,
  ) => void;
  onSavePolishedAnswer?: (answer: string) => void;
}

export function PracticeHistory({
  attempts,
  apiBaseUrl,
  onDeleteAttempt,
  onUpdateAttempt,
  onSavePolishedAnswer,
}: PracticeHistoryProps) {
  const [evaluations, setEvaluations] = useState<
    Record<string, PracticeEvaluation>
  >({});
  const [evaluatingId, setEvaluatingId] = useState<string | null>(null);

  const requestEvaluation = async (recordId: string) => {
    setEvaluatingId(recordId);
    try {
      const evaluation = await api.createPracticeEvaluation(recordId);
      setEvaluations((current) => ({ ...current, [recordId]: evaluation }));
      showGlobalToast(`AI feedback ready: ${evaluation.overall_score}/100`);
      window.dispatchEvent(new Event('playbookGamificationUpdated'));
    } catch (error) {
      console.error('Failed to score practice answer:', error);
      showGlobalToast(
        error instanceof Error ? error.message : 'Could not score this answer',
      );
    } finally {
      setEvaluatingId(null);
    }
  };

  useEffect(() => {
    let cancelled = false;
    void Promise.all(
      attempts.map(async (attempt) => {
        const records = await api.practiceEvaluations(attempt.id);
        return [attempt.id, records[0]] as const;
      }),
    )
      .then((items) => {
        if (cancelled) return;
        setEvaluations(
          Object.fromEntries(
            items.filter(
              (item): item is readonly [string, PracticeEvaluation] =>
                Boolean(item[1]),
            ),
          ),
        );
      })
      .catch((error) => console.error('Failed to load AI feedback:', error));
    return () => {
      cancelled = true;
    };
  }, [attempts]);
  if (attempts.length === 0) {
    return (
      <div className='flex-1 flex flex-col items-center justify-center text-center p-6 text-ink-secondary opacity-65 h-full min-h-[300px]'>
        <Award className='w-10 h-10 mb-3 text-zinc-400' />
        <p className='body-md'>No practice records for this question yet.</p>
        <p className='body-sm mt-1'>
          Submit your response in the Workspace tab to create your first history
          record.
        </p>
      </div>
    );
  }

  return (
    <div className='flex-1 flex flex-col gap-4'>
      {attempts.map((attempt) => (
        <div
          key={attempt.id}
          className='p-4 rounded-t-3xl rounded-b-2xl bg-linear-to-b from-primary/30  to-transparent flex flex-col gap-3 relative group'
        >
          {attempt.audio_records && attempt.audio_records.length > 0 && (
            <div className=''>
              <audio
                id={`audio-player-${attempt.id}`}
                src={resolveAudioSrc(
                  apiBaseUrl,
                  attempt.audio_records[0].url_path,
                )}
                controls
                onLoadedMetadata={(e) => normalizePlayback(e.currentTarget)}
                onPlay={(e) => normalizePlayback(e.currentTarget)}
                className='body-sm w-full focus:outline-none'
              />
            </div>
          )}
          <div className='ml-6 mb-4'>
            <div className='flex justify-between'>
              <div className='flex items-center gap-4'>
                <span className='label-sm'>
                  {formatRelativeDate(attempt.date || attempt.created_at)}
                </span>
                {attempt.confidence_score && (
                  <div className='flex items-center gap-1 bg-primary/10 text-primary px-2 py-0.5 rounded-full text-[12px] font-bold'>
                    <CheckCircle className='w-3 h-3' />
                    Score: {attempt.confidence_score}/5
                  </div>
                )}
              </div>
              {/* Delete Attempt Trigger */}
              <button
                onClick={() => onDeleteAttempt(attempt.id)}
                className='p-2 text-ink-secondary hover:text-red-500 rounded-lg hover:bg-background-secondary transition-colors'
              >
                <Trash2 className='w-4 h-4' />
              </button>
            </div>

            {/* Clickable transcript segments with timestamp jump */}
            {attempt.my_answer && (
              <div className=''>
                {(() => {
                  try {
                    if (attempt.my_answer.startsWith('[')) {
                      const parsed = JSON.parse(attempt.my_answer);
                      return (
                        <InteractiveTranscript
                          segments={parsed}
                          attemptId={attempt.id}
                          onEditSegment={(index, newText) => {
                            if (!onUpdateAttempt) return;
                            const updatedSegments = [...parsed];
                            updatedSegments[index].text = newText;
                            onUpdateAttempt(attempt.id, {
                              my_answer: JSON.stringify(updatedSegments),
                            });
                          }}
                        />
                      );
                    }
                  } catch (e) {}
                  return (
                    <span className='whitespace-pre-wrap '>
                      {attempt.my_answer}
                    </span>
                  );
                })()}
              </div>
            )}

            {attempt.notes && (
              <div className='body-sm text-ink-secondary bg-amber-500/5 p-2 rounded border border-amber-500/10 flex flex-col gap-0.5 mt-2'>
                <span className='font-bold text-[10px] uppercase text-amber-600 dark:text-amber-400'>
                  Notes
                </span>
                <p>{attempt.notes}</p>
              </div>
            )}
            {attempt.my_answer && (
              <div className='mt-3 border-t border-border/60 pt-3'>
                {evaluations[attempt.id] ?
                  (() => {
                    const evalData = evaluations[attempt.id];
                    const score = evalData.overall_score ?? 0;
                    const res = evalData.result || {};
                    const scoreColorClass =
                      score >= 80 ?
                        'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                      : score >= 60 ?
                        'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20'
                      : 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20';

                    return (
                      <div className='rounded-xl border border-border/80 bg-background/50 p-3.5 space-y-3 shadow-xs'>
                        {/* Header: Score & Badge */}
                        <div className='flex items-center justify-between'>
                          <div className='flex items-center gap-2'>
                            <Sparkles className='w-4 h-4 text-primary' />
                            <span className='font-semibold text-ink-primary text-sm'>
                              AI Feedback
                            </span>
                          </div>
                          <div
                            className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${scoreColorClass}`}
                          >
                            Overall Score: {score} / 100
                          </div>
                        </div>

                        {(res.priority_issue ||
                          res.priority_fix ||
                          res.gaps?.[0] ||
                          res.next_steps?.[0]) && (
                          <div className='rounded-lg border border-amber-500/15 bg-amber-500/5 p-3 space-y-2'>
                            <div className='font-bold text-[11px] uppercase text-amber-600 dark:text-amber-400 flex items-center gap-1.5'>
                              <Target className='w-3.5 h-3.5' />
                              Fix This First
                            </div>
                            {(res.priority_issue || res.gaps?.[0]) && (
                              <p className='text-xs text-ink-secondary leading-relaxed'>
                                Issue: {res.priority_issue || res.gaps?.[0]}
                              </p>
                            )}
                            {(res.priority_fix || res.next_steps?.[0]) && (
                              <p className='text-sm text-ink-primary leading-relaxed font-semibold'>
                                {res.priority_fix || res.next_steps?.[0]}
                              </p>
                            )}
                          </div>
                        )}

                        {res.answer_plan && res.answer_plan.length > 0 && (
                          <div className='rounded-lg border border-sky-500/10 bg-sky-500/5 p-3 space-y-2'>
                            <div className='font-bold text-[11px] uppercase text-sky-600 dark:text-sky-400 flex items-center gap-1.5'>
                              <ListChecks className='w-3.5 h-3.5' />
                              Next Answer Plan
                            </div>
                            <div className='space-y-2'>
                              {res.answer_plan.slice(0, 4).map((step, i) => (
                                <div
                                  key={i}
                                  className='flex gap-2 text-xs leading-relaxed'
                                >
                                  <span className='mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-sky-500/15 text-[10px] font-bold text-sky-600 dark:text-sky-300'>
                                    {i + 1}
                                  </span>
                                  <span className='text-ink-secondary'>
                                    {step}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {res.polished_answer && (
                          <div className='bg-primary/5 border border-primary/15 rounded-lg p-3 space-y-2'>
                            <div className='flex items-center justify-between gap-2'>
                              <div className='font-bold text-[10px] uppercase text-primary flex items-center gap-1'>
                                <FileText className='w-3 h-3' />
                                AI Polished Answer
                              </div>
                              {onSavePolishedAnswer && (
                                <button
                                  type='button'
                                  onClick={() =>
                                    onSavePolishedAnswer(
                                      res.polished_answer || '',
                                    )
                                  }
                                  className='inline-flex items-center gap-1 rounded-md border border-primary/20 bg-background px-2 py-1 text-[11px] font-semibold text-primary hover:bg-primary/10 transition-colors'
                                >
                                  <Save className='w-3 h-3' />
                                  Add to My Answer
                                </button>
                              )}
                            </div>
                            <p className='text-xs text-ink-primary whitespace-pre-wrap leading-relaxed'>
                              {res.polished_answer}
                            </p>
                          </div>
                        )}

                        {res.gold_rewrite && (
                          <div className='bg-background-secondary/50 border border-border/70 rounded-lg p-2.5 space-y-1'>
                            <div className='font-bold text-[10px] uppercase text-primary flex items-center gap-1'>
                              <Sparkles className='w-3 h-3' />
                              Stronger Sample Line
                            </div>
                            <p className='text-xs text-ink-primary italic font-serif leading-relaxed'>
                              “{res.gold_rewrite}”
                            </p>
                          </div>
                        )}

                        <div className='grid grid-cols-2 gap-2 text-[12px]'>
                          {res.strengths && res.strengths.length > 0 && (
                            <div className='bg-emerald-500/5 border border-emerald-500/10 rounded-lg p-2 space-y-1'>
                              <div className='font-bold text-[10px] uppercase text-emerald-600 dark:text-emerald-400 flex items-center gap-1'>
                                <CheckCircle className='w-3 h-3' />
                                Keep
                              </div>
                              {res.strengths.slice(0, 2).map((st, i) => (
                                <p
                                  key={i}
                                  className='text-ink-secondary leading-snug'
                                >
                                  {st}
                                </p>
                              ))}
                            </div>
                          )}
                          {res.gaps && res.gaps.length > 0 && (
                            <div className='bg-rose-500/5 border border-rose-500/10 rounded-lg p-2 space-y-1'>
                              <div className='font-bold text-[10px] uppercase text-rose-600 dark:text-rose-400 flex items-center gap-1'>
                                <ArrowRight className='w-3 h-3' />
                                Replace
                              </div>
                              {res.gaps.slice(0, 2).map((gp, i) => (
                                <p
                                  key={i}
                                  className='text-ink-secondary leading-snug'
                                >
                                  {gp}
                                </p>
                              ))}
                            </div>
                          )}
                        </div>

                        {res.next_steps && res.next_steps.length > 0 && (
                          <div className='bg-background-secondary/50 border border-border/70 rounded-lg p-2.5 space-y-1.5'>
                            <div className='font-bold text-[10px] uppercase text-ink-primary flex items-center gap-1'>
                              <Lightbulb className='w-3 h-3 text-primary' />
                              Next Practice Actions
                            </div>
                            {res.next_steps.slice(0, 3).map((step, i) => (
                              <p
                                key={i}
                                className='text-xs text-ink-secondary leading-relaxed'
                              >
                                {step}
                              </p>
                            ))}
                          </div>
                        )}

                        {res.score_basis && res.score_basis.length > 0 && (
                          <div className='bg-background-secondary/50 border border-border/70 rounded-lg p-3 space-y-2'>
                            <div className='font-bold text-[10px] uppercase text-ink-primary flex items-center gap-1.5'>
                              <ClipboardList className='w-3.5 h-3.5 text-primary' />
                              Why This Score
                            </div>
                            <div className='space-y-1.5'>
                              {res.score_basis.slice(0, 3).map((basis, i) => (
                                <p
                                  key={i}
                                  className='text-xs text-ink-secondary leading-relaxed'
                                >
                                  {basis}
                                </p>
                              ))}
                            </div>
                          </div>
                        )}

                        {res.dimensions && res.dimensions.length > 0 && (
                          <div className='space-y-2'>
                            <div className='font-bold text-[10px] uppercase text-ink-primary'>
                              Score Details
                            </div>
                            <div className='grid grid-cols-1 sm:grid-cols-2 gap-2'>
                              {res.dimensions.slice(0, 4).map((dim) => (
                                <div
                                  key={dim.name}
                                  className='bg-background-secondary/60 rounded-lg p-3 flex flex-col gap-2'
                                >
                                  <div className='flex justify-between text-[12px] font-medium text-ink-secondary gap-2'>
                                    <span className='text-ink-primary font-semibold'>
                                      {dim.name}
                                    </span>
                                    <span className='font-bold text-ink-primary'>
                                      {dim.score} %
                                    </span>
                                  </div>
                                  <div className='w-full bg-zinc-200 dark:bg-zinc-700 h-2 rounded-full overflow-hidden'>
                                    <motion.div
                                      className='bg-primary-gradient h-full rounded-full '
                                      initial={{
                                        width: 0,
                                      }}
                                      whileInView={{
                                        width: `${Math.min(100, Math.max(0, dim.score))}%`,
                                      }}
                                      transition={{
                                        // type: 'spring',
                                        // bounce: 0.3,
                                        ease: [0.22, 1, 0.36, 1],
                                        duration: 1.2,
                                      }}
                                    />
                                  </div>
                                  {dim.feedback && (
                                    <p className='text-xs text-ink-secondary leading-relaxed'>
                                      {dim.feedback}
                                    </p>
                                  )}
                                  {dim.evidence && (
                                    <p className='text-[11px] text-ink-secondary/80 leading-relaxed'>
                                      Evidence: {dim.evidence}
                                    </p>
                                  )}
                                  {dim.fix && (
                                    <p className='text-[11px] text-primary leading-relaxed font-medium'>
                                      Fix: {dim.fix}
                                    </p>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })()
                : <button
                    type='button'
                    onClick={() => void requestEvaluation(attempt.id)}
                    disabled={evaluatingId === attempt.id}
                    className='inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline disabled:opacity-50'
                  >
                    <Sparkles className='h-3.5 w-3.5' />
                    {evaluatingId === attempt.id ?
                      'Scoring...'
                    : 'Get AI Feedback'}
                  </button>
                }
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
