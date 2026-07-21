/** @format */

'use client';

import React, { useEffect } from 'react';
import { isDesktopRuntime } from '@/lib/runtime';
import { useBrowserSessionStore } from './_component/browser-session-store';
import { BrowserSessionHeader } from './_component/browser-session-header';
import { BrowserSessionAlerts } from './_component/browser-session-alerts';
import { OpenLoginBrowserCard } from './_component/open-login-browser-card';
import { CheckLoginStatusCard } from './_component/check-login-status-card';
import { ClearSavedLoginCard } from './_component/clear-saved-login-card';
import { BrowserLoginFaq } from './_component/browser-login-faq';
import { showGlobalToast } from '@/lib/toast';

export default function BrowserSessionPage() {
  const isReady = useBrowserSessionStore((state) => state.isReady);
  const loadSettings = useBrowserSessionStore((state) => state.loadSettings);
  const checkStatus = useBrowserSessionStore((state) => state.checkStatus);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  useEffect(() => {
    if (isReady) {
      checkStatus();
    }
  }, [isReady, checkStatus]);

  useEffect(() => {
    if (!isDesktopRuntime() || !window.autoJobDesktop?.onManualChromeExit) {
      return;
    }
    const unsubscribe = window.autoJobDesktop.onManualChromeExit(() => {
      showGlobalToast('Login browser closed');
      checkStatus();
    });
    return () => {
      unsubscribe();
    };
  }, [checkStatus]);

  if (!isReady) {
    return (
      <div className='grid grid-cols-1 gap-6'>
        <section className='body-md panel p-6 text-ink-secondary'>
          Refreshing data...
        </section>
      </div>
    );
  }

  const isDesktop = isDesktopRuntime();

  return (
    <div className='grid grid-cols-1 gap-6 min-h-[640px] overflow-hidden'>
      <section className='flex flex-col'>
        <BrowserSessionHeader />

        <div className='custom-scrollbar-primary flex-1 overflow-y-auto space-y-6 py-6'>
          <BrowserSessionAlerts isDesktop={isDesktop} />

          <div className='grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3'>
            <OpenLoginBrowserCard isDesktop={isDesktop} />
            <CheckLoginStatusCard isDesktop={isDesktop} />
            <ClearSavedLoginCard isDesktop={isDesktop} />
          </div>

          <BrowserLoginFaq />
        </div>
      </section>
    </div>
  );
}
