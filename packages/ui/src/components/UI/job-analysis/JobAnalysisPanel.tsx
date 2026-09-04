/** @format */

'use client';

import { cn } from '@jobby/ui';
import { JobDetails, type JobDetailsProps } from './JobDetails';
import { JobScoreCard } from './JobScoreCard';
import type {
  JobAnalysisDocType,
  JobAnalysisEvaluation,
  JobAnalysisGeneration,
  JobAnalysisInspection,
} from './types';

export interface JobAnalysisPanelProps
  extends Omit<
    JobDetailsProps,
    'latestInspection' | 'latestMatch' | 'isMatchLoading' | 'isInspecting'
  > {
  latestInspection: JobAnalysisInspection | null;
  latestMatch: JobAnalysisEvaluation | null;
  isMatchLoading?: boolean;
  isInspecting?: boolean;
  onTailor?: (type: JobAnalysisDocType) => void;
  onPreview?: (type: 'resume' | 'cover_letter') => void;
  existingDocuments?: {
    resume?: boolean;
    cover_letter?: boolean;
  };
  activeGeneration?: JobAnalysisGeneration | null;
  hasBackground?: boolean;
  onRecordApplication?: () => void;
  canRecordApplication?: boolean;
  isApplicationRecorded?: boolean;
  isRecordingApplication?: boolean;
}

export function JobAnalysisPanel({
  latestInspection,
  latestMatch,
  isMatchLoading = false,
  isInspecting = false,
  onTailor,
  onPreview,
  existingDocuments,
  activeGeneration,
  authConnected = true,
  onSignIn,
  onRecordApplication,
  canRecordApplication = false,
  isApplicationRecorded = false,
  isRecordingApplication = false,
  hasBackground = true,
  ...detailsProps
}: JobAnalysisPanelProps) {
  return (
    <>
      <div 
        style={{
          padding: hasBackground ? 'var(--score-card-padding)' : '0px',
          borderTopLeftRadius: hasBackground ? 'var(--score-card-radius-accent)' : undefined,
        }}
        className={cn(
          hasBackground &&
            'flex flex-col gap-3 w-full max-h-full rounded-xl bg-primary/10 dark:bg-primary/20',
        )}
      >
      <JobScoreCard
        latestInspection={latestInspection}
        latestMatch={latestMatch}
        isMatchLoading={isMatchLoading}
        isInspecting={isInspecting}
        onTailor={onTailor}
        onPreview={onPreview}
        existingDocuments={existingDocuments}
        activeGeneration={activeGeneration}
        authConnected={authConnected}
        onSignIn={onSignIn}
        onRecordApplication={onRecordApplication}
        canRecordApplication={canRecordApplication}
        isApplicationRecorded={isApplicationRecorded}
        isRecordingApplication={isRecordingApplication}
      />
      </div>
      <JobDetails
        {...detailsProps}
        latestInspection={latestInspection}
        latestMatch={latestMatch}
        isMatchLoading={isMatchLoading}
        isInspecting={isInspecting}
        authConnected={authConnected}
        onSignIn={onSignIn}
      />
    </>
  );
}
