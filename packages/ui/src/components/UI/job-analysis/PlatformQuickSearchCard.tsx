/** @format */

'use client';

import { useMemo, useState } from 'react';
import {
  Briefcase,
  ExternalLink,
  Layers,
  RefreshCw,
  Sparkles,
} from '@jobby/ui/components/icons';
import { motion, type Variants } from 'framer-motion';
import { IPEmotion } from '../IPEmotion';
import { cn } from '../../../lib/utils';
import type { JobAnalysisCareerProfile } from './types';

interface PlatformQuickSearchCardProps {
  activeProfile?: JobAnalysisCareerProfile | null;
  onReDetect?: () => void;
  isInspecting?: boolean;
}

export type PlatformCategory = 'all' | 'boards' | 'ats';

export interface JobPlatform {
  id: string;
  name: string;
  category: 'boards' | 'ats';
  domain: string;
  typeLabel: string;
  brandColor: string;
  getSearchUrl: (title: string, location: string) => string;
}

export const SUPPORTED_PLATFORMS: JobPlatform[] = [
  // Major Job Boards
  {
    id: 'linkedin',
    name: 'LinkedIn',
    category: 'boards',
    domain: 'linkedin.com',
    typeLabel: 'Global & AU Jobs',
    brandColor: '#0A66C2',
    getSearchUrl: (title, location) => {
      const params = new URLSearchParams();
      if (title) params.set('keywords', title);
      if (location) params.set('location', location);
      const query = params.toString();
      return query ?
          `https://www.linkedin.com/jobs/search/?${query}`
        : 'https://www.linkedin.com/jobs/';
    },
  },
  {
    id: 'seek',
    name: 'SEEK',
    category: 'boards',
    domain: 'seek.com.au',
    typeLabel: 'Australia & NZ #1',
    brandColor: '#E60278',
    getSearchUrl: (title, location) => {
      const params = new URLSearchParams();
      if (title) params.set('keywords', title);
      if (location) params.set('where', location);
      const query = params.toString();
      return query ?
          `https://www.seek.com.au/jobs?${query}`
        : 'https://www.seek.com.au/';
    },
  },
  {
    id: 'indeed',
    name: 'Indeed',
    category: 'boards',
    domain: 'indeed.com',
    typeLabel: 'Worldwide Search',
    brandColor: '#2164F3',
    getSearchUrl: (title, location) => {
      const params = new URLSearchParams();
      if (title) params.set('q', title);
      if (location) params.set('l', location);
      const query = params.toString();
      return query ?
          `https://www.indeed.com/jobs?${query}`
        : 'https://www.indeed.com/';
    },
  },
  {
    id: 'glassdoor',
    name: 'Glassdoor',
    category: 'boards',
    domain: 'glassdoor.com',
    typeLabel: 'Jobs & Salaries',
    brandColor: '#0CAA41',
    getSearchUrl: (title, location) => {
      const params = new URLSearchParams();
      if (title) params.set('sc.keyword', title);
      if (location) params.set('locKeyword', location);
      const query = params.toString();
      return query ?
          `https://www.glassdoor.com/Job/jobs.htm?${query}`
        : 'https://www.glassdoor.com/Job/index.htm';
    },
  },
  {
    id: 'jora',
    name: 'Jora',
    category: 'boards',
    domain: 'jora.com',
    typeLabel: 'Global Job Aggregator',
    brandColor: '#15A449',
    getSearchUrl: (title, location) => {
      const params = new URLSearchParams();
      if (title) params.set('q', title);
      if (location) params.set('l', location);
      const query = params.toString();
      return query ?
          `https://au.jora.com/j?${query}`
        : 'https://au.jora.com/';
    },
  },
  {
    id: 'ziprecruiter',
    name: 'ZipRecruiter',
    category: 'boards',
    domain: 'ziprecruiter.com',
    typeLabel: '1-Click Apply',
    brandColor: '#1F8435',
    getSearchUrl: (title, location) => {
      const params = new URLSearchParams();
      if (title) params.set('search', title);
      if (location) params.set('location', location);
      const query = params.toString();
      return query ?
          `https://www.ziprecruiter.com/candidate/search?${query}`
        : 'https://www.ziprecruiter.com/';
    },
  },
  {
    id: 'adzuna',
    name: 'Adzuna',
    category: 'boards',
    domain: 'adzuna.com.au',
    typeLabel: 'Millions of Jobs',
    brandColor: '#1E88E5',
    getSearchUrl: (title, location) => {
      const params = new URLSearchParams();
      if (title) params.set('q', title);
      if (location) params.set('w', location);
      const query = params.toString();
      return query ?
          `https://www.adzuna.com.au/search?${query}`
        : 'https://www.adzuna.com.au/';
    },
  },
  {
    id: 'wellfound',
    name: 'Wellfound',
    category: 'boards',
    domain: 'wellfound.com',
    typeLabel: 'Startups & Tech',
    brandColor: '#141413',
    getSearchUrl: (title, location) => {
      const params = new URLSearchParams();
      if (title) params.set('role', title);
      if (location) params.set('location', location);
      const query = params.toString();
      return query ?
          `https://wellfound.com/jobs?${query}`
        : 'https://wellfound.com/jobs';
    },
  },
  {
    id: 'dice',
    name: 'Dice',
    category: 'boards',
    domain: 'dice.com',
    typeLabel: 'Tech Careers',
    brandColor: '#E01A22',
    getSearchUrl: (title, location) => {
      const params = new URLSearchParams();
      if (title) params.set('q', title);
      if (location) params.set('location', location);
      const query = params.toString();
      return query ?
          `https://www.dice.com/jobs?${query}`
        : 'https://www.dice.com/';
    },
  },
  {
    id: 'simplyhired',
    name: 'SimplyHired',
    category: 'boards',
    domain: 'simplyhired.com.au',
    typeLabel: 'Job Search Engine',
    brandColor: '#205493',
    getSearchUrl: (title, location) => {
      const params = new URLSearchParams();
      if (title) params.set('q', title);
      if (location) params.set('l', location);
      const query = params.toString();
      return query ?
          `https://www.simplyhired.com.au/search?${query}`
        : 'https://www.simplyhired.com.au/';
    },
  },
  {
    id: 'careerone',
    name: 'CareerOne',
    category: 'boards',
    domain: 'careerone.com.au',
    typeLabel: 'Australian Career Portal',
    brandColor: '#F26522',
    getSearchUrl: (title, location) => {
      const params = new URLSearchParams();
      if (title) params.set('q', title);
      if (location) params.set('where', location);
      const query = params.toString();
      return query ?
          `https://www.careerone.com.au/jobs?${query}`
        : 'https://www.careerone.com.au/jobs/in-australia';
    },
  },
  // ATS Portals
  {
    id: 'greenhouse',
    name: 'Greenhouse',
    category: 'ats',
    domain: 'greenhouse.io',
    typeLabel: 'Top Tech Careers',
    brandColor: '#008552',
    getSearchUrl: (title, location) => {
      const terms = ['site:boards.greenhouse.io', title, location]
        .filter(Boolean)
        .join(' ');
      return `https://www.google.com/search?q=${encodeURIComponent(terms)}`;
    },
  },
  {
    id: 'ashby',
    name: 'Ashby',
    category: 'ats',
    domain: 'ashbyhq.com',
    typeLabel: 'High-Growth Tech',
    brandColor: '#7C3AED',
    getSearchUrl: (title, location) => {
      const terms = ['site:jobs.ashbyhq.com', title, location]
        .filter(Boolean)
        .join(' ');
      return `https://www.google.com/search?q=${encodeURIComponent(terms)}`;
    },
  },
  {
    id: 'lever',
    name: 'Lever',
    category: 'ats',
    domain: 'lever.co',
    typeLabel: 'Modern Tech Jobs',
    brandColor: '#26A69A',
    getSearchUrl: (title, location) => {
      const terms = ['site:jobs.lever.co', title, location]
        .filter(Boolean)
        .join(' ');
      return `https://www.google.com/search?q=${encodeURIComponent(terms)}`;
    },
  },
  {
    id: 'workday',
    name: 'Workday',
    category: 'ats',
    domain: 'workday.com',
    typeLabel: 'Enterprise Portals',
    brandColor: '#E25225',
    getSearchUrl: (title, location) => {
      const terms = ['site:myworkdayjobs.com', title, location]
        .filter(Boolean)
        .join(' ');
      return `https://www.google.com/search?q=${encodeURIComponent(terms)}`;
    },
  },
  {
    id: 'smartrecruiters',
    name: 'SmartRecruiters',
    category: 'ats',
    domain: 'smartrecruiters.com',
    typeLabel: 'Global Companies',
    brandColor: '#0084FF',
    getSearchUrl: (title, location) => {
      const terms = ['site:jobs.smartrecruiters.com', title, location]
        .filter(Boolean)
        .join(' ');
      return `https://www.google.com/search?q=${encodeURIComponent(terms)}`;
    },
  },
  {
    id: 'workable',
    name: 'Workable',
    category: 'ats',
    domain: 'workable.com',
    typeLabel: 'Direct Hiring',
    brandColor: '#00756A',
    getSearchUrl: (title, location) => {
      const terms = ['site:apply.workable.com', title, location]
        .filter(Boolean)
        .join(' ');
      return `https://www.google.com/search?q=${encodeURIComponent(terms)}`;
    },
  },
  {
    id: 'bamboohr',
    name: 'BambooHR',
    category: 'ats',
    domain: 'bamboohr.com',
    typeLabel: 'Company Careers',
    brandColor: '#658800',
    getSearchUrl: (title, location) => {
      const terms = ['site:bamboohr.com/careers', title, location]
        .filter(Boolean)
        .join(' ');
      return `https://www.google.com/search?q=${encodeURIComponent(terms)}`;
    },
  },
  {
    id: 'icims',
    name: 'iCIMS',
    category: 'ats',
    domain: 'icims.com',
    typeLabel: 'Corporate Jobs',
    brandColor: '#007EA7',
    getSearchUrl: (title, location) => {
      const terms = ['site:icims.com/jobs', title, location]
        .filter(Boolean)
        .join(' ');
      return `https://www.google.com/search?q=${encodeURIComponent(terms)}`;
    },
  },
  {
    id: 'micro1',
    name: 'micro1',
    category: 'ats',
    domain: 'micro1.ai',
    typeLabel: 'AI & Tech Talent',
    brandColor: '#6366F1',
    getSearchUrl: (title, location) => {
      const terms = ['site:jobs.micro1.ai/post', title, location]
        .filter(Boolean)
        .join(' ');
      return `https://www.google.com/search?q=${encodeURIComponent(terms)}`;
    },
  },
  {
    id: 'dayforce',
    name: 'Dayforce',
    category: 'ats',
    domain: 'dayforcehcm.com',
    typeLabel: 'Enterprise Portals',
    brandColor: '#1E51BE',
    getSearchUrl: (title, location) => {
      const terms = ['site:jobs.dayforcehcm.com', title, location]
        .filter(Boolean)
        .join(' ');
      return `https://www.google.com/search?q=${encodeURIComponent(terms)}`;
    },
  },
];

export function extractProfileSearchCriteria(
  profile: JobAnalysisCareerProfile | null | undefined,
): {
  jobTitle: string;
  location: string;
} {
  if (!profile) {
    return { jobTitle: '', location: '' };
  }

  const basics = profile.resume_data?.basics;
  const headline = basics?.headline?.trim();
  const latestExpTitle = profile.resume_data?.experience?.[0]?.title?.trim();
  const rawProfileName = profile.name?.trim() || '';
  const isGenericProfileName =
    !rawProfileName ||
    /^default(?:\s+profile)?$/i.test(rawProfileName) ||
    /^master(?:\s+resume)?$/i.test(rawProfileName);

  const jobTitle =
    headline ||
    latestExpTitle ||
    (!isGenericProfileName ? rawProfileName : '') ||
    '';

  const loc = basics?.location;
  const locParts = [loc?.city, loc?.state, loc?.country]
    .filter(Boolean)
    .map((s) => (s as string).trim());
  const location =
    locParts.length > 0 ? locParts.join(', ') : loc?.address?.trim() || '';

  return { jobTitle, location };
}

function PlatformItem({
  platform,
  searchTitle,
  searchLocation,
}: {
  platform: JobPlatform;
  searchTitle: string;
  searchLocation: string;
}) {
  const [faviconError, setFaviconError] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  const searchUrl = platform.getSearchUrl(searchTitle, searchLocation);
  const faviconUrl = `https://www.google.com/s2/favicons?domain=${platform.domain}&sz=64`;

  const handleOpen = (e?: React.MouseEvent) => {
    e?.preventDefault();
    e?.stopPropagation();
    const extensionTabs = (
      globalThis as {
        chrome?: { tabs?: { create?: (options: { url: string }) => void } };
      }
    ).chrome?.tabs;
    if (extensionTabs?.create) {
      extensionTabs.create({ url: searchUrl });
    } else {
      window.open(searchUrl, '_blank', 'noopener,noreferrer');
    }
  };

  return (
    <button
      type='button'
      onClick={handleOpen}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={cn(
        'group relative w-full flex items-center justify-between text-left min-w-0',
        'p-2.5 rounded-xl transition-all duration-150',
        'cursor-pointer border-0 shadow-none outline-none select-none',
        'active:scale-[0.98]',
      )}
      style={{
        backgroundColor:
          isHovered ?
            `${platform.brandColor}18`
          : 'var(--color-background-50, rgba(255, 255, 255, 0.05))',
      }}
      title={`Search for "${searchTitle || 'jobs'}" on ${platform.name}`}
    >
      <div className='flex items-center gap-2.5 min-w-0 pr-0.5 flex-1 overflow-hidden'>
        {/* Full Icon with No Surrounding Background */}
        <div className='size-5 shrink-0 flex items-center justify-center'>
          {!faviconError ?
            <img
              src={faviconUrl}
              alt={platform.name}
              className='size-5 object-contain rounded-xs'
              onError={() => setFaviconError(true)}
              loading='lazy'
            />
          : <span
              className='text-[10px] font-bold'
              style={{ color: platform.brandColor }}
            >
              {platform.name.slice(0, 2).toUpperCase()}
            </span>
          }
        </div>

        <div className='min-w-0 flex flex-col flex-1'>
          <span
            className='text-xs font-semibold tracking-tight truncate leading-tight transition-colors'
            style={{
              color: isHovered ? platform.brandColor : undefined,
            }}
          >
            {platform.name}
          </span>
          <span className='text-[10px] text-muted-foreground truncate leading-none mt-1'>
            {platform.typeLabel}
          </span>
        </div>
      </div>

      <div
        className='shrink-0 flex items-center justify-center size-5 rounded-md transition-colors ml-1'
        style={{
          color: isHovered ? platform.brandColor : undefined,
        }}
      >
        <ExternalLink className='size-3.5 opacity-50 group-hover:opacity-100' />
      </div>
    </button>
  );
}

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      delayChildren: 0.05,
      staggerChildren: 0.035,
    },
  },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 6, scale: 0.96 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      duration: 0.22,
      ease: [0.25, 1, 0.5, 1],
    },
  },
};

export interface PlatformQuickSearchListProps {
  activeProfile?: JobAnalysisCareerProfile | null;
  className?: string;
}

export function PlatformQuickSearchList({
  activeProfile,
  className,
}: PlatformQuickSearchListProps) {
  const { jobTitle, location } = extractProfileSearchCriteria(activeProfile);

  const jobBoards = useMemo(
    () => SUPPORTED_PLATFORMS.filter((p) => p.category === 'boards'),
    [],
  );

  const atsPortals = useMemo(
    () => SUPPORTED_PLATFORMS.filter((p) => p.category === 'ats'),
    [],
  );

  return (
    <motion.div
      className={cn(
        'flex flex-col gap-4 h-full overflow-y-auto pr-0.5',
        className,
      )}
      variants={containerVariants}
      initial='hidden'
      animate='visible'
    >
      {/* Job Boards Section */}
      <div className='flex flex-col gap-2'>
        <div className='flex items-center gap-2 px-1'>
          <Briefcase className='size-3.5 text-primary' />
          <span className='text-xs font-semibold text-foreground/90'>
            Job Boards
          </span>
        </div>
        <div className='grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2'>
          {jobBoards.map((platform) => (
            <motion.div key={platform.id} variants={itemVariants}>
              <PlatformItem
                platform={platform}
                searchTitle={jobTitle}
                searchLocation={location}
              />
            </motion.div>
          ))}
        </div>
      </div>

      {/* ATS Portals Section */}
      <div className='flex flex-col gap-2 pt-1'>
        <div className='flex items-center gap-2 px-1'>
          <Layers className='size-3.5 text-primary' />
          <span className='text-xs font-semibold text-foreground/90'>
            ATS Portals
          </span>
        </div>
        <div className='grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2'>
          {atsPortals.map((platform) => (
            <motion.div key={platform.id} variants={itemVariants}>
              <PlatformItem
                platform={platform}
                searchTitle={jobTitle}
                searchLocation={location}
              />
            </motion.div>
          ))}
        </div>
      </div>
    </motion.div>
  );
}

export function PlatformQuickSearchCard({
  activeProfile,
  onReDetect,
  isInspecting = false,
}: PlatformQuickSearchCardProps) {
  const { jobTitle, location } = extractProfileSearchCriteria(activeProfile);

  return (
    <div className='w-full rounded-2xl bg-primary/10 p-2.5 flex flex-col gap-2.5 border-0 shadow-none'>
            {/* Re-detect action */}
      {onReDetect && (
        <button
          type='button'
          onClick={onReDetect}
          disabled={isInspecting}
          className={cn(
            'w-full py-2 px-3 rounded-xl flex items-center justify-center gap-1.5',
            'text-[11px] font-medium text-muted-foreground hover:text-primary',
            'bg-background-50/50 hover:bg-background-50 transition-colors',
            'border-0 shadow-none cursor-pointer disabled:opacity-50',
          )}
        >
          <RefreshCw
            className={cn('w-3 h-3', isInspecting && 'animate-spin')}
          />
          <span>
            {isInspecting ? 'Re-scanning page...' : 'Re-scan Current Page'}
          </span>
        </button>
      )}
      {/* Top Banner / Mascot Header */}
      <div className='rounded-xl bg-background-50/90 backdrop-blur-sm px-4 pt-3 pb-3.5 flex flex-col items-center text-center border-0 shadow-none'>
        <div className='relative w-24 h-24 -mt-1 mb-1 flex items-center justify-center'>
          <IPEmotion emotionId={1} className='w-24 h-24' />
        </div>

        <h3 className='text-xs font-bold text-primary uppercase tracking-wider'>
          No Job Detected
        </h3>

        <p className='text-[11px] text-muted-foreground leading-relaxed mt-1 max-w-[260px]'>
          Jobby is adapted to 12+ job platforms. Search tailored positions
          directly with your preferences:
        </p>

        {/* Profile Search Criteria Indicator Pill */}
        <div className='mt-2.5 inline-flex items-center justify-between gap-1.5 px-3 py-1.5 rounded-xl bg-primary/15 text-primary'>
          <div className='flex items-center gap-1.5 min-w-0 overflow-hidden text-left'>
            <Sparkles className='w-3.5 h-3.5 shrink-0 text-primary' />
            <span className='text-[11px] font-semibold truncate'>
              {jobTitle || 'All Roles'}
            </span>
            {location && (
              <>
                <span className='text-[10px] opacity-60'>•</span>
                <span className='text-[10px] font-medium opacity-90 truncate'>
                  {location}
                </span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Categorized Platform Lists */}
      <PlatformQuickSearchList activeProfile={activeProfile} />


    </div>
  );
}
