/** @format */

'use client';

import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Check, X } from 'lucide-react';
import {
  getApplicationTimeline,
  getCurrentApplicationStage,
  type ApplicationTimelineEntry,
  type JobApplication,
  type ApplicationPlanResponse,
} from '@/lib/types';
import { useLayoutStore } from '@/lib/store/layout-store';
import { formatRelativeDate } from '@/components/ConsoleUtils';
import { Button } from '@jobby/ui';

import { Header } from './Header';
import { Tabs } from './Tabs';
import { Timeline } from './Timeline';
import { NotesAndQA } from './NotesAndQA';
import { JobDescription } from './JobDescription';
import { stageConfig } from './constants';

export function ApplicationDetails({
  application,
  initialTab = 'overview',
  onSave,
  onPlanAction,
  onTabChange,
}: {
  application: JobApplication;
  initialTab?: 'overview' | 'qa' | 'description';
  onSave: (
    applicationId: string,
    payload: Partial<JobApplication>,
  ) => Promise<void>;
  onPlanAction?: (
    applicationId: string,
    action: string,
    reason?: string,
  ) => Promise<ApplicationPlanResponse>;
  onTabChange?: (tab: 'overview' | 'qa' | 'description') => void;
}) {
  const { actions } = useLayoutStore();
  const [draft, setDraft] = useState<JobApplication>(application);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'qa' | 'description'>(
    initialTab,
  );
  const [isEditingTimeline, setIsEditingTimeline] = useState(false);
  const [isEditingNotes, setIsEditingNotes] = useState(false);
  const [isEditingDescription, setIsEditingDescription] = useState(false);
  const [planBusy, setPlanBusy] = useState(false);
  const [rejectReason, setRejectReason] = useState('');

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  const handleTabChange = (tab: 'overview' | 'qa' | 'description') => {
    setActiveTab(tab);
    onTabChange?.(tab);
  };

  useEffect(() => {
    setDraft(application);
  }, [application]);

  // Read or initialize custom stage timeline from raw_data
  const timeline: ApplicationTimelineEntry[] = useMemo(
    () => getApplicationTimeline(draft),
    [draft],
  );

  const set = (
    key: keyof JobApplication,
    value: string | null | Record<string, any>,
  ) => {
    setDraft((current) => ({ ...current, [key]: value }));
  };

  const updateTimeline = (newTimeline: ApplicationTimelineEntry[]) => {
    const rawData = {
      ...(draft.raw_data || {}),
      timeline: newTimeline,
    };
    const latestStage = getCurrentApplicationStage({
      ...draft,
      raw_data: rawData,
    });

    setDraft((curr) => ({
      ...curr,
      pipeline_stage: latestStage,
      status: latestStage === 'applied' ? 'submitted' : latestStage,
      raw_data: {
        ...(curr.raw_data || {}),
        timeline: newTimeline,
      },
    }));
  };

  const addTimelineStage = (stage: string) => {
    const defaultNotes = `Transitioned to ${stageConfig[stage]?.label || stage}.`;
    const newEntry: ApplicationTimelineEntry = {
      stage,
      timestamp: new Date().toISOString(),
      notes: defaultNotes,
    };
    updateTimeline([...timeline, newEntry]);
  };

  const handleTimelineEntryChange = (
    index: number,
    key: keyof ApplicationTimelineEntry,
    val: string,
  ) => {
    const updated = [...timeline];
    updated[index] = { ...updated[index], [key]: val };
    updateTimeline(updated);
  };

  const deleteTimelineEntry = (index: number) => {
    const updated = timeline.filter((_, i) => i !== index);
    updateTimeline(updated);
  };

  const save = async () => {
    setSaving(true);
    try {
      await onSave(application.id, {
        title: draft.title,
        company: draft.company,
        work_location: draft.work_location,
        work_style: draft.work_style,
        job_description: draft.job_description,
        status: draft.status,
        pipeline_stage: draft.pipeline_stage,
        interview_stage: draft.interview_stage,
        next_action: draft.next_action,
        next_action_at: draft.next_action_at,
        notes: draft.notes,
        skip_reason: draft.skip_reason,
        raw_data: draft.raw_data,
      });
    } finally {
      setSaving(false);
    }
  };

  const plan = (draft.raw_data?.application_plan || null) as
    | ApplicationPlanResponse['plan']
    | null;
  const reviewPending = plan?.state === 'awaiting_user_review';
  const runPlanAction = async (action: 'approve' | 'reject') => {
    if (!onPlanAction || (action === 'reject' && !rejectReason.trim())) return;
    setPlanBusy(true);
    try {
      const response = await onPlanAction(
        draft.id,
        action,
        rejectReason.trim() || undefined,
      );
      const nextState = response.plan.state;
      setDraft((current) => ({
        ...current,
        status:
          nextState === 'submitted' ? 'submitted'
          : nextState === 'rejected' ? 'skipped'
          : nextState === 'awaiting_user_review' ? 'interrupted'
          : current.status,
        skip_reason: response.plan.review_reason ?? current.skip_reason,
        raw_data: {
          ...(current.raw_data || {}),
          application_plan: response.plan,
        },
      }));
      if (action === 'reject') setRejectReason('');
    } finally {
      setPlanBusy(false);
    }
  };

  return (
    <div className='flex flex-col h-full text-ink-primary'>
      <div className='sticky top-0 z-20'>
        <Header
          platform={draft.platform}
          jobId={draft.job_id}
          title={draft.title}
          company={draft.company}
          workLocation={draft.work_location}
          jobLink={draft.job_link}
          onClose={actions.closeDrawer}
        />
        <Tabs activeTab={activeTab} onChangeTab={handleTabChange} />
      </div>

      {/* Scrollable Content Container */}
      <div className='flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar-primary'>
        {reviewPending && onPlanAction && (
          <section className='rounded-lg border border-amber-500/30 bg-amber-500/5 p-4'>
            <div className='flex items-start gap-3'>
              <AlertTriangle className='mt-0.5 size-5 shrink-0 text-amber-600' />
              <div className='min-w-0 flex-1'>
                <h3 className='title-card'>Application review required</h3>
                <p className='body-sm mt-1 text-ink-secondary'>
                  {plan?.review_reason ||
                    'Review the prepared application before continuing.'}
                </p>
                <div className='mt-3 flex flex-col gap-2 sm:flex-row'>
                  <Button
                    size='sm'
                    Icon={Check}
                    isLoading={planBusy}
                    onClick={() => void runPlanAction('approve')}
                  >
                    Approve
                  </Button>
                  <input
                    className='h-8 min-w-0 flex-1 rounded-md border border-transparent bg-background px-2 text-sm'
                    placeholder='Reason for rejecting'
                    value={rejectReason}
                    onChange={(event) => setRejectReason(event.target.value)}
                  />
                  <Button
                    size='sm'
                    variant='destructive'
                    Icon={X}
                    disabled={planBusy || !rejectReason.trim()}
                    onClick={() => void runPlanAction('reject')}
                  >
                    Reject
                  </Button>
                </div>
              </div>
            </div>
          </section>
        )}
        {activeTab === 'overview' && (
          <div className='space-y-6'>
            <Timeline
              timeline={timeline}
              isEditingTimeline={isEditingTimeline}
              setIsEditingTimeline={setIsEditingTimeline}
              addTimelineStage={addTimelineStage}
              handleTimelineEntryChange={handleTimelineEntryChange}
              deleteTimelineEntry={deleteTimelineEntry}
            />
          </div>
        )}

        {activeTab === 'qa' && (
          <NotesAndQA
            notes={draft.notes}
            status={draft.status}
            skipReason={draft.skip_reason}
            questions={draft.questions}
            isEditingNotes={isEditingNotes}
            setIsEditingNotes={setIsEditingNotes}
            onChangeNotes={(val) => set('notes', val)}
          />
        )}

        {activeTab === 'description' && (
          <JobDescription
            description={draft.job_description}
            isEditing={isEditingDescription}
            setIsEditing={setIsEditingDescription}
            onChangeDescription={(val) => set('job_description', val)}
          />
        )}
      </div>

      {/* Floating Save Actions Bar */}
      <div className='px-6 py-4 flex items-center justify-between shrink-0'>
        <span className='label-sm'>
          {draft.updated_at ?
            `Updated: ${formatRelativeDate(draft.updated_at)}`
          : ''}
        </span>
        <div className='flex items-center gap-3'>
          <Button variant='ghost' onClick={actions.closeDrawer}>
            Cancel
          </Button>
          <Button
            isLoading={saving}
            onClick={() => void save()}
            disabled={saving}
          >
            Save Changes
          </Button>
        </div>
      </div>
    </div>
  );
}
