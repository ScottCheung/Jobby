/** @format */

'use client';

import React, { useEffect, useState } from 'react';
import { RotateCcw, Save, Sparkles } from 'lucide-react';
import {
  CELEBRATION_EVENT_ORDER,
  CELEBRATION_STYLE_ORDER,
  getDefaultCelebrationConfig,
  loadCelebrationConfigFromServer,
  resetCelebrationConfig,
  saveCelebrationConfig,
  type CelebrationConfigSnapshot,
  type CelebrationEventConfig,
  type CelebrationEventKey,
} from '@/lib/celebration-config';
import { previewCelebrationEvent } from '@/lib/celebration';

function inputClassName() {
  return 'body-md w-full rounded-xl border border-primary/60 bg-background px-3 py-2 text-ink-primary outline-none transition focus:border-primary/50';
}

function updateEvent(
  config: CelebrationConfigSnapshot,
  key: CelebrationEventKey,
  patch: Partial<CelebrationEventConfig>,
) {
  return {
    ...config,
    events: {
      ...config.events,
      [key]: {
        ...config.events[key],
        ...patch,
      },
    },
  };
}

export default function CelebrationEventsPage() {
  const [config, setConfig] = useState<CelebrationConfigSnapshot>(
    getDefaultCelebrationConfig(),
  );
  const [savedConfig, setSavedConfig] = useState<CelebrationConfigSnapshot>(
    getDefaultCelebrationConfig(),
  );
  const [hasSaved, setHasSaved] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const sync = async () => {
      const next = await loadCelebrationConfigFromServer();
      setConfig(next);
      setSavedConfig(next);
      setHasSaved(false);
    };

    void sync();
  }, []);

  const handleSave = async () => {
    setIsSaving(true);
    setError('');
    try {
      const next = await saveCelebrationConfig(config);
      setConfig(next);
      setSavedConfig(next);
      setHasSaved(true);
    } catch (saveError) {
      setError(
        saveError instanceof Error ?
          saveError.message
        : 'Failed to save celebration mapping.',
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = async () => {
    setIsSaving(true);
    setError('');
    try {
      const defaults = await resetCelebrationConfig();
      setConfig(defaults);
      setSavedConfig(defaults);
      setHasSaved(false);
    } catch (resetError) {
      setError(
        resetError instanceof Error ?
          resetError.message
        : 'Failed to reset celebration mapping.',
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className='flex flex-col gap-6'>
      <div className='flex flex-col gap-4 md:flex-row md:items-start md:justify-between'>
        <div>
          <h1 className='title-section'>Celebration Event Mapping</h1>
          <p className='body-md mt-2 max-w-3xl text-ink-secondary'>
            Decide which celebration style each product event should use, what
            message it shows by default, and whether a specific event deserves a
            longer or shorter effect than the shared style preset.
          </p>
          <p className='body-sm mt-3 max-w-3xl text-amber-700'>
            Example: if you want Daily Check-in to become Soft Burst, change its
            Style field to Soft Burst here. Editing the Soft Burst style alone
            will not remap Daily Check-in automatically.
          </p>
        </div>
        <div className='flex items-center gap-2'>
          <button
            type='button'
            onClick={handleReset}
            disabled={isSaving}
            className='label inline-flex items-center gap-2 rounded-xl border border-primary/60 bg-background px-3 py-2 transition hover:border-primary/40 hover:text-primary'
          >
            <RotateCcw className='h-4 w-4' />
            Reset Defaults
          </button>
          <button
            type='button'
            onClick={handleSave}
            disabled={isSaving}
            className='label inline-flex items-center gap-2 rounded-xl bg-primary px-3 py-2 text-primary-foreground transition hover:opacity-90'
          >
            <Save className='h-4 w-4' />
            {isSaving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>

      {hasSaved && (
        <div className='rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-700'>
          Celebration event mapping saved.
        </div>
      )}
      {error && (
        <div className='rounded-2xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-700'>
          {error}
        </div>
      )}

      <div className='grid gap-4'>
        {CELEBRATION_EVENT_ORDER.map((key) => {
          const event = config.events[key];
          const linkedStyle = config.styles[event.styleType];
          const savedEvent = savedConfig.events[key];
          const savedStyle = savedConfig.styles[savedEvent.styleType];
          return (
            <div
              key={key}
              className='rounded-[28px] border border-primary/60 bg-panel/60 p-5'
            >
              <div className='mb-4 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between'>
                <div>
                  <div className='inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] text-primary'>
                    <Sparkles className='h-3.5 w-3.5' />
                    {event.label}
                  </div>
                  <p className='body-sm mt-3 max-w-3xl text-ink-secondary'>
                    {event.description}
                  </p>
                  <div className='mt-3 flex flex-wrap items-center gap-2 text-xs'>
                    <span className='rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 font-medium text-emerald-700'>
                      Active now: {savedStyle.label}
                    </span>
                    <span className='rounded-full border border-primary/60 bg-background/70 px-3 py-1 font-medium text-ink-secondary'>
                      Engine key: {savedEvent.styleType}
                    </span>
                    {savedEvent.styleType !== event.styleType && (
                      <span className='rounded-full border border-amber-500/20 bg-amber-500/10 px-3 py-1 font-medium text-amber-700'>
                        Unsaved draft: {linkedStyle.label}
                      </span>
                    )}
                  </div>
                </div>
                <button
                  type='button'
                  onClick={() => previewCelebrationEvent(event, config)}
                  className='label rounded-xl border border-primary/20 bg-primary/5 px-3 py-2 text-primary transition hover:bg-primary/10'
                >
                  Test Event
                </button>
              </div>

              <div className='grid gap-4 md:grid-cols-2 xl:grid-cols-4'>
                <div>
                  <label className='label-sm uppercase tracking-wide text-ink-secondary'>
                    Event Label
                  </label>
                  <input
                    className={inputClassName()}
                    value={event.label}
                    onChange={(entry) =>
                      setConfig((current) =>
                        updateEvent(current, key, {
                          label: entry.target.value,
                        }),
                      )
                    }
                  />
                </div>
                <div>
                  <label className='label-sm uppercase tracking-wide text-ink-secondary'>
                    Style
                  </label>
                  <select
                    className={inputClassName()}
                    value={event.styleType}
                    onChange={(entry) =>
                      setConfig((current) =>
                        updateEvent(current, key, {
                          styleType: entry.target
                            .value as CelebrationEventConfig['styleType'],
                        }),
                      )
                    }
                  >
                    {CELEBRATION_STYLE_ORDER.map((type) => (
                      <option key={type} value={type}>
                        {config.styles[type].label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className='label-sm uppercase tracking-wide text-ink-secondary'>
                    Duration Override
                  </label>
                  <input
                    type='number'
                    min={0}
                    max={5000}
                    className={inputClassName()}
                    value={event.durationMs ?? ''}
                    placeholder={`${linkedStyle.durationMs}`}
                    onChange={(entry) =>
                      setConfig((current) =>
                        updateEvent(current, key, {
                          durationMs:
                            entry.target.value.trim() === '' ?
                              null
                            : Number(entry.target.value),
                        }),
                      )
                    }
                  />
                </div>
                <label className='flex items-center gap-3 rounded-2xl border border-primary/60 bg-background/70 px-4 py-3'>
                  <input
                    type='checkbox'
                    checked={event.enabled}
                    onChange={(entry) =>
                      setConfig((current) =>
                        updateEvent(current, key, {
                          enabled: entry.target.checked,
                        }),
                      )
                    }
                  />
                  <div>
                    <div className='label-sm uppercase tracking-wide text-ink-primary'>
                      Enabled
                    </div>
                    <div className='body-sm text-ink-secondary'>
                      Turn off to suppress celebration for this event.
                    </div>
                  </div>
                </label>
                <div className='md:col-span-2 xl:col-span-4'>
                  <label className='label-sm uppercase tracking-wide text-ink-secondary'>
                    Description
                  </label>
                  <input
                    className={inputClassName()}
                    value={event.description}
                    onChange={(entry) =>
                      setConfig((current) =>
                        updateEvent(current, key, {
                          description: entry.target.value,
                        }),
                      )
                    }
                  />
                </div>
                <div className='md:col-span-2 xl:col-span-4'>
                  <label className='label-sm uppercase tracking-wide text-ink-secondary'>
                    Default Message
                  </label>
                  <input
                    className={inputClassName()}
                    value={event.defaultMessage}
                    onChange={(entry) =>
                      setConfig((current) =>
                        updateEvent(current, key, {
                          defaultMessage: entry.target.value,
                        }),
                      )
                    }
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
