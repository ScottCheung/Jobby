/** @format */

'use client';

import React, { useState, useEffect } from 'react';
import { X, Building2, Briefcase, Calendar } from 'lucide-react';
import { Button } from '@/components/UI/Button';
import { Modal } from '@/components/layout/modal';
import { showGlobalToast } from '@/lib/toast';
import { useConsole } from '@/components/ConsoleContext';
import { cn } from '@/lib/utils';

export interface InterviewReportData {
  company: string;
  role: string;
  happened_at: string; // ISO date string
}

const COMMON_COMPANIES = [
  'Google',
  'Meta',
  'Amazon',
  'Apple',
  'Microsoft',
  'ByteDance',
  'Stripe',
  'Netflix',
];

interface InterviewReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: InterviewReportData) => Promise<void>;
  isSubmitting?: boolean;
}

export function InterviewReportModal({
  isOpen,
  onClose,
  onSubmit,
  isSubmitting = false,
}: InterviewReportModalProps) {
  const { profile, jobHuntingProfiles } = useConsole();
  const [company, setCompany] = useState('');
  const [role, setRole] = useState('');
  const [happenedAt, setHappenedAt] = useState('');
  const [suggestedRoles, setSuggestedRoles] = useState<string[]>([]);

  // Initialize happenedAt to today's date when modal opens
  useEffect(() => {
    if (isOpen) {
      setCompany('');
      setRole('');
      const today = new Date().toISOString().split('T')[0];
      setHappenedAt(today);
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) {
      const seen = new Set<string>();
      const roles: string[] = [];
      const addRole = (r: string) => {
        const cleaned = r.trim();
        if (!cleaned) return;
        const lower = cleaned.toLowerCase();
        if (!seen.has(lower)) {
          seen.add(lower);
          roles.push(cleaned);
        }
      };

      // 1. Extract from jobHuntingProfiles search_terms and filters.job_titles
      if (jobHuntingProfiles && Array.isArray(jobHuntingProfiles)) {
        jobHuntingProfiles.forEach((p) => {
          if (Array.isArray(p.search_terms)) {
            p.search_terms.forEach((term) => addRole(term));
          }
          const jobTitles = p.filters?.job_titles;
          if (Array.isArray(jobTitles)) {
            jobTitles.forEach((title) => addRole(title));
          }
        });
      }

      // 2. Extract from profile extra_data
      if (profile && profile.extra_data) {
        const extra = profile.extra_data;
        ['role', 'job_title', 'title', 'desired_role'].forEach((key) => {
          const val = extra[key];
          if (typeof val === 'string') {
            addRole(val);
          }
        });
      }

      setSuggestedRoles(roles);
    }
  }, [isOpen, jobHuntingProfiles, profile]);

  const getOffsetDate = (days: number, months = 0) => {
    const d = new Date();
    if (days) d.setDate(d.getDate() - days);
    if (months) d.setMonth(d.getMonth() - months);
    return d.toISOString().split('T')[0];
  };

  const getButtonClass = (isActive: boolean) =>
    cn(
      'text-[10px] px-2 py-1 rounded-md transition-colors font-medium',
      isActive ?
        'bg-primary text-primary-foreground font-semibold shadow-sm'
      : 'bg-background-secondary hover:bg-primary/10 hover:text-primary text-ink-secondary',
    );

  const setDateOffset = (days: number) => {
    setHappenedAt(getOffsetDate(days));
  };

  const setMonthOffset = (months: number) => {
    setHappenedAt(getOffsetDate(0, months));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!company.trim()) {
      showGlobalToast('Company name is required');
      return;
    }

    // Ensure happenedAt is an ISO string with time
    let dateToSubmit = new Date().toISOString();
    if (happenedAt) {
      const parsedDate = new Date(happenedAt);
      if (!isNaN(parsedDate.getTime())) {
        dateToSubmit = parsedDate.toISOString();
      }
    }

    try {
      await onSubmit({
        company: company.trim(),
        role: role.trim(),
        happened_at: dateToSubmit,
      });
      onClose();
    } catch (err) {
      console.error('Error submitting report:', err);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      layoutId='Seen in Interview'
      className='w-[92vw] max-w-md'
    >
      {/* Header */}
      <div className='header'>
        <div>
          <h3 className='title-sub'>Seen in Interview</h3>
          <p className='body-sm text-ink-secondary mt-0.5'>
            Help others by sharing where you saw this question!
          </p>
        </div>
        <button
          type='button'
          onClick={onClose}
          className='p-2 rounded-lg hover:bg-background-secondary transition-colors'
        >
          <X className='w-4 h-4 text-ink-secondary' />
        </button>
      </div>

      <form onSubmit={handleSubmit} className='flex flex-col flex-1'>
        <div className='flex-1 overflow-y-auto custom-scrollbar-primary body flex flex-col gap-4'>
          <div className='flex flex-col gap-1.5'>
            <label className='label flex items-center gap-1.5'>
              <Building2 className='w-4 h-4 text-ink-secondary' /> Company{' '}
              <span className='text-rose-500'>*</span>
            </label>
            <input
              type='text'
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              placeholder='e.g. Google, Meta, Startup Inc.'
              className='body-md flex-1 bg-panel px-3 py-2 rounded-lg border border-border focus:outline-none focus:border-primary text-ink-primary placeholder:text-ink-secondary'
              required
            />
            <div className='flex flex-wrap gap-1 mt-1'>
              {COMMON_COMPANIES.map((c) => (
                <button
                  key={c}
                  type='button'
                  onClick={() => setCompany(c)}
                  className={getButtonClass(company === c)}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>

          <div className='flex flex-col gap-1.5'>
            <label className='label flex items-center gap-1.5'>
              <Briefcase className='w-4 h-4 text-ink-secondary' /> Role{' '}
              <span className='text-ink-secondary font-normal'>(Optional)</span>
            </label>
            <input
              type='text'
              value={role}
              onChange={(e) => setRole(e.target.value)}
              placeholder='e.g. Frontend Engineer, Product Manager'
              className='body-md flex-1 bg-panel px-3 py-2 rounded-lg border border-border focus:outline-none focus:border-primary text-ink-primary placeholder:text-ink-secondary'
            />
            {suggestedRoles.length > 0 && (
              <div className='flex flex-wrap gap-1 mt-1'>
                {suggestedRoles.map((r) => (
                  <button
                    key={r}
                    type='button'
                    onClick={() => setRole(r)}
                    className={getButtonClass(role === r)}
                  >
                    {r}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className='flex flex-col gap-1.5'>
            <label className='label flex items-center gap-1.5'>
              <Calendar className='w-4 h-4 text-ink-secondary' /> Date
            </label>
            <div className='flex flex-wrap gap-1 mb-1'>
              <button
                type='button'
                onClick={() => setDateOffset(0)}
                className={getButtonClass(happenedAt === getOffsetDate(0))}
              >
                Today
              </button>

              {/* Iterating 1 to 6 days ago */}
              {Array.from({ length: 6 }, (_, i) => i + 1).map((days) => (
                <button
                  key={`day-${days}`}
                  type='button'
                  onClick={() => setDateOffset(days)}
                  className={getButtonClass(happenedAt === getOffsetDate(days))}
                >
                  {days}d ago
                </button>
              ))}
              <button
                type='button'
                onClick={() => setDateOffset(7)}
                className={getButtonClass(happenedAt === getOffsetDate(7))}
              >
                About 1w ago
              </button>
              <button
                type='button'
                onClick={() => setDateOffset(14)}
                className={getButtonClass(happenedAt === getOffsetDate(14))}
              >
                About 2w ago
              </button>
              <button
                type='button'
                onClick={() => setMonthOffset(1)}
                className={getButtonClass(happenedAt === getOffsetDate(0, 1))}
              >
                About 1mo ago
              </button>
              <button
                type='button'
                onClick={() => setMonthOffset(2)}
                className={getButtonClass(happenedAt === getOffsetDate(0, 2))}
              >
                About 2mon ago
              </button>
            </div>
            <input
              type='date'
              value={happenedAt}
              onChange={(e) => setHappenedAt(e.target.value)}
              className='body-md flex-1 bg-panel px-3 py-2 rounded-lg border border-border focus:outline-none focus:border-primary text-ink-primary'
            />
          </div>
        </div>

        {/* Footer */}
        <div className='footer mt-4'>
          <Button
            type='button'
            variant='ghost'
            onClick={onClose}
            className='flex-1'
          >
            Cancel
          </Button>
          <Button
            type='submit'
            className='flex-1'
            isLoading={isSubmitting}
            disabled={!company.trim() || isSubmitting}
          >
            Submit Report
          </Button>
        </div>
      </form>
    </Modal>
  );
}
