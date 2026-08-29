/** @format */

'use client';
import { Avatar } from '@jobby/ui';

import React, { useState } from 'react';
import {
  Building2,
  MapPin,
  ExternalLink,
  Sparkles,
  MessageSquare,
  CheckCircle2,
  Clock,
  UserCheck,
  Briefcase,
  ChevronRight,
  Trash2,
  Copy,
  Check,
  Users,
  Zap,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import type { Prospect, ProspectStatus } from '@/lib/types';

const LinkedInIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox='0 0 34 34' fill='currentColor'>
    <path
      className='fill-[#0a66c2]'
      d='M34 2.5v29a2.5 2.5 0 0 1-2.5 2.5h-29A2.5 2.5 0 0 1 0 31.5v-29A2.5 2.5 0 0 1 2.5 0h29A2.5 2.5 0 0 1 34 2.5M10 13H5v16h5zm.45-5.5a2.88 2.88 0 0 0-2.86-2.9H7.5a2.9 2.9 0 0 0 0 5.8 2.88 2.88 0 0 0 2.95-2.81zM29 19.28c0-4.81-3.06-6.68-6.1-6.68a5.7 5.7 0 0 0-5.06 2.58h-.14V13H13v16h5v-8.51a3.32 3.32 0 0 1 3-3.58h.19c1.59 0 2.77 1 2.77 3.52V29h5z'
    />
  </svg>
);

interface ProspectCardProps {
  prospect: Prospect;
  onStatusChange: (id: string, newStatus: ProspectStatus) => void;
  onOpenDetail: (prospect: Prospect) => void;
  onDelete: (id: string) => void;
}

type ScenarioId = 'referral' | 'networking' | 'manager_pitch';

const roleTypeBadge: Record<string, { label: string; className: string }> = {
  hiring_manager: {
    label: 'Hiring Manager',
    className:
      'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  },
  engineering_manager: {
    label: 'Engineering Manager',
    className:
      'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400',
  },
  recruiter: {
    label: 'Technical Recruiter',
    className: 'bg-sky-500/10 text-sky-600 dark:text-sky-400',
  },
};

const statusOptions: Array<{
  value: ProspectStatus;
  label: string;
  icon: React.ElementType;
}> = [
  { value: 'recommended', label: 'Recommended', icon: Sparkles },
  { value: 'contacted', label: 'Contacted', icon: Clock },
  { value: 'replied', label: 'Replied', icon: MessageSquare },
  { value: 'interviewing', label: 'Interviewing', icon: UserCheck },
  { value: 'archived', label: 'Archived', icon: CheckCircle2 },
];

export function ProspectCard({
  prospect,
  onStatusChange,
  onOpenDetail,
  onDelete,
}: ProspectCardProps) {
  const [copiedScenario, setCopiedScenario] = useState<ScenarioId | null>(null);
  const [hoveredScenario, setHoveredScenario] = useState<ScenarioId | null>(
    null,
  );

  const roleBadge = roleTypeBadge[prospect.role_type] || {
    label: prospect.role_type,
    className:
      'bg-slate-500/10 text-slate-600 dark:text-slate-400',
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .substring(0, 2)
      .toUpperCase();
  };

  const firstName = prospect.name.split(' ')[0] || 'there';
  const targetComp = prospect.company || 'your team';
  const targetJob = prospect.active_job_title || 'engineering positions';

  // 3 Distinct Outreach Scenarios
  const scenarioTexts: Record<
    ScenarioId,
    { title: string; label: string; text: string; icon: React.ReactNode }
  > = {
    referral: {
      title: 'Job Referral Request Note',
      label: 'Job Referral',
      icon: <UserCheck className='size-3.5 text-emerald-500 shrink-0' />,
      text: `Hi ${firstName},\n\nI noticed your team at ${targetComp} is actively recruiting for ${targetJob}. Given my background in TypeScript, React, and API infrastructure, I'd love to connect and see if you'd be open to referring my application for a screening chat!\n\nBest regards!`,
    },
    networking: {
      title: 'Tech Stack Networking Note',
      label: 'Networking',
      icon: <Users className='size-3.5 text-blue-500 shrink-0' />,
      text: `Hi ${firstName},\n\nI saw your work leading engineering initiatives at ${targetComp}. I'm currently expanding my technical network among engineering leaders and would love to connect to follow your team's updates and exchange architecture insights.\n\nBest!`,
    },
    manager_pitch: {
      title: 'Direct Hiring Manager Pitch Note',
      label: 'Direct Pitch',
      icon: <Zap className='size-3.5 text-amber-500 shrink-0' />,
      text: `Hi ${firstName},\n\nI'm a Senior Full Stack Engineer with a strong track record of shipping high-impact cloud applications. I noticed your team's initiatives at ${targetComp} regarding ${targetJob} and would love to share a brief overview of my recent work to see if I'd be a fit for your team.\n\nBest regards!`,
    },
  };

  const handleCopyScenarioText = (scenId: ScenarioId, textToCopy: string) => {
    navigator.clipboard.writeText(textToCopy);
    setCopiedScenario(scenId);
    setTimeout(() => setCopiedScenario(null), 2000);
  };

  const handleOpenLinkedIn = (e: React.MouseEvent) => {
    e.stopPropagation();
    const targetUrl =
      prospect.linkedin_url ||
      `https://www.linkedin.com/search/results/all/?keywords=${encodeURIComponent(
        prospect.name + ' ' + prospect.company,
      )}`;
    window.open(targetUrl, '_blank', 'noopener,noreferrer');
  };

  const handleOpenJob = (e: React.MouseEvent) => {
    e.stopPropagation();
    const targetUrl =
      prospect.active_job_url ||
      `https://www.google.com/search?q=${encodeURIComponent(
        `${prospect.company} ${prospect.active_job_title} careers`,
      )}`;
    window.open(targetUrl, '_blank', 'noopener,noreferrer');
  };

  const activeScenarioObj =
    hoveredScenario ? scenarioTexts[hoveredScenario] : null;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.98 }}
      onClick={() => onOpenDetail(prospect)}
      className='group relative flex flex-col justify-between rounded-2xl bg-panel/70 p-5 transition-all hover:shadow-md cursor-pointer'
    >
      {/* Top Header */}
      <div>
        <div className='flex items-start justify-between gap-3'>
          {/* Avatar & Name -> Clickable to LinkedIn */}
          <div
            onClick={handleOpenLinkedIn}
            className='flex col items-start gap-3.5 cursor-pointer group/user'
            title='Click to open LinkedIn profile'
          >
            {/* <div className='flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary-gradient font-bold text-white shadow-xs group-hover/user:scale-105 transition-transform'>
              {}
            </div> */}
            <Avatar name={prospect.name} />
            <div className='min-w-0 flex-1'>
              <div className='flex items-center gap-1.5'>
                <h3 className='truncate text-base font-bold text-ink-primary group-hover/user:text-primary transition-colors'>
                  {prospect.name}
                </h3>
                <LinkedInIcon className='size-4 shrink-0 text-slate-400 group-hover/user:text-[#0a66c2] transition-colors' />
              </div>
              <p
                className='truncate text-xs text-ink-secondary mt-0.5'
                title={prospect.title}
              >
                {prospect.title}
              </p>
            </div>
          </div>

          {/* Priority / AI Score Badge */}
          <div className='flex flex-col items-end shrink-0 absolute top-4 right-4'>
            <div
              className={cn(
                'flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold shadow-xs',
                (
                  (prospect.score_breakdown?.overall ||
                    prospect.priority_score) >= 90
                ) ?
                  'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                : 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
              )}
            >
              <Sparkles className='size-3.5' />
              <span>
                {prospect.score_breakdown?.overall || prospect.priority_score}%
                <span> Match </span>
              </span>
            </div>
          </div>
        </div>

        {/* Company & Meta info */}
        <div className='mt-3.5 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-ink-secondary'>
          <div className='flex items-center gap-1.5 font-medium text-ink-primary'>
            <Building2 className='size-3.5 text-primary' />
            <span>{prospect.company}</span>
          </div>
          {prospect.location && (
            <div className='flex items-center gap-1.5'>
              <MapPin className='size-3.5 text-slate-400' />
              <span>{prospect.location}</span>
            </div>
          )}
          <div
            className={cn(
              'rounded-md px-2 py-0.5 text-[11px] font-medium',
              roleBadge.className,
            )}
          >
            {roleBadge.label}
          </div>
        </div>

        {/* Multi-Dimensional AI Match Score Metrics */}
        <div className='mt-3 grid grid-cols-2 gap-x-6 text-[10px] font-semibold text-ink-secondary bg-background-secondary/40 p-2 rounded-xl'>
          <div className='flex items-center justify-between'>
            <span>Hiring Power:</span>
            <span className='text-emerald-600 dark:text-emerald-400 font-bold'>
              {prospect.score_breakdown?.hiring_power || 93}
            </span>
          </div>
          <div className='flex items-center justify-between'>
            <span>Reply Prob:</span>
            <span className='text-blue-600 dark:text-blue-400 font-bold'>
              {prospect.score_breakdown?.reply_probability || 88}%
            </span>
          </div>
          <div className='flex items-center justify-between'>
            <span>Company Match:</span>
            <span className='text-indigo-600 dark:text-indigo-400 font-bold'>
              {prospect.score_breakdown?.company_match || 95}%
            </span>
          </div>
          <div className='flex items-center justify-between'>
            <span>Experience:</span>
            <span className='text-amber-600 dark:text-amber-400 font-bold'>
              {prospect.score_breakdown?.experience_match || 90}%
            </span>
          </div>
        </div>

        {/* Active Job Requisition Bar -> Clickable entire bar */}
        {prospect.has_active_job && prospect.active_job_title && (
          <div
            onClick={handleOpenJob}
            className='mt-3 flex items-center justify-between rounded-xl bg-blue-500/10 px-3 py-2 text-xs hover:bg-blue-500/20  transition-colors cursor-pointer group/job'
            title='Click to view active job requisition'
          >
            <div className='flex items-center gap-2 min-w-0'>
              <Briefcase className='size-3.5 shrink-0 text-blue-500 group-hover/job:scale-110 transition-transform' />
              <span className='truncate font-medium text-ink-primary group-hover/job:text-blue-600 dark:group-hover/job:text-blue-400 transition-colors'>
                {prospect.active_job_title}
              </span>
            </div>
            <div className='ml-2 flex items-center gap-1 text-[11px] font-bold text-blue-600 dark:text-blue-400 shrink-0'>
              <span>View Job</span>
              <ExternalLink className='size-3' />
            </div>
          </div>
        )}

        {/* AI Recommendation Reason Box - Fully Expanded */}
        <div className='mt-3.5 rounded-xl bg-background-secondary/60 p-3.5 text-xs leading-relaxed text-ink-secondary'>
          <div className='mb-1.5 flex items-center justify-between font-semibold text-primary text-[11px] uppercase tracking-wider'>
            <div className='flex items-center gap-1.5'>
              <Sparkles className='size-3.5 text-primary' />
              <span>AI Recommendation Reason</span>
            </div>
          </div>
          <p className='text-ink-primary/90 leading-relaxed whitespace-pre-wrap font-normal '>
            {prospect.recommendation_reason}
          </p>
        </div>

        {/* 3 Tiled Outreach Scenario Copy Buttons Below AI Recommendation Reason */}
        <div className='relative mt-3.5'>
          <div className='text-[10px] font-bold text-ink-secondary uppercase tracking-wider mb-1.5 flex items-center gap-1'>
            <MessageSquare className='size-3 text-primary' />
            <span>Copy Outreach Note (Hover to preview)</span>
          </div>
          <div className='grid grid-cols-3 gap-1.5'>
            {(
              [
                { id: 'referral', ...scenarioTexts.referral },
                { id: 'networking', ...scenarioTexts.networking },
                { id: 'manager_pitch', ...scenarioTexts.manager_pitch },
              ] as const
            ).map((scen) => {
              const isCopied = copiedScenario === scen.id;
              const isHovered = hoveredScenario === scen.id;

              return (
                <button
                  key={scen.id}
                  type='button'
                  onMouseEnter={() => setHoveredScenario(scen.id)}
                  onMouseLeave={() => setHoveredScenario(null)}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleCopyScenarioText(scen.id, scen.text);
                  }}
                  className={cn(
                    'flex items-center justify-center gap-1 rounded-xl p-2 text-[11px] font-semibold transition-all cursor-pointer shadow-xs',
                    isCopied ?
                      'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold'
                    : isHovered ?
                      'bg-primary/10 text-ink-primary shadow-sm scale-[1.02]'
                    : 'bg-background/70 text-ink-secondary hover:text-ink-primary hover:bg-background-secondary',
                  )}
                  title={`Copy ${scen.title}`}
                >
                  {isCopied ?
                    <>
                      <Check className='size-3 text-emerald-500 shrink-0' />
                      <span className='text-emerald-600 dark:text-emerald-400 truncate font-bold'>
                        Copied!
                      </span>
                    </>
                  : <>
                      <Copy className='size-3 text-primary shrink-0' />
                      <span className='truncate'>{scen.label}</span>
                    </>
                  }
                </button>
              );
            })}
          </div>

          {/* Hover Popover showing text preview + word/character count with backdrop-blur-xl */}
          <AnimatePresence>
            {activeScenarioObj && (
              <motion.div
                initial={{ opacity: 0, y: 8, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 8, scale: 0.96 }}
                transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
                className='absolute bottom-full left-0 right-0 mb-2.5 z-50 rounded-2xl bg-panel/95 backdrop-blur-xl p-4 shadow-2xl text-xs space-y-2.5 pointer-events-none'
              >
                <div className='flex col items-center justify-between pb-2'>
                  <div className='flex items-center gap-1.5 font-bold text-ink-primary text-xs'>
                    {activeScenarioObj.icon}
                    <span>{activeScenarioObj.title}</span>
                  </div>
                  <span className='font-mono text-[10px] font-bold text-primary bg-primary/10 px-1 py-0.5 rounded-full'>
                    {activeScenarioObj.text.length} chars |{' '}
                    {
                      activeScenarioObj.text.trim().split(/\s+/).filter(Boolean)
                        .length
                    }{' '}
                    words
                  </span>
                </div>
                <p className='text-[11px] text-ink-primary leading-relaxed font-mono whitespace-pre-wrap bg-background/80 p-3 pb-6! rounded-xl'>
                  {activeScenarioObj.text}
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Footer Controls */}
      <div className='mt-4 flex items-center justify-between pt-3 text-xs gap-2'>
        {/* Status Selector */}
        <div
          className='flex items-center gap-2'
          onClick={(e) => e.stopPropagation()}
        >
          <label
            htmlFor={`status-select-${prospect.id}`}
            className='text-[11px] text-ink-secondary font-medium'
          >
            Status:
          </label>
          <select
            id={`status-select-${prospect.id}`}
            aria-label='Prospect status'
            value={prospect.status}
            onChange={(e) =>
              onStatusChange(prospect.id, e.target.value as ProspectStatus)
            }
            className='rounded-lg bg-background px-2.5 py-1 text-xs font-medium text-ink-primary focus:outline-hidden focus:ring-2 focus:ring-primary/40 cursor-pointer'
          >
            {statusOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        <div className='flex items-center gap-2'>
          <button
            type='button'
            onClick={(e) => {
              e.stopPropagation();
              onDelete(prospect.id);
            }}
            className='rounded-lg p-1.5 text-slate-400 hover:bg-red-500/10 hover:text-red-500 transition-colors cursor-pointer'
            title='Delete Prospect'
          >
            <Trash2 className='size-3.5' />
          </button>
          <button
            type='button'
            onClick={(e) => {
              e.stopPropagation();
              onOpenDetail(prospect);
            }}
            className='flex items-center gap-0.5 text-xs font-semibold text-primary hover:text-primary/80 transition-colors cursor-pointer'
          >
            <span>Details</span>
            <ChevronRight className='size-3.5' />
          </button>
        </div>
      </div>
    </motion.div>
  );
}
