/** @format */

'use client';

import React from 'react';
import { useConsole } from '@/components/ConsoleContext';
import { WaterfallLayout } from '@/components/layout/waterfallLayout';
import { useGlobalModalStore } from '@/lib/store/global-modal-store';
import {
  SearchStrategyCard,
  LinkedInFiltersCard,
  DecisionPolicyCard,
  AutomationControlsCard,
  AiResumeStrategyCard,
  ApplySettingsModalEditor,
  type ApplySettingsSection,
} from './_components/apply-settings-cards';

export default function ApplySettingsPage() {
  const {
    jobHuntingProfile,
    setJobHuntingProfile,
    saveJobHuntingProfile,
    applicationSettings,
    setApplicationSettings,
    saveApplicationSettings,
    hasLoadedInitialData,
  } = useConsole();

  const openModal = useGlobalModalStore((state) => state.actions.openModal);
  const closeModal = useGlobalModalStore((state) => state.actions.closeModal);

  const edit = (section: ApplySettingsSection) =>
    openModal({
      layoutId: `apply-card-${section}`,
      className: 'w-[94vw] max-w-3xl flex max-h-[88vh] rounded-lg',
      content: (
        <ApplySettingsModalEditor
          section={section}
          jobHuntingProfile={jobHuntingProfile}
          applicationSettings={applicationSettings}
          onSaveJobHuntingProfile={async (updated) => {
            setJobHuntingProfile(updated);
            await saveJobHuntingProfile(updated);
          }}
          onSaveApplicationSettings={async (updated) => {
            setApplicationSettings(updated);
            await saveApplicationSettings(updated);
          }}
          onClose={closeModal}
        />
      ),
      onClose: closeModal,
    });

  if (!hasLoadedInitialData) {
    return (
      <div className='w-full flex flex-col h-full overflow-hidden'>
        <div className='mb-6 shrink-0'>
          <h1 className='title-card text-ink-primary'>Apply Settings</h1>
          <p className='body-sm text-ink-secondary mt-1'>
            Loading settings data...
          </p>
        </div>
        <div className='flex-1 flex items-center justify-center p-12'>
          <div className='flex items-center gap-3 text-ink-secondary body-md'>
            <div className='h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent' />
            Refreshing application settings...
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className='w-full flex flex-col h-full overflow-hidden'>
      {/* Header */}
      <div className='mb-6 shrink-0'>
        <h1 className='title-card text-ink-primary'>
          Apply Settings & Automation
        </h1>
        <p className='body-sm text-ink-secondary mt-1'>
          Configure job search keywords, filters, decision policy, automation
          bot, and AI strategy
        </p>
      </div>

      {/* Form Content Area with Waterfall Layout */}
      <div className='flex-1 min-h-0 overflow-y-auto custom-scrollbar-primary pb-8 pr-2'>
        <WaterfallLayout minColumnWidth={460}>
          {/* Card 1: Search Strategy */}
          <SearchStrategyCard
            value={jobHuntingProfile}
            onClick={() => edit('strategy')}
          />

          {/* Card 2: LinkedIn Filters */}
          <LinkedInFiltersCard
            value={jobHuntingProfile}
            onClick={() => edit('filters')}
          />

          {/* Card 3: Decision Policy & Blacklists */}
          <DecisionPolicyCard
            value={applicationSettings}
            onClick={() => edit('policy')}
          />

          {/* Card 4: Bot Automation Controls */}
          <AutomationControlsCard
            value={applicationSettings}
            onClick={() => edit('automation')}
          />

          {/* Card 5: AI Assistance & Resume Strategy */}
          <AiResumeStrategyCard
            value={applicationSettings}
            onClick={() => edit('ai_resume')}
          />
        </WaterfallLayout>
      </div>
    </div>
  );
}
