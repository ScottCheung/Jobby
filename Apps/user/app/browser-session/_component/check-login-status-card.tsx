/** @format */

import React, { memo } from 'react';
import {
  RefreshCw,
  CheckCircle2,
  XCircle,
  Sparkles,
  AlertTriangle,
} from 'lucide-react';
import { HelpTip } from '@/components/UI/help-tip';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
dayjs.extend(relativeTime);
import { useBrowserSessionStore } from './browser-session-store';

export const CheckLoginStatusCard = memo(function CheckLoginStatusCard({
  isDesktop,
}: {
  isDesktop: boolean;
}) {
  const sessionStatus = useBrowserSessionStore((state) => state.sessionStatus);
  const sessionVerification = useBrowserSessionStore(
    (state) => state.sessionVerification,
  );
  const isVerifyingSession = useBrowserSessionStore(
    (state) => state.isVerifyingSession,
  );
  const isClosingChrome = useBrowserSessionStore(
    (state) => state.isClosingChrome,
  );
  const isCheckingStatus = useBrowserSessionStore(
    (state) => state.isCheckingStatus,
  );
  const verifySession = useBrowserSessionStore((state) => state.verifySession);
  const checkStatus = useBrowserSessionStore((state) => state.checkStatus);

  const [relativeText, setRelativeText] = React.useState('Not checked yet');

  React.useEffect(() => {
    if (!sessionVerification?.checkedAt) {
      setRelativeText('Not checked yet');
      return;
    }

    const updateText = () => {
      const diffSeconds = dayjs().diff(
        dayjs(sessionVerification.checkedAt),
        'second',
      );
      if (diffSeconds < 5) {
        setRelativeText('just now');
      } else if (diffSeconds < 60) {
        setRelativeText(`${diffSeconds}s ago`);
      } else {
        setRelativeText(dayjs(sessionVerification.checkedAt).fromNow());
      }
    };

    updateText();
    const interval = setInterval(updateText, 5000);
    return () => clearInterval(interval);
  }, [sessionVerification?.checkedAt]);

  return (
    <div className='panel-xl'>
      <div className='flex items-start justify-between gap-3'>
        <div>
          <h2 className='text-base font-semibold text-ink-primary flex items-center gap-2'>
            Check Login Status
          </h2>
          <p className='mt-1 text-sm text-ink-secondary'>
            Confirm whether LinkedIn and Seek still recognize you.
          </p>
        </div>
        <HelpTip content='The app will close the login browser for you first if needed, then run the check.' />
      </div>

      <div className='space-y-6 panel-sm'>
        <div className='flex items-center justify-between'>
          <span className='text-sm text-ink-primary0 dark:text-zinc-400'>
            Saved Login Sessions
          </span>
          {sessionStatus?.exists ?
            <span className='inline-flex items-center gap-1 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400'>
              <CheckCircle2 className='h-3 w-3' />
              Ready
            </span>
          : <span className='inline-flex items-center gap-1 rounded-full border border-zinc-500/20 bg-zinc-500/10 px-2 py-0.5 text-xs font-semibold text-ink-primary0'>
              <XCircle className='h-3 w-3' />
              Empty
            </span>
          }
        </div>

        <div className='flex items-center justify-between'>
          <span className='text-sm text-ink-primary0 dark:text-zinc-400'>
            Last check
          </span>
          <span
            className='status-badge'
            title={
              sessionVerification ?
                dayjs(sessionVerification.checkedAt).format(
                  'YYYY-MM-DD HH:mm:ss',
                )
              : undefined
            }
          >
            {relativeText}
          </span>
        </div>
      </div>

      <div className='flex items-center gap-2'>
        <button
          onClick={() => void verifySession()}
          disabled={!isDesktop || isVerifyingSession || isClosingChrome}
          className='flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-primary-gradient  text-primary-foreground px-4 py-2.5 text-sm font-semibold transition shadow-md active:scale-98 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed'
        >
          <Sparkles
            className={`h-4 w-4 ${isVerifyingSession ? 'animate-spin' : ''}`}
          />
          {isClosingChrome ?
            'Closing browser...'
          : isVerifyingSession ?
            'Checking...'
          : 'Check LinkedIn and Seek'}
        </button>
      </div>

      {isDesktop && sessionStatus ?
        sessionVerification ?
          <div className='space-y-3'>
            {(
              [
                ['LinkedIn', sessionVerification.results.linkedin],
                ['Seek', sessionVerification.results.seek],
              ] as const
            ).map(([label, result]) => (
              <div key={label} className='panel-lg space-y-1.5'>
                <div className='flex items-center justify-between gap-3'>
                  <span className='font-semibold text-ink-primary'>
                    {label}
                  </span>
                  {result.loggedIn ?
                    <span className='inline-flex items-center gap-1 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400'>
                      <CheckCircle2 className='h-3 w-3' />
                      Signed in
                    </span>
                  : <span className='inline-flex items-center gap-1 rounded-full border border-amber-500/20 bg-amber-500/10 px-2 py-0.5 text-xs font-semibold text-amber-600 dark:text-amber-400'>
                      <AlertTriangle className='h-3 w-3' />
                      Please sign in
                    </span>
                  }
                </div>
                <p
                  className='text-xs text-ink-secondary leading-relaxed'
                  dangerouslySetInnerHTML={{ __html: result.detail }}
                />
              </div>
            ))}
          </div>
        : null
      : <div className='rounded-xl border border-dashed border-border dark:border-border px-4 py-6 text-center text-sm text-ink-secondary'>
          {isDesktop ?
            'Checking status...'
          : 'Status is only available in the desktop app.'}
        </div>
      }
    </div>
  );
});
