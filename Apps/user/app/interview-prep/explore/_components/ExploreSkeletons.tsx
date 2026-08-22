/** @format */

'use client';

import { cn } from '@/lib/utils';

export function QuestionCardSkeleton({
  compact = false,
}: {
  compact?: boolean;
}) {
  return (
    <div
      className={cn(
        'animate-pulse rounded-xl border border-primary/50 bg-background-secondary/35 p-4',
        compact ? 'min-h-[154px]' : 'min-h-[190px]',
      )}
    >
      <div className='h-3 w-20 rounded bg-border/60' />
      <div className='mt-4 h-4 w-full rounded bg-border/60' />
      <div className='mt-2 h-4 w-4/5 rounded bg-border/60' />
      <div className='mt-8 flex items-center justify-between'>
        <div className='h-5 w-14 rounded bg-border/60' />
        <div className='h-8 w-20 rounded-md bg-border/60' />
      </div>
    </div>
  );
}

export function CollectionCardSkeleton() {
  return (
    <div className='min-h-[360px] animate-pulse rounded-2xl border border-primary/50 bg-background-secondary/35 p-4'>
      <div className='aspect-[16/9] rounded-xl bg-border/60' />
      <div className='mt-4 h-4 w-3/4 rounded bg-border/60' />
      <div className='mt-3 h-3 w-full rounded bg-border/60' />
      <div className='mt-2 h-3 w-5/6 rounded bg-border/60' />
      <div className='mt-6 h-9 w-full rounded-xl bg-border/60' />
    </div>
  );
}
