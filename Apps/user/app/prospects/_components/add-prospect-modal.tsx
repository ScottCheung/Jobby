/** @format */

'use client';

import React, { useState } from 'react';
import { X, UserPlus } from 'lucide-react';
import { api } from '@/lib/api';
import type {
  Prospect,
  ProspectRoleType,
  ProspectStatus,
} from '@/lib/types';

interface AddProspectModalProps {
  isOpen?: boolean;
  onClose: () => void;
  onSuccess: (newProspect: Prospect) => void;
}

export function AddProspectModal({
  isOpen = true,
  onClose,
  onSuccess,
}: AddProspectModalProps) {
  const [name, setName] = useState('');
  const [title, setTitle] = useState('');
  const [company, setCompany] = useState('');
  const [roleType, setRoleType] = useState<ProspectRoleType>('hiring_manager');
  const [location, setLocation] = useState('');
  const [linkedinUrl, setLinkedinUrl] = useState('');
  const [hasActiveJob, setHasActiveJob] = useState(false);
  const [activeJobTitle, setActiveJobTitle] = useState('');
  const [activeJobUrl, setActiveJobUrl] = useState('');
  const [priorityScore, setPriorityScore] = useState(85);
  const [recommendationReason, setRecommendationReason] = useState('');
  const [status, setStatus] = useState<ProspectStatus>('recommended');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (
      !name.trim() ||
      !title.trim() ||
      !company.trim() ||
      !recommendationReason.trim()
    ) {
      setError(
        'Please fill in all required fields (Name, Title, Company, Rationale).',
      );
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const created = await api.createProspect({
        name: name.trim(),
        title: title.trim(),
        company: company.trim(),
        role_type: roleType,
        location: location.trim() || undefined,
        linkedin_url: linkedinUrl.trim() || undefined,
        has_active_job: hasActiveJob,
        active_job_title: activeJobTitle.trim() || undefined,
        active_job_url: activeJobUrl.trim() || undefined,
        priority_score: Number(priorityScore),
        match_level:
          priorityScore >= 90 ? 'high'
          : priorityScore >= 75 ? 'medium'
          : 'low',
        recommendation_reason: recommendationReason.trim(),
        status,
        notes: notes.trim() || undefined,
      });

      onSuccess(created);
      setIsSubmitting(false);
      onClose();
      // Reset form
      setName('');
      setTitle('');
      setCompany('');
      setLocation('');
      setLinkedinUrl('');
      setHasActiveJob(false);
      setActiveJobTitle('');
      setActiveJobUrl('');
      setPriorityScore(85);
      setRecommendationReason('');
      setNotes('');
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to create prospect',
      );
      setIsSubmitting(false);
    }
  };

  return (
    <div className='relative w-full max-w-2xl overflow-hidden rounded-3xl border border-border/80 bg-panel shadow-2xl flex flex-col max-h-[90vh]'>
      {/* Header */}
      <div className='flex items-center justify-between border-b border-border/60 px-6 py-4 bg-background-secondary/40 shrink-0'>
        <div className='flex items-center gap-3'>
          <div className='flex size-10 items-center justify-center rounded-xl bg-primary-gradient text-white shadow-xs'>
            <UserPlus className='size-5' />
          </div>
          <div>
            <h2 className='text-lg font-bold text-ink-primary'>
              Add New Prospect
            </h2>
            <p className='text-xs text-ink-secondary'>
              Manually add a recruiter, Hiring Manager, or Engineering Manager
              to Jobby.
            </p>
          </div>
        </div>
        <button
          type='button'
          onClick={onClose}
          className='rounded-full p-2 text-ink-secondary hover:bg-background-secondary hover:text-ink-primary transition-colors cursor-pointer'
        >
          <X className='size-5' />
        </button>
      </div>

      {/* Form */}
      <form
        onSubmit={handleSubmit}
        className='flex-1 overflow-y-auto p-6 space-y-4 text-xs'
      >
        {error && (
          <div className='rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-red-600 dark:text-red-400 font-medium'>
            {error}
          </div>
        )}

        {/* Basic Info */}
        <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
          <div>
            <label className='block font-semibold text-ink-primary mb-1'>
              Candidate Name <span className='text-red-500'>*</span>
            </label>
            <input
              type='text'
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder='e.g. Sarah Jenkins'
              className='w-full rounded-xl border border-border bg-background px-3 py-2 text-xs text-ink-primary focus:outline-hidden focus:ring-2 focus:ring-primary/40'
            />
          </div>

          <div>
            <label className='block font-semibold text-ink-primary mb-1'>
              Company <span className='text-red-500'>*</span>
            </label>
            <input
              type='text'
              required
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              placeholder='e.g. Stripe'
              className='w-full rounded-xl border border-border bg-background px-3 py-2 text-xs text-ink-primary focus:outline-hidden focus:ring-2 focus:ring-primary/40'
            />
          </div>
        </div>

        <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
          <div>
            <label className='block font-semibold text-ink-primary mb-1'>
              Job Title <span className='text-red-500'>*</span>
            </label>
            <input
              type='text'
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder='e.g. Engineering Manager - Infrastructure'
              className='w-full rounded-xl border border-border bg-background px-3 py-2 text-xs text-ink-primary focus:outline-hidden focus:ring-2 focus:ring-primary/40'
            />
          </div>

          <div>
            <label className='block font-semibold text-ink-primary mb-1'>
              Role Category
            </label>
            <select
              value={roleType}
              onChange={(e) =>
                setRoleType(e.target.value as ProspectRoleType)
              }
              className='w-full rounded-xl border border-border bg-background px-3 py-2 text-xs text-ink-primary focus:outline-hidden focus:ring-2 focus:ring-primary/40 cursor-pointer'
            >
              <option value='hiring_manager'>Hiring Manager</option>
              <option value='engineering_manager'>Engineering Manager</option>
              <option value='recruiter'>Technical Recruiter</option>
            </select>
          </div>
        </div>

        <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
          <div>
            <label className='block font-semibold text-ink-primary mb-1'>
              Location
            </label>
            <input
              type='text'
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder='e.g. San Francisco, CA'
              className='w-full rounded-xl border border-border bg-background px-3 py-2 text-xs text-ink-primary focus:outline-hidden focus:ring-2 focus:ring-primary/40'
            />
          </div>

          <div>
            <label className='block font-semibold text-ink-primary mb-1'>
              LinkedIn URL
            </label>
            <input
              type='url'
              value={linkedinUrl}
              onChange={(e) => setLinkedinUrl(e.target.value)}
              placeholder='https://www.linkedin.com/in/username'
              className='w-full rounded-xl border border-border bg-background px-3 py-2 text-xs text-ink-primary focus:outline-hidden focus:ring-2 focus:ring-primary/40'
            />
          </div>
        </div>

        {/* Active Requisition Check */}
        <div className='rounded-2xl border border-border/60 bg-background-secondary/30 p-4 space-y-3'>
          <div className='flex items-center gap-2'>
            <input
              type='checkbox'
              id='hasActiveJob'
              checked={hasActiveJob}
              onChange={(e) => setHasActiveJob(e.target.checked)}
              className='size-4 rounded border-border text-primary focus:ring-primary/40 cursor-pointer'
            />
            <label
              htmlFor='hasActiveJob'
              className='font-semibold text-ink-primary cursor-pointer'
            >
              Has Verified Active Job Requisition
            </label>
          </div>

          {hasActiveJob && (
            <div className='grid grid-cols-1 md:grid-cols-2 gap-3 pt-1'>
              <div>
                <label className='block text-ink-secondary mb-1'>
                  Active Job Title
                </label>
                <input
                  type='text'
                  value={activeJobTitle}
                  onChange={(e) => setActiveJobTitle(e.target.value)}
                  placeholder='e.g. Senior Full Stack Engineer'
                  className='w-full rounded-xl border border-border bg-background px-3 py-2 text-xs text-ink-primary'
                />
              </div>
              <div>
                <label className='block text-ink-secondary mb-1'>
                  Active Job Link
                </label>
                <input
                  type='url'
                  value={activeJobUrl}
                  onChange={(e) => setActiveJobUrl(e.target.value)}
                  placeholder='https://company.com/jobs/...'
                  className='w-full rounded-xl border border-border bg-background px-3 py-2 text-xs text-ink-primary'
                />
              </div>
            </div>
          )}
        </div>

        {/* Score & Recommendation Rationale */}
        <div className='grid grid-cols-1 md:grid-cols-3 gap-4'>
          <div>
            <label className='block font-semibold text-ink-primary mb-1'>
              Priority Match Score (1-100)
            </label>
            <input
              type='number'
              min={1}
              max={100}
              value={priorityScore}
              onChange={(e) => setPriorityScore(Number(e.target.value))}
              className='w-full rounded-xl border border-border bg-background px-3 py-2 text-xs text-ink-primary font-bold'
            />
          </div>

          <div className='md:col-span-2'>
            <label className='block font-semibold text-ink-primary mb-1'>
              Status
            </label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as ProspectStatus)}
              className='w-full rounded-xl border border-border bg-background px-3 py-2 text-xs text-ink-primary font-medium cursor-pointer'
            >
              <option value='recommended'>Recommended</option>
              <option value='contacted'>Contacted</option>
              <option value='replied'>Replied</option>
              <option value='interviewing'>Interviewing</option>
              <option value='archived'>Archived</option>
            </select>
          </div>
        </div>

        <div>
          <label className='block font-semibold text-ink-primary mb-1'>
            Recommendation Rationale <span className='text-red-500'>*</span>
          </label>
          <textarea
            required
            rows={3}
            value={recommendationReason}
            onChange={(e) => setRecommendationReason(e.target.value)}
            placeholder='Detail why this recruiter or manager is worth contacting...'
            className='w-full rounded-xl border border-border bg-background p-3 text-xs text-ink-primary focus:outline-hidden focus:ring-2 focus:ring-primary/40'
          />
        </div>

        <div>
          <label className='block font-semibold text-ink-primary mb-1'>
            Personal Notes
          </label>
          <textarea
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder='Optional outreach history, referral notes...'
            className='w-full rounded-xl border border-border bg-background p-3 text-xs text-ink-primary focus:outline-hidden focus:ring-2 focus:ring-primary/40'
          />
        </div>

        {/* Footer Buttons */}
        <div className='border-t border-border/60 pt-4 flex items-center justify-end gap-3 shrink-0'>
          <button
            type='button'
            onClick={onClose}
            className='rounded-xl border border-border bg-background px-4 py-2.5 text-xs font-semibold text-ink-primary hover:bg-background-secondary transition-colors cursor-pointer'
          >
            Cancel
          </button>
          <button
            type='submit'
            disabled={isSubmitting}
            className='flex items-center gap-2 rounded-xl bg-primary-gradient px-5 py-2.5 text-xs font-bold text-white shadow-xs hover:opacity-90 transition-opacity disabled:opacity-50 cursor-pointer'
          >
            <UserPlus className='size-3.5' />
            <span>{isSubmitting ? 'Saving...' : 'Add Prospect'}</span>
          </button>
        </div>
      </form>
    </div>
  );
}
