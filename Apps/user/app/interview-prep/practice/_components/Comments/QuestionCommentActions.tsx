/** @format */

'use client';

import { useEffect, useState } from 'react';
import { ChevronUp, ChevronDown, Eye } from 'lucide-react';
import { api } from '@/lib/api';
import type { QuestionCommunitySummary } from '@/lib/types';
import { useLayoutStore } from '@/lib/store/layout-store';
import { showGlobalToast } from '@/lib/toast';
import { cn } from '@/lib/utils';
import { QuestionReportsDrawer } from '../QuestionReportsDrawer';
import { Tooltip } from '@/components/UI/tooltip';
import { button } from 'framer-motion/client';

export function QuestionCommentActions({
  questionId,
  reportRefreshKey,
  onReport,
}: {
  questionId: string;
  reportRefreshKey: number;
  onReport: () => void;
}) {
  const [summary, setSummary] = useState<QuestionCommunitySummary | null>(null);
  const openDrawer = useLayoutStore((state) => state.actions.openDrawer);

  useEffect(() => {
    void api
      .questionCommunity(questionId)
      .then(setSummary)
      .catch(() => undefined);
  }, [questionId, reportRefreshKey]);
  const react = async (value: 'up' | 'down') => {
    if (!summary) return;
    const previous = summary;
    const next = summary.user_reaction === value ? null : value;
    setSummary({
      ...summary,
      user_reaction: next,
      upvote_count:
        summary.upvote_count +
        Number(next === 'up') -
        Number(summary.user_reaction === 'up'),
      downvote_count:
        summary.downvote_count +
        Number(next === 'down') -
        Number(summary.user_reaction === 'down'),
    });
    try {
      setSummary(await api.updateQuestionCommunityReaction(questionId, next));
    } catch {
      setSummary(previous);
      showGlobalToast('Could not save reaction.');
    }
  };
  const openReports = () =>
    openDrawer({
      id: 'question-reports',
      width: 430,
      content: (
        <QuestionReportsDrawer questionId={questionId} onReport={onReport} />
      ),
    });
  const companies = summary?.top_companies || [];

  return (
    <div className='mt-3 space-y-2.5 border-t border-border/50 pt-3'>
      <div className='flex flex-wrap items-center gap-1.5'>
        <button
          onClick={() => void react('up')}
          className={cn(
            'rounded-full px-2 py-1 text-xs',
            summary?.user_reaction === 'up' ?
              'bg-primary/15 text-primary'
            : 'bg-background-secondary text-ink-secondary',
          )}
        >
          <ChevronUp className='h-3.5 w-3.5' /> {summary?.upvote_count || 0}
        </button>
        <button
          onClick={() => void react('down')}
          className={cn(
            'rounded-full px-2 py-1 text-xs',
            summary?.user_reaction === 'down' ?
              'bg-primary/15 text-primary'
            : 'bg-background-secondary text-ink-secondary',
          )}
        >
          <ChevronDown className='h-3.5 w-3.5' /> {summary?.downvote_count || 0}
        </button>
        <button
          onClick={onReport}
          className='ml-auto flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-semibold text-primary hover:bg-primary/10'
        >
          <Eye className='h-3 w-3' /> Seen in interview
        </button>
      </div>
      {(companies.length > 0 || summary?.seen_in_interview_count) && (
        <div className='flex flex-wrap items-center gap-1.5'>
          <span className='text-[10px] font-semibold uppercase tracking-wide text-ink-secondary'></span>
          {companies.map((company) => (
            <Tooltip
              key={company.name}
              content={`${company.count} users have been asked in ${company.name}`}
            >
              <button
                onClick={openReports}
                className='rounded-full bg-blue-500/10 px-2.5 py-1 text-[10px] font-semibold text-blue-600'
              >
                {company.name} {company.count > 1 ? company.count : ''}
              </button>
            </Tooltip>
          ))}
          {(summary?.company_count || 0) > companies.length && (
            <Tooltip
              key={'other'}
              content={`other ${(summary?.company_count || 0) - companies.length} users have been asked this question in other companies, Click to see detail.`}
            >
              <button
                onClick={openReports}
                className='rounded-full bg-background-secondary px-2.5 py-1 text-[10px] font-semibold text-ink-secondary'
              >
                Other {(summary?.company_count || 0) - companies.length}
              </button>
            </Tooltip>
          )}
          <button
            onClick={openReports}
            className='text-[10px] text-ink-secondary underline'
          >
            View {summary?.seen_in_interview_count || 0}
          </button>
        </div>
      )}
    </div>
  );
}
