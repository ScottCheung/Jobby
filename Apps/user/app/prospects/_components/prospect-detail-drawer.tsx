/** @format */

'use client';

import React, { useState, useEffect } from 'react';
import {
  X,
  Building2,
  MapPin,
  ExternalLink,
  Sparkles,
  Copy,
  Check,
  Briefcase,
  UserCheck,
  Save,
  MessageSquare,
  Trash2,
  Edit3,
} from 'lucide-react';
import { api } from '@/lib/api';
import type { Prospect, ProspectStatus, ProspectRoleType } from '@/lib/types';

const LinkedInIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox='0 0 34 34' fill='currentColor'>
    <path
      className='fill-[#0a66c2]'
      d='M34 2.5v29a2.5 2.5 0 0 1-2.5 2.5h-29A2.5 2.5 0 0 1 0 31.5v-29A2.5 2.5 0 0 1 2.5 0h29A2.5 2.5 0 0 1 34 2.5M10 13H5v16h5zm.45-5.5a2.88 2.88 0 0 0-2.86-2.9H7.5a2.9 2.9 0 0 0 0 5.8 2.88 2.88 0 0 0 2.95-2.81zM29 19.28c0-4.81-3.06-6.68-6.1-6.68a5.7 5.7 0 0 0-5.06 2.58h-.14V13H13v16h5v-8.51a3.32 3.32 0 0 1 3-3.58h.19c1.59 0 2.77 1 2.77 3.52V29h5z'
    />
  </svg>
);

interface ProspectDetailDrawerProps {
  prospect: Prospect | null;
  onClose: () => void;
  onUpdate: (updated: Prospect) => void;
  onDelete: (id: string) => void;
}

export function ProspectDetailDrawer({
  prospect,
  onClose,
  onUpdate,
  onDelete,
}: ProspectDetailDrawerProps) {
  const [isEditing, setIsEditing] = useState(false);

  // Form State
  const [name, setName] = useState('');
  const [title, setTitle] = useState('');
  const [company, setCompany] = useState('');
  const [roleType, setRoleType] = useState<ProspectRoleType>('hiring_manager');
  const [location, setLocation] = useState('');
  const [linkedinUrl, setLinkedinUrl] = useState('');
  const [activeJobTitle, setActiveJobTitle] = useState('');
  const [priorityScore, setPriorityScore] = useState(85);
  const [recommendationReason, setRecommendationReason] = useState('');
  const [status, setStatus] = useState<ProspectStatus>('recommended');
  const [notes, setNotes] = useState('');

  const [pitchIntent, setPitchIntent] = useState<
    'referral' | 'networking' | 'manager_pitch'
  >('referral');
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [copiedPitch, setCopiedPitch] = useState(false);

  useEffect(() => {
    if (prospect) {
      setName(prospect.name || '');
      setTitle(prospect.title || '');
      setCompany(prospect.company || '');
      setRoleType(prospect.role_type || 'hiring_manager');
      setLocation(prospect.location || '');
      setLinkedinUrl(prospect.linkedin_url || '');
      setActiveJobTitle(prospect.active_job_title || '');
      setPriorityScore(prospect.priority_score || 85);
      setRecommendationReason(prospect.recommendation_reason || '');
      setStatus(prospect.status || 'recommended');
      setNotes(prospect.notes || '');
      setIsEditing(false);
    }
  }, [prospect]);

  if (!prospect) return null;

  const generateOutreachPitch = () => {
    const firstName = name.split(' ')[0] || 'there';
    const targetComp = company || 'your team';
    const targetJob = activeJobTitle || 'engineering positions';

    if (pitchIntent === 'referral') {
      return `Hi ${firstName},\n\nI noticed your team at ${targetComp} is actively recruiting for ${targetJob}. Given my background in TypeScript, React, and API infrastructure, I'd love to connect and see if you'd be open to referring my application for a screening chat!\n\nBest regards!`;
    }
    if (pitchIntent === 'networking') {
      return `Hi ${firstName},\n\nI saw your work leading engineering initiatives at ${targetComp}. I'm currently expanding my professional network among technical leaders and would love to connect to follow your team's updates and exchange architecture insights.\n\nBest!`;
    }
    return `Hi ${firstName},\n\nI'm a Senior Full Stack Engineer with a strong track record of shipping high-impact cloud applications. I noticed your team's initiatives at ${targetComp} regarding ${targetJob} and would love to share a brief overview of my recent work to see if I'd be a fit for your team.\n\nBest regards!`;
  };

  const pitchText = generateOutreachPitch();

  const handleCopyPitch = () => {
    navigator.clipboard.writeText(pitchText);
    setCopiedPitch(true);
    setTimeout(() => setCopiedPitch(false), 2000);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const updated = await api.updateProspect(prospect.id, {
        name,
        title,
        company,
        role_type: roleType,
        location,
        linkedin_url: linkedinUrl,
        active_job_title: activeJobTitle,
        has_active_job: Boolean(activeJobTitle),
        priority_score: Number(priorityScore),
        recommendation_reason: recommendationReason,
        status,
        notes,
        last_interacted_at:
          status !== 'recommended' ?
            new Date().toISOString()
          : prospect.last_interacted_at,
      });
      onUpdate(updated);
      setIsSaving(false);
      setIsEditing(false);
    } catch (err) {
      console.error('Failed to update prospect:', err);
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm(`Are you sure you want to delete ${prospect.name}?`))
      return;
    setIsDeleting(true);
    try {
      await api.deleteProspect(prospect.id);
      onDelete(prospect.id);
      setIsDeleting(false);
      onClose();
    } catch (err) {
      console.error('Failed to delete prospect:', err);
      setIsDeleting(false);
    }
  };

  return (
    <div className='relative flex h-full w-full flex-col justify-between bg-panel p-6 overflow-y-auto'>
      {/* Header */}
      <div>
        <div className='flex items-center justify-between border-b border-border/40 pb-4'>
          <div className='flex items-center gap-2'>
            <UserCheck className='size-5 text-primary' />
            <h2 className='text-lg font-bold text-ink-primary'>
              {isEditing ?
                'Edit Prospect Details'
              : 'Prospect Outreach Details'}
            </h2>
          </div>

          <div className='flex items-center gap-2'>
            <button
              onClick={() => setIsEditing((prev) => !prev)}
              className={`rounded-lg px-2.5 py-1 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer ${
                isEditing ?
                  'bg-primary text-white'
                : 'border border-border text-ink-primary hover:bg-background-secondary'
              }`}
            >
              <Edit3 className='size-3.5' />
              <span>{isEditing ? 'Viewing' : 'Edit'}</span>
            </button>
            <button
              onClick={onClose}
              className='rounded-full p-2 text-ink-secondary hover:bg-background-secondary hover:text-ink-primary transition-colors cursor-pointer'
            >
              <X className='size-5' />
            </button>
          </div>
        </div>

        {/* Profile Info / Form */}
        {isEditing ?
          /* Edit Form Mode */
          <div className='mt-5 space-y-3.5 text-xs'>
            <div className='grid grid-cols-2 gap-3'>
              <div>
                <label className='font-semibold text-ink-primary block mb-1'>
                  Name
                </label>
                <input
                  type='text'
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className='w-full rounded-xl border border-border bg-background p-2.5 text-xs text-ink-primary'
                />
              </div>
              <div>
                <label className='font-semibold text-ink-primary block mb-1'>
                  Company
                </label>
                <input
                  type='text'
                  value={company}
                  onChange={(e) => setCompany(e.target.value)}
                  className='w-full rounded-xl border border-border bg-background p-2.5 text-xs text-ink-primary'
                />
              </div>
            </div>

            <div>
              <label className='font-semibold text-ink-primary block mb-1'>
                Job Title
              </label>
              <input
                type='text'
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className='w-full rounded-xl border border-border bg-background p-2.5 text-xs text-ink-primary'
              />
            </div>

            <div className='grid grid-cols-2 gap-3'>
              <div>
                <label className='font-semibold text-ink-primary block mb-1'>
                  Role Category
                </label>
                <select
                  value={roleType}
                  onChange={(e) =>
                    setRoleType(e.target.value as ProspectRoleType)
                  }
                  className='w-full rounded-xl border border-border bg-background p-2 text-xs text-ink-primary'
                >
                  <option value='hiring_manager'>Hiring Manager</option>
                  <option value='engineering_manager'>
                    Engineering Manager
                  </option>
                  <option value='recruiter'>Technical Recruiter</option>
                </select>
              </div>
              <div>
                <label className='font-semibold text-ink-primary block mb-1'>
                  Priority Score (1-100)
                </label>
                <input
                  type='number'
                  min={1}
                  max={100}
                  value={priorityScore}
                  onChange={(e) => setPriorityScore(Number(e.target.value))}
                  className='w-full rounded-xl border border-border bg-background p-2 text-xs text-ink-primary font-bold'
                />
              </div>
            </div>

            <div className='grid grid-cols-2 gap-3'>
              <div>
                <label className='font-semibold text-ink-primary block mb-1'>
                  Location
                </label>
                <input
                  type='text'
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  className='w-full rounded-xl border border-border bg-background p-2 text-xs text-ink-primary'
                />
              </div>
              <div>
                <label className='font-semibold text-ink-primary block mb-1'>
                  LinkedIn URL
                </label>
                <input
                  type='url'
                  value={linkedinUrl}
                  onChange={(e) => setLinkedinUrl(e.target.value)}
                  className='w-full rounded-xl border border-border bg-background p-2 text-xs text-ink-primary'
                />
              </div>
            </div>

            <div>
              <label className='font-semibold text-ink-primary block mb-1'>
                Active Job Requisition Title
              </label>
              <input
                type='text'
                value={activeJobTitle}
                onChange={(e) => setActiveJobTitle(e.target.value)}
                placeholder='Leave empty if no active opening'
                className='w-full rounded-xl border border-border bg-background p-2.5 text-xs text-ink-primary'
              />
            </div>

            <div>
              <label className='font-semibold text-ink-primary block mb-1'>
                Recommendation Rationale
              </label>
              <textarea
                rows={3}
                value={recommendationReason}
                onChange={(e) => setRecommendationReason(e.target.value)}
                className='w-full rounded-xl border border-border bg-background p-2.5 text-xs text-ink-primary'
              />
            </div>
          </div>
        : /* View Mode */
          <>
            {/* Profile Info Card */}
            <div className='mt-5 rounded-2xl border border-border/60 bg-background-secondary/40 p-4 flex flex-col gap-3'>
              <div className='flex items-start justify-between gap-3'>
                <div>
                  <h3 className='text-base font-bold text-ink-primary'>
                    {name}
                  </h3>
                  <p className='text-xs text-ink-secondary mt-0.5'>{title}</p>
                </div>
                <div className='flex items-center gap-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 px-3 py-1 text-xs font-bold text-emerald-600 dark:text-emerald-400'>
                  <Sparkles className='size-3.5' />
                  <span>{priorityScore}% Priority</span>
                </div>
              </div>

              <div className='flex flex-wrap items-center gap-4 text-xs text-ink-secondary pt-1 border-t border-border/40'>
                <div className='flex items-center gap-1.5 font-medium text-ink-primary'>
                  <Building2 className='size-3.5 text-primary' />
                  <span>{company}</span>
                </div>
                {location && (
                  <div className='flex items-center gap-1.5'>
                    <MapPin className='size-3.5 text-slate-400' />
                    <span>{location}</span>
                  </div>
                )}
                {linkedinUrl && (
                  <a
                    href={linkedinUrl}
                    target='_blank'
                    rel='noopener noreferrer'
                    className='flex items-center gap-1 text-blue-600 hover:underline font-medium'
                  >
                    <LinkedInIcon className='size-3.5' />
                    <span>LinkedIn Profile</span>
                    <ExternalLink className='size-3' />
                  </a>
                )}
              </div>
            </div>

            {/* Active Job Requisition */}
            {activeJobTitle && (
              <div className='mt-4 rounded-2xl border border-blue-500/30 bg-blue-500/10 p-4 flex flex-col gap-2'>
                <div className='flex items-center justify-between text-xs font-semibold text-blue-600 dark:text-blue-400'>
                  <span className='flex items-center gap-1.5'>
                    <Briefcase className='size-4' /> Verified Active
                    Requisition
                  </span>
                </div>
                <p className='text-xs font-medium text-ink-primary'>
                  {activeJobTitle}
                </p>
              </div>
            )}

            {/* Multi-Dimensional AI Score Breakdown Panel */}
            <div className='mt-4 rounded-2xl border border-primary/25 bg-primary/5 p-4 space-y-3 text-xs'>
              <div className='flex items-center justify-between'>
                <span className='font-bold text-ink-primary flex items-center gap-1.5 uppercase tracking-wider text-[11px]'>
                  <Sparkles className='size-3.5 text-primary' />{' '}
                  Multi-Dimensional AI Match Score
                </span>
                <span className='rounded-full bg-emerald-500/10 border border-emerald-500/30 px-2.5 py-0.5 text-xs font-bold text-emerald-600 dark:text-emerald-400'>
                  {prospect.score_breakdown?.overall || priorityScore}% Overall
                </span>
              </div>

              <div className='grid grid-cols-1 md:grid-cols-2 gap-3 pt-1'>
                {[
                  {
                    label: 'Hiring Power',
                    score: prospect.score_breakdown?.hiring_power || 93,
                    color: 'bg-emerald-500',
                  },
                  {
                    label: 'Reply Probability',
                    score: prospect.score_breakdown?.reply_probability || 88,
                    color: 'bg-blue-500',
                  },
                  {
                    label: 'Company Match',
                    score: prospect.score_breakdown?.company_match || 95,
                    color: 'bg-indigo-500',
                  },
                  {
                    label: 'Experience Match',
                    score: prospect.score_breakdown?.experience_match || 90,
                    color: 'bg-amber-500',
                  },
                ].map((m) => (
                  <div
                    key={m.label}
                    className='space-y-1 bg-background/60 p-2.5 rounded-xl border border-border/40'
                  >
                    <div className='flex items-center justify-between text-[11px] font-semibold text-ink-secondary'>
                      <span>{m.label}</span>
                      <span className='font-bold text-ink-primary'>
                        {m.score}%
                      </span>
                    </div>
                    <div className='h-1.5 w-full rounded-full bg-background-secondary overflow-hidden'>
                      <div
                        className={`h-full rounded-full ${m.color}`}
                        style={{ width: `${m.score}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* AI Recommendation Reason */}
            <div className='mt-4 rounded-2xl border border-border/60 bg-background/50 p-4 flex flex-col gap-2 text-xs'>
              <span className='font-bold text-ink-primary flex items-center gap-1.5 uppercase tracking-wider text-[11px]'>
                <Sparkles className='size-3.5 text-primary' /> Recommendation
                Rationale
              </span>
              <p className='text-ink-primary leading-relaxed'>
                {recommendationReason}
              </p>
            </div>
          </>
        }

        {/* AI Automated Connection Note Generator */}
        <div className='mt-4 rounded-2xl border border-border/60 bg-background/50 p-4 flex flex-col gap-3'>
          <div className='flex items-center justify-between text-xs'>
            <span className='font-bold text-ink-primary flex items-center gap-1.5'>
              <MessageSquare className='size-3.5 text-primary' /> AI Generated
              Connection Note
            </span>
            <button
              onClick={handleCopyPitch}
              className='flex items-center gap-1.5 rounded-lg border border-border bg-background px-2.5 py-1 text-[11px] font-medium text-ink-primary hover:bg-background-secondary transition-colors cursor-pointer'
            >
              {copiedPitch ?
                <>
                  <Check className='size-3 text-emerald-500' />
                  <span className='text-emerald-500 font-semibold'>
                    Copied Note!
                  </span>
                </>
              : <>
                  <Copy className='size-3' />
                  <span>Copy Note</span>
                </>
              }
            </button>
          </div>

          {/* Scenario Pills */}
          <div className='flex items-center gap-1.5 text-[11px] font-medium'>
            {[
              { id: 'referral', label: 'Job Referral' },
              { id: 'networking', label: 'Tech Networking' },
              { id: 'manager_pitch', label: 'Direct Pitch' },
            ].map((opt) => (
              <button
                key={opt.id}
                type='button'
                onClick={() => setPitchIntent(opt.id as typeof pitchIntent)}
                className={`rounded-lg px-2.5 py-1 transition-all cursor-pointer ${
                  pitchIntent === opt.id ?
                    'bg-primary text-white font-semibold shadow-xs'
                  : 'bg-background border border-border/60 text-ink-secondary hover:text-ink-primary'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          <textarea
            readOnly
            value={pitchText}
            rows={5}
            className='w-full rounded-xl border border-border bg-background p-3 text-xs text-ink-primary font-mono leading-relaxed focus:outline-hidden no-scrollbar'
          />
        </div>

        {/* Notes & Status Section */}
        <div className='mt-4 flex flex-col gap-3 text-xs'>
          <div>
            <label className='font-semibold text-ink-primary block mb-1.5'>
              Status
            </label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as ProspectStatus)}
              className='w-full rounded-xl border border-border bg-background p-2.5 text-xs font-medium text-ink-primary focus:outline-hidden focus:ring-2 focus:ring-primary/40 cursor-pointer'
            >
              <option value='recommended'>Recommended</option>
              <option value='contacted'>Contacted</option>
              <option value='replied'>Replied</option>
              <option value='interviewing'>Interviewing</option>
              <option value='archived'>Archived</option>
            </select>
          </div>

          <div>
            <label className='font-semibold text-ink-primary block mb-1.5'>
              Personal Notes
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder='Add outreach notes, email dates, or referral details...'
              rows={3}
              className='w-full rounded-xl border border-border bg-background p-3 text-xs text-ink-primary focus:outline-hidden focus:ring-2 focus:ring-primary/40'
            />
          </div>
        </div>
      </div>

      {/* Footer Save & Delete CTA */}
      <div className='mt-6 border-t border-border/40 pt-4 flex items-center justify-between gap-3 shrink-0'>
        <button
          onClick={handleDelete}
          disabled={isDeleting}
          className='flex items-center gap-1.5 rounded-xl border border-red-500/30 bg-red-500/10 px-3.5 py-2.5 text-xs font-semibold text-red-600 dark:text-red-400 hover:bg-red-500/20 transition-colors disabled:opacity-50 cursor-pointer'
        >
          <Trash2 className='size-3.5' />
          <span>{isDeleting ? 'Deleting...' : 'Delete'}</span>
        </button>

        <div className='flex items-center gap-2'>
          <button
            onClick={onClose}
            className='rounded-xl border border-border bg-background px-4 py-2.5 text-xs font-semibold text-ink-primary hover:bg-background-secondary transition-colors cursor-pointer'
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className='flex items-center gap-2 rounded-xl bg-primary-gradient px-5 py-2.5 text-xs font-semibold text-white shadow-xs hover:opacity-90 transition-opacity disabled:opacity-50 cursor-pointer'
          >
            <Save className='size-3.5' />
            <span>{isSaving ? 'Saving...' : 'Save Prospect'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
