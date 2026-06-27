/** @format */

import React, { memo } from 'react';
import { AlertTriangle } from 'lucide-react';
import { useBrowserSessionStore } from './browser-session-store';

export const BrowserSessionAlerts = memo(function BrowserSessionAlerts({
  isDesktop,
}: {
  isDesktop: boolean;
}) {
  const showCloseOtherChromePrompt = useBrowserSessionStore(
    (state) => state.showCloseOtherChromePrompt,
  );
  const isClosingAllChrome = useBrowserSessionStore(
    (state) => state.isClosingAllChrome,
  );
  const setShowCloseOtherChromePrompt = useBrowserSessionStore(
    (state) => state.setShowCloseOtherChromePrompt,
  );
  const closeOtherChromeAndContinue = useBrowserSessionStore(
    (state) => state.closeOtherChromeAndContinue,
  );

  return (
    <>
      {showCloseOtherChromePrompt && (
        <div className='rounded-2xl border border-amber-500/30 bg-amber-500/8 px-4 py-4 space-y-3'>
          <div className='flex items-start gap-3'>
            <AlertTriangle className='h-5 w-5 shrink-0 text-amber-500 mt-0.5' />
            <div className='space-y-1'>
              <p className='text-sm font-semibold text-ink-primary'>
                Close other Chrome windows first
              </p>
              <p className='text-sm text-ink-secondary leading-relaxed'>
                This helps the app open the right login browser, so your sign-in
                stays saved for Auto Apply.
              </p>
            </div>
          </div>

          <div className='flex gap-3'>
            <button
              onClick={() => void closeOtherChromeAndContinue()}
              disabled={isClosingAllChrome}
              className='inline-flex items-center justify-center rounded-xl bg-amber-500 hover:bg-amber-400 text-white px-4 py-2.5 text-sm font-semibold transition active:scale-98 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed'
            >
              {isClosingAllChrome ?
                'Closing...'
              : 'Close All Chrome and Continue'}
            </button>
            <button
              onClick={() => setShowCloseOtherChromePrompt(false)}
              disabled={isClosingAllChrome}
              className='inline-flex items-center justify-center rounded-xl border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-900 text-ink-primary px-4 py-2.5 text-sm font-semibold transition active:scale-98 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed'
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {!isDesktop && (
        <div className='rounded-2xl p-4 bg-amber-500/10 border border-amber-500/20 flex gap-3 items-start'>
          <AlertTriangle className='h-5 w-5 text-amber-500 shrink-0 mt-0.5' />
          <div className='text-sm text-amber-800 dark:text-amber-400'>
            <p className='font-semibold'>Please use the desktop app</p>
            <p className='mt-1'>
              These browser controls only work in the desktop app.
            </p>
          </div>
        </div>
      )}
    </>
  );
});
