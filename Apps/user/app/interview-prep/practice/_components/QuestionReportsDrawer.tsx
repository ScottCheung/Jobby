/** @format */

'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Briefcase,
  Building2,
  Calendar,
  Eye,
  Loader2,
  MapPin,
  X,
} from 'lucide-react';
import { api } from '@/lib/api';
import type { CommunityInterviewReport } from '@/lib/types';
import { useLayoutStore } from '@/lib/store/layout-store';

export interface QuestionReportsDrawerProps {
  isOpen?: boolean;
  onClose?: () => void;
  questionId: string;
  onReport: () => void;
  width?: number | string;
}
export function QuestionReportsDrawer({
  isOpen = true,
  onClose,
  questionId,
  onReport,
  width = 400,
}: QuestionReportsDrawerProps) {
  const openDrawer = useLayoutStore((state) => state.actions.openDrawer);
  const closeDrawer = useLayoutStore((state) => state.actions.closeDrawer);

  useEffect(() => {
    if (isOpen) {
      openDrawer({
        id: 'question-reports',
        width,
        content: (
          <QuestionReportsContent
            questionId={questionId}
            onReport={onReport}
            onClose={onClose}
          />
        ),
      });
    } else {
      closeDrawer();
    }
  }, [isOpen, questionId, width, openDrawer, closeDrawer, onReport, onClose]);

  return null;
}

export function QuestionReportsContent({
  questionId,
  onReport,
  onClose,
}: {
  questionId: string;
  onReport: () => void;
  onClose?: () => void;
}) {
  const closeDrawer = useLayoutStore((state) => state.actions.closeDrawer);
  const [reports, setReports] = useState<CommunityInterviewReport[] | null>(
    null,
  );
  const [loadError, setLoadError] = useState<string | null>(null);

  const handleClose = () => {
    closeDrawer();
    onClose?.();
  };

  useEffect(() => {
    setReports(null);
    setLoadError(null);
    void api
      .communityInterviewReports(questionId)
      .then(setReports)
      .catch((error) => {
        setReports([]);
        setLoadError(
          error instanceof Error ?
            error.message
          : 'Could not load interview reports.',
        );
      });
  }, [questionId]);

  const companyCounts = useMemo(() => {
    if (!reports) return [];
    const map = new Map<string, number>();
    reports.forEach((r) => {
      const cName = r.company?.trim() || 'Anonymous Company';
      map.set(cName, (map.get(cName) || 0) + 1);
    });
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
  }, [reports]);

  const visibleCompanyCounts = companyCounts.slice(0, 5);
  const hiddenCompanyCount = Math.max(
    0,
    companyCounts.length - visibleCompanyCounts.length,
  );
  const sortedReports = useMemo(
    () =>
      [...(reports || [])].sort(
        (a, b) =>
          new Date(b.happened_at).getTime() - new Date(a.happened_at).getTime(),
      ),
    [reports],
  );

  return (
    <div className='flex min-h-full flex-col p-6'>
      {/* Header */}
      <div className='header'>
        <div>
          <p className='label-sm text-primary font-medium'>Interview Signal</p>
          <h2 className='title-card mt-1 text-lg font-bold'>
            Seen in Interview Reports
          </h2>
          <p className='body-sm mt-1 text-ink-secondary text-xs'>
            Shared anonymously by candidates who were asked this question.
          </p>
        </div>
        <button
          onClick={handleClose}
          aria-label='Close reports'
          className='rounded-full p-2 text-ink-secondary hover:bg-background-secondary transition-colors cursor-pointer'
        >
          <X className='h-4 w-4' />
        </button>
      </div>
      <div className='body'>
        {/* Aggregated Company Statistics Breakdown */}
        {reports && reports.length > 0 && (
          <div className='mt-5 rounded-xl border w-full border-blue-500/20 bg-blue-500/5 p-3.5'>
            <div className='flex items-center justify-between text-xs font-semibold text-blue-700 dark:text-blue-300'>
              <span>Company Frequency</span>
              <span className='rounded-full bg-blue-500/15 px-2 py-0.5 text-[10px]'>
                {reports.length} report{reports.length > 1 ? 's' : ''} total
              </span>
            </div>
            <div className='mt-2.5 flex flex-wrap gap-1.5'>
              {visibleCompanyCounts.map(([companyName, count]) => (
                <span
                  key={companyName}
                  className='inline-flex items-center gap-1 rounded-full border border-blue-500/20 px-2 py-1 text-[11px] font-medium text-blue-600 dark:text-blue-400'
                >
                  <Building2 className='h-3 w-3 opacity-70' />
                  {companyName}
                  <span className='ml-0.5 rounded-full bg-blue-500/15 px-1 py-0.2 text-[9px] font-bold'>
                    {count}
                  </span>
                </span>
              ))}
              {hiddenCompanyCount > 0 && (
                <span className='inline-flex items-center rounded-md border border-blue-500/20 bg-background/80 px-2 py-1 text-[11px] font-semibold text-blue-600 dark:text-blue-400'>
                  More +{hiddenCompanyCount}
                </span>
              )}
            </div>
          </div>
        )}

        {/* Action button to report an interview */}
        <button
          onClick={() => {
            handleClose();
            onReport();
          }}
          className='mt-5 w-full flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm transition-all hover:bg-primary/90 active:scale-[0.98] cursor-pointer'
        >
          <Eye className='h-4 w-4' /> Report an Interview
        </button>

        {/* Reports List */}
        <div className='mt-5 flex-1 space-y-2.5 overflow-y-auto custom-scrollbar-primary'>
          {reports === null ?
            <div className='flex justify-center py-12 text-ink-secondary'>
              <Loader2 className='h-5 w-5 animate-spin' />
            </div>
          : loadError ?
            <div className='flex flex-col items-center justify-center gap-2 py-12 text-center text-ink-secondary'>
              <Building2 className='h-8 w-8 opacity-40' />
              <p className='text-sm font-medium'>Could not load reports</p>
              <p className='max-w-xs text-xs opacity-70'>{loadError}</p>
            </div>
          : reports.length === 0 ?
            <div className='flex flex-col items-center justify-center py-12 text-center text-ink-secondary gap-2'>
              <Building2 className='h-8 w-8 opacity-40' />
              <p className='text-sm font-medium'>No interview reports yet</p>
              <p className='text-xs opacity-70 max-w-xs'>
                Be the first to report seeing this question in an actual
                interview!
              </p>
            </div>
          : sortedReports.map((report) => (
              <div
                key={report.id}
                className='rounded-xl border border-border/60 bg-background/50 p-3.5 transition-colors hover:bg-background-secondary/40'
              >
                <div className='flex items-center justify-between gap-2'>
                  <div className='flex items-center gap-2 text-sm font-semibold text-ink-primary'>
                    <Building2 className='h-4 w-4 text-primary shrink-0' />
                    <span>{report.company || 'Anonymous Company'}</span>
                  </div>
                  {report.happened_at && (
                    <span className='flex items-center gap-1 text-[10px] text-ink-secondary shrink-0'>
                      <Calendar className='h-3 w-3 opacity-60' />
                      {new Date(report.happened_at).toLocaleDateString()}
                    </span>
                  )}
                </div>
                {(report.role || report.location) && (
                  <div className='mt-1.5 flex flex-wrap items-center gap-3 text-xs text-ink-secondary'>
                    {report.role && (
                      <span className='flex items-center gap-1'>
                        <Briefcase className='h-3 w-3 opacity-60 shrink-0' />
                        {report.role}
                      </span>
                    )}
                    {report.location && (
                      <span className='flex items-center gap-1 text-amber-600 dark:text-amber-400'>
                        <MapPin className='h-3 w-3 opacity-80 shrink-0' />
                        {report.location}
                      </span>
                    )}
                  </div>
                )}
              </div>
            ))
          }
        </div>
      </div>
    </div>
  );
}
