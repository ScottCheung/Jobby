/** @format */

'use client';

import React, { useRef } from 'react';
import {
  History,
  ChevronLeft,
  ChevronRight,
  Trash2,
  Sparkles,
  Search,
} from 'lucide-react';
import { Button } from '@jobby/ui';
import { cn } from '@/lib/utils';
import type { TailoredResume } from '@/lib/api';
import { formatRelativeTime } from '@/lib/use-relative-time';
import { useGlobalModalStore } from '@/lib/store/global-modal-store';
import { TailoredResumeSearchModal } from './TailoredResumeSearchModal';

function documentTypeLabel(item: TailoredResume): string[] {
  const rawAi = item.raw_ai_response as
    | { generated_documents?: { resume?: boolean; cover_letter?: boolean }; cover_letter?: string }
    | undefined;
  const generated = rawAi?.generated_documents;
  const hasCl = Boolean(item.cover_letter || rawAi?.cover_letter || generated?.cover_letter);
  const hasCv = Boolean(item.resume_data && Object.keys(item.resume_data).length > 0) || Boolean(generated?.resume);

  if (hasCv && hasCl) return ['CV', 'CL'];
  if (hasCl) return ['CL'];
  return ['CV'];
}

interface RecentTailorCarouselProps {
  items: TailoredResume[];
  selectedId?: string;
  onSelect: (item: TailoredResume) => void;
  onDelete?: (item: TailoredResume) => void;
  onMore?: () => void;
  className?: string;
}

export function RecentTailorCarousel({
  items,
  selectedId,
  onSelect,
  onDelete,
  onMore,
  className,
}: RecentTailorCarouselProps) {
  const railRef = useRef<HTMLDivElement>(null);
  const openModal = useGlobalModalStore((state) => state.actions.openModal);
  const closeModal = useGlobalModalStore((state) => state.actions.closeModal);

  const scrollRail = (direction: -1 | 1) => {
    if (!railRef.current) return;
    const distance = 280 * direction;
    railRef.current.scrollBy({ left: distance, behavior: 'smooth' });
  };

  const handleOpenSearchModal = () => {
    if (onMore) {
      onMore();
      return;
    }
    openModal({
      layoutId: 'recent-tailor-search-modal',
      className: 'w-[94vw] max-w-2xl h-[80vh] rounded-3xl',
      content: (
        <TailoredResumeSearchModal
          items={items}
          selectedId={selectedId}
          onSelect={onSelect}
          onDelete={onDelete}
          onClose={closeModal}
        />
      ),
      onClose: closeModal,
    });
  };

  if (items.length === 0) {
    return null;
  }

  return (
    <div className={cn('w-full max-w-full min-w-0 flex flex-col gap-2 overflow-hidden', className)}>
      {/* Header */}
      <div className='flex items-center justify-between px-1 w-full min-w-0'>
        <span className='text-xs font-bold uppercase tracking-wider text-ink-secondary flex items-center gap-1.5'>
          <History className='w-4 h-4 text-primary' />
          Recent Tailor ({items.length})
        </span>
        <div className='flex items-center gap-2'>
          <button
            type='button'
            onClick={() => scrollRail(-1)}
            className='flex h-7.5 w-7.5 items-center justify-center rounded-lg border border-primary/20 text-ink-secondary transition hover:border-primary hover:bg-primary/10 hover:text-primary cursor-pointer'
            aria-label='Scroll previous tailored'
          >
            <ChevronLeft className='h-4 w-4' />
          </button>
          <button
            type='button'
            onClick={() => scrollRail(1)}
            className='flex h-7.5 w-7.5 items-center justify-center rounded-lg border border-primary/20 text-ink-secondary transition hover:border-primary hover:bg-primary/10 hover:text-primary cursor-pointer'
            aria-label='Scroll next tailored'
          >
            <ChevronRight className='h-4 w-4' />
          </button>
          <Button
            type='button'
            layoutId='recent-tailor-search-modal'
            onClick={handleOpenSearchModal}
            size='sm'
            variant='default'
            className='!h-7.5 !px-3.5 !text-xs font-bold shadow-xs'
          >
            More
          </Button>
        </div>
      </div>

      {/* Horizontal Rail */}
      <div className='relative w-full max-w-full min-w-0 overflow-hidden'>
        <div
          ref={railRef}
          className='w-full max-w-full min-w-0 flex items-stretch gap-3 overflow-x-auto pb-2 pt-0.5 no-scrollbar scroll-smooth'
        >
          {items.map((item) => {
            const isSelected = item.id === selectedId;
            const isProcessing = item.status === 'processing';
            const timeAgo = isProcessing ? 'Generating' : formatRelativeTime(item.created_at);
            const docLabels = documentTypeLabel(item);

            return (
              <div
                key={item.id}
                onClick={() => onSelect(item)}
                className={cn(
                  'group/history relative shrink-0 w-[180px] min-h-[92px] p-3 rounded-2xl text-left transition-all duration-200 cursor-pointer flex flex-col gap-1.5 select-none',
                  isSelected ?
                    'bg-panel border-2 border-primary shadow-md'
                  : 'bg-panel/70 border border-primary/15 hover:border-primary/50 hover:bg-panel hover:-translate-y-0.5',
                )}
              >
                {/* Delete button on hover */}
                {onDelete && !isProcessing && (
                  <button
                    type='button'
                    onClick={(e) => {
                      e.stopPropagation();
                      onDelete(item);
                    }}
                    className='absolute top-2 right-2 z-10 opacity-0 group-hover/history:opacity-100 p-1 rounded-md text-ink-secondary hover:text-red-500 hover:bg-red-500/10 transition-all cursor-pointer'
                    title='Delete record'
                    aria-label={`Delete record for ${item.job_title || item.company}`}
                  >
                    <Trash2 className='w-3.5 h-3.5' />
                  </button>
                )}

                {/* Job Title */}
                <div className='w-full min-w-0 pr-4'>
                  <span className='text-[10px] font-bold leading-tight line-clamp-1 text-primary'>
                    {item.job_title || 'Tailored Role'}
                  </span>
                </div>

                {/* Company Name */}
                <div className='w-full min-w-0'>
                  <p className='text-xs text-ink-primary font-bold leading-tight line-clamp-1 break-words'>
                    {item.company || 'Job Application'}
                  </p>
                </div>

                {/* Badges */}
                <div className='flex items-center gap-1.5 mt-auto pt-1'>
                  {isProcessing ? (
                    <span className='inline-flex items-center gap-1 text-[9px] font-bold text-primary'>
                      <Sparkles className='w-2.5 h-2.5 animate-spin' />
                      AI Working...
                    </span>
                  ) : (
                    docLabels.map((type, idx) => (
                      <span
                        key={idx}
                        className='text-[8px] bg-primary text-white rounded-md px-1.5 py-0.5 font-extrabold uppercase tracking-wide shadow-2xs'
                      >
                        {type}
                      </span>
                    ))
                  )}
                  <span className='ml-auto text-[9px] text-ink-secondary font-medium'>
                    {timeAgo}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
