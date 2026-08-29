/** @format */

'use client';

import React from 'react';
import { MapPin, Globe, X } from 'lucide-react';

interface HeaderProps {
  platform?: string | null;
  jobId?: string | null;
  title?: string | null;
  company?: string | null;
  workLocation?: string | null;
  jobLink?: string | null;
  onClose: () => void;
}

export function Header({
  platform,
  jobId,
  title,
  company,
  workLocation,
  jobLink,
  onClose,
}: HeaderProps) {
  return (
    <div className='flex items-start justify-between '>
      <div className='min-w-0 pr-4'>
        <div className='flex items-center gap-2 flex-wrap'>
          {platform && (
            <span className='text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-ink-primary/10 text-ink-primary/70 shrink-0'>
              {platform}
            </span>
          )}
          {jobId && (
            <span className='text-[9px] px-1 py-0.5 rounded bg-ink-primary/10 text-ink-primary/70 font-mono shrink-0'>
              ID: {jobId}
            </span>
          )}
        </div>

        <h2
          className='title-card text-ink-primary mt-2 truncate'
          title={title || 'Untitled Role'}
        >
          {title || 'Untitled Role'}
        </h2>
        <div className='label flex items-center gap-1.5 text-ink-secondary mt-1 flex-wrap'>
          <span>{company || 'Unknown Company'}</span>
          {workLocation && (
            <>
              <span className='text-border'>•</span>
              <span className='body-sm inline-flex items-center gap-1'>
                <MapPin className='w-3.5 h-3.5' />
                {workLocation}
              </span>
            </>
          )}
        </div>
      </div>
      <div className='flex items-center gap-2 shrink-0'>
        {jobLink && (
          <a
            href={jobLink}
            target='_blank'
            rel='noopener noreferrer'
            className='p-2 rounded-xl text-ink-secondary hover:text-ink-primary hover:bg-glass transition-colors'
            title='Open job posting link'
          >
            <Globe className='w-4 h-4' />
          </a>
        )}
        <button
          onClick={onClose}
          className='p-2 rounded-xl text-ink-secondary hover:text-ink-primary hover:bg-glass transition-colors'
        >
          <X className='w-4 h-4' />
        </button>
      </div>
    </div>
  );
}
