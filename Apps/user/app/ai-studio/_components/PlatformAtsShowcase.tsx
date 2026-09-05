/** @format */

'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

export interface PlatformItemData {
  id: string;
  name: string;
  domain: string;
}

export const SUPPORTED_JOB_PLATFORMS: PlatformItemData[] = [
  { id: 'linkedin', name: 'LinkedIn', domain: 'linkedin.com' },
  { id: 'seek', name: 'SEEK', domain: 'seek.com.au' },
  { id: 'indeed', name: 'Indeed', domain: 'indeed.com' },
  { id: 'glassdoor', name: 'Glassdoor', domain: 'glassdoor.com' },
  { id: 'workday', name: 'Workday', domain: 'workday.com' },
  { id: 'greenhouse', name: 'Greenhouse', domain: 'greenhouse.io' },
  { id: 'ashby', name: 'Ashby', domain: 'ashbyhq.com' },
  { id: 'lever', name: 'Lever', domain: 'lever.co' },
  { id: 'wellfound', name: 'Wellfound', domain: 'wellfound.com' },
  { id: 'ziprecruiter', name: 'ZipRecruiter', domain: 'ziprecruiter.com' },
  { id: 'smartrecruiters', name: 'SmartRecruiters', domain: 'smartrecruiters.com' },
  { id: 'adzuna', name: 'Adzuna', domain: 'adzuna.com.au' },
  { id: 'dice', name: 'Dice', domain: 'dice.com' },
  { id: 'jora', name: 'Jora', domain: 'jora.com' },
  { id: 'bamboohr', name: 'BambooHR', domain: 'bamboohr.com' },
  { id: 'taleo', name: 'Taleo', domain: 'taleo.net' },
  { id: 'icims', name: 'iCIMS', domain: 'icims.com' },
  { id: 'workable', name: 'Workable', domain: 'workable.com' },
  { id: 'successfactors', name: 'SuccessFactors', domain: 'successfactors.com' },
  { id: 'micro1', name: 'micro1', domain: 'micro1.ai' },
  { id: 'avature', name: 'Avature', domain: 'avature.net' },
];

export function buildPlatformSearchUrl(
  platformId: string,
  domain: string,
  title: string,
  location: string,
): string {
  const t = title.trim();
  const l = location.trim();

  switch (platformId) {
    case 'linkedin': {
      const p = new URLSearchParams();
      if (t) p.set('keywords', t);
      if (l) p.set('location', l);
      const q = p.toString();
      return q ? `https://www.linkedin.com/jobs/search/?${q}` : 'https://www.linkedin.com/jobs/';
    }
    case 'seek': {
      const p = new URLSearchParams();
      if (t) p.set('keywords', t);
      if (l) p.set('where', l);
      const q = p.toString();
      return q ? `https://www.seek.com.au/jobs?${q}` : 'https://www.seek.com.au/';
    }
    case 'indeed': {
      const p = new URLSearchParams();
      if (t) p.set('q', t);
      if (l) p.set('l', l);
      const q = p.toString();
      return q ? `https://www.indeed.com/jobs?${q}` : 'https://www.indeed.com/';
    }
    case 'glassdoor': {
      const p = new URLSearchParams();
      if (t) p.set('sc.keyword', t);
      if (l) p.set('locKeyword', l);
      const q = p.toString();
      return q ? `https://www.glassdoor.com/Job/jobs.htm?${q}` : 'https://www.glassdoor.com/Job/index.htm';
    }
    case 'jora': {
      const p = new URLSearchParams();
      if (t) p.set('q', t);
      if (l) p.set('l', l);
      const q = p.toString();
      return q ? `https://au.jora.com/j?${q}` : 'https://au.jora.com/';
    }
    case 'ziprecruiter': {
      const p = new URLSearchParams();
      if (t) p.set('search', t);
      if (l) p.set('location', l);
      const q = p.toString();
      return q ? `https://www.ziprecruiter.com/candidate/search?${q}` : 'https://www.ziprecruiter.com/';
    }
    case 'adzuna': {
      const p = new URLSearchParams();
      if (t) p.set('q', t);
      if (l) p.set('w', l);
      const q = p.toString();
      return q ? `https://www.adzuna.com.au/search?${q}` : 'https://www.adzuna.com.au/';
    }
    case 'wellfound': {
      const p = new URLSearchParams();
      if (t) p.set('role', t);
      if (l) p.set('location', l);
      const q = p.toString();
      return q ? `https://wellfound.com/jobs?${q}` : 'https://wellfound.com/jobs';
    }
    case 'dice': {
      const p = new URLSearchParams();
      if (t) p.set('q', t);
      if (l) p.set('location', l);
      const q = p.toString();
      return q ? `https://www.dice.com/jobs?${q}` : 'https://www.dice.com/';
    }
    case 'greenhouse': {
      const terms = ['site:boards.greenhouse.io', t, l].filter(Boolean).join(' ');
      return `https://www.google.com/search?q=${encodeURIComponent(terms)}`;
    }
    case 'ashby': {
      const terms = ['site:jobs.ashbyhq.com', t, l].filter(Boolean).join(' ');
      return `https://www.google.com/search?q=${encodeURIComponent(terms)}`;
    }
    case 'lever': {
      const terms = ['site:jobs.lever.co', t, l].filter(Boolean).join(' ');
      return `https://www.google.com/search?q=${encodeURIComponent(terms)}`;
    }
    case 'workday': {
      const terms = ['site:myworkdayjobs.com', t, l].filter(Boolean).join(' ');
      return `https://www.google.com/search?q=${encodeURIComponent(terms)}`;
    }
    case 'smartrecruiters': {
      const terms = ['site:jobs.smartrecruiters.com', t, l].filter(Boolean).join(' ');
      return `https://www.google.com/search?q=${encodeURIComponent(terms)}`;
    }
    case 'workable': {
      const terms = ['site:apply.workable.com', t, l].filter(Boolean).join(' ');
      return `https://www.google.com/search?q=${encodeURIComponent(terms)}`;
    }
    case 'bamboohr': {
      const terms = ['site:bamboohr.com/careers', t, l].filter(Boolean).join(' ');
      return `https://www.google.com/search?q=${encodeURIComponent(terms)}`;
    }
    case 'icims': {
      const terms = ['site:icims.com/jobs', t, l].filter(Boolean).join(' ');
      return `https://www.google.com/search?q=${encodeURIComponent(terms)}`;
    }
    case 'taleo': {
      const terms = ['site:taleo.net', t, l].filter(Boolean).join(' ');
      return `https://www.google.com/search?q=${encodeURIComponent(terms)}`;
    }
    case 'successfactors': {
      const terms = ['site:successfactors.com', t, l].filter(Boolean).join(' ');
      return `https://www.google.com/search?q=${encodeURIComponent(terms)}`;
    }
    case 'micro1': {
      const terms = ['site:jobs.micro1.ai/post', t, l].filter(Boolean).join(' ');
      return `https://www.google.com/search?q=${encodeURIComponent(terms)}`;
    }
    case 'avature': {
      const terms = ['site:avature.net/careers', t, l].filter(Boolean).join(' ');
      return `https://www.google.com/search?q=${encodeURIComponent(terms)}`;
    }
    default:
      return `https://${domain}`;
  }
}

const SCATTER_CONFIGS = [
  { top: '3%', left: '4%', size: 44, rotate: -6, floatOffset: -8, rotateOffset: 2, duration: 4.2, delay: 0 },
  { top: '14%', left: '16%', size: 38, rotate: 5, floatOffset: -6, rotateOffset: -2, duration: 5.1, delay: 0.7 },
  { top: '2%', left: '34%', size: 40, rotate: -4, floatOffset: -9, rotateOffset: 3, duration: 4.6, delay: 1.2 },
  { top: '1%', right: '32%', size: 42, rotate: 6, floatOffset: -7, rotateOffset: -2, duration: 4.8, delay: 0.4 },
  { top: '12%', right: '15%', size: 36, rotate: -8, floatOffset: -6, rotateOffset: 3, duration: 5.4, delay: 1.5 },
  { top: '3%', right: '4%', size: 46, rotate: 4, floatOffset: -10, rotateOffset: -3, duration: 4.0, delay: 0.2 },
  { top: '35%', left: '2%', size: 42, rotate: -5, floatOffset: -8, rotateOffset: 2, duration: 5.6, delay: 0.9 },
  { top: '42%', left: '13%', size: 48, rotate: 7, floatOffset: -9, rotateOffset: -2, duration: 4.4, delay: 1.8 },
  { top: '58%', left: '5%', size: 40, rotate: -7, floatOffset: -7, rotateOffset: 3, duration: 5.0, delay: 0.5 },
  { top: '34%', right: '2%', size: 44, rotate: 6, floatOffset: -8, rotateOffset: -2, duration: 4.5, delay: 1.1 },
  { top: '44%', right: '12%', size: 48, rotate: -6, floatOffset: -10, rotateOffset: 3, duration: 5.2, delay: 0.3 },
  { top: '60%', right: '4%', size: 38, rotate: 5, floatOffset: -6, rotateOffset: -2, duration: 4.7, delay: 1.6 },
  { top: '32%', left: '28%', size: 36, rotate: -3, floatOffset: -7, rotateOffset: 2, duration: 5.8, delay: 0.8 },
  { top: '30%', right: '28%', size: 38, rotate: 4, floatOffset: -8, rotateOffset: -3, duration: 4.3, delay: 1.4 },
  { top: '62%', left: '24%', size: 42, rotate: 6, floatOffset: -8, rotateOffset: 2, duration: 5.3, delay: 0.6 },
  { top: '64%', right: '24%', size: 40, rotate: -5, floatOffset: -7, rotateOffset: -2, duration: 4.9, delay: 1.3 },
  { top: '80%', left: '10%', size: 44, rotate: -4, floatOffset: -9, rotateOffset: 3, duration: 5.5, delay: 0.1 },
  { top: '84%', left: '46%', size: 38, rotate: 5, floatOffset: -6, rotateOffset: -2, duration: 4.1, delay: 1.7 },
  { top: '78%', right: '12%', size: 42, rotate: 8, floatOffset: -8, rotateOffset: -3, duration: 5.0, delay: 1.0 },
  { top: '18%', left: '44%', size: 40, rotate: -7, floatOffset: -7, rotateOffset: 2, duration: 4.6, delay: 1.1 },
];

function PlatformLogoIcon({
  item,
  config,
  searchTitle = '',
  searchLocation = '',
}: {
  item: PlatformItemData;
  config: (typeof SCATTER_CONFIGS)[number];
  searchTitle?: string;
  searchLocation?: string;
}) {
  const [faviconFailed, setFaviconFailed] = useState(false);
  const faviconUrl = `https://www.google.com/s2/favicons?domain=${item.domain}&sz=64`;
  const searchUrl = buildPlatformSearchUrl(item.id, item.domain, searchTitle, searchLocation);

  const tooltipLabel = searchTitle
    ? `Search "${searchTitle}" on ${item.name}${searchLocation ? ` in ${searchLocation}` : ''}`
    : `Explore jobs on ${item.name}`;

  return (
    <motion.a
      href={searchUrl}
      target='_blank'
      rel='noopener noreferrer'
      title={tooltipLabel}
      style={{
        top: config.top,
        left: config.left,
        right: config.right,
        width: `${config.size}px`,
        height: `${config.size}px`,
      }}
      initial={{ y: 0, rotate: config.rotate }}
      animate={{
        y: [0, config.floatOffset, 0],
        rotate: [config.rotate, config.rotate + config.rotateOffset, config.rotate],
      }}
      transition={{
        duration: config.duration * 0.9,
        repeat: Infinity,
        repeatType: 'reverse',
        ease: 'easeInOut',
        delay: config.delay,
      }}
      className={cn(
        'group absolute flex items-center justify-center cursor-pointer select-none pointer-events-auto',
        'grayscale filter contrast-75 dark:contrast-50 opacity-[0.05] dark:opacity-[0.10]',
        'hover:grayscale-0 hover:contrast-100 dark:hover:contrast-100 hover:opacity-100 hover:scale-120',
        'transition-all duration-300 ease-out',
      )}
    >
      {!faviconFailed ? (
        <img
          src={faviconUrl}
          alt={item.name}
          className='w-full h-full object-contain pointer-events-none drop-shadow-xs transition-transform duration-300 group-hover:scale-105'
          onError={() => setFaviconFailed(true)}
          loading='lazy'
        />
      ) : (
        <span className='text-xs font-black tracking-tight text-ink-primary/70 group-hover:text-primary transition-colors'>
          {item.name.slice(0, 3).toUpperCase()}
        </span>
      )}
    </motion.a>
  );
}

export interface PlatformAtsShowcaseProps {
  className?: string;
  searchTitle?: string;
  searchLocation?: string;
}

export function PlatformAtsShowcase({
  className,
  searchTitle = '',
  searchLocation = '',
}: PlatformAtsShowcaseProps) {
  return (
    <div
      aria-hidden='true'
      className={cn(
        'pointer-events-none absolute inset-0 overflow-hidden select-none',
        className,
      )}
    >
      {SUPPORTED_JOB_PLATFORMS.map((platform, idx) => {
        const config = SCATTER_CONFIGS[idx % SCATTER_CONFIGS.length];
        return (
          <PlatformLogoIcon
            key={platform.id}
            item={platform}
            config={config}
            searchTitle={searchTitle}
            searchLocation={searchLocation}
          />
        );
      })}
    </div>
  );
}
