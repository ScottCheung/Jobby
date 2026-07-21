import React from 'react';
import { Check, CopyPlus } from 'lucide-react';
import type { JobHuntingProfile } from '@/lib/types';
import { cn } from '@/lib/utils';
import { summarizeJobHuntingProfile } from './summary-cards';

interface ProfileSidebarProps {
  profiles: JobHuntingProfile[];
  selectedId: string;
  onSelect: (id: string) => void;
  onCreate: () => Promise<void>;
}

export function ProfileSidebar({
  profiles,
  selectedId,
  onSelect,
  onCreate,
}: ProfileSidebarProps) {
  return (
    <aside className='rounded-2xl border border-border/60 bg-panel p-4 flex flex-col min-h-0'>
      <div className='flex items-start justify-between gap-3'>
        <div>
          <h2 className='title-sub'>
            Job Hunting Profiles
          </h2>
          <p className='body-md mt-1 text-ink-secondary'>
            Choose the profile that defines what to search for, what to skip,
            and which resume version to use next.
          </p>
        </div>
        <button
          type='button'
          className='inline-flex h-9 w-9 items-center justify-center rounded-xl border border-border/60 bg-background-secondary/50 dark:bg-panel/40 text-ink-secondary hover:text-ink-primary cursor-pointer'
          onClick={() => void onCreate()}
          title='Create a new search profile'
        >
          <CopyPlus className='h-4 w-4' />
        </button>
      </div>

      <div className='mt-4 flex-1 overflow-y-auto space-y-2 pr-1'>
        {profiles.map((profile) => {
          const isSelected = profile.id === selectedId;
          const profileSummary = summarizeJobHuntingProfile(profile);
          return (
            <button
              key={profile.id}
              type='button'
              onClick={() => onSelect(profile.id ?? '')}
              className={cn(
                'w-full rounded-2xl border px-4 py-3 text-left transition-colors cursor-pointer',
                isSelected ?
                  'border-zinc-900 dark:border-zinc-100 bg-secondary text-white dark:bg-background-secondary dark:text-ink-primary'
                : 'border-border/60 bg-zinc-50/60 dark:bg-panel/40 text-ink-primary hover:border-zinc-400 dark:hover:border-zinc-700',
              )}
            >
              <div className='flex items-center justify-between gap-2'>
                <div className='min-w-0'>
                  <div className='label truncate'>
                    {profile.name || 'Untitled profile'}
                  </div>
                  <div
                    className={cn(
                      'body-sm mt-1 truncate',
                      isSelected ?
                        'text-white/70 dark:text-zinc-700'
                      : 'text-ink-secondary',
                    )}
                  >
                    {profile.search_location || 'No location'}
                  </div>
                </div>
                {profile.is_default && (
                  <span
                    className={cn(
                      'inline-flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-semibold uppercase tracking-wider',
                      isSelected ?
                        'bg-white/15 text-white dark:bg-panel/10 dark:text-ink-primary'
                      : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
                    )}
                  >
                    <Check className='h-3 w-3' />
                    Running
                  </span>
                )}
              </div>
              <div
                className={cn(
                  'mt-3 grid grid-cols-2 gap-2 text-[11px]',
                  isSelected ?
                    'text-white/70 dark:text-zinc-700'
                  : 'text-ink-secondary',
                )}
              >
                <span>{profileSummary.searchTermsCount} keywords</span>
                <span>{profileSummary.switchNumber} / keyword</span>
              </div>
            </button>
          );
        })}
      </div>
    </aside>
  );
}
