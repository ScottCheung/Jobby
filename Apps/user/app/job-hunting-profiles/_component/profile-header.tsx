import React from 'react';
import { Pencil, Play, Save, Trash2, X } from 'lucide-react';
import { SegmentedControl } from '@/components/UI/segmented-control';
import type { JobHuntingProfile } from '@/lib/types';

type SearchSection = 'overview' | 'filters' | 'rules' | 'application';

interface ProfileHeaderProps {
  profile: JobHuntingProfile | undefined;
  profilesCount: number;
  isEditing: boolean;
  isSaving: boolean;
  activeSection: SearchSection;
  onChangeSection: (section: SearchSection) => void;
  onActivate: () => Promise<void>;
  onDelete: () => Promise<void>;
  onEdit: () => void;
  onCancel: () => void;
  onSave: () => Promise<void>;
}

export function ProfileHeader({
  profile,
  profilesCount,
  isEditing,
  isSaving,
  activeSection,
  onChangeSection,
  onActivate,
  onDelete,
  onEdit,
  onCancel,
  onSave,
}: ProfileHeaderProps) {
  const sectionOptions = [
    { value: 'overview', label: 'Overview' },
    { value: 'application', label: 'Application' },
    { value: 'filters', label: 'Filters' },
    { value: 'rules', label: 'Rules' },
  ];

  return (
    <div className='sticky top-0 z-10 border-b border-border/60 bg-panel/95 backdrop-blur-md px-6 py-5'>
      <div className='flex flex-col gap-4'>
        <div className='flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between'>
          <div>
            <div className='flex items-center gap-2'>
              <h1 className='text-xl font-semibold text-ink-primary'>
                {profile?.name || 'Search Profile'}
              </h1>
              {profile?.is_default && (
                <span className='inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400'>
                  <Play className='h-3 w-3' />
                  Active run profile
                </span>
              )}
            </div>
            <p className='mt-1 text-sm text-ink-secondary'>
              {profile?.search_location || 'No search location selected'}
            </p>
          </div>

          <div className='flex flex-wrap items-center gap-2'>
            {!profile?.is_default && profile?.id && (
              <button
                type='button'
                className='inline-flex items-center gap-2 rounded-xl border border-border/60 px-3.5 py-2 text-sm font-medium text-ink-primary hover:bg-background-secondary cursor-pointer'
                onClick={() => void onActivate()}
              >
                <Play className='h-4 w-4' />
                Use for runs
              </button>
            )}

            {profile?.id &&
              profilesCount > 1 &&
              !isEditing && (
                <button
                  type='button'
                  className='inline-flex items-center gap-2 rounded-xl border border-border/60 px-3.5 py-2 text-sm font-medium text-ink-primary hover:bg-background-secondary cursor-pointer'
                  onClick={() => void onDelete()}
                >
                  <Trash2 className='h-4 w-4' />
                  Delete
                </button>
              )}

            {isEditing ?
              <>
                <button
                  type='button'
                  className='inline-flex items-center gap-2 rounded-xl border border-border/60 px-3.5 py-2 text-sm font-medium text-ink-primary hover:bg-background-secondary cursor-pointer'
                  onClick={onCancel}
                >
                  <X className='h-4 w-4' />
                  Cancel
                </button>
                <button
                  type='button'
                  className='inline-flex items-center gap-2 rounded-xl bg-secondary px-3.5 py-2 text-sm font-medium text-white dark:bg-background-secondary dark:text-ink-primary cursor-pointer disabled:opacity-60'
                  onClick={() => void onSave()}
                  disabled={isSaving}
                >
                  <Save className='h-4 w-4' />
                  {isSaving ? 'Saving...' : 'Save profile'}
                </button>
              </>
            : <button
                type='button'
                className='inline-flex items-center gap-2 rounded-xl bg-secondary px-3.5 py-2 text-sm font-medium text-white dark:bg-background-secondary dark:text-ink-primary cursor-pointer'
                onClick={onEdit}
              >
                <Pencil className='h-4 w-4' />
                Edit
              </button>
            }
          </div>
        </div>

        <div className='flex flex-wrap items-center gap-3'>
          <SegmentedControl
            value={activeSection}
            onChange={(next) => onChangeSection(next as SearchSection)}
            options={sectionOptions}
            className='mx-0'
          />
        </div>
      </div>
    </div>
  );
}
