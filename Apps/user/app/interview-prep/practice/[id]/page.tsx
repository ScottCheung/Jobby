/** @format */

'use client';
import React, { Suspense, useState } from 'react';
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
import { PracticeWorkspace } from '../_components/PracticeWorkspace';
import { PracticeHistory } from '../_components/PracticeHistory';
import { PracticeModeModal } from '../_components/PracticeModeModal';
import { PracticeHeader } from '../_components/PracticeHeader';
import { StandardAnswerCard } from '../_components/StandardAnswerCard';
import { FrameworkCard } from '../_components/FrameworkCard';
import { DailySummaryModal } from '../../_components/DailySummaryModal';
import { InterviewReportModal } from '../_components/InterviewReportModal';
import { PracticeSkeleton } from '../_components/PracticeSkeleton';
import { usePracticeData } from '../_hook/usePracticeData';
import { QuestionComments } from '../_components/Comments/QuestionComments';
import { PracticeCompletionModal } from '../_components/PracticeCompletionModal';

function PracticeModeQuestionPageInner() {
  const router = useRouter();
  const [reportRefreshKey, setReportRefreshKey] = useState(0);
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
    isEditingFramework,
    isSavingFramework,
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
    shouldShowAnswer,
    currentAttempts,
    setShowThisAnswer,
    setIsEditingAnswer,
    setIsEditingFramework,
    customSelectedIds,
    showReportModal,
    setShowReportModal,
    showCompletionModal,
    setShowCompletionModal,
    completionReward,
    isSubmittingReport,
    handleReportSubmit,
  } = usePracticeData();

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

  if (effectiveQueue.length > 0 && currentQuestionIndex === -1) {
    router.replace(
      `/interview-prep/practice/${effectiveQueue[0].id}?mode=${practiceMode}&shuffle=${isShuffled ? '1' : '0'}`,
    );
    return null;
  }

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
        <div className='flex-1 w-full transition-all panel-xl  flex flex-col gap-4 relative h-full pt-4!'>
          <PracticeHeader
            currentQuestion={currentQuestion}
            currentIndex={currentQuestionIndex}
            totalQuestions={effectiveQueue.length}
            practiceMode={practiceMode}
            isShuffled={isShuffled}
            isDrawerOpen={isDrawerOpen}
            drawerId={drawerId}
            globalShowAnswers={globalShowAnswers}
            customSelectedIds={customSelectedIds}
            onShowModeModal={() => setShowModeModal(true)}
            onToggleAnswers={() => {
              const newVal = !globalShowAnswers;
              setGlobalShowAnswers(newVal);
              try {
                localStorage.setItem(
                  'practiceShowAnswersPreference',
                  newVal ? '1' : '0',
                );
              } catch {}
            }}
            onToggleShuffle={toggleShuffle}
            onOpenQueue={handleOpenQueue}
            onPrevious={handlePrevious}
            onNext={handleNext}
            onReportInterview={() => setShowReportModal(true)}
            reportRefreshKey={reportRefreshKey}
          />

          {/* Scrollable body */}
          <div className='flex-1 overflow-y-auto body flex flex-col  pr-1 custom-scrollbar-primary'>
            <StandardAnswerCard
              currentQuestion={currentQuestion}
              shouldShowAnswer={shouldShowAnswer}
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
              isSavingAnswer={isSavingAnswer}
            />

            <FrameworkCard
              currentQuestion={currentQuestion}
              isEditingFramework={isEditingFramework}
              onStartEditing={() =>
                setIsEditingFramework && setIsEditingFramework(true)
              }
              onCancelEditing={() =>
                setIsEditingFramework && setIsEditingFramework(false)
              }
              onSaveFramework={handleSaveFramework}
              isSavingFramework={isSavingFramework}
            />
          </div>
        </div>

        {/* ── Right Column ── */}
        <div className=' w-xl h-full  panel-xl transition-all flex flex-col overflow-hidden bg-panel p-4! pt-2!'>
          <div className='flex shrink-0'>
            {(['workspace', 'history', 'comment'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={cn(
                  'label flex-1 py-3 text-center transition-all border-b-2',
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
            ))}
          </div>

          <div className='flex-1 overflow-y-auto relative flex flex-col'>
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
          setActiveTab('workspace');
        }}
        onReview={() => {
          setShowCompletionModal(false);
          setActiveTab('history');
        }}
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
