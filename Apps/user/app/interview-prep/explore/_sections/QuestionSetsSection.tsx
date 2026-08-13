/** @format */

'use client';
import { CardWithNorth, EmptyPlaceHolder } from '@jobby/ui';

import { BookOpen, Search } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { InterviewCategory, InterviewCollection } from '@/lib/types';

import { ScrollableContainer } from '@/components/layout/ScrollableContainer';
import { cn } from '@/lib/utils';
import {
  getInterviewCategoryIcon,
  getInterviewCategoryLabel,
} from '@/lib/interview-categories';
import { CollectionCard } from '../../collections/_components/CollectionCard';
import { CollectionCardSkeleton } from '../_components/ExploreSkeletons';

import { div } from 'framer-motion/client';

type CollectionSource = 'featured' | 'official' | 'community' | 'mine';

const sources: Array<{ id: CollectionSource; label: string }> = [
  { id: 'featured', label: 'Featured' },
  { id: 'official', label: 'Official' },
  { id: 'community', label: 'Community' },
  { id: 'mine', label: 'My sets' },
];

type QuestionSetsSectionProps = {
  searchQuery: string;
  activeTheme: string;
  categories: InterviewCategory[];
  onSelectTheme: (theme: string) => void;
  matchingSets: InterviewCollection[];
  officialSets: InterviewCollection[];
  communitySets: InterviewCollection[];
  personalSets: InterviewCollection[];
  archivedSets: InterviewCollection[];
  isLoading: boolean;
  lastLoginAt: string | null;
  activeId: string | null;
  currentUserId?: string | null;
  onFollow: (collection: InterviewCollection) => void;
  onUnfollow: (collection: InterviewCollection) => void;
  onEdit: (collection: InterviewCollection) => void;
  onDelete: (collection: InterviewCollection) => void;
  onRestore: (collection: InterviewCollection) => void;
};

export function QuestionSetsSection({
  searchQuery,
  activeTheme,
  categories,
  onSelectTheme,
  matchingSets,
  officialSets,
  communitySets,
  personalSets,
  archivedSets,
  isLoading,
  lastLoginAt,
  activeId,
  currentUserId,
  onFollow,
  onUnfollow,
  onEdit,
  onDelete,
  onRestore,
}: QuestionSetsSectionProps) {
  const [source, setSource] = useState<CollectionSource>('featured');
  const visibleSets = useMemo(() => {
    if (source === 'official') return officialSets;
    if (source === 'community') return communitySets;
    if (source === 'mine') return [...personalSets, ...archivedSets];
    return matchingSets;
  }, [
    archivedSets,
    communitySets,
    matchingSets,
    officialSets,
    personalSets,
    source,
  ]);

  return (
    <section id='sets' className='scroll-mt-5'>
      <CardWithNorth title='Question Sets' contentClassName='p-5'>
        <div className=' gap-5  min-h-90vh h-screen col'>
          <div className='flex flex-col  gap-4 xl:flex-row xl:items-center xl:justify-between'>
            <div>
              <p className='body-sm text-ink-secondary'>
                Browse a single source at a time, then follow the sets you want
                in your Library.
              </p>
              {searchQuery.trim() && (
                <p className='mt-1 flex items-center gap-1.5 text-xs font-medium text-primary'>
                  <Search className='h-3.5 w-3.5' />
                  Matching “{searchQuery.trim()}”
                </p>
              )}
            </div>
            <div
              role='tablist'
              aria-label='Question Set source'
              className='inline-flex self-start  rounded-lg border border-border/60 bg-background-secondary/60 p-0.5'
            >
              {sources.map((item) => (
                <button
                  key={item.id}
                  type='button'
                  role='tab'
                  aria-selected={source === item.id}
                  onClick={() => setSource(item.id)}
                  className={cn(
                    'rounded-md px-2 py-1 text-[11px] font-semibold transition-colors',
                    source === item.id ?
                      'bg-primary text-primary-foreground shadow-xs'
                    : 'text-ink-secondary hover:text-ink-primary',
                  )}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          <div className='grid grid-cols-2 gap-3 border-y border-border/40 py-4 sm:grid-cols-3 xl:grid-cols-5'>
            {categories.map((category) => {
              const theme = getInterviewCategoryLabel(category);
              const Icon = getInterviewCategoryIcon(category, BookOpen);
              const isActive = activeTheme === theme;
              return (
                <button
                  key={category.id}
                  type='button'
                  onClick={() => onSelectTheme(isActive ? 'All' : theme)}
                  className={cn(
                    isActive ? 'select-card-active' : 'select-card',
                  )}
                >
                  <span
                    className={cn(
                      'mb-3 inline-flex h-8 w-8 items-center justify-center rounded-lg',
                      isActive ?
                        'bg-primary text-primary-foreground'
                      : 'bg-background-secondary text-ink-secondary',
                    )}
                  >
                    <Icon className='h-4 w-4' />
                  </span>
                  <span className='block text-sm font-bold'>{theme}</span>
                  <span className='mt-1 block text-xs text-ink-secondary'>
                    Focused Question Sets
                  </span>
                </button>
              );
            })}
          </div>

          {isLoading ?
            <div className='grid grid-flow-col auto-cols-[280px] gap-4 overflow-hidden sm:auto-cols-[320px] lg:auto-cols-[380px]'>
              {Array.from({ length: 3 }, (_, index) => (
                <CollectionCardSkeleton key={index} />
              ))}
            </div>
          : visibleSets.length === 0 ?
            <EmptyPlaceHolder
              message={
                source === 'mine' ?
                  'Create a Question Set to keep your interview practice organised.'
                : 'No Question Sets match these filters yet.'
              }
            />
          : <ScrollableContainer>
              {visibleSets.map((collection) => (
                <CollectionCard
                  key={collection.id}
                  collection={collection}
                  onAdd={onFollow}
                  onRemove={onUnfollow}
                  isLoading={activeId === collection.id}
                  currentUserId={currentUserId}
                  onEdit={onEdit}
                  onDelete={onDelete}
                  onRestore={onRestore}
                />
              ))}
            </ScrollableContainer>
          }

          {source === 'mine' && archivedSets.length > 0 && (
            <p className='flex items-center gap-1.5 text-xs h-full text-ink-secondary'>
              <BookOpen className='h-3.5 w-3.5' />
              Archived sets are included here and can be restored from their
              card.
            </p>
          )}
        </div>
      </CardWithNorth>
    </section>
  );
}
