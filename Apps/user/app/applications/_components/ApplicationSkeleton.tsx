/** @format */

'use client';

import React from 'react';

interface ApplicationSkeletonProps {
  style?: React.CSSProperties;
}

export const ApplicationSkeleton = React.memo(
  function ApplicationSkeleton({ style }: ApplicationSkeletonProps) {
    return (
      <div
        style={style}
        className='grid grid-cols-[minmax(0,3.5fr)_minmax(0,2fr)_minmax(0,2.5fr)_minmax(0,1.3fr)_minmax(0,1.2fr)] items-center px-4 animate-text-shimmer-primary animate-text-shimmer'
      >
        <div className='pr-4'>
          <div className='h-3 bg-ink-secondary/50 rounded w-3/4 mb-2'></div>
          <div className='h-4 bg-ink-secondary/50 rounded w-1/2'></div>
        </div>
        <div className='px-4'>
          <div className='h-4 bg-ink-secondary/50 rounded w-1/2'></div>
        </div>
        <div className='px-4'>
          <div className='h-4 bg-ink-secondary/50 rounded w-1/3'></div>
        </div>
        <div className='px-4'>
          <div className='h-3 bg-ink-secondary/50 rounded w-1/4'></div>
        </div>
        <div className='pl-4'>
          <div className='inline-flex gap-1.5 justify-end w-full'>
            <div className='w-8 h-8 rounded-lg bg-ink-secondary/50'></div>
            <div className='w-8 h-8 rounded-lg bg-ink-secondary/50'></div>
            <div className='w-8 h-8 rounded-lg bg-ink-secondary/50'></div>
            <div className='w-8 h-8 rounded-lg bg-ink-secondary/50'></div>
          </div>
        </div>
      </div>
    );
  },
  (prevProps, nextProps) => {
    return (
      prevProps.style?.top === nextProps.style?.top &&
      prevProps.style?.height === nextProps.style?.height &&
      prevProps.style?.width === nextProps.style?.width
    );
  },
);
