'use client';

import { useEffect, useState } from 'react';
import { Building2, Eye, Loader2, X } from 'lucide-react';
import { api } from '@/lib/api';
import type { CommunityInterviewReport } from '@/lib/types';
import { useLayoutStore } from '@/lib/store/layout-store';

export function QuestionReportsDrawer({ questionId, onReport }: { questionId: string; onReport: () => void }) {
  const closeDrawer = useLayoutStore((state) => state.actions.closeDrawer);
  const [reports, setReports] = useState<CommunityInterviewReport[] | null>(null);

  useEffect(() => {
    void api.communityInterviewReports(questionId).then(setReports).catch(() => setReports([]));
  }, [questionId]);

  return (
    <div className='flex min-h-full flex-col p-6'>
      <div className='flex items-start justify-between gap-4'>
        <div>
          <p className='label-sm text-primary'>Interview signal</p>
          <h2 className='title-card mt-1'>Seen in interview reports</h2>
          <p className='body-sm mt-2 text-ink-secondary'>Shared anonymously by people who have practised this question.</p>
        </div>
        <button onClick={closeDrawer} aria-label='Close reports' className='rounded-full p-2 text-ink-secondary hover:bg-background-secondary'><X className='h-4 w-4' /></button>
      </div>
      <button onClick={() => { closeDrawer(); onReport(); }} className='mt-6 flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground'><Eye className='h-4 w-4' /> Report an interview</button>
      <div className='mt-6 flex-1 space-y-2'>
        {reports === null ? <div className='flex justify-center py-12 text-ink-secondary'><Loader2 className='h-5 w-5 animate-spin' /></div> : reports.length === 0 ? <p className='py-12 text-center text-sm text-ink-secondary'>No reports yet.</p> : reports.map((report) => (
          <div key={report.id} className='rounded-xl border border-border/60 bg-background/30 p-3'>
            <div className='flex items-center gap-2 text-sm font-semibold text-ink-primary'><Building2 className='h-4 w-4 text-primary' />{report.company || 'Anonymous company'}</div>
            <div className='mt-1 text-xs text-ink-secondary'>{report.role || 'Interview candidate'} <span className='mx-1'>·</span> {new Date(report.happened_at).toLocaleDateString()}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
