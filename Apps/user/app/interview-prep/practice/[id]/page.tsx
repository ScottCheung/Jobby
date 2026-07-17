/** @format */

'use client';
import React, { Suspense } from 'react';
import { useRouter } from 'next/navigation';
import { Clock, Edit, CalendarCheck } from 'lucide-react';
import { cn } from '@/lib/utils';
import { PracticeWorkspace } from '../_components/PracticeWorkspace';
import { PracticeHistory } from '../_components/PracticeHistory';
import { PracticeModeModal } from '../_components/PracticeModeModal';
import { PracticeHeader } from '../_components/PracticeHeader';
import { StandardAnswerCard } from '../_components/StandardAnswerCard';
import { FrameworkCard } from '../_components/FrameworkCard';
import { DailySummaryModal } from '../../_components/DailySummaryModal';
import { PracticeSkeleton } from '../_components/PracticeSkeleton';
import { usePracticeData } from '../_hook/usePracticeData';

function PracticeModeQuestionPageInner() {
  const router = useRouter();
  const {
    id,
    practiceMode,
    isShuffled,
    questions,
    categories,
    apiBaseUrl,
    isLoading,
    activePlan,
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
    handleSaveStandardAnswer,
    handleSaveFramework,
    shouldShowAnswer,
    currentAttempts,
    setShowThisAnswer,
    setIsEditingAnswer,
    setIsEditingFramework,
    customSelectedIds,
  } = usePracticeData();

  if (isLoading) {
    return <PracticeSkeleton />;
  }

  if (questions.length === 0) {
    return (
      <div className='flex items-center justify-center h-full text-ink-secondary bg-panel rounded-4xl p-6'>
        No interview questions found. Please add questions first.
      </div>
    );
  }

  if (practiceMode === 'plan' && effectiveQueue.length === 0) {
    return (
      <div className='flex items-center justify-center h-full bg-panel rounded-4xl p-6'>
        <div className='flex flex-col items-center gap-3 text-center max-w-sm'>
          <CalendarCheck className='w-10 h-10 text-primary opacity-60' />
          <p className='font-semibold text-ink-primary'>
            All caught up for today!
          </p>
          <p className='text-sm text-ink-secondary'>
            All scheduled tasks are done. Switch modes to keep practising.
          </p>
          <button
            onClick={() => {
              router.push('/interview-prep/practice/');
            }}
            className='mt-1 px-4 py-2 rounded-lg bg-primary/10 text-primary text-xs font-bold hover:bg-primary/20 transition-colors'
          >
            Practice More
          </button>
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
      <div className='flex items-center justify-center h-full text-ink-secondary bg-panel rounded-4xl p-6'>
        Question not found.
      </div>
    );
  }

  return (
    <>
      <div className='grid grid-cols-2 gap-4 h-full overflow-hidden'>
        {/* ── Left Column ── */}
        <div className='display-panel flex flex-col gap-4 overflow-hidden relative h-full bg-panel'>
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
          />

          {/* Scrollable body */}
          <div className='flex-1 overflow-y-auto flex flex-col gap-4 pr-1 custom-scrollbar-primary'>
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
        <div className='display-panel flex flex-col overflow-hidden bg-panel'>
          <div className='flex border-b border-zinc-100 dark:border-zinc-800/60 bg-panel shrink-0'>
            {(['workspace', 'history'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={cn(
                  'flex-1 py-3 text-sm font-semibold text-center transition-all border-b-2',
                  activeTab === tab ?
                    'border-primary text-primary font-bold'
                  : 'border-transparent text-ink-secondary hover:text-ink-primary',
                )}
              >
                <span className='flex items-center justify-center gap-2'>
                  {tab === 'workspace' ?
                    <>
                      <Edit className='w-4 h-4' /> Practice Workspace
                    </>
                  : <>
                      <Clock className='w-4 h-4' /> History (
                      {currentAttempts.length})
                    </>
                  }
                </span>
              </button>
            ))}
          </div>

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
