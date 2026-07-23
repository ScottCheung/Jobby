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
  QuestionAnswer,
} from '@/lib/types';
import { showGlobalToast } from '@/lib/toast';
import { showCelebrationEvent } from '@/lib/celebration';
import { useConfirmStore } from '@/lib/store/confirm-store';
import { useLayoutStore } from '@/lib/store/layout-store';
import { practiceCache } from '../practice-cache';
import { seededShuffle, getPlanQueue } from '../practice-utils';
import { PracticeQueueDrawerContent } from '../_components/PracticeQueueDrawer';
import { useConsole } from '@/components/ConsoleContext';
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
const AUTO_EVAL_PREF_KEY = 'practiceAutoEvalPreference';

type PracticePreferenceSnapshot = {
  mode: PracticeMode;
  shuffled: boolean;
  customIds: string[];
};

function parsePracticePreference(
  value: unknown,
): PracticePreferenceSnapshot | null {
  if (!value || typeof value !== 'object') return null;
  const candidate = value as Partial<PracticePreferenceSnapshot>;
  if (
    candidate.mode !== 'free' &&
    candidate.mode !== 'custom' &&
    candidate.mode !== 'plan'
  ) {
    return null;
  }
  return {
    mode: candidate.mode,
    shuffled: candidate.shuffled !== false,
    customIds: Array.isArray(candidate.customIds) ? candidate.customIds : [],
  };
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
  const consoleContext = useConsole();
  const user = consoleContext.user;
  const profileExtra = consoleContext.profile.extra_data ?? {};
  const updateProfileExtra = consoleContext.updateProfileExtra;
  const hasLoadedProfile = consoleContext.hasLoadedInitialData;

  // ── Mode + shuffle ──
  const practiceMode =
    (searchParams?.get('mode') as PracticeMode | null) ?? 'free';
  const isShuffled = searchParams?.get('shuffle') !== '0';

  // ── Data ──
  const [questions, setQuestions] = useState<InterviewQuestion[]>([]);
  const [categories, setCategories] = useState<InterviewCategory[]>([]);
  const [practiceRecords, setPracticeRecords] = useState<PracticeRecord[]>([]);
  const [questionAnswersByQuestion, setQuestionAnswersByQuestion] = useState<
    Record<string, QuestionAnswer[]>
  >({});
  const [isGeneratingAiAnswer, setIsGeneratingAiAnswer] = useState(false);
  const [isGeneratingQuestionMetadata, setIsGeneratingQuestionMetadata] =
    useState(false);
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
  const [completionReward, setCompletionReward] =
    useState<PracticeRecord['gamification_update']>(null);
  const [isSubmittingReport, setIsSubmittingReport] = useState(false);
  const [activeTab, setActiveTab] = useState<
    'workspace' | 'history' | 'comment'
  >(
    (searchParams?.get('tab') as 'workspace' | 'history' | 'comment') ||
      'workspace',
  );
  const confirm = useConfirmStore((state) => state.confirm);
  const [autoEvalEnabled, setAutoEvalEnabled] = useState(false);

  useEffect(() => {
    if (!hasLoadedProfile) return;
    setAutoEvalEnabled(profileExtra[AUTO_EVAL_PREF_KEY] === '1');
  }, [hasLoadedProfile, profileExtra]);

  const toggleAutoEval = async () => {
    if (!autoEvalEnabled) {
      const ok = await confirm({
        title: 'Enable Auto AI Evaluation on Submit?',
        message:
          'After enabling AI Evaluation, each practice submission will trigger an AI assessment and consume 5 coins each time. The advantage is that this will provide a faster response speed. Our server will immediately trigger the AI scoring after receiving your interview response, but this may cause your coins to be comsumed faster than expected. Are you sure you want to enable this function?',
        confirmLabel: 'Enable Auto Evaluation',
        cancelLabel: 'Cancel',
      });
      if (!ok) return;
      setAutoEvalEnabled(true);
      void updateProfileExtra({ [AUTO_EVAL_PREF_KEY]: '1' });
      showGlobalToast('Auto AI Evaluation enabled on submit.');
    } else {
      setAutoEvalEnabled(false);
      void updateProfileExtra({ [AUTO_EVAL_PREF_KEY]: '0' });
      showGlobalToast('Auto AI Evaluation disabled.');
    }
  };

  const [globalShowAnswers, setGlobalShowAnswers] = useState(false);
  const [showThisAnswer, setShowThisAnswer] = useState(false);
  const [showDailySummaryModal, setShowDailySummaryModal] = useState(false);
  const [dailySummaryData, setDailySummaryData] = useState<DailySummary | null>(
    null,
  );

  // ── Answer editing ──
  const [isEditingAnswer, setIsEditingAnswer] = useState(false);
  const [isSavingAnswer, setIsSavingAnswer] = useState(false);

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
    if (!hasLoadedProfile) return;
    const currentSeed = shuffleSeedRef.current;
    try {
      sessionStorage.setItem(SESSION_SEED_KEY, String(currentSeed));
    } catch {}

    setGlobalShowAnswers(profileExtra[SHOW_ANSWERS_PREF_KEY] === '1');

    try {
      const saved = sessionStorage.getItem(SESSION_CUSTOM_IDS_KEY);
      if (saved) setCustomSelectedIds(JSON.parse(saved));
    } catch {}

    if (!searchParams?.get('mode')) {
      const pref = parsePracticePreference(profileExtra[PREF_STORAGE_KEY]);
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
  }, [hasLoadedProfile]);

  const savePracticePreference = useCallback(
    (snapshot: PracticePreferenceSnapshot) => {
      void updateProfileExtra({ [PREF_STORAGE_KEY]: snapshot });
    },
    [updateProfileExtra],
  );

  const setGlobalShowAnswersPreference = useCallback(
    (show: boolean) => {
      setGlobalShowAnswers(show);
      void updateProfileExtra({ [SHOW_ANSWERS_PREF_KEY]: show ? '1' : '0' });
    },
    [updateProfileExtra],
  );

  // Sync tab from URL
  useEffect(() => {
    const tabParam = searchParams?.get('tab');
    if (
      tabParam === 'workspace' ||
      tabParam === 'history' ||
      tabParam === 'comment'
    ) {
      setActiveTab(tabParam);
    }
  }, [searchParams]);

  // Reset per-question UI state on id change
  useEffect(() => {
    setShowThisAnswer(false);
    setIsEditingAnswer(false);
    resetWorkspace();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // Support direct URL practice for any valid question ID or display_number
  useEffect(() => {
    if (!id || isLoading) return;
    const isIdInQueue = questions.some(
      (q) =>
        q.id === id ||
        String(q.display_number) === id ||
        (q.display_number && `q${q.display_number}` === id.toLowerCase()),
    );
    if (questions.length > 0 && !isIdInQueue) {
      let cancelled = false;
      void api
        .getInterviewQuestion(id)
        .then((fetchedQ) => {
          if (cancelled || !fetchedQ) return;
          setQuestions((prev) => {
            if (prev.some((q) => q.id === fetchedQ.id)) return prev;
            return [fetchedQ, ...prev];
          });
        })
        .catch((err) => {
          console.error(
            'Could not load question for direct URL practice:',
            err,
          );
        });
      return () => {
        cancelled = true;
      };
    }
  }, [id, isLoading, questions]);

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
    savePracticePreference({
      mode: practiceMode,
      shuffled: newShuffled,
      customIds: customSelectedIds,
    });
    router.push(
      `/interview-prep/practice/${id}?mode=${practiceMode}&shuffle=${newShuffled ? '1' : '0'}`,
    );
  }, [
    id,
    isShuffled,
    practiceMode,
    customSelectedIds,
    router,
    savePracticePreference,
  ]);

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

  const currentQuestionIndex = effectiveQueue.findIndex(
    (q) =>
      q.id === id ||
      String(q.display_number) === id ||
      (q.display_number && `q${q.display_number}` === id.toLowerCase()),
  );
  const baseCurrentQuestion =
    effectiveQueue[currentQuestionIndex] ??
    questions.find(
      (q) =>
        q.id === id ||
        String(q.display_number) === id ||
        (q.display_number && `q${q.display_number}` === id.toLowerCase()),
    );

  const currentQuestionAnswers = useMemo(
    () =>
      baseCurrentQuestion ?
        questionAnswersByQuestion[baseCurrentQuestion.id] || []
      : [],
    [baseCurrentQuestion, questionAnswersByQuestion],
  );

  // Author's official reference answer (source === 'author', type === 'reference', status === 'published')
  const authorAnswers = useMemo(
    () =>
      currentQuestionAnswers.filter(
        (a) =>
          a.answer_type === 'reference' &&
          a.source === 'author' &&
          a.status === 'published',
      ),
    [currentQuestionAnswers],
  );

  // Current user's own private reference answer (is_author === true, type === 'reference', not an official published author answer)
  const myAnswer = useMemo(
    () =>
      currentQuestionAnswers.find(
        (a) =>
          a.answer_type === 'reference' &&
          a.is_author &&
          a.status !== 'archived' &&
          !(a.source === 'author' && a.status === 'published'),
      ) ?? null,
    [currentQuestionAnswers],
  );

  const allCommunityAnswers = useMemo(
    () =>
      currentQuestionAnswers.filter(
        (answer) =>
          (answer.source === 'community' || answer.answer_type === 'example') &&
          answer.status !== 'archived',
      ),
    [currentQuestionAnswers],
  );

  const featuredCommunityAnswers = useMemo(
    () =>
      currentQuestionAnswers.filter(
        (answer) =>
          answer.status !== 'archived' &&
          (answer.is_recommended ||
            (answer.answer_type === 'example' && answer.is_recommended)),
      ),
    [currentQuestionAnswers],
  );

  const isQuestionAuthor = useMemo(() => {
    if (!user || !baseCurrentQuestion) return false;
    return (
      user.id === baseCurrentQuestion.submitted_by_user_id ||
      user.role === 'admin'
    );
  }, [user, baseCurrentQuestion]);

  const aiReferenceAnswers = useMemo(
    () =>
      currentQuestionAnswers.filter(
        (answer) =>
          answer.source === 'ai' &&
          answer.answer_type === 'reference' &&
          answer.status !== 'archived',
      ),
    [currentQuestionAnswers],
  );

  const currentQuestion = useMemo(() => {
    return baseCurrentQuestion;
  }, [baseCurrentQuestion]);

  const [isAnswersLoading, setIsAnswersLoading] = useState(false);

  useEffect(() => {
    if (!baseCurrentQuestion) return;
    const startTime = Date.now();
    const minSkeletonDuration = 1000; // Enforce minimum 0.5s skeleton display for smooth UX
    let cancelled = false;

    const hasCachedAnswers = Boolean(
      questionAnswersByQuestion[baseCurrentQuestion.id],
    );

    setIsAnswersLoading(true);

    if (!hasCachedAnswers) {
      void api
        .questionAnswers(baseCurrentQuestion.id)
        .then((answers) => {
          if (cancelled) return;
          setQuestionAnswersByQuestion((prev) => ({
            ...prev,
            [baseCurrentQuestion.id]: answers,
          }));
        })
        .catch((err) => {
          console.error('Failed to load question answers:', err);
        })
        .finally(async () => {
          const elapsed = Date.now() - startTime;
          if (elapsed < minSkeletonDuration) {
            await new Promise((resolve) =>
              setTimeout(resolve, minSkeletonDuration - elapsed),
            );
          }
          if (!cancelled) setIsAnswersLoading(false);
        });
    } else {
      const timer = setTimeout(() => {
        if (!cancelled) setIsAnswersLoading(false);
      }, minSkeletonDuration);
      return () => {
        cancelled = true;
        clearTimeout(timer);
      };
    }

    return () => {
      cancelled = true;
    };
  }, [baseCurrentQuestion?.id]);

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

  // ─── Navigation (Infinite wrap-around) ───
  const handleNext = () => {
    if (effectiveQueue.length === 0) return;
    const nextIdx =
      currentQuestionIndex >= 0 ?
        (currentQuestionIndex + 1) % effectiveQueue.length
      : 0;
    navigateTo(effectiveQueue[nextIdx].id);
  };

  const handlePrevious = () => {
    if (effectiveQueue.length === 0) return;
    const prevIdx =
      currentQuestionIndex >= 0 ?
        (currentQuestionIndex - 1 + effectiveQueue.length) %
        effectiveQueue.length
      : 0;
    navigateTo(effectiveQueue[prevIdx].id);
  };

  // ─── Mode Confirm ───
  const handleModeConfirm = (newMode: PracticeMode, customIds: string[]) => {
    setCustomSelectedIds(customIds);
    try {
      sessionStorage.setItem(SESSION_CUSTOM_IDS_KEY, JSON.stringify(customIds));
    } catch {}

    savePracticePreference({ mode: newMode, shuffled: isShuffled, customIds });

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
          const actualEnd =
            segmentLastUpdateTime > currentSegmentStartTime ?
              segmentLastUpdateTime
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
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
          sampleRate: 48_000,
        },
      });
      setActiveStream(stream);
      const opusMimeType = 'audio/webm;codecs=opus';
      const mimeType =
        MediaRecorder.isTypeSupported(opusMimeType) ? opusMimeType : (
          'audio/webm'
        );
      const mediaRecorder = new MediaRecorder(stream, {
        // Keep the recording crisp enough for playback review without excessive file size.
        mimeType,
        audioBitsPerSecond: 48_000,
      });
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];
      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };
      mediaRecorder.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: mimeType });
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

  // ─── Global Keyboard Shortcuts ───
  useEffect(() => {
    const isEditableElement = (target: EventTarget | null) => {
      if (!target || !(target instanceof HTMLElement)) return false;
      const tagName = target.tagName.toLowerCase();
      return (
        tagName === 'input' ||
        tagName === 'textarea' ||
        tagName === 'select' ||
        target.isContentEditable ||
        target.getAttribute('contenteditable') === 'true' ||
        target.closest('[contenteditable="true"]') !== null ||
        target.closest('input, textarea, select') !== null
      );
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (isEditableElement(e.target)) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      const key = e.key;

      if (key === 'ArrowLeft') {
        e.preventDefault();
        handlePrevious();
      } else if (key === 'ArrowRight') {
        e.preventDefault();
        handleNext();
      } else if (key === 'ArrowUp') {
        e.preventDefault();
        window.dispatchEvent(
          new CustomEvent('jobby:keyboard-action', {
            detail: { action: 'upvote' },
          }),
        );
      } else if (key === 'ArrowDown') {
        e.preventDefault();
        window.dispatchEvent(
          new CustomEvent('jobby:keyboard-action', {
            detail: { action: 'downvote' },
          }),
        );
      } else if (key === 'r' || key === 'R') {
        e.preventDefault();
        setShowReportModal(true);
      } else if (key === 's' || key === 'S') {
        e.preventDefault();
        window.dispatchEvent(
          new CustomEvent('jobby:keyboard-action', {
            detail: { action: 'favorite' },
          }),
        );
      } else if (key === ' ' || key === 'Spacebar') {
        e.preventDefault();
        if (isRecording) {
          stopRecording();
        } else {
          void startRecording();
        }
      } else if (key === 'c' || key === 'C') {
        e.preventDefault();
        window.dispatchEvent(
          new CustomEvent('jobby:keyboard-action', {
            detail: { action: 'tab-comment' },
          }),
        );
      } else if (key === 'h' || key === 'H') {
        e.preventDefault();
        window.dispatchEvent(
          new CustomEvent('jobby:keyboard-action', {
            detail: { action: 'tab-history' },
          }),
        );
      } else if (key === 'p' || key === 'P') {
        e.preventDefault();
        window.dispatchEvent(
          new CustomEvent('jobby:keyboard-action', {
            detail: { action: 'tab-workspace' },
          }),
        );
      } else if (key === 'f' || key === 'F') {
        e.preventDefault();
        handleOpenQueue();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    handlePrevious,
    handleNext,
    handleOpenQueue,
    isRecording,
    startRecording,
    stopRecording,
    setShowReportModal,
  ]);

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

      if (autoEvalEnabled && record?.id) {
        void api
          .createPracticeEvaluation(record.id)
          .then((evaluation) => {
            showGlobalToast(
              `AI Evaluation complete: ${evaluation.overall_score}/100`,
            );
            window.dispatchEvent(new Event('playbookGamificationUpdated'));
          })
          .catch((err) => {
            console.error('Auto evaluation error:', err);
          });
      }

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

  const handleUpdateAttempt = async (
    attemptId: string,
    updatedRecord: Partial<PracticeRecord>,
  ) => {
    try {
      await api.updatePracticeRecord(attemptId, updatedRecord);
      const updated = await api.practiceRecords();
      practiceCache.records = updated;
      setPracticeRecords(updated);
    } catch (err) {
      console.error('Failed to update practice record:', err);
    }
  };

  const handleSavePolishedAnswerAsMyAnswer = async (polishedAnswer: string) => {
    const answer = polishedAnswer.trim();
    if (!currentQuestion || !answer) return;
    try {
      const updatedQuestion = await api.updateInterviewQuestion(
        currentQuestion.id,
        { my_answer: answer },
      );
      setQuestions((previous) =>
        previous.map((question) =>
          question.id === updatedQuestion.id ? updatedQuestion : question,
        ),
      );
      if (practiceCache.questions) {
        practiceCache.questions = practiceCache.questions.map((question) =>
          question.id === updatedQuestion.id ? updatedQuestion : question,
        );
      }
      showGlobalToast('AI polish added to My Answer');
      window.dispatchEvent(new Event('playbookLibraryUpdated'));
    } catch (err) {
      console.error('Failed to save polished answer:', err);
      showGlobalToast(
        err instanceof Error ? err.message : 'Could not save AI polish',
      );
    }
  };

  const handleReportSubmit = async (data: {
    company: string;
    role?: string;
    happened_at: string;
    location?: string;
  }) => {
    if (!currentQuestion) return;
    setIsSubmittingReport(true);
    try {
      await api.createInterviewReport({
        question_id: currentQuestion.id,
        company: data.company,
        role: data.role || undefined,
        happened_at: data.happened_at,
        seen_in_interview: true,
        raw_data: data.location ? { location: data.location } : {},
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
      const trimmed = newText.trim();
      // myAnswer is the current user's own reference answer entry
      if (myAnswer) {
        await api.updateQuestionAnswer(
          myAnswer.id,
          trimmed ? { body: trimmed, status: 'draft' } : { status: 'archived' },
        );
      } else if (trimmed) {
        // My Answer is always a user's private practice draft.
        await api.createQuestionAnswer(currentQuestion.id, {
          source: 'community',
          answer_type: 'reference',
          status: 'draft',
          title: 'My Reference Answer',
          body: trimmed,
        });
      }
      const refreshedAnswers = await api.questionAnswers(currentQuestion.id);
      setQuestionAnswersByQuestion((prev) => ({
        ...prev,
        [currentQuestion.id]: refreshedAnswers,
      }));
      setIsEditingAnswer(false);
    } catch (err) {
      console.error('Failed to update standard answer:', err);
    } finally {
      setIsSavingAnswer(false);
    }
  };

  const handleCreateAuthorAnswer = async (newText: string) => {
    if (!currentQuestion || !isQuestionAuthor) return;
    const trimmed = newText.trim();
    if (!trimmed) return;
    setIsSavingAnswer(true);
    try {
      await api.createQuestionAnswer(currentQuestion.id, {
        answer_type: 'reference',
        status: 'published',
        title: 'Author Reference Answer',
        body: trimmed,
      });
      const refreshedAnswers = await api.questionAnswers(currentQuestion.id);
      setQuestionAnswersByQuestion((prev) => ({
        ...prev,
        [currentQuestion.id]: refreshedAnswers,
      }));
    } catch (err) {
      console.error('Failed to create author answer:', err);
    } finally {
      setIsSavingAnswer(false);
    }
  };

  const handleUpdateAuthorAnswer = async (
    answerId: string,
    newText: string,
  ) => {
    const trimmed = newText.trim();
    if (!currentQuestion || !isQuestionAuthor || !trimmed) return;
    setIsSavingAnswer(true);
    try {
      await api.updateQuestionAnswer(answerId, {
        body: trimmed,
        status: 'published',
      });
      const refreshedAnswers = await api.questionAnswers(currentQuestion.id);
      setQuestionAnswersByQuestion((prev) => ({
        ...prev,
        [currentQuestion.id]: refreshedAnswers,
      }));
    } catch (err) {
      console.error('Failed to update author answer:', err);
    } finally {
      setIsSavingAnswer(false);
    }
  };

  const handleDeleteAuthorAnswer = async (answerId: string) => {
    if (!currentQuestion || !isQuestionAuthor) return;
    setIsSavingAnswer(true);
    try {
      await api.updateQuestionAnswer(answerId, { status: 'archived' });
      const refreshedAnswers = await api.questionAnswers(currentQuestion.id);
      setQuestionAnswersByQuestion((prev) => ({
        ...prev,
        [currentQuestion.id]: refreshedAnswers,
      }));
    } catch (err) {
      console.error('Failed to delete author answer:', err);
    } finally {
      setIsSavingAnswer(false);
    }
  };

  const handleGenerateAiAnswer = async (regenerate = false) => {
    if (!currentQuestion) return;
    if (regenerate) {
      const ok = await confirm({
        title: 'Regenerate AI Answer?',
        message:
          'Regenerating will call AI again and consume 5 coins. The existing AI answer will remain in history, but a new version will be created for this question.',
        confirmLabel: 'Regenerate',
        cancelLabel: 'Cancel',
        type: 'warning',
      });
      if (!ok) return;
    }
    setIsGeneratingAiAnswer(true);
    try {
      const answer = await api.createAiReferenceAnswer(currentQuestion.id, {
        regenerate,
      });
      setQuestionAnswersByQuestion((prev) => ({
        ...prev,
        [currentQuestion.id]:
          (
            (prev[currentQuestion.id] || []).some(
              (item) => item.id === answer.id,
            )
          ) ?
            (prev[currentQuestion.id] || []).map((item) =>
              item.id === answer.id ? answer : item,
            )
          : [...(prev[currentQuestion.id] || []), answer],
      }));
      const refreshedQuestion = await api
        .getInterviewQuestion(currentQuestion.id)
        .catch(() => null);
      if (refreshedQuestion) {
        setQuestions((previous) =>
          previous.map((question) =>
            question.id === refreshedQuestion.id ? refreshedQuestion : question,
          ),
        );
        if (practiceCache.questions) {
          practiceCache.questions = practiceCache.questions.map((question) =>
            question.id === refreshedQuestion.id ? refreshedQuestion : question,
          );
        }
      }
      showGlobalToast(
        regenerate ?
          'New AI reference answer generated'
        : 'AI reference answer ready',
      );
      window.dispatchEvent(new Event('playbookGamificationUpdated'));
      return answer;
    } catch (err) {
      console.error('Failed to generate AI reference answer:', err);
      showGlobalToast(
        err instanceof Error ? err.message : 'Could not generate AI answer',
      );
    } finally {
      setIsGeneratingAiAnswer(false);
    }
  };

  const handleGenerateQuestionMetadata = async () => {
    if (!currentQuestion || currentQuestion.ai_metadata) return;
    setIsGeneratingQuestionMetadata(true);
    try {
      const updatedQuestion = await api.generateQuestionAiMetadata(
        currentQuestion.id,
      );
      const updateQuestion = (question: InterviewQuestion) =>
        question.id === currentQuestion.id ? updatedQuestion : question;
      setQuestions((previous) =>
        previous.some((question) => question.id === currentQuestion.id) ?
          previous.map(updateQuestion)
        : [updatedQuestion, ...previous],
      );
      if (practiceCache.questions) {
        practiceCache.questions =
          (
            practiceCache.questions.some(
              (question) => question.id === currentQuestion.id,
            )
          ) ?
            practiceCache.questions.map(updateQuestion)
          : [updatedQuestion, ...practiceCache.questions];
      }
      showGlobalToast('AI has added detailed information for this question');
      window.dispatchEvent(new Event('playbookLibraryUpdated'));
    } catch (err) {
      console.error('Failed to generate question metadata:', err);
      showGlobalToast(
        err instanceof Error ?
          err.message
        : 'AI has not added detailed information for this question',
      );
    } finally {
      setIsGeneratingQuestionMetadata(false);
    }
  };

  const handleUnlockAiAnswer = async (answerId: string) => {
    if (!currentQuestion) return;
    try {
      const result = await api.unlockAiAnswer(answerId);
      setQuestionAnswersByQuestion((prev) => ({
        ...prev,
        [currentQuestion.id]: (prev[currentQuestion.id] || []).map((answer) =>
          answer.id === answerId ? result.answer : answer,
        ),
      }));
      const refreshedQuestion = await api
        .getInterviewQuestion(currentQuestion.id)
        .catch(() => null);
      if (refreshedQuestion) {
        setQuestions((previous) =>
          previous.map((question) =>
            question.id === refreshedQuestion.id ? refreshedQuestion : question,
          ),
        );
        if (practiceCache.questions) {
          practiceCache.questions = practiceCache.questions.map((question) =>
            question.id === refreshedQuestion.id ? refreshedQuestion : question,
          );
        }
      }
      showGlobalToast(
        result.coins_spent ?
          `AI answer unlocked for ${result.coins_spent} coins`
        : 'AI answer unlocked',
      );
      window.dispatchEvent(new Event('playbookGamificationUpdated'));
    } catch (err) {
      console.error('Failed to unlock AI answer:', err);
      showGlobalToast(
        err instanceof Error ? err.message : 'Could not unlock AI answer',
      );
    }
  };

  const handleToggleFeaturedAnswer = async (
    answerId: string,
    currentIsRecommended: boolean,
  ) => {
    if (!baseCurrentQuestion) return;
    try {
      await api.updateQuestionAnswer(answerId, {
        is_recommended: !currentIsRecommended,
      });
      showGlobalToast(
        !currentIsRecommended ?
          'Marked as featured answer'
        : 'Removed from featured answers',
      );
      const refreshedAnswers = await api.questionAnswers(
        baseCurrentQuestion.id,
      );
      setQuestionAnswersByQuestion((prev) => ({
        ...prev,
        [baseCurrentQuestion.id]: refreshedAnswers,
      }));
    } catch (err) {
      console.error('Failed to toggle featured answer:', err);
      showGlobalToast(
        err instanceof Error ?
          err.message
        : 'Operation failed. Please try again.',
      );
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
    setGlobalShowAnswers: setGlobalShowAnswersPreference,
    showThisAnswer,
    setShowThisAnswer,
    showDailySummaryModal,
    setShowDailySummaryModal,
    dailySummaryData,
    isEditingAnswer,
    setIsEditingAnswer,
    isSavingAnswer,
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

    autoEvalEnabled,
    toggleAutoEval,

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
    handleSavePolishedAnswerAsMyAnswer,
    handleUpdateTranscriptSegment,
    handleSaveStandardAnswer,
    handleCreateAuthorAnswer,
    handleUpdateAuthorAnswer,
    handleDeleteAuthorAnswer,
    handleGenerateAiAnswer,
    handleGenerateQuestionMetadata,
    handleUnlockAiAnswer,
    handleToggleFeaturedAnswer,
    handleReportSubmit,

    // Derived
    effectiveQueue,
    currentQuestionIndex,
    currentQuestion,
    authorAnswers,
    myAnswer,
    allCommunityAnswers,
    featuredCommunityAnswers,
    aiReferenceAnswers,
    isGeneratingAiAnswer,
    isAnswersLoading,
    isGeneratingQuestionMetadata,
    isQuestionAuthor,
    shouldShowAnswer,
    currentAttempts,
  };
}
