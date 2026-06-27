/** @format */

import React, { memo } from 'react';
import { FolderOpen, XCircle } from 'lucide-react';
import { HelpTip } from '@/components/UI/help-tip';
import { ChromeIcon } from './chrome-icon';
import { useBrowserSessionStore } from './browser-session-store';

export const OpenLoginBrowserCard = memo(function OpenLoginBrowserCard({
  isDesktop,
}: {
  isDesktop: boolean;
}) {
  const sessionStatus = useBrowserSessionStore((state) => state.sessionStatus);
  const isOpeningChrome = useBrowserSessionStore(
    (state) => state.isOpeningChrome,
  );
  const isClosingChrome = useBrowserSessionStore(
    (state) => state.isClosingChrome,
  );
  const openChrome = useBrowserSessionStore((state) => state.openChrome);
  const closeChrome = useBrowserSessionStore((state) => state.closeChrome);

  return (
    <div className='card'>
      <div className='flex items-start justify-between gap-3'>
        <div>
          <h2 className='text-base font-semibold text-ink-primary flex items-center gap-2'>
            Open A Separate Profile
          </h2>
          <p className='mt-1 text-sm text-ink-secondary'>
            Use this first when you want to sign in.
          </p>
        </div>
        <HelpTip content='This opens the browser that Auto Apply uses later. Sign in to LinkedIn and Seek there, then close that browser.' />
      </div>

      <div className='status-panel'>
        <div className='flex items-center justify-between gap-3'>
          <span className='text-sm text-ink-secondary'>Browser Status</span>
          {sessionStatus?.isRunning ?
            <span className='inline-flex items-center gap-1.5 rounded-full border border-success/20 bg-success/10 px-2.5 py-0.5 text-xs font-semibold text-success'>
              Open
            </span>
          : <span className='status-badge'>Closed</span>}
        </div>
      </div>

      <div className='grid grid-cols-1 gap-3'>
        <button
          onClick={() => void openChrome()}
          disabled={!isDesktop || isOpeningChrome || sessionStatus?.isRunning}
          className='w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold transition-all shadow-md active:scale-98 cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed'
        >
          <ChromeIcon className='h-4 w-4' />
          {isOpeningChrome ?
            'Opening...'
          : sessionStatus?.isRunning ?
            'Browser Already Open'
          : 'Open A Separate Profile'}
        </button>

        <button
          onClick={() => void closeChrome()}
          disabled={!isDesktop || isClosingChrome || !sessionStatus?.isRunning}
          className='w-full py-2.5 rounded-xl  bg-ink-secondary/10 hover:bg-ink-secondary/20 text-ink-primary text-sm font-semibold transition active:scale-98 cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed'
        >
          <XCircle className='h-4 w-4' />
          {isClosingChrome ? 'Closing...' : 'Close Login Browser'}
        </button>
      </div>
    </div>
  );
});
