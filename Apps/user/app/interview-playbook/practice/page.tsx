/** @format */

'use client';
import React, { useEffect, useState, useRef } from 'react';
import { api } from '@/lib/api';
import { resolveApiBaseUrl } from '@/lib/runtime';
import type { InterviewQuestion, PracticeRecord } from '@/lib/types';
import {
  ChevronLeft,
  ChevronRight,
  Clock,
  Lightbulb,
  Target,
  Star,
  Tag,
  Edit,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { FrameworkDetails } from './_components/FrameworkDetails';
import { PracticeWorkspace } from './_components/PracticeWorkspace';
import { PracticeHistory } from './_components/PracticeHistory';

// Helper to compute keyword overlap similarity client-side
const calculateSimilarityScore = (
  transcript: string,
  standardAnswer: string,
): number => {
  if (!transcript || !standardAnswer) return 1;

  // Clean and tokenize text
  const tokenize = (text: string) =>
    text
      .toLowerCase()
      .replace(/[^\w\s]/g, '')
      .split(/\s+/)
      .filter((w) => w.length > 2); // Ignore short words

  const wordsT = tokenize(transcript);
  const wordsS = tokenize(standardAnswer);

  if (wordsT.length === 0 || wordsS.length === 0) return 1;

  // Count frequencies
  const freqT: Record<string, number> = {};
  const freqS: Record<string, number> = {};
  const allWords = new Set<string>();

  wordsT.forEach((w) => {
    freqT[w] = (freqT[w] || 0) + 1;
    allWords.add(w);
  });
  wordsS.forEach((w) => {
    freqS[w] = (freqS[w] || 0) + 1;
    allWords.add(w);
  });

  // Compute cosine similarity
  let dotProduct = 0;
  let magnitudeT = 0;
  let magnitudeS = 0;

  allWords.forEach((w) => {
    const valT = freqT[w] || 0;
    const valS = freqS[w] || 0;
    dotProduct += valT * valS;
    magnitudeT += valT * valT;
    magnitudeS += valS * valS;
  });

  const magT = Math.sqrt(magnitudeT);
  const magS = Math.sqrt(magnitudeS);

  if (magT === 0 || magS === 0) return 1;

  const cosineSim = dotProduct / (magT * magS);

  // Map 0..1 similarity to 1..5 stars
  if (cosineSim < 0.1) return 1;
  if (cosineSim < 0.25) return 2;
  if (cosineSim < 0.45) return 3;
  if (cosineSim < 0.65) return 4;
  return 5;
};

export default function PracticeModePage() {
  const [questions, setQuestions] = useState<InterviewQuestion[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [practiceRecords, setPracticeRecords] = useState<PracticeRecord[]>([]);
  const [apiBaseUrl, setApiBaseUrl] = useState('');

  // Right column tab state: 'workspace' or 'history'
  const [activeTab, setActiveTab] = useState<'workspace' | 'history'>(
    'workspace',
  );

  // Answers visibility states
  const [globalShowAnswers, setGlobalShowAnswers] = useState(false); // Global toggle
  const [showThisAnswer, setShowThisAnswer] = useState(false); // Local per-question toggle

  // In-place Standard Answer editing state
  const [isEditingAnswer, setIsEditingAnswer] = useState(false);
  const [editedAnswer, setEditedAnswer] = useState('');
  const [isSavingAnswer, setIsSavingAnswer] = useState(false);

  // Answer states
  const [confidenceScore, setConfidenceScore] = useState<number | null>(null);
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Audio Recording State
  const [isRecording, setIsRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [activeStream, setActiveStream] = useState<MediaStream | null>(null);

  // Speech-to-Text State
  const [transcriptSegments, setTranscriptSegments] = useState<
    Array<{ text: string; start: number; end: number }>
  >([]);
  const [interimText, setInterimText] = useState('');

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const recognitionRef = useRef<any>(null);
  const draftAudioRef = useRef<HTMLAudioElement | null>(null);

  const initData = async () => {
    try {
      const qs = await api.interviewQuestions();
      setQuestions(qs);
      const prs = await api.practiceRecords();
      setPracticeRecords(prs);
      const baseUrl = await resolveApiBaseUrl();
      setApiBaseUrl(baseUrl);
    } catch (err) {
      console.error('Failed to initialize practice mode:', err);
    }
  };

  useEffect(() => {
    void initData();
  }, []);

  // Reset local show answer toggle when switching questions
  useEffect(() => {
    setShowThisAnswer(false);
    setIsEditingAnswer(false);
  }, [currentQuestionIndex]);

  const currentQuestion = questions[currentQuestionIndex];

  // Filter history of attempts for this current question
  const currentAttempts = practiceRecords
    .filter((r) => r.question_id === currentQuestion?.id)
    .sort(
      (a, b) =>
        new Date(b.date || b.created_at || '').getTime() -
        new Date(a.date || a.created_at || '').getTime(),
    );

  const handleNext = () => {
    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex((prev) => prev + 1);
      resetWorkspace();
    }
  };

  const handlePrevious = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex((prev) => prev - 1);
      resetWorkspace();
    }
  };

  const resetWorkspace = () => {
    setConfidenceScore(null);
    setNotes('');
    resetRecording();
  };

  // Speech Recognition Start/Stop with start and end times
  const startSpeechRecognition = () => {
    setTranscriptSegments([]);
    setInterimText('');
    const SpeechRecognition =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      console.warn('Speech recognition not supported in this browser.');
      return;
    }

    const rec = new SpeechRecognition();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = 'en-US';

    const recordStartTime = Date.now();
    let lastSegmentEndTime = 0;

    rec.onresult = (event: any) => {
      let interim = '';
      const finalSegments: Array<{ text: string; start: number; end: number }> =
        [];

      for (let i = event.resultIndex; i < event.results.length; ++i) {
        const transcript = event.results[i][0].transcript;
        const elapsed = (Date.now() - recordStartTime) / 1000;
        if (event.results[i].isFinal) {
          finalSegments.push({
            text: transcript.trim(),
            start: lastSegmentEndTime,
            end: elapsed,
          });
          lastSegmentEndTime = elapsed;
        } else {
          interim += transcript;
        }
      }

      if (finalSegments.length > 0) {
        setTranscriptSegments((prev) => {
          const newSegs = [...prev];
          finalSegments.forEach((item) => {
            if (
              !newSegs.some(
                (s) => s.text === item.text && Math.abs(s.end - item.end) < 0.5,
              )
            ) {
              newSegs.push(item);
            }
          });
          return newSegs;
        });
      }
      setInterimText(interim);
    };

    rec.onerror = (err: any) => {
      console.error('Speech recognition error:', err);
    };

    recognitionRef.current = rec;
    rec.start();
  };

  const stopSpeechRecognition = () => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (e) {}
      recognitionRef.current = null;
    }
    setInterimText('');
  };

  // Recording Functions
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      setActiveStream(stream);
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm',
      });
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const url = URL.createObjectURL(blob);
        setAudioBlob(blob);
        setAudioUrl(url);
        stream.getTracks().forEach((track) => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingSeconds(0);

      // Start Web Speech API Recognition
      startSpeechRecognition();

      timerRef.current = setInterval(() => {
        setRecordingSeconds((prev) => prev + 1);
      }, 1000);
    } catch (err) {
      console.error('Failed to start recording:', err);
      alert('Microphone access denied or not found.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      setActiveStream(null);
      stopSpeechRecognition();
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }

      // Compute similarity score after recognition outputs are settled
      setTimeout(() => {
        setTranscriptSegments((currentSegs) => {
          const fullText = currentSegs.map((s) => s.text).join(' ');
          const standardText = currentQuestion?.answer_objective || '';
          const score = calculateSimilarityScore(fullText, standardText);
          setConfidenceScore(score);
          return currentSegs;
        });
      }, 300);
    }
  };

  const resetRecording = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    stopSpeechRecognition();
    setAudioBlob(null);
    setAudioUrl(null);
    setActiveStream(null);
    setRecordingSeconds(0);
    setIsRecording(false);
    setTranscriptSegments([]);
    setInterimText('');
  };

  const handleSubmit = async () => {
    if (!currentQuestion || (!audioBlob && transcriptSegments.length === 0))
      return;

    setIsSubmitting(true);
    try {
      // Serialize transcript array with start and end times into my_answer
      const myAnswerSerialized =
        transcriptSegments.length > 0 ? JSON.stringify(transcriptSegments) : '';

      // 1. Save practice record text/score
      const record = await api.createPracticeRecord({
        question_id: currentQuestion.id,
        my_answer: myAnswerSerialized || undefined,
        confidence_score: confidenceScore ?? undefined,
        notes: notes.trim() || undefined,
        date: new Date().toISOString(),
      });

      // 2. Upload audio if available
      if (audioBlob && record?.id) {
        await api.uploadPracticeAudio(record.id, audioBlob);
      }

      // Re-fetch practice records to update attempts list
      const updated = await api.practiceRecords();
      setPracticeRecords(updated);

      // Reset
      resetRecording();
      setConfidenceScore(null);
      setNotes('');
      setActiveTab('history');
    } catch (err) {
      console.error('Failed to save practice record:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteAttempt = async (id: string) => {
    if (
      !window.confirm('Are you sure you want to delete this practice attempt?')
    )
      return;
    try {
      await api.deletePracticeRecord(id);
      const updated = await api.practiceRecords();
      setPracticeRecords(updated);
    } catch (err) {
      console.error('Failed to delete practice record:', err);
    }
  };

  const handleSaveStandardAnswer = async () => {
    if (!currentQuestion) return;
    setIsSavingAnswer(true);
    try {
      await api.updateInterviewQuestion(currentQuestion.id, {
        answer_objective: editedAnswer.trim() || undefined,
      } as any);

      // Update locally
      setQuestions((prev) =>
        prev.map((q) =>
          q.id === currentQuestion.id ?
            { ...q, answer_objective: editedAnswer.trim() }
          : q,
        ),
      );
      setIsEditingAnswer(false);
    } catch (err) {
      console.error('Failed to update standard answer:', err);
    } finally {
      setIsSavingAnswer(false);
    }
  };

  const shouldShowAnswer = globalShowAnswers || showThisAnswer;

  return (
    <div className='grid grid-cols-2 gap-4 h-full overflow-hidden'>
      {/* 1. Left Column: Question metadata, Navigation, Answer Spoiler & Framework */}
      <div className='display-panel relative flex flex-col gap-4 overflow-y-auto relative'>
        {/* Navigation header directly inside the card */}
        <div className='sticky-0 px-6 pt-6 pb-2  -mx-6 -mt-6 mb-2 shrink-0'>
          <div className='flex  items-center justify-between'>
            {' '}
            <div className='flex flex-col'>
              <span className='text-[10px] text-ink-secondary font-bold'>
                Question {currentQuestionIndex + 1} of {questions.length}
              </span>
            </div>
            <div className='flex items-center gap-2'>
              {/* Global toggle to show/hide standard answer example */}
              <button
                onClick={() => setGlobalShowAnswers((prev) => !prev)}
                className={cn(
                  'text-[10px] font-bold px-2 py-1.5 rounded-lg border transition-all',
                  globalShowAnswers ?
                    'bg-primary text-primary-foreground border-primary'
                  : 'bg-white dark:bg-zinc-900 text-ink-secondary border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800',
                )}
                title='Toggle showing standard answers across all questions'
              >
                {globalShowAnswers ?
                  'Already Show Answer'
                : 'Default Hide Answer'}
              </button>
              <div className='h-4 w-px bg-zinc-200 dark:bg-zinc-800/60 mx-1' />
              <button
                onClick={handlePrevious}
                disabled={currentQuestionIndex === 0}
                className='p-1.5 rounded-lg border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-ink-primary'
              >
                <ChevronLeft className='w-4 h-4' />
              </button>
              <button
                onClick={handleNext}
                disabled={currentQuestionIndex === questions.length - 1}
                className='p-1.5 rounded-lg border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-ink-primary'
              >
                <ChevronRight className='w-4 h-4' />
              </button>
            </div>
          </div>

          {/* Title, tags, rating */}
          <div className='flex flex-col gap-3'>
            <h2 className='text-xl font-bold text-ink-primary leading-snug'>
              {currentQuestion?.title}
            </h2>
            {/* Display Tags */}
            {currentQuestion?.tags && currentQuestion.tags.length > 0 && (
              <div className='flex flex-wrap gap-1'>
                <div className='flex flex-wrap items-center justify-between gap-2'>
                  <div className='flex items-center gap-2'>
                    {currentQuestion?.frequency && (
                      <span
                        className={cn(
                          'px-2.5 py-1 rounded-full text-[10px] font-medium',
                          (currentQuestion.frequency === 'Low' ||
                            currentQuestion.frequency === 'Easy') &&
                            'bg-green-500/10 text-green-600 dark:text-green-400',
                          currentQuestion.frequency === 'Medium' &&
                            'bg-amber-500/10 text-amber-600 dark:text-amber-400',
                          (currentQuestion.frequency === 'High' ||
                            currentQuestion.frequency === 'Hard') &&
                            'bg-rose-500/10 text-rose-600 dark:text-rose-400',
                        )}
                      >
                        {(
                          currentQuestion.frequency === 'High' ||
                          currentQuestion.frequency === 'Hard'
                        ) ?
                          'High'
                        : currentQuestion.frequency === 'Medium' ?
                          'Medium'
                        : (
                          currentQuestion.frequency === 'Low' ||
                          currentQuestion.frequency === 'Easy'
                        ) ?
                          'Low'
                        : currentQuestion.frequency}
                      </span>
                    )}
                  </div>
                </div>
                {currentQuestion.tags.map((t) => (
                  <span
                    key={t.id}
                    className='text-[10px] bg-zinc-100 dark:bg-zinc-800/80 text-ink-primary px-2 py-0.5 rounded-full border border-zinc-200/50 dark:border-zinc-700/50 flex items-center gap-1 font-semibold'
                  >
                    <Tag className='w-2.5 h-2.5 opacity-60' />
                    {t.name}
                  </span>
                ))}
              </div>
            )}
            <div className='flex gap-0.5'>
              {Array.from({ length: 5 }).map((_, i) => (
                <Star
                  key={i}
                  className={cn(
                    'w-3.5 h-3.5',
                    i < (currentQuestion?.importance_score || 0) ?
                      'fill-amber-500 text-amber-500'
                    : 'text-zinc-300 dark:text-zinc-700',
                  )}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Collapsible Standard Answer Section (Entire module box clickable when collapsed) */}
        <div
          onClick={() => {
            if (!shouldShowAnswer) {
              setShowThisAnswer(true);
            }
          }}
          className={cn(
            'flex flex-col gap-1.5 mt-2 p-4 rounded-xl border border-zinc-100 dark:border-zinc-800/50 bg-zinc-50/50 dark:bg-zinc-900/30 transition-all select-none',
            !shouldShowAnswer &&
              'cursor-pointer hover:bg-zinc-100 dark:hover:bg-zinc-800/50',
          )}
        >
          <div
            onClick={(e) => {
              if (shouldShowAnswer) {
                e.stopPropagation(); // Stop parent expand click
                setShowThisAnswer(false);
                setIsEditingAnswer(false);
              }
            }}
            className={cn(
              'flex justify-between items-center pb-2 mb-2 border-b border-zinc-200/50 dark:border-zinc-750 pb-2 mb-2',
              shouldShowAnswer && 'cursor-pointer hover:opacity-85',
            )}
          >
            <span className='text-xs font-bold text-ink-primary flex items-center gap-1.5'>
              <Target className='w-3.5 h-3.5 text-blue-500 shrink-0' />
              标准答案示例 (Standard Answer)
            </span>
            <div className='flex items-center gap-3 shrink-0'>
              {shouldShowAnswer && !isEditingAnswer && (
                <button
                  onClick={(e) => {
                    e.stopPropagation(); // Don't collapse card
                    setEditedAnswer(currentQuestion?.answer_objective || '');
                    setIsEditingAnswer(true);
                  }}
                  className='text-xs text-primary font-bold hover:underline'
                >
                  修改标答
                </button>
              )}
              <span className='text-xs text-primary font-bold'>
                {shouldShowAnswer ? '点击折叠' : '点击展开'}
              </span>
            </div>
          </div>

          {shouldShowAnswer ?
            isEditingAnswer ?
              <div
                className='flex flex-col gap-2 pt-1'
                onClick={(e) => e.stopPropagation()}
              >
                <textarea
                  value={editedAnswer}
                  onChange={(e) => setEditedAnswer(e.target.value)}
                  placeholder='Modify your personal standard answer here...'
                  className='w-full h-32 p-3 text-sm rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 focus:outline-none text-ink-primary resize-none leading-relaxed'
                />
                <div className='flex justify-end gap-2 text-xs'>
                  <button
                    onClick={() => setIsEditingAnswer(false)}
                    disabled={isSavingAnswer}
                    className='px-3 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-800 text-ink-secondary font-bold hover:bg-zinc-50'
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSaveStandardAnswer}
                    disabled={isSavingAnswer}
                    className='px-3 py-1.5 rounded-lg bg-primary text-primary-foreground font-bold hover:opacity-90 disabled:opacity-50'
                  >
                    {isSavingAnswer ? 'Saving...' : 'Save Answer'}
                  </button>
                </div>
              </div>
            : currentQuestion?.answer_objective?.trim() ?
              <div className='text-sm text-ink-secondary leading-relaxed flex flex-col gap-2.5'>
                {currentQuestion.answer_objective
                  .split('\n')
                  .map((paragraph, index) => (
                    <p key={index}>{paragraph}</p>
                  ))}
              </div>
            : <p className='text-sm text-ink-secondary italic leading-relaxed'>
                No standard answer provided. Click "修改标答" to define your
                answer.
              </p>

          : <p className='text-xs text-ink-secondary italic leading-relaxed py-1'>
              Standard answer is hidden. Click anywhere on this card or toggle
              the global switcher above to view it.
            </p>
          }
        </div>

        {/* Answering Framework */}
        <div className='flex flex-col gap-1.5 bg-zinc-50/50 dark:bg-zinc-900/30 p-4 rounded-xl border border-zinc-100 dark:border-zinc-800/50'>
          <span className='text-xs font-bold text-ink-primary flex items-center gap-1.5'>
            <Lightbulb className='w-3.5 h-3.5 text-amber-500' />
            Answering Framework (答题框架)
          </span>
          <FrameworkDetails framework={currentQuestion?.answer_framework} />
        </div>
      </div>

      {/* 2. Right Column: Tabbed Response Workspace & History Timeline */}
      <div className='bg-panel border border-zinc-100 dark:border-zinc-800/60 rounded-xl flex flex-col overflow-hidden'>
        {/* Tab switch header */}
        <div className='flex border-b border-zinc-100 dark:border-zinc-800/60 bg-zinc-50/20 dark:bg-zinc-900/10 shrink-0'>
          <button
            onClick={() => setActiveTab('workspace')}
            className={cn(
              'flex-1 py-3 text-sm font-semibold text-center transition-all border-b-2',
              activeTab === 'workspace' ?
                'border-primary text-primary font-bold'
              : 'border-transparent text-ink-secondary hover:text-ink-primary',
            )}
          >
            <span className='flex items-center justify-center gap-2'>
              <Edit className='w-4 h-4' />
              Practice Workspace
            </span>
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={cn(
              'flex-1 py-3 text-sm font-semibold text-center transition-all border-b-2',
              activeTab === 'history' ?
                'border-primary text-primary font-bold'
              : 'border-transparent text-ink-secondary hover:text-ink-primary',
            )}
          >
            <span className='flex items-center justify-center gap-2'>
              <Clock className='w-4 h-4' />
              History ({currentAttempts.length})
            </span>
          </button>
        </div>

        {/* Tab Contents */}
        <div className='flex-1 overflow-y-auto relative p-6 flex flex-col'>
          {activeTab === 'workspace' ?
            <PracticeWorkspace
              isRecording={isRecording}
              activeStream={activeStream}
              audioUrl={audioUrl}
              draftAudioRef={draftAudioRef}
              transcriptSegments={transcriptSegments}
              interimText={interimText}
              confidenceScore={confidenceScore}
              setConfidenceScore={setConfidenceScore}
              notes={notes}
              setNotes={setNotes}
              isSubmitting={isSubmitting}
              startRecording={startRecording}
              stopRecording={stopRecording}
              resetRecording={resetRecording}
              handleSubmit={handleSubmit}
              resetWorkspace={resetWorkspace}
              audioBlob={audioBlob}
            />
          : <PracticeHistory
              attempts={currentAttempts}
              apiBaseUrl={apiBaseUrl}
              onDeleteAttempt={handleDeleteAttempt}
            />
          }
        </div>
      </div>
    </div>
  );
}
