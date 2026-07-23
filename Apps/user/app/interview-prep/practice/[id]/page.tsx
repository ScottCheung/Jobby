/** @format */

'use client';
import React, { Suspense, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  BookOpen,
  CalendarCheck,
  CalendarPlus,
  Clock,
  Edit,
  MessageCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import dynamic from 'next/dynamic';

const PracticeModeModal = dynamic(
  () => import('../_components/PracticeModeModal').then((mod) => mod.PracticeModeModal),
  { ssr: false },
);
const DailySummaryModal = dynamic(
  () => import('../../_components/DailySummaryModal').then((mod) => mod.DailySummaryModal),
  { ssr: false },
);
const InterviewReportModal = dynamic(
  () => import('../_components/InterviewReportModal').then((mod) => mod.InterviewReportModal),
  { ssr: false },
);
const PracticeCompletionModal = dynamic(
  () => import('../_components/PracticeCompletionModal').then((mod) => mod.PracticeCompletionModal),
  { ssr: false },
);

import { api } from '@/lib/api';
import { showGlobalToast } from '@/lib/toast';
import { PracticeWorkspace } from '../_components/PracticeWorkspace';
import { PracticeHistory } from '../_components/PracticeHistory';
import { PracticeHeader } from '../_components/PracticeHeader';
import { StandardAnswerCard } from '../_components/StandardAnswerCard';
import { PracticeSkeleton } from '../_components/PracticeSkeleton';
import { usePracticeData } from '../_hook/usePracticeData';
import { QuestionComments } from '../_components/Comments/QuestionComments';
import { Tooltip, Kbd } from '@/components/UI/tooltip';

function PracticeModeQuestionPageInner() {
  const router = useRouter();
  const [reportRefreshKey, setReportRefreshKey] = useState(0);
  const [isCompletionScoring, setIsCompletionScoring] = useState(false);
  const {
    id,
    practiceMode,
    isShuffled,
    questions,
    categories,
    apiBaseUrl,
    isLoading,
    activePlan,
    planTasks,
    effectiveQueue,
    currentQuestionIndex,
    currentQuestion,
    isDrawerOpen,
    drawerId,
    showModeModal,
    setShowModeModal,
    activeTab,
    setActiveTab,
    globalShowAnswers,
    setGlobalShowAnswers,
    showDailySummaryModal,
    setShowDailySummaryModal,
    dailySummaryData,
    isEditingAnswer,
    isSavingAnswer,
    confidenceScore,
    setConfidenceScore,
    notes,
    setNotes,
    isSubmitting,
    isRecording,
    audioBlob,
    audioUrl,
    activeStream,
    transcriptSegments,
    interimText,
    draftAudioRef,
    autoEvalEnabled,
    toggleAutoEval,
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
    shouldShowAnswer,
    allCommunityAnswers,
    featuredCommunityAnswers,
    aiReferenceAnswers,
    authorAnswers,
    myAnswer,
    isGeneratingAiAnswer,
    isAnswersLoading,
    isGeneratingQuestionMetadata,
    isQuestionAuthor,
    currentAttempts,
    setShowThisAnswer,
    setIsEditingAnswer,
    customSelectedIds,
    showReportModal,
    setShowReportModal,
    showCompletionModal,
    setShowCompletionModal,
    completionReward,
    isSubmittingReport,
    handleReportSubmit,
  } = usePracticeData();

  const queueRedirectTarget =
    // A free-practice URL is also a shareable deep link. The referenced
    // question may not be in the recipient's library until its direct fetch
    // completes, so never replace that URL with an unrelated queued question.
    (
      !isLoading &&
      practiceMode !== 'free' &&
      effectiveQueue.length > 0 &&
      currentQuestionIndex === -1
    ) ?
      `/interview-prep/practice/${effectiveQueue[0].id}?mode=${practiceMode}&shuffle=${isShuffled ? '1' : '0'}`
    : null;

  useEffect(() => {
    if (queueRedirectTarget) router.replace(queueRedirectTarget);
  }, [queueRedirectTarget, router]);

  // Refresh community metrics after a practice submission (completion modal opens)
  useEffect(() => {
    if (showCompletionModal) {
      setReportRefreshKey((v) => v + 1);
    }
  }, [showCompletionModal]);

  const selectTab = (tab: 'workspace' | 'history' | 'comment') => {
    setActiveTab(tab);
    const params = new URLSearchParams(window.location.search);
    params.set('tab', tab);
    router.replace(`${window.location.pathname}?${params.toString()}`, {
      scroll: false,
    });
  };

  // Listen for global keyboard shortcut tab actions (P, H, C)
  useEffect(() => {
    const handleKeyboardAction = (event: Event) => {
      const detail = (event as CustomEvent<{ action: string }>).detail;
      if (!detail) return;
      if (detail.action === 'tab-workspace') selectTab('workspace');
      if (detail.action === 'tab-history') selectTab('history');
      if (detail.action === 'tab-comment') selectTab('comment');
    };
    window.addEventListener('jobby:keyboard-action', handleKeyboardAction);
    return () =>
      window.removeEventListener('jobby:keyboard-action', handleKeyboardAction);
  }, []);

  const handleCompletionScore = async () => {
    const latestAttempt = currentAttempts[0];
    if (!latestAttempt) {
      setShowCompletionModal(false);
      selectTab('history');
      return;
    }
    setIsCompletionScoring(true);
    try {
      const existing = await api.practiceEvaluations(latestAttempt.id);
      if (existing.length === 0) {
        const evaluation = await api.createPracticeEvaluation(latestAttempt.id);
        showGlobalToast(`AI feedback ready: ${evaluation.overall_score}/100`);
        window.dispatchEvent(new Event('playbookGamificationUpdated'));
      }
      setShowCompletionModal(false);
      selectTab('history');
    } catch (error) {
      console.error('Failed to score latest practice answer:', error);
      showGlobalToast(
        error instanceof Error ? error.message : 'Could not score this answer',
      );
    } finally {
      setIsCompletionScoring(false);
    }
  };

  if (isLoading) {
    return <PracticeSkeleton />;
  }

  if (questions.length === 0) {
    return (
      <div className='flex h-full items-center justify-center panel-lg p-6'>
        <div className='flex max-w-sm flex-col items-center gap-3 text-center'>
          <div className='flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary'>
            <BookOpen className='h-6 w-6' />
          </div>
          <p className='font-semibold text-ink-primary'>
            Your question library is empty
          </p>
          <p className='body-md text-ink-secondary'>
            Add your own questions or choose a collection before starting a
            practice session.
          </p>
          <button
            onClick={() => router.push('/interview-prep/library')}
            className='label-sm mt-1 rounded-lg bg-primary px-4 py-2 text-primary-foreground transition-colors hover:bg-primary/90'
          >
            Add Questions
          </button>
        </div>
      </div>
    );
  }

  if (practiceMode === 'plan' && effectiveQueue.length === 0) {
    const hasScheduledTasks = planTasks.length > 0;

    return (
      <div className='flex items-center justify-center h-full panel-lg p-6'>
        <div className='flex flex-col items-center gap-3 text-center max-w-sm'>
          {hasScheduledTasks ?
            <CalendarCheck className='w-10 h-10 text-primary opacity-60' />
          : <CalendarPlus className='w-10 h-10 text-primary opacity-60' />}
          <p className='font-semibold text-ink-primary'>
            {hasScheduledTasks ?
              'All caught up for today!'
            : 'Your practice plan is empty'}
          </p>
          <p className='body-md text-ink-secondary'>
            {hasScheduledTasks ?
              'All scheduled tasks are done. Switch modes to keep practising.'
            : activePlan ?
              'This plan has no scheduled questions yet. Update the plan or practise freely.'
            : 'Create a plan to receive a focused daily practice queue.'}
          </p>
          <div className='mt-1 flex flex-wrap justify-center gap-2'>
            <button
              onClick={() =>
                router.replace(
                  `/interview-prep/practice/${questions[0].id}?mode=free&shuffle=${isShuffled ? '1' : '0'}`,
                )
              }
              className='label-sm rounded-lg bg-primary/10 px-4 py-2 text-primary transition-colors hover:bg-primary/20'
            >
              Practice Freely
            </button>
            {!hasScheduledTasks && (
              <button
                onClick={() => router.push('/interview-prep')}
                className='label-sm rounded-lg border border-border px-4 py-2 text-ink-primary transition-colors hover:bg-background-secondary'
              >
                Set Up Plan
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (queueRedirectTarget) return <PracticeSkeleton />;

  if (!currentQuestion) {
    return (
      <div className='flex items-center justify-center h-full text-ink-secondary panel-xl'>
        Question not found.
      </div>
    );
  }

  return (
    <>
      <div className='flex gap-4 h-full overflow-hidden'>
        {/* ── Left Column ── */}
        <div className='flex-1 w-full transition-all panel-xl pb-0!  flex flex-col gap-4 relative h-full pt-4!'>
          <PracticeHeader
            currentQuestion={currentQuestion}
            currentIndex={currentQuestionIndex}
            totalQuestions={effectiveQueue.length}
            practiceMode={practiceMode}
            isShuffled={isShuffled}
            isDrawerOpen={isDrawerOpen}
            drawerId={drawerId}
            globalShowAnswers={globalShowAnswers}
            autoEvalEnabled={autoEvalEnabled}
            customSelectedIds={customSelectedIds}
            onShowModeModal={() => setShowModeModal(true)}
            onToggleAnswers={() => {
              const newVal = !globalShowAnswers;
              setGlobalShowAnswers(newVal);
            }}
            onToggleShuffle={toggleShuffle}
            onToggleAutoEval={toggleAutoEval}
            onOpenQueue={handleOpenQueue}
            onPrevious={handlePrevious}
            onNext={handleNext}
            onReportInterview={() => setShowReportModal(true)}
            onOpenComments={() => selectTab('comment')}
            reportRefreshKey={reportRefreshKey}
          />

          {/* Scrollable body */}
          <div className='flex-1 overflow-y-auto body flex flex-col  custom-scrollbar-primary'>
            <StandardAnswerCard
              currentQuestion={currentQuestion}
              shouldShowAnswer={shouldShowAnswer}
              isAnswersLoading={isAnswersLoading}
              onShowAnswerToggle={() => {
                // If it is in local hook return
                if (setShowThisAnswer) {
                  setShowThisAnswer((prev: boolean) => !prev);
                }
              }}
              isEditingAnswer={isEditingAnswer}
              onStartEditing={() =>
                setIsEditingAnswer && setIsEditingAnswer(true)
              }
              onCancelEditing={() =>
                setIsEditingAnswer && setIsEditingAnswer(false)
              }
              onSaveAnswer={handleSaveStandardAnswer}
              onCreateAuthorAnswer={handleCreateAuthorAnswer}
              onUpdateAuthorAnswer={handleUpdateAuthorAnswer}
              onDeleteAuthorAnswer={handleDeleteAuthorAnswer}
              isSavingAnswer={isSavingAnswer}
              featuredAnswers={featuredCommunityAnswers}
              allCommunityAnswers={allCommunityAnswers}
              aiAnswers={aiReferenceAnswers}
              authorAnswers={authorAnswers}
              myAnswer={myAnswer}
              isGeneratingAiAnswer={isGeneratingAiAnswer}
              isGeneratingQuestionMetadata={isGeneratingQuestionMetadata}
              isQuestionAuthor={isQuestionAuthor}
              onGenerateAiAnswer={handleGenerateAiAnswer}
              onGenerateQuestionMetadata={handleGenerateQuestionMetadata}
              onUnlockAiAnswer={handleUnlockAiAnswer}
              onToggleFeaturedAnswer={handleToggleFeaturedAnswer}
            />
          </div>
        </div>

        {/* ── Right Column ── */}
        <div className=' w-xl h-full  panel-xl transition-all flex flex-col overflow-hidden bg-panel p-4! pt-2! pb-0!'>
          <div className='header'>
            {(['workspace', 'history', 'comment'] as const).map((tab) => {
              const keyLabel =
                tab === 'workspace' ? 'P'
                : tab === 'history' ? 'H'
                : 'C';
              const tabTitle =
                tab === 'workspace' ? 'Practice Workspace'
                : tab === 'history' ? 'Practice History'
                : 'Comments & Discussion';
              return (
                <Tooltip
                  key={tab}
                  content={
                    <span className='inline-flex items-center'>
                      {tabTitle} <Kbd>{keyLabel}</Kbd>
                    </span>
                  }
                  side='bottom'
                >
                  <button
                    onClick={() => selectTab(tab)}
                    className={cn(
                      'label flex-1 py-3 text-center transition-all border-b-2 cursor-pointer',
                      activeTab === tab ?
                        'border-primary text-primary font-bold'
                      : 'border-transparent text-ink-secondary hover:text-ink-primary',
                    )}
                  >
                    <span className='flex items-center justify-center gap-2'>
                      {tab === 'workspace' ?
                        <>
                          <Edit className='w-4 h-4' /> Practice
                        </>
                      : tab === 'history' ?
                        <>
                          <Clock className='w-4 h-4' /> History (
                          {currentAttempts.length})
                        </>
                      : <>
                          <MessageCircle className='w-4 h-4' /> Comment
                        </>
                      }
                    </span>
                  </button>
                </Tooltip>
              );
            })}
          </div>

          <div className='body flex-1 overflow-y-auto relative flex flex-col'>
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
                onUpdateTranscriptSegment={handleUpdateTranscriptSegment}
              />
            : activeTab === 'history' ?
              <PracticeHistory
                attempts={currentAttempts}
                apiBaseUrl={apiBaseUrl}
                onDeleteAttempt={handleDeleteAttempt}
                onUpdateAttempt={handleUpdateAttempt}
                onSavePolishedAnswer={handleSavePolishedAnswerAsMyAnswer}
              />
            : <QuestionComments questionId={currentQuestion.id} />}
          </div>
        </div>
      </div>

      <PracticeModeModal
        isOpen={showModeModal}
        onClose={() => setShowModeModal(false)}
        currentMode={practiceMode}
        currentCustomIds={customSelectedIds}
        questions={questions}
        categories={categories}
        activePlan={activePlan}
        onConfirm={handleModeConfirm}
      />

      <DailySummaryModal
        isOpen={showDailySummaryModal}
        onClose={() => {
          setShowDailySummaryModal(false);
          router.push('/interview-prep');
        }}
        summary={dailySummaryData}
      />

      <InterviewReportModal
        isOpen={showReportModal}
        onClose={() => setShowReportModal(false)}
        onSubmit={async (data) => {
          await handleReportSubmit(data);
          setReportRefreshKey((value) => value + 1);
        }}
        isSubmitting={isSubmittingReport}
      />

      <PracticeCompletionModal
        isOpen={showCompletionModal}
        questionId={currentQuestion.id}
        reward={completionReward}
        onRedo={() => {
          setShowCompletionModal(false);
          resetWorkspace();
          selectTab('workspace');
        }}
        onReview={() => {
          setShowCompletionModal(false);
          selectTab('history');
        }}
        onScore={() => void handleCompletionScore()}
        isScoring={isCompletionScoring}
        onNext={() => {
          setShowCompletionModal(false);
          handleNext();
        }}
      />
    </>
  );
}

// Wrap in Suspense for useSearchParams
export default function PracticeModeQuestionPage() {
  return (
    <Suspense fallback={<PracticeSkeleton />}>
      {/* <PracticeSkeleton /> */}
      <PracticeModeQuestionPageInner />
    </Suspense>
  );
}
