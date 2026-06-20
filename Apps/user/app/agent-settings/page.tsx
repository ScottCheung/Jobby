/** @format */

'use client';

import React from 'react';
import { Settings2 } from 'lucide-react';
import { useConsole } from '@/components/ConsoleContext';
import { RuntimeForm } from '@/components/forms';

export default function AgentSettingsPage() {
  const {
    runtimeSettings,
    setRuntimeSettings,
    saveRuntime,
    hasLoadedInitialData,
  } = useConsole();

  if (!hasLoadedInitialData) {
    return (
      <div className='grid grid-cols-1 gap-6'>
        <section className='panel p-6 text-sm text-ink-secondary'>
          Refreshing data...
        </section>
      </div>
    );
  }

  return (
    <div className='grid grid-cols-1 gap-6 h-[calc(100vh-88px)] min-h-[640px] overflow-hidden'>
      <section className='min-h-0 overflow-hidden rounded-2xl border border-zinc-200/70 dark:border-zinc-800/80 bg-panel flex flex-col'>
        <div className='sticky top-0 z-10 border-b border-zinc-200/70 dark:border-zinc-800/80 bg-panel/95 backdrop-blur-md px-6 py-5'>
          <div className='flex items-center gap-3'>
            <div className='flex h-10 w-10 items-center justify-center rounded-xl bg-zinc-100 dark:bg-zinc-900/60 text-ink-primary'>
              <Settings2 className='h-5 w-5' />
            </div>
            <div>
              <h1 className='text-xl font-semibold text-ink-primary'>
                Agent Settings
              </h1>
              <p className='mt-1 text-sm text-ink-secondary'>
                Control how the browser worker runs after you choose a job hunting profile.
              </p>
            </div>
          </div>
        </div>

        <div className='custom-scrollbar-primary flex-1 overflow-y-auto px-6 py-6'>
          <RuntimeForm
            value={runtimeSettings}
            onChange={setRuntimeSettings}
            onSave={saveRuntime}
          />
        </div>
      </section>
    </div>
  );
}
