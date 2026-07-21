/** @format */

'use client';

import React, {
  useEffect,
  useState,
  useRef,
  useMemo,
  useCallback,
} from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { api } from '@/lib/api';
import { resolveApiBaseUrl } from '@/lib/runtime';
import type {
  InterviewQuestion,
  PracticeRecord,
  PracticePlan,
  PlanTask,
  InterviewCategory,
  DailySummary,
} from '@/lib/types';
import { showGlobalToast } from '@/lib/toast';
import { showCelebrationEvent } from '@/lib/celebration';
import { useLayoutStore } from '@/lib/store/layout-store';
import { practiceCache } from '../practice-cache';
import { seededShuffle, getPlanQueue } from '../practice-utils';
import { PracticeQueueDrawerContent } from '../_components/PracticeQueueDrawer';
import type { PracticeMode } from '../_components/PracticeModeModal';

// ─── Helpers ──────────────────────────────────────────────────────────────────
const calculateSimilarityScore = (
  transcript: string,
  standardAnswer: string,
): number => {
  if (!transcript || !standardAnswer) return 1;
  const tokenize = (text: string) =>
    text
      .toLowerCase()
      .replace(/[^\w\s]/g, '')
      .split(/\s+/)
      .filter((w) => w.length > 2);
  const wordsT = tokenize(transcript);
  const wordsS = tokenize(standardAnswer);
  if (wordsT.length === 0 || wordsS.length === 0) return 1;
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
  let dotProduct = 0,
    magnitudeT = 0,
    magnitudeS = 0;
  allWords.forEach((w) => {
    const valT = freqT[w] || 0,
      valS = freqS[w] || 0;
    dotProduct += valT * valS;
    magnitudeT += valT * valT;
    magnitudeS += valS * valS;
  });
  const magT = Math.sqrt(magnitudeT),
    magS = Math.sqrt(magnitudeS);
  if (magT === 0 || magS === 0) return 1;
  const cosineSim = dotProduct / (magT * magS);
  if (cosineSim < 0.1) return 1;
  if (cosineSim < 0.25) return 2;
  if (cosineSim < 0.45) return 3;
  if (cosineSim < 0.65) return 4;
  return 5;
};

const SESSION_SEED_KEY = 'practiceShuffleSeed';
const SESSION_CUSTOM_IDS_KEY = 'practiceCustomIds';
const PREF_STORAGE_KEY = 'practiceModePreference';
const SHOW_ANSWERS_PREF_KEY = 'practiceShowAnswersPreference';

function savePref(snapshot: {
  mode: PracticeMode;
  shuffled: boolean;
  customIds: string[];
}) {
  try {
    localStorage.setItem(PREF_STORAGE_KEY, JSON.stringify(snapshot));
  } catch {}
}

function loadPref() {
  try {
    const raw = localStorage.getItem(PREF_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function saveShowAnswersPref(show: boolean) {
  try {
    localStorage.setItem(SHOW_ANSWERS_PREF_KEY, show ? '1' : '0');
  } catch {}
}

function loadShowAnswersPref(): boolean {
  try {
    return localStorage.getItem(SHOW_ANSWERS_PREF_KEY) === '1';
  } catch {
    return false;
  }
}

function getOrCreateSeed(): number {
  try {
    const saved = sessionStorage.getItem(SESSION_SEED_KEY);
    if (saved) return parseInt(saved, 10);
    const seed = Date.now();
    sessionStorage.setItem(SESSION_SEED_KEY, String(seed));
    return seed;
  } catch {
    return Date.now();
  }
}

export function usePracticeData() {
  const params = useParams();
  const id = (params?.id as string) || '';
  const router = useRouter();
  const searchParams = useSearchParams();

  // ── Mode + shuffle ──
  const practiceMode =
    (searchParams?.get('mode') as PracticeMode | null) ?? 'free';
  const isShuffled = searchParams?.get('shuffle') !== '0';

  // ── Data ──
  const [questions, setQuestions] = useState<InterviewQuestion[]>([]);
  const [categories, setCategories] = useState<InterviewCategory[]>([]);
  const [practiceRecords, setPracticeRecords] = useState<PracticeRecord[]>([]);
  const [apiBaseUrl, setApiBaseUrl] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [activePlan, setActivePlan] = useState<PracticePlan | null>(null);
  const [planTasks, setPlanTasks] = useState<PlanTask[]>([]);

  // ── Custom IDs ──
  const [customSelectedIds, setCustomSelectedIds] = useState<string[]>([]);

  // ── Shuffle seed ──
  const shuffleSeedRef = useRef<number>(getOrCreateSeed());

  // ── Global layout store drawer ──
  const openDrawer = useLayoutStore((state) => state.actions.openDrawer);
  const closeDrawer = useLayoutStore((state) => state.actions.closeDrawer);
  const isDrawerOpen = useLayoutStore((state) => state.isDrawerOpen);
  const drawerId = useLayoutStore((state) => state.drawerConfig.id);

  // ── UI ──
  const [showModeModal, setShowModeModal] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [showCompletionModal, setShowCompletionModal] = useState(false);
  const [completionReward, setCompletionReward] = useState<PracticeRecord['gamification_update']>(null);
  const [isSubmittingReport, setIsSubmittingReport] = useState(false);
  const [activeTab, setActiveTab] = useState<'workspace' | 'history' | 'comment'>(
    (searchParams?.get('tab') as 'workspace' | 'history' | 'comment') || 'workspace',
  );
  const [globalShowAnswers, setGlobalShowAnswers] = useState(false);
  const [showThisAnswer, setShowThisAnswer] = useState(false);
  const [showDailySummaryModal, setShowDailySummaryModal] = useState(false);
  const [dailySummaryData, setDailySummaryData] = useState<DailySummary | null>(
    null,
  );

  // ── Answer editing ──
  const [isEditingAnswer, setIsEditingAnswer] = useState(false);
  const [isSavingAnswer, setIsSavingAnswer] = useState(false);

  // ── Framework editing ──
  const [isEditingFramework, setIsEditingFramework] = useState(false);
  const [isSavingFramework, setIsSavingFramework] = useState(false);

  // ── Workspace ──
  const [confidenceScore, setConfidenceScore] = useState<number | null>(null);
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // ── Audio / Recording ──
  const [isRecording, setIsRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [activeStream, setActiveStream] = useState<MediaStream | null>(null);
  const [transcriptSegments, setTranscriptSegments] = useState<
    Array<{ text: string; start: number; end: number }>
  >([]);
  const [interimText, setInterimText] = useState('');

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const recognitionRef = useRef<any>(null);
  const draftAudioRef = useRef<HTMLAudioElement | null>(null);

  // ─── Init ──────────────────────────────────────────────────────────────────
  const initData = async (forceRefetch = false) => {
    if (practiceCache.questions && !forceRefetch) {
      setQuestions(practiceCache.questions);
      setPracticeRecords(practiceCache.records || []);
      setCategories(practiceCache.categories || []);
      setApiBaseUrl(practiceCache.apiBaseUrl);
      setActivePlan(practiceCache.activePlan);
      setPlanTasks(practiceCache.planTasks || []);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    const startTime = Date.now();
    try {
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

      setQuestions(qs);
      setPracticeRecords(prs);
      setCategories(cats);
      setApiBaseUrl(baseUrl);

      if (plans && plans.length > 0) {
        const plan = plans[0];
        practiceCache.activePlan = plan;
        setActivePlan(plan);
        const tasks = await api.planTasks(plan.id);
        practiceCache.planTasks = tasks;
        setPlanTasks(tasks);
      } else {
        practiceCache.activePlan = null;
        practiceCache.planTasks = [];
        setActivePlan(null);
        setPlanTasks([]);
      }
    } catch (err) {
      console.error('Failed to initialize practice mode:', err);
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
    const currentSeed = shuffleSeedRef.current;
    try {
      sessionStorage.setItem(SESSION_SEED_KEY, String(currentSeed));
    } catch {}

    setGlobalShowAnswers(loadShowAnswersPref());

    try {
      const saved = sessionStorage.getItem(SESSION_CUSTOM_IDS_KEY);
      if (saved) setCustomSelectedIds(JSON.parse(saved));
    } catch {}

    if (!searchParams?.get('mode')) {
      const pref = loadPref();
      const mode = pref?.mode ?? 'free';
      const shuffle = pref ? pref.shuffled !== false : true;
      if (pref && pref.customIds?.length) {
        setCustomSelectedIds(pref.customIds);
        try {
          sessionStorage.setItem(
            SESSION_CUSTOM_IDS_KEY,
            JSON.stringify(pref.customIds),
          );
        } catch {}
      }
      
      const tabParam = searchParams?.get('tab');
      const tabString = tabParam ? `&tab=${tabParam}` : '';
      
      router.replace(
        `/interview-prep/practice/${id}?mode=${mode}&shuffle=${shuffle ? '1' : '0'}${tabString}`,
      );
    }

    void initData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync tab from URL
  useEffect(() => {
    const tabParam = searchParams?.get('tab');
    if (tabParam === 'workspace' || tabParam === 'history' || tabParam === 'comment') {
      setActiveTab(tabParam);
    }
  }, [searchParams]);

  // Reset per-question UI state on id change
  useEffect(() => {
    setShowThisAnswer(false);
    setIsEditingAnswer(false);
    setIsEditingFramework(false);
    resetWorkspace();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // ─── Navigation helper ───
  const navigateTo = useCallback(
    (
      questionId: string,
      overrideMode?: PracticeMode,
      overrideShuffled?: boolean,
    ) => {
      const m = overrideMode ?? practiceMode;
      const s = overrideShuffled ?? isShuffled;
      router.push(
        `/interview-prep/practice/${questionId}?mode=${m}&shuffle=${s ? '1' : '0'}`,
      );
    },
    [practiceMode, isShuffled, router],
  );

  // ─── Shuffle toggle ───
  const toggleShuffle = useCallback(() => {
    const newShuffled = !isShuffled;
    if (newShuffled) {
      const newSeed = Date.now();
      shuffleSeedRef.current = newSeed;
      try {
        sessionStorage.setItem(SESSION_SEED_KEY, String(newSeed));
      } catch {}
    }
    savePref({
      mode: practiceMode,
      shuffled: newShuffled,
      customIds: customSelectedIds,
    });
    router.push(
      `/interview-prep/practice/${id}?mode=${practiceMode}&shuffle=${newShuffled ? '1' : '0'}`,
    );
  }, [id, isShuffled, practiceMode, customSelectedIds, router]);

  // ─── Effective Queue ───
  const effectiveQueue = useMemo<InterviewQuestion[]>(() => {
    if (questions.length === 0) return [];
    switch (practiceMode) {
      case 'free':
        return isShuffled ?
            seededShuffle(questions, shuffleSeedRef.current)
          : questions;
      case 'custom': {
        const base =
          customSelectedIds.length > 0 ?
            questions.filter((q) => customSelectedIds.includes(q.id))
          : questions;
        return isShuffled ? seededShuffle(base, shuffleSeedRef.current) : base;
      }
      case 'plan':
        return getPlanQueue(planTasks, questions);
      default:
        return questions;
    }
  }, [practiceMode, isShuffled, questions, customSelectedIds, planTasks]);

  const currentQuestionIndex = effectiveQueue.findIndex((q) => q.id === id);
  const currentQuestion =
    effectiveQueue[currentQuestionIndex] ?? questions.find((q) => q.id === id);

  // ─── Queue Drawer ───
  const handleOpenQueue = useCallback(() => {
    openDrawer({
      id: 'practice-queue',
      width: 320,
      content: (
        <PracticeQueueDrawerContent
          queue={effectiveQueue}
          currentId={id}
          practiceMode={practiceMode}
          isShuffled={isShuffled}
          onSelect={(qid) => navigateTo(qid)}
          onClose={closeDrawer}
        />
      ),
    });
  }, [
    openDrawer,
    closeDrawer,
    effectiveQueue,
    id,
    practiceMode,
    isShuffled,
    navigateTo,
  ]);

  // Keep queue drawer updated when active question or queue properties change
  useEffect(() => {
    if (isDrawerOpen && drawerId === 'practice-queue') {
      handleOpenQueue();
    }
  }, [
    id,
    effectiveQueue,
    practiceMode,
    isShuffled,
    isDrawerOpen,
    drawerId,
    handleOpenQueue,
  ]);

  // ─── Navigation ───
  const handleNext = () => {
    if (
      currentQuestionIndex >= 0 &&
      currentQuestionIndex < effectiveQueue.length - 1
    ) {
      navigateTo(effectiveQueue[currentQuestionIndex + 1].id);
    } else if (practiceMode === 'free' && effectiveQueue.length > 0) {
      navigateTo(effectiveQueue[0].id);
    }
  };

  const handlePrevious = () => {
    if (currentQuestionIndex > 0) {
      navigateTo(effectiveQueue[currentQuestionIndex - 1].id);
    }
  };

  // ─── Mode Confirm ───
  const handleModeConfirm = (newMode: PracticeMode, customIds: string[]) => {
    setCustomSelectedIds(customIds);
    try {
      sessionStorage.setItem(SESSION_CUSTOM_IDS_KEY, JSON.stringify(customIds));
    } catch {}

    savePref({ mode: newMode, shuffled: isShuffled, customIds });

    let newQueue: InterviewQuestion[];
    switch (newMode) {
      case 'free': {
        const base = questions;
        newQueue =
          isShuffled ? seededShuffle(base, shuffleSeedRef.current) : base;
        break;
      }
      case 'custom': {
        const base =
          customIds.length > 0 ?
            questions.filter((q) => customIds.includes(q.id))
          : questions;
        newQueue =
          isShuffled ? seededShuffle(base, shuffleSeedRef.current) : base;
        break;
      }
      case 'plan':
        newQueue = getPlanQueue(planTasks, questions);
        break;
      default:
        newQueue = questions;
    }

    const targetId =
      newQueue.length > 0 ?
        newQueue.find((q) => q.id === id) ?
          id
        : newQueue[0].id
      : id;

    router.push(
      `/interview-prep/practice/${targetId}?mode=${newMode}&shuffle=${isShuffled ? '1' : '0'}`,
    );
    setShowModeModal(false);
  };

  // ─── Workspace ───
  const resetWorkspace = () => {
    setConfidenceScore(null);
    setNotes('');
    resetRecording();
  };

  const startSpeechRecognition = () => {
    setTranscriptSegments([]);
    setInterimText('');
    const SpeechRecognition =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return;
    const rec = new SpeechRecognition();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = 'en-US';
    const recordStartTime = Date.now();
    let currentSegmentStartTime: number | null = null;
    let segmentLastUpdateTime: number = 0;
    
    rec.onresult = (event: any) => {
      let interim = '';
      const finalSegments: Array<{ text: string; start: number; end: number }> =
        [];
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        const transcript = event.results[i][0].transcript;
        const elapsed = (Date.now() - recordStartTime) / 1000;
        
        if (currentSegmentStartTime === null) {
          // Compensate for typical API network latency on the first interim result
          currentSegmentStartTime = Math.max(0, elapsed - 0.4);
        }

        if (event.results[i].isFinal) {
          // The 'isFinal' event often arrives 1-2s after actual speech ends.
          // Using the last interim time gives a much tighter bound on the true audio end time.
          const actualEnd = segmentLastUpdateTime > currentSegmentStartTime 
            ? segmentLastUpdateTime 
            : Math.max(currentSegmentStartTime + 0.5, elapsed - 0.4);

          finalSegments.push({
            text: transcript.trim(),
            start: currentSegmentStartTime,
            end: actualEnd,
          });
          currentSegmentStartTime = null;
          segmentLastUpdateTime = 0;
        } else {
          interim += transcript;
          segmentLastUpdateTime = elapsed;
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
            )
              newSegs.push(item);
          });
          return newSegs;
        });
      }
      setInterimText(interim);
    };
    rec.onerror = (event: any) => {
      const error = event?.error || '';
      if (!error || ['no-speech', 'aborted', 'audio-capture'].includes(error)) {
        return;
      }
      console.warn('Speech recognition stopped:', error);
      showGlobalToast('Voice input stopped.');
    };
    recognitionRef.current = rec;
    rec.start();
  };

  const stopSpeechRecognition = () => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {}
      recognitionRef.current = null;
    }
    setInterimText('');
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      setActiveStream(stream);
      const opusMimeType = 'audio/webm;codecs=opus';
      const mediaRecorder = new MediaRecorder(stream, {
        // Speech needs little bandwidth; Opus at 24 kbps keeps practice audio inexpensive.
        mimeType: MediaRecorder.isTypeSupported(opusMimeType) ? opusMimeType : 'audio/webm',
        audioBitsPerSecond: 24_000,
      });
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];
      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };
      mediaRecorder.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        setAudioBlob(blob);
        setAudioUrl(URL.createObjectURL(blob));
        stream.getTracks().forEach((t) => t.stop());
      };
      mediaRecorder.start();
      setIsRecording(true);
      setRecordingSeconds(0);
      startSpeechRecognition();
      timerRef.current = setInterval(
        () => setRecordingSeconds((p) => p + 1),
        1000,
      );
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
      if (timerRef.current) clearInterval(timerRef.current);
      setTimeout(() => {
        setTranscriptSegments((segs) => {
          const fullText = segs.map((s) => s.text).join(' ');
          setConfidenceScore(
            calculateSimilarityScore(
              fullText,
              currentQuestion?.answer_objective || '',
            ),
          );
          return segs;
        });
      }, 300);
    }
  };

  const handleUpdateTranscriptSegment = (index: number, newText: string) => {
    setTranscriptSegments((prev) => {
      const updated = [...prev];
      if (updated[index]) {
        updated[index].text = newText;
      }
      return updated;
    });
  };

  const resetRecording = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    stopSpeechRecognition();
    setAudioBlob(null);
    setAudioUrl(null);
    setActiveStream(null);
    setRecordingSeconds(0);
    setIsRecording(false);
    setTranscriptSegments([]);
    setInterimText('');
  };

  // ─── Submit ───
  const handleSubmit = async () => {
    if (!currentQuestion || (!audioBlob && transcriptSegments.length === 0))
      return;
    setIsSubmitting(true);
    try {
      const myAnswerSerialized =
        transcriptSegments.length > 0 ? JSON.stringify(transcriptSegments) : '';

      const record = await api.createPracticeRecord({
        question_id: currentQuestion.id,
        my_answer: myAnswerSerialized || undefined,
        confidence_score: confidenceScore ?? undefined,
        notes: notes.trim() || undefined,
        date: new Date().toISOString(),
      });

      if (record?.gamification_update) {
        setCompletionReward(record.gamification_update);
        const { xp_gained, coins_gained, is_streak_extended } =
          record.gamification_update;
        if (xp_gained > 0 || coins_gained > 0) {
          showGlobalToast(
            `+${xp_gained} XP, +${coins_gained} Coins${is_streak_extended ? ' Streak Extended!' : ''}`,
          );
          showCelebrationEvent('practice_completed');
        }
        window.dispatchEvent(new Event('playbookGamificationUpdated'));
      }

      if (audioBlob && record?.id)
        await api.uploadPracticeAudio(record.id, audioBlob);

      if (activePlan) {
        try {
          const tasks = await api.planTasks(activePlan.id);
          const pendingTask = tasks.find(
            (t) =>
              t.question_id === currentQuestion.id && t.status === 'pending',
          );
          if (pendingTask) {
            await api.updatePlanTask(activePlan.id, pendingTask.id, {
              status: 'completed',
            });
            const updatedTasks = await api.planTasks(activePlan.id);
            practiceCache.planTasks = updatedTasks;
            setPlanTasks(updatedTasks);

            const todayStr = new Date().toDateString();
            const todayTasks = updatedTasks.filter(
              (t) => new Date(t.scheduled_date).toDateString() === todayStr,
            );
            const allTodayCompleted =
              todayTasks.length > 0 &&
              todayTasks.every((t) => t.status === 'completed');

            if (practiceMode === 'plan') {
              if (allTodayCompleted) {
                const summary = await api.gamificationSummary();
                setDailySummaryData(summary);
                setShowDailySummaryModal(true);
              } else {
                const nextQ = effectiveQueue[currentQuestionIndex + 1];
                if (nextQ) navigateTo(nextQ.id, 'plan');
              }
            }
          }
        } catch (planErr) {
          console.error('Failed to auto-complete plan task:', planErr);
        }
      }

      const updated = await api.practiceRecords();
      practiceCache.records = updated;
      setPracticeRecords(updated);
      resetRecording();
      setConfidenceScore(null);
      setNotes('');
      setShowCompletionModal(true);
    } catch (err) {
      console.error('Failed to save practice record:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteAttempt = async (attemptId: string) => {
    if (
      !window.confirm('Are you sure you want to delete this practice attempt?')
    )
      return;
    try {
      await api.deletePracticeRecord(attemptId);
      const updated = await api.practiceRecords();
      practiceCache.records = updated;
      setPracticeRecords(updated);
    } catch (err) {
      console.error('Failed to delete practice record:', err);
    }
  };

  const handleUpdateAttempt = async (attemptId: string, updatedRecord: Partial<PracticeRecord>) => {
    try {
      await api.updatePracticeRecord(attemptId, updatedRecord);
      const updated = await api.practiceRecords();
      practiceCache.records = updated;
      setPracticeRecords(updated);
    } catch (err) {
      console.error('Failed to update practice record:', err);
    }
  };

  const handleReportSubmit = async (data: { company: string; role: string; happened_at: string }) => {
    if (!currentQuestion) return;
    setIsSubmittingReport(true);
    try {
      await api.createInterviewReport({
        question_id: currentQuestion.id,
        company: data.company,
        role: data.role || undefined,
        happened_at: data.happened_at,
        seen_in_interview: true,
      });
      showGlobalToast('Interview report submitted successfully!');
    } catch (err) {
      console.error('Failed to submit interview report:', err);
      throw err;
    } finally {
      setIsSubmittingReport(false);
    }
  };

  const handleSaveStandardAnswer = async (newText: string) => {
    if (!currentQuestion) return;
    setIsSavingAnswer(true);
    try {
      await api.updateInterviewQuestion(currentQuestion.id, {
        answer_objective: newText.trim() || undefined,
      } as any);
      setQuestions((prev) => {
        const updatedQuestions = prev.map((q) =>
          q.id === currentQuestion.id ?
            { ...q, answer_objective: newText.trim() }
          : q,
        );
        practiceCache.questions = updatedQuestions;
        return updatedQuestions;
      });
      setIsEditingAnswer(false);
    } catch (err) {
      console.error('Failed to update standard answer:', err);
    } finally {
      setIsSavingAnswer(false);
    }
  };

  const handleSaveFramework = async (type: string, customText: string) => {
    if (!currentQuestion) return;
    setIsSavingFramework(true);
    try {
      const fv = type === 'custom' ? customText.trim() : type;
      await api.updateInterviewQuestion(currentQuestion.id, {
        answer_framework: fv || null,
      } as any);
      setQuestions((prev) => {
        const updatedQuestions = prev.map((q) =>
          q.id === currentQuestion.id ?
            { ...q, answer_framework: fv || null }
          : q,
        );
        practiceCache.questions = updatedQuestions;
        return updatedQuestions;
      });
      setIsEditingFramework(false);
    } catch (err) {
      console.error('Failed to update answering framework:', err);
    } finally {
      setIsSavingFramework(false);
    }
  };

  const shouldShowAnswer = globalShowAnswers || showThisAnswer;
  const currentAttempts = practiceRecords
    .filter((r) => r.question_id === currentQuestion?.id)
    .sort(
      (a, b) =>
        new Date(b.date || b.created_at || '').getTime() -
        new Date(a.date || a.created_at || '').getTime(),
    );

  return {
    id,
    practiceMode,
    isShuffled,
    questions,
    categories,
    practiceRecords,
    apiBaseUrl,
    isLoading,
    activePlan,
    planTasks,
    customSelectedIds,
    isDrawerOpen,
    drawerId,
    showModeModal,
    setShowModeModal,
    showReportModal,
    setShowReportModal,
    showCompletionModal,
    setShowCompletionModal,
    completionReward,
    isSubmittingReport,
    activeTab,
    setActiveTab,
    globalShowAnswers,
    setGlobalShowAnswers,
    showThisAnswer,
    setShowThisAnswer,
    showDailySummaryModal,
    setShowDailySummaryModal,
    dailySummaryData,
    isEditingAnswer,
    setIsEditingAnswer,
    isSavingAnswer,
    isEditingFramework,
    setIsEditingFramework,
    isSavingFramework,
    confidenceScore,
    setConfidenceScore,
    notes,
    setNotes,
    isSubmitting,
    isRecording,
    audioBlob,
    audioUrl,
    recordingSeconds,
    activeStream,
    transcriptSegments,
    interimText,
    draftAudioRef,

    // Handlers
    initData,
    toggleShuffle,
    navigateTo,
    handleOpenQueue,
    handleNext,
    handlePrevious,
    handleModeConfirm,
    resetWorkspace,
    startRecording,
    stopRecording,
    resetRecording,
    handleSubmit,
    handleDeleteAttempt,
    handleUpdateAttempt,
    handleUpdateTranscriptSegment,
    handleSaveStandardAnswer,
    handleSaveFramework,
    handleReportSubmit,

    // Derived
    effectiveQueue,
    currentQuestionIndex,
    currentQuestion,
    shouldShowAnswer,
    currentAttempts,
  };
}
