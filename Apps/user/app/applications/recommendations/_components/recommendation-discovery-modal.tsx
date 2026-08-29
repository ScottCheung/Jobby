/** @format */

'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { BriefcaseBusiness, Check, Copy, Navigation, Plus, Sparkles, X } from 'lucide-react';
import { Button } from '@jobby/ui';
import { api } from '@/lib/api';
import type { MasterResumeData } from '@/lib/types';
import { PlatformTagSelector } from '@/components/platform-tag-selector';

const times = ['1 day', '3 days', '1 week', '2 weeks'] as const;

export function RecommendationDiscoveryModal({ onClose }: { onClose: () => void }) {
  const [locations, setLocations] = useState(['Sydney, NSW', 'Remote']);
  const [locationInput, setLocationInput] = useState('');
  const [isAddingLocation, setIsAddingLocation] = useState(false);
  const [count, setCount] = useState(30);
  const [selectedPlatforms, setSelectedPlatforms] = useState(['seek', 'linkedin', 'indeed']);
  const [publishedWithin, setPublishedWithin] = useState<(typeof times)[number]>('3 days');
  const [resume, setResume] = useState<MasterResumeData | null>(null);
  const [copied, setCopied] = useState(false);
  const [detecting, setDetecting] = useState(false);

  useEffect(() => { void api.masterResume().then((item) => setResume(item.resume_data)).catch(() => setResume(null)); }, []);

  const prompt = useMemo(() => `Candidate resume:
${resume ? JSON.stringify(resume) : 'Unavailable'}

DISCOVERY PARAMETERS
- Locations: ${locations.join(', ') || 'Any'}
- Platforms: ${selectedPlatforms.join(', ') || 'Any supported platform'}
- Published within: ${publishedWithin}
- Maximum recommendations: ${count}

TASK
Search the selected platforms for jobs published within the requested time window and locations. Find the roles that are most worth this candidate's time to apply for, not merely roles with similar keywords.

Rank each role by practical application value: likelihood of passing an initial screen, direct evidence from the resume for the role's core requirements, realistic seniority and scope, location/work-style feasibility, posting freshness, and the quality of the opportunity. Penalize roles where essential requirements are materially unsupported by the resume. Prefer high-confidence opportunities with a clear, defensible application story.

For every recommendation, provide a match score based on this application value and a concise reason citing the strongest resume-to-role evidence.

OUTPUT
Return only one TSV code block, with this exact header and one line per job:
job_id\tplatform\ttitle\tcompany\twork_location\twork_style\tjob_link\tmatch_score\trecommend_reason

Score 0–100. recommend_reason must be concise and cite the strongest resume-to-role evidence. Do not output JSON, Markdown tables, commentary, or text outside the TSV code block.`, [count, locations, publishedWithin, resume, selectedPlatforms]);

  const toggle = (value: string) => setSelectedPlatforms((items) => items.includes(value) ? items.filter((item) => item !== value) : [...items, value]);
  const addLocation = () => { const value = locationInput.trim(); if (value && !locations.some((item) => item.toLowerCase() === value.toLowerCase())) setLocations((items) => [...items, value]); setLocationInput(''); setIsAddingLocation(false); };
  const detectLocation = () => { if (!navigator.geolocation) return; setDetecting(true); navigator.geolocation.getCurrentPosition((position) => { const value = position.coords.latitude < 0 && position.coords.longitude > 110 ? 'Sydney, NSW' : 'Remote'; setLocations((items) => items.includes(value) ? items : [...items, value]); setDetecting(false); }, () => setDetecting(false)); };
  const copy = async () => { await navigator.clipboard.writeText(prompt); setCopied(true); window.setTimeout(() => setCopied(false), 2000); };

  return (
    <div className='panel-xl flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden'>
      <div className='header'>
        <div className='flex items-center gap-3'>
          <div className='flex size-10 items-center justify-center rounded-xl bg-primary-gradient text-white shadow-xs'>
            <Sparkles className='size-5' />
          </div>
          <h2 className='text-lg font-bold text-ink-primary'>AI Job Discovery</h2>
        </div>
        <button
          type='button'
          aria-label='Close'
          onClick={onClose}
          className='cursor-pointer rounded-full p-2 text-ink-secondary transition-colors hover:bg-background-secondary hover:text-ink-primary'
        >
          <X className='size-5' />
        </button>
      </div>

      <div className='body space-y-4'>
        <section className='space-y-4 rounded-2xl border border-border/40 bg-background-secondary/35 p-4.5'>
          <span className='flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-ink-secondary'>
            <BriefcaseBusiness className='size-3.5 text-primary' /> Discovery parameters
          </span>

          <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
            <div className='flex flex-col justify-between space-y-2 rounded-xl border border-border/30 bg-panel/50 p-3'>
              <div className='flex items-center justify-between'>
                <label className='text-xs font-semibold text-ink-primary'>Job locations</label>
                <button
                  type='button'
                  onClick={detectLocation}
                  disabled={detecting}
                  className='inline-flex cursor-pointer items-center gap-1 text-[11px] font-medium text-primary hover:underline disabled:opacity-50'
                >
                  <Navigation className={detecting ? 'size-3 animate-spin' : 'size-3'} />
                  {detecting ? 'Detecting…' : 'Auto detect'}
                </button>
              </div>

              <div className='flex min-h-8 flex-wrap items-center gap-1.5'>
                {locations.map((value) => (
                  <Tag
                    key={value}
                    value={value}
                    onRemove={() => setLocations((items) => items.filter((item) => item !== value))}
                  />
                ))}
                {isAddingLocation ? (
                  <div className='inline-flex items-center gap-1.5'>
                    <input
                      autoFocus
                      value={locationInput}
                      onChange={(event) => setLocationInput(event.target.value)}
                      onKeyDown={(event) => event.key === 'Enter' && (event.preventDefault(), addLocation())}
                      placeholder='Location name…'
                      className='h-7 w-32 rounded-lg border border-primary/40 bg-panel px-2 text-xs text-ink-primary outline-none focus:border-primary'
                    />
                    <Button size='sm' className='h-7 px-2 text-xs' onClick={addLocation}>
                      Add
                    </Button>
                  </div>
                ) : (
                  <button
                    type='button'
                    onClick={() => setIsAddingLocation(true)}
                    className='inline-flex h-7 cursor-pointer items-center gap-1 rounded-lg border border-dashed border-border/80 bg-panel/40 px-2 text-[11px] font-medium text-ink-secondary transition-colors hover:border-primary/50 hover:text-primary'
                  >
                    <Plus className='size-3' /> Add location
                  </button>
                )}
              </div>
            </div>

            <div className='space-y-3'>
              <div className='space-y-1.5'>
                <label className='text-xs font-semibold text-ink-primary'>Recommendations</label>
                <div className='grid grid-cols-4 gap-1.5'>
                  {[10, 20, 30, 50].map((value) => (
                    <Choice key={value} active={count === value} onClick={() => setCount(value)}>
                      {value}
                    </Choice>
                  ))}
                </div>
              </div>

              <div className='space-y-1.5'>
                <label className='text-xs font-semibold text-ink-primary'>Published within</label>
                <div className='grid grid-cols-4 gap-1.5'>
                  {times.map((value) => (
                    <Choice key={value} active={publishedWithin === value} onClick={() => setPublishedWithin(value)}>
                      {value}
                    </Choice>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className='space-y-2 border-t border-border/30 pt-3'>
            <label className='text-xs font-semibold text-ink-primary'>Explore platforms</label>
            <PlatformTagSelector selected={selectedPlatforms} onChange={toggle} />
          </div>
        </section>

        <section className='space-y-2.5 rounded-2xl border border-border/40 bg-background-secondary/35 p-4.5'>
          <span className='flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-ink-secondary'>
            <Sparkles className='size-3.5 text-primary' /> AI prompt
          </span>
          <textarea
            readOnly
            rows={7}
            value={prompt}
            className='w-full resize-none rounded-xl border border-border/60 bg-panel/80 p-3 font-mono text-xs leading-relaxed text-ink-primary outline-none focus:border-primary/50 custom-scrollbar select-all'
          />
        </section>
      </div>

      <div className='footer'>
        <Button variant='ghost' onClick={onClose}>
          Close
        </Button>
        <Button Icon={copied ? Check : Copy} onClick={copy}>
          {copied ? 'Copied prompt' : 'Copy prompt'}
        </Button>
      </div>
    </div>
  );
}

function Choice({
  children,
  active,
  onClick,
}: {
  children: React.ReactNode;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type='button'
      onClick={onClick}
      className={`inline-flex h-8 cursor-pointer items-center justify-center rounded-lg text-xs font-medium transition-all ${
        active
          ? 'bg-primary text-white shadow-xs font-semibold'
          : 'bg-panel text-ink-secondary border border-border/40 hover:bg-background-secondary hover:text-ink-primary hover:border-border'
      }`}
    >
      {children}
    </button>
  );
}

function Tag({ value, onRemove }: { value: string; onRemove: () => void }) {
  return (
    <span className='inline-flex h-7 items-center gap-1.5 rounded-lg bg-primary/10 px-2.5 text-xs font-medium text-primary'>
      <span>{value}</span>
      <button
        type='button'
        aria-label={`Remove ${value}`}
        className='cursor-pointer rounded-full p-0.5 transition-colors hover:bg-primary/20'
        onClick={onRemove}
      >
        <X className='size-3' />
      </button>
    </span>
  );
}
