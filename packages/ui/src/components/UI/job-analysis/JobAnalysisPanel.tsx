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
  activeGeneration?: JobAnalysisGeneration | null;
  hasBackground?: boolean;
}

export function JobAnalysisPanel({
  latestInspection,
  latestMatch,
  isMatchLoading = false,
  isInspecting = false,
  onTailor,
  activeGeneration,
  authConnected = true,
  onSignIn,
  hasBackground = true,
  ...detailsProps
}: JobAnalysisPanelProps) {
  return (
    <>
    <div 
    style={{ padding: hasBackground ? 'var(--score-card-padding)' : '0px' }}
    className= {
      cn(hasBackground && 'flex flex-col gap-3 flex flex-col w-full h-full max-h-full rounded-xl  bg-primary/10 dark:bg-primary/20 rounded-tl-[3em]!')} >
      <JobScoreCard
        latestInspection={latestInspection}
        latestMatch={latestMatch}
        isMatchLoading={isMatchLoading}
        isInspecting={isInspecting}
        onTailor={onTailor}
        activeGeneration={activeGeneration}
        authConnected={authConnected}
        onSignIn={onSignIn}
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
