/** @format */

'use client';
import React from 'react';

export function PracticeSkeleton() {
  return (
    <div className='grid grid-cols-2 gap-4 h-full overflow-hidden'>
      {/* ── Left Column ── */}
      <div className='panel-xl flex flex-col gap-4 overflow-hidden relative h-full '>
        {/* Header Skeleton */}
        <div className='flex items-center justify-between  dark:border-border/60  shrink-0'>
          <div className='h-3 skeleton rounded w-1/3 '></div>

          <div className='flex gap-2'>
            <div className='h-8 w-8 skeleton rounded-lg'></div>
            <div className='h-8 w-8 skeleton rounded-lg'></div>
            <div className='h-8 w-8 skeleton rounded-lg'></div>
            <div className='h-8 w-8 skeleton rounded-lg'></div>
            <div className='h-8 w-8 skeleton rounded-lg'></div>
          </div>
        </div>
        <div className='h-6 skeleton rounded w-1/2 -mt-3'></div>
        <div className='h-3 skeleton rounded w-1/3 -mt-2'></div>
        {/* Content Skeletons */}
        <div className='flex-1 mt-3 flex flex-col gap-4 overflow-y-auto pr-1'>
          {/* Card 1 */}
          <div className='rounded-3xl p-6 skeleton flex flex-col gap-4'>
            <div className='h-4 skeleton rounded w-1/4'></div>
            <div className='h-16 skeleton rounded-xl w-full'></div>
          </div>
          {/* Card 2 */}
          <div className='rounded-3xl p-6 skeleton flex flex-col gap-4'>
            <div className='h-4 skeleton rounded w-1/4'></div>
            <div className='h-32 skeleton rounded-xl w-full'></div>
          </div>
        </div>
      </div>

      {/* ── Right Column ── */}
      <div className='panel-xl flex flex-col overflow-hidden '>
        {/* Tab Header Skeleton */}
        <div className='flex   shrink-0'>
          <div className='flex-1 py-3 flex justify-center'>
            <div className='h-6 skeleton rounded w-1/3'></div>
          </div>
          <div className='flex-1 py-3 flex justify-center'>
            <div className='h-6 skeleton rounded w-1/3'></div>
          </div>
        </div>
        {/* Workspace Skeleton */}
        <div className='flex-1 p-6 flex flex-col gap-4'>
          <div className='h-4 skeleton rounded w-1/4 mb-4'></div>
          <div className='flex-1 skeleton rounded-2xl p-6 flex flex-col gap-4 items-center justify-center border border-dashed border-border dark:border-border/60'>
            <div className='w-16 h-16 rounded-full skeleton'></div>
            <div className='h-4 skeleton rounded w-1/3'></div>
            <div className='h-3 skeleton rounded w-1/2'></div>
          </div>
        </div>
      </div>
    </div>
  );
}
