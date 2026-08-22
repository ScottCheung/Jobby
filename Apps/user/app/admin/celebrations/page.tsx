/** @format */

'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { RotateCcw, Save, Sparkles } from 'lucide-react';
import {
  CELEBRATION_EVENT_ORDER,
  CELEBRATION_STYLE_ORDER,
  getDefaultCelebrationConfig,
  loadCelebrationConfigFromServer,
  resetCelebrationConfig,
  saveCelebrationConfig,
  type CelebrationConfigSnapshot,
  type CelebrationStyleConfig,
  type CelebrationType,
} from '@/lib/celebration-config';
import { previewCelebrationStyle } from '@/lib/celebration';

function inputClassName() {
  return 'body-md w-full rounded-xl border border-primary/60 bg-background px-3 py-2 text-ink-primary outline-none transition focus:border-primary/50';
}

function labelClassName() {
  return 'label-sm uppercase tracking-wide text-ink-secondary';
}

function updateStyle(
  config: CelebrationConfigSnapshot,
  type: CelebrationType,
  patch: Partial<CelebrationStyleConfig>,
) {
  return {
    ...config,
    styles: {
      ...config.styles,
      [type]: {
        ...config.styles[type],
        ...patch,
      },
    },
  };
}

export default function CelebrationStylesPage() {
  const [config, setConfig] = useState<CelebrationConfigSnapshot>(
    getDefaultCelebrationConfig(),
  );
  const [hasLoaded, setHasLoaded] = useState(false);
  const [hasSaved, setHasSaved] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const sync = async () => {
      setConfig(await loadCelebrationConfigFromServer());
      setHasLoaded(true);
      setHasSaved(false);
    };

    void sync();
  }, []);

  const handleSave = async () => {
    setIsSaving(true);
    setError('');
    try {
      setConfig(await saveCelebrationConfig(config));
      setHasSaved(true);
    } catch (saveError) {
      setError(
        saveError instanceof Error ?
          saveError.message
        : 'Failed to save celebration styles.',
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = async () => {
    setIsSaving(true);
    setError('');
    try {
      setConfig(await resetCelebrationConfig());
      setHasSaved(false);
    } catch (resetError) {
      setError(
        resetError instanceof Error ?
          resetError.message
        : 'Failed to reset celebration styles.',
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className='flex flex-col gap-6'>
      <div className='flex flex-col gap-4 md:flex-row md:items-start md:justify-between'>
        <div>
          <h1 className='title-section'>Global Celebration Styles</h1>
          <p className='body-md mt-2 max-w-3xl text-ink-secondary'>
            Control how much screen space the celebration layer uses, how long
            it stays, and how strong each particle effect feels. The effect no
            longer adds any full-screen blur or global overlay, so the page
            stays visible and interactive underneath.
          </p>
          <p className='body-sm mt-3 max-w-3xl text-amber-700'>
            Changing a style only updates events already linked to that style.
            If you want Daily Check-in to use Soft Burst, switch that event to
            Soft Burst in Celebration Events.
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

      {hasLoaded && hasSaved && (
        <div className='rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-700'>
          Celebration styles saved.
        </div>
      )}
      {error && (
        <div className='rounded-2xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-700'>
          {error}
        </div>
      )}

      <div className='grid gap-4 xl:grid-cols-2'>
        {CELEBRATION_STYLE_ORDER.map((type) => {
          const style = config.styles[type];
          const linkedEvents = CELEBRATION_EVENT_ORDER.map(
            (eventKey) => config.events[eventKey],
          ).filter((event) => event.styleType === type);
          return (
            <div
              key={type}
              className='rounded-[28px] border border-primary/60 bg-panel/60 p-5'
            >
              <div className='mb-5 flex items-start justify-between gap-4'>
                <div>
                  <div className='inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] text-primary'>
                    <Sparkles className='h-3.5 w-3.5' />
                    {style.label}
                  </div>
                  <p className='body-sm mt-3 max-w-xl text-ink-secondary'>
                    {style.description}
                  </p>
                </div>
                <button
                  type='button'
                  onClick={() =>
                    previewCelebrationStyle(style, `${style.label} preview`)
                  }
                  className='label rounded-xl border border-primary/20 bg-primary/5 px-3 py-2 text-primary transition hover:bg-primary/10'
                >
                  Test Effect
                </button>
              </div>

              <div className='mb-5 rounded-2xl border border-primary/60 bg-background/70 p-4'>
                <div className='flex items-center justify-between gap-3'>
                  <div>
                    <div className='label-sm uppercase tracking-wide text-ink-primary'>
                      Linked Events
                    </div>
                    <div className='body-sm mt-1 text-ink-secondary'>
                      {linkedEvents.length > 0 ?
                        `${linkedEvents.length} events currently use this style.`
                      : 'No events currently use this style.'}
                    </div>
                  </div>
                  <Link
                    href='/admin/celebration-events'
                    className='label rounded-xl border border-primary/20 bg-primary/5 px-3 py-2 text-primary transition hover:bg-primary/10'
                  >
                    Edit Mapping
                  </Link>
                </div>
                {linkedEvents.length > 0 && (
                  <div className='mt-3 flex flex-wrap gap-2'>
                    {linkedEvents.map((event) => (
                      <span
                        key={event.key}
                        className='rounded-full border border-primary/60 bg-panel px-3 py-1 text-xs font-medium text-ink-secondary'
                      >
                        {event.label}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <div className='grid gap-4 md:grid-cols-2'>
                <div>
                  <label className={labelClassName()}>Style Label</label>
                  <input
                    className={inputClassName()}
                    value={style.label}
                    onChange={(event) =>
                      setConfig((current) =>
                        updateStyle(current, type, {
                          label: event.target.value,
                        }),
                      )
                    }
                  />
                </div>
                <div>
                  <label className={labelClassName()}>Duration (ms)</label>
                  <input
                    type='number'
                    min={900}
                    max={5000}
                    className={inputClassName()}
                    value={style.durationMs}
                    onChange={(event) =>
                      setConfig((current) =>
                        updateStyle(current, type, {
                          durationMs: Number(event.target.value || 0),
                        }),
                      )
                    }
                  />
                </div>
                <div className='md:col-span-2'>
                  <label className={labelClassName()}>Description</label>
                  <input
                    className={inputClassName()}
                    value={style.description}
                    onChange={(event) =>
                      setConfig((current) =>
                        updateStyle(current, type, {
                          description: event.target.value,
                        }),
                      )
                    }
                  />
                </div>
                <div>
                  <label className={labelClassName()}>Particle Strength</label>
                  <input
                    type='range'
                    min={0.3}
                    max={2.5}
                    step={0.1}
                    value={style.particleMultiplier}
                    onChange={(event) =>
                      setConfig((current) =>
                        updateStyle(current, type, {
                          particleMultiplier: Number(event.target.value),
                        }),
                      )
                    }
                    className='mt-3 w-full'
                  />
                  <div className='body-sm mt-1 text-ink-secondary'>
                    {style.particleMultiplier.toFixed(1)}x
                  </div>
                </div>
                <div>
                  <label className={labelClassName()}>
                    Message Panel Opacity
                  </label>
                  <input
                    type='range'
                    min={35}
                    max={100}
                    value={style.panelOpacity}
                    onChange={(event) =>
                      setConfig((current) =>
                        updateStyle(current, type, {
                          panelOpacity: Number(event.target.value),
                        }),
                      )
                    }
                    className='mt-3 w-full'
                  />
                  <div className='body-sm mt-1 text-ink-secondary'>
                    {style.panelOpacity}%
                  </div>
                </div>
                <label className='flex items-center gap-3 rounded-2xl border border-primary/60 bg-background/70 px-4 py-3 md:col-span-2'>
                  <input
                    type='checkbox'
                    checked={style.panelEnabled}
                    onChange={(event) =>
                      setConfig((current) =>
                        updateStyle(current, type, {
                          panelEnabled: event.target.checked,
                        }),
                      )
                    }
                  />
                  <div>
                    <div className='label-sm uppercase tracking-wide text-ink-primary'>
                      Show message panel
                    </div>
                    <div className='body-sm text-ink-secondary'>
                      Turn this off for light-touch celebrations that should not
                      cover the content.
                    </div>
                  </div>
                </label>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
