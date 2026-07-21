/** @format */

import React, { memo } from 'react';
import { Trash2, AlertTriangle } from 'lucide-react';
import { HelpTip } from '@/components/UI/help-tip';
import { useBrowserSessionStore } from './browser-session-store';

export const ClearSavedLoginCard = memo(function ClearSavedLoginCard({
  isDesktop,
}: {
  isDesktop: boolean;
}) {
  const sessionStatus = useBrowserSessionStore((state) => state.sessionStatus);
  const showClearConfirm = useBrowserSessionStore(
    (state) => state.showClearConfirm,
  );
  const isOpeningChrome = useBrowserSessionStore(
    (state) => state.isOpeningChrome,
  );
  const isClearingSession = useBrowserSessionStore(
    (state) => state.isClearingSession,
  );
  const setShowClearConfirm = useBrowserSessionStore(
    (state) => state.setShowClearConfirm,
  );
  const clearSession = useBrowserSessionStore((state) => state.clearSession);

  return (
    <div className='panel-xl col'>
      <div className='flex items-start justify-between gap-3'>
        <div className=''>
          <h2 className='title-sub flex items-center gap-2'>
            Clear Saved Login
          </h2>
          <p className='body-md mt-1 text-ink-secondary'>
            Use this only if you want to start over.
          </p>
        </div>
        <HelpTip content='This removes the saved sign-in data for the login browser. After that, you will need to sign in to LinkedIn and Seek again.' />
      </div>

      <div className='space-y-6 panel-sm'>
        <div className='flex items-center justify-between gap-3'>
          <span className='body-md text-ink-primary0'>
            Saved login data
          </span>
          <span className='label'>
            {sessionStatus ? `${sessionStatus.sizeMb} MB` : 'N/A'}
          </span>
        </div>
      </div>

      {!showClearConfirm ?
        <button
          onClick={() => setShowClearConfirm(true)}
          disabled={
            !isDesktop ||
            isOpeningChrome ||
            sessionStatus?.isRunning ||
            !sessionStatus?.exists
          }
          className='label w-full py-2.5 rounded-xl border border-red-500/30 hover:border-red-500/50 bg-red-500/5 hover:bg-red-500/10 text-red-500 transition-all active:scale-98 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed'
        >
          Clear Saved Login
        </button>
      : <div className='rounded-xl border border-red-500/20 bg-red-500/5 p-3.5 space-y-3'>
          <div className='label flex gap-2 items-center text-red-600 dark:text-red-400'>
            <AlertTriangle className='h-4 w-4 shrink-0 text-red-500' />
            <span>This will sign you out and remove saved login data.</span>
          </div>
          <div className='flex gap-2'>
            <button
              onClick={() => void clearSession()}
              disabled={isClearingSession}
              className='label flex-1 py-2 rounded-lg bg-red-600 hover:bg-red-500 transition cursor-pointer disabled:opacity-50'
            >
              {isClearingSession ? 'Clearing...' : 'Yes, clear it'}
            </button>
            <button
              onClick={() => setShowClearConfirm(false)}
              disabled={isClearingSession}
              className='label flex-1 py-2 rounded-lg border border-border dark:border-border hover:bg-background-secondary transition cursor-pointer'
            >
              Cancel
            </button>
          </div>
        </div>
      }
    </div>
  );
});
