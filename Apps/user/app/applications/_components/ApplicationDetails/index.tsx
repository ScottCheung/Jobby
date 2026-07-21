/** @format */

'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  getApplicationTimeline,
  getCurrentApplicationStage,
  type ApplicationTimelineEntry,
  type JobApplication,
} from '@/lib/types';
import { useLayoutStore } from '@/lib/store/layout-store';
import { formatRelativeDate } from '@/components/ConsoleUtils';
import { Button } from '@/components/UI/Button';

import { Header } from './Header';
import { Tabs } from './Tabs';
import { Timeline } from './Timeline';
import { NotesAndQA } from './NotesAndQA';
import { JobDescription } from './JobDescription';
import { stageConfig } from './constants';

export function ApplicationDetails({
  application,
  onSave,
}: {
  application: JobApplication;
  onSave: (
    applicationId: string,
    payload: Partial<JobApplication>,
  ) => Promise<void>;
}) {
  const { actions } = useLayoutStore();
  const [draft, setDraft] = useState<JobApplication>(application);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'qa' | 'description'>(
    'overview',
  );
  const [isEditingTimeline, setIsEditingTimeline] = useState(false);
  const [isEditingNotes, setIsEditingNotes] = useState(false);
  const [isEditingDescription, setIsEditingDescription] = useState(false);

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
        <Tabs activeTab={activeTab} onChangeTab={setActiveTab} />
      </div>

      {/* Scrollable Content Container */}
      <div className='flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar-primary'>
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
