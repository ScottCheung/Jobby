/** @format */

import React from 'react';
import type { JobHuntingProfile } from '@/lib/types';

interface SummaryCardProps {
  label: string;
  value: string;
  hint?: string;
}

function SummaryCard({ label, value, hint }: SummaryCardProps) {
  return (
    <div className='panel-lg'>
      <div className='text-[11px] uppercase tracking-wider text-ink-secondary/70'>
        {label}
      </div>
      <div className='label mt-1'>{value}</div>
      {hint ?
        <div className='body-sm mt-1 text-ink-secondary'>{hint}</div>
      : null}
    </div>
  );
}

export function summarizeJobHuntingProfile(profile: JobHuntingProfile) {
  const filters = profile.filters ?? {};
  const searchTermsCount = profile.search_terms?.length ?? 0;
  const locationsCount =
    Array.isArray(filters.location) ? filters.location.length : 0;
  const companiesCount =
    Array.isArray(filters.companies) ? filters.companies.length : 0;
  const workplaceCount =
    Array.isArray(filters.on_site) ? filters.on_site.length : 0;

  return {
    searchTermsCount,
    locationsCount,
    companiesCount,
    workplaceCount,
    switchNumber: Number(filters.switch_number ?? 30) || 30,
    sortBy: String(filters.sort_by ?? 'Most recent'),
    datePosted: String(filters.date_posted ?? 'Past week'),
  };
}

interface SummaryCardsProps {
  profile: JobHuntingProfile;
}

export function SummaryCards({ profile }: SummaryCardsProps) {
  const summary = summarizeJobHuntingProfile(profile);

  return (
    <div className='grid gap-4 md:grid-cols-2 xl:grid-cols-4'>
      <SummaryCard
        label='Keywords'
        value={`${summary.searchTermsCount}`}
        hint='Search phrases in rotation'
      />
      <SummaryCard
        label='Candidate Scan Limit'
        value={`${summary.switchNumber}`}
        hint='Candidates checked under the locked keyword'
      />
      <SummaryCard
        label='Sort'
        value={summary.sortBy}
        hint='LinkedIn results order'
      />
      <SummaryCard
        label='Date Window'
        value={summary.datePosted}
        hint='Posting freshness filter'
      />
    </div>
  );
}
