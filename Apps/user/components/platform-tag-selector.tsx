/** @format */

'use client';

import React from 'react';
import { CircleCheck } from 'lucide-react';

export const supportedJobPlatforms = [
  { id: 'seek', label: 'SEEK', mark: 'S', color: '#0d3880' },
  { id: 'linkedin', label: 'LinkedIn', mark: 'in', color: '#0a66c2' },
  { id: 'indeed', label: 'Indeed', mark: 'i', color: '#2164f3' },
  { id: 'glassdoor', label: 'Glassdoor', mark: 'G', color: '#0caa41' },
  { id: 'workday', label: 'Workday', mark: 'W', color: '#f58220' },
  { id: 'greenhouse', label: 'Greenhouse', mark: 'G', color: '#24a47f' },
  { id: 'lever', label: 'Lever', mark: 'L', color: '#1d8cff' },
  { id: 'ashby', label: 'Ashby', mark: 'A', color: '#5c5ce2' },
  { id: 'smartrecruiters', label: 'SmartRecruiters', mark: 'S', color: '#2a9d8f' },
  { id: 'taleo', label: 'Taleo', mark: 'T', color: '#e02222' },
  { id: 'icims', label: 'iCIMS', mark: 'i', color: '#6b4aa1' },
  { id: 'successfactors', label: 'SuccessFactors', mark: 'S', color: '#0070f2' },
  { id: 'oracle', label: 'Oracle', mark: 'O', color: '#c74634' },
  { id: 'workable', label: 'Workable', mark: 'W', color: '#2c3e7f' },
  { id: 'bamboohr', label: 'BambooHR', mark: 'B', color: '#78a22f' },
  { id: 'jora', label: 'Jora', mark: 'J', color: '#15a449' },
  { id: 'ziprecruiter', label: 'ZipRecruiter', mark: 'Z', color: '#1f8435' },
  { id: 'adzuna', label: 'Adzuna', mark: 'A', color: '#1e88e5' },
  { id: 'wellfound', label: 'Wellfound', mark: 'W', color: '#141413' },
  { id: 'dice', label: 'Dice', mark: 'D', color: '#e01a22' },
  { id: 'simplyhired', label: 'SimplyHired', mark: 'S', color: '#205493' },
  { id: 'careerone', label: 'CareerOne', mark: 'C', color: '#f26522' },
  { id: 'micro1', label: 'micro1', mark: 'm', color: '#6366f1' },
] as const;

const platformDomains: Record<string, string> = {
  seek: 'seek.com.au', linkedin: 'linkedin.com', indeed: 'indeed.com', glassdoor: 'glassdoor.com', workday: 'workday.com', greenhouse: 'greenhouse.io', lever: 'lever.co', ashby: 'ashbyhq.com', smartrecruiters: 'smartrecruiters.com', taleo: 'taleo.net', icims: 'icims.com', successfactors: 'successfactors.com', oracle: 'oracle.com', workable: 'workable.com', bamboohr: 'bamboohr.com', jora: 'jora.com', ziprecruiter: 'ziprecruiter.com', adzuna: 'adzuna.com.au', wellfound: 'wellfound.com', dice: 'dice.com', simplyhired: 'simplyhired.com.au', careerone: 'careerone.com.au', micro1: 'micro1.ai',
};

export function PlatformTagSelector({
  selected,
  onChange,
}: {
  selected: string[];
  onChange: (platform: string) => void;
}) {
  return (
    <div className='flex flex-wrap gap-1.5'>
      {supportedJobPlatforms.map((platform) => {
        const active = selected.includes(platform.id);
        return (
          <button
            key={platform.id}
            type='button'
            onClick={() => onChange(platform.id)}
            className={`inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium transition-all ${
              active
                ? 'shadow-2xs font-semibold'
                : 'bg-panel text-ink-secondary border border-border/50 hover:border-border hover:text-ink-primary'
            }`}
            style={
              active
                ? {
                    backgroundColor: `${platform.color}15`,
                    color: platform.color,
                    border: `1px solid ${platform.color}40`,
                  }
                : undefined
            }
          >
            <img
              src={`https://www.google.com/s2/favicons?domain=${platformDomains[platform.id]}&sz=32`}
              alt=''
              className='size-3.5 rounded-[3px] object-contain'
            />
            <span>{platform.label}</span>
          </button>
        );
      })}
    </div>
  );
}
