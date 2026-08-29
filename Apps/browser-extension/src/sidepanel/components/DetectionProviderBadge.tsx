/** @format */

import { useState } from 'react';
import { CircleCheck, TriangleAlert } from 'lucide-react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@jobby/ui/components/UI/popover';
import { Tooltip } from '@jobby/ui/components/UI/tooltip';
import { cn } from '@jobby/ui/lib/utils';
import type { CareerProfile } from '../../shared/contracts/tailored-resume';
import { PlatformQuickSearchList } from './PlatformQuickSearchCard';

export function isGenericDetection(platform?: string): boolean {
  return platform?.toLowerCase() === 'generic';
}

const PLATFORM_DOMAIN_MAP: Record<string, string> = {
  seek: 'seek.com.au',
  linkedin: 'linkedin.com',
  indeed: 'indeed.com',
  glassdoor: 'glassdoor.com',
  workday: 'workday.com',
  greenhouse: 'greenhouse.io',
  lever: 'lever.co',
  ashby: 'ashbyhq.com',
  smartrecruiters: 'smartrecruiters.com',
  taleo: 'taleo.net',
  icims: 'icims.com',
  successfactors: 'successfactors.com',
  oracle: 'oracle.com',
  workable: 'workable.com',
  bamboohr: 'bamboohr.com',
};

const PLATFORM_BRAND_STYLES: Record<string, string> = {
  // Seek - Iconic Magenta / Deep Pink
  seek: 'border-[#E60278]/25 bg-[#E60278]/10 text-[#E60278] dark:border-[#E60278]/35 dark:bg-[#E60278]/15 dark:text-[#ff5aa9]',
  // LinkedIn - Classic LinkedIn Blue
  linkedin:
    'border-[#3171ad]/25 bg-[#3171ad]/10 text-[#3171ad] dark:border-[#0A66C2]/35 dark:bg-[#0A66C2]/15 dark:text-[#4595ea]',
  // Indeed - Indeed Navy Blue
  indeed:
    'border-[#003A9B]/25 bg-[#003A9B]/10 text-[#003A9B] dark:border-[#2164f3]/35 dark:bg-[#2164f3]/15 dark:text-[#60a5fa]',
  // Glassdoor - Vibrant Emerald Green
  glassdoor:
    'border-[#0caa41]/25 bg-[#0caa41]/10 text-[#0caa41] dark:border-[#0caa41]/35 dark:bg-[#0caa41]/15 dark:text-[#34d399]',
  // Greenhouse - Deep Forest Green
  greenhouse:
    'border-[#008552]/25 bg-[#008552]/10 text-[#008552] dark:border-[#008552]/35 dark:bg-[#008552]/15 dark:text-[#4ade80]',
  // Lever - Slate Teal
  lever:
    'border-[#26A69A]/25 bg-[#26A69A]/10 text-[#0f766e] dark:border-[#26A69A]/35 dark:bg-[#26A69A]/15 dark:text-[#2dd4bf]',
  // Workday - Energy Warm Orange
  workday:
    'border-[#E25225]/25 bg-[#E25225]/10 text-[#c2410c] dark:border-[#E25225]/35 dark:bg-[#E25225]/15 dark:text-[#fb923c]',
  // Ashby - Royal Violet
  ashby:
    'border-[#453cc6]/25 bg-[#453cc6]/10 text-[#453cc6] dark:border-[#7C3AED]/35 dark:bg-[#7C3AED]/15 dark:text-[#c084fc]',
  // SmartRecruiters - Vivid Blue
  smartrecruiters:
    'border-[#0084FF]/25 bg-[#0084FF]/10 text-[#0070d8] dark:border-[#0084FF]/35 dark:bg-[#0084FF]/15 dark:text-[#38bdf8]',
  // Taleo - Crimson Red
  taleo:
    'border-[#C74634]/25 bg-[#C74634]/10 text-[#b91c1c] dark:border-[#C74634]/35 dark:bg-[#C74634]/15 dark:text-[#f87171]',
  // iCIMS - Ocean Teal
  icims:
    'border-[#007EA7]/25 bg-[#007EA7]/10 text-[#007ea7] dark:border-[#38BDF8]/35 dark:bg-[#38BDF8]/15 dark:text-[#38bdf8]',
  // SuccessFactors - SAP Indigo Blue
  successfactors:
    'border-[#0070F2]/25 bg-[#0070F2]/10 text-[#0070f2] dark:border-[#0070F2]/35 dark:bg-[#0070F2]/15 dark:text-[#60a5fa]',
  // Oracle - Redwood Red
  oracle:
    'border-[#C74634]/25 bg-[#C74634]/10 text-[#b91c1c] dark:border-[#C74634]/35 dark:bg-[#C74634]/15 dark:text-[#f87171]',
  // Workable - Forest Green / Teal
  workable:
    'border-[#00756A]/25 bg-[#00756A]/10 text-[#00756a] dark:border-[#2DD4BF]/35 dark:bg-[#2DD4BF]/15 dark:text-[#2dd4bf]',
  // BambooHR - Lime Pine Green
  bamboohr:
    'border-[#658800]/25 bg-[#658800]/10 text-[#658800] dark:border-[#A3E635]/35 dark:bg-[#A3E635]/15 dark:text-[#a3e635]',
};

export function getPlatformDomain(
  url?: string,
  platform?: string,
): string | null {
  if (url) {
    try {
      return new URL(url).hostname;
    } catch {
      // ignore invalid URL
    }
  }
  if (platform) {
    return PLATFORM_DOMAIN_MAP[platform.toLowerCase()] || null;
  }
  return null;
}

export function getPlatformBadgeStyle(
  platform?: string,
  isGeneric?: boolean,
  isManual?: boolean,
): string {
  if (isGeneric) {
    return 'border-warning/30 bg-warning/10 text-warning';
  }
  if (isManual || !platform) {
    return 'border-border/40 bg-muted/40 text-muted-foreground';
  }
  const brandStyle = PLATFORM_BRAND_STYLES[platform.toLowerCase()];
  if (brandStyle) {
    return brandStyle;
  }
  return 'border-primary/25 bg-primary/10 text-primary';
}

export function DetectionProviderBadge({
  platform,
  url,
  activeProfile,
}: {
  platform?: string;
  url?: string;
  activeProfile?: CareerProfile | null;
}) {
  const [faviconFailed, setFaviconFailed] = useState(false);
  const isGeneric = isGenericDetection(platform);
  const isManual = !platform;
  const label = isGeneric ? 'Needs review' : platform || 'Manual';
  const tooltip =
    isGeneric ? 'Generic Algorithm detection is active'
    : isManual ? 'Job details entered manually'
    : 'Platform detected (Verified)';

  const domain = getPlatformDomain(url, platform);
  const faviconUrl =
    domain && !isManual ?
      `https://www.google.com/s2/favicons?domain=${domain}&sz=32`
    : null;

  const badgeStyle = getPlatformBadgeStyle(platform, isGeneric, isManual);

  return (
    <Popover>
      <Tooltip
        content={<span className='text-xs'>{tooltip}</span>}
        side='bottom'
        align='end'
      >
        <PopoverTrigger asChild>
          <button
            type='button'
            className={cn(
              'inline-flex items-center gap-1.5 rounded-full border pl-2 pr-1 py-0.5 text-[10px] font-bold capitalize transition-all cursor-pointer hover:brightness-95 dark:hover:brightness-110 active:scale-95 select-none',
              badgeStyle,
            )}
            aria-label={`Platform: ${label}. Click to view supported platforms`}
            title={`Platform: ${label}. Click to view supported platforms`}
          >
            {faviconUrl && !faviconFailed && (
              <img
                src={faviconUrl}
                alt=''
                className='h-3 w-3 shrink-0 rounded-xs object-contain'
                onError={() => setFaviconFailed(true)}
                loading='lazy'
              />
            )}
            <span>{label}</span>
            {!isManual &&
              (isGeneric ?
                <TriangleAlert
                  className='h-3 w-3 shrink-0 text-warning'
                  aria-hidden='true'
                />
              : <CircleCheck
                  className='h-3 w-3 shrink-0 text-emerald-500 dark:text-emerald-400'
                  aria-hidden='true'
                />)}
          </button>
        </PopoverTrigger>
      </Tooltip>
      <PopoverContent
        side='bottom'
        align='end'
        sideOffset={8}
        collisionPadding={14}
        className='w-[310px] max-w-[calc(100vw-28px)] p-3 rounded-2xl border border-primary/20 bg-background/95 backdrop-blur-xl shadow-xl z-[200]'
      >
        <PlatformQuickSearchList activeProfile={activeProfile} />
      </PopoverContent>
    </Popover>
  );
}
