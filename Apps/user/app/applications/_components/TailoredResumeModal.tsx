/** @format */

'use client';

import React, { useEffect, useState } from 'react';
import {
  FileText,
  Loader2,
  X,
  AlertCircle,
  RefreshCw,
  Edit3,
  Eye,
  Check,
  Plus,
  Trash2,
} from 'lucide-react';
import { api, type TailoredResume } from '@/lib/api';
import type { MasterResumeData } from '@/lib/types';
import { ResumePdfPreview } from '@/app/settings/resume/_component/resume-pdf-preview';

interface TailoredResumeModalProps {
  applicationId: string;
  title: string;
  company: string;
  onClose: () => void;
}

export function TailoredResumeModal({
  applicationId,
  title,
  company,
  onClose,
}: TailoredResumeModalProps) {
  const [tailoredResume, setTailoredResume] = useState<TailoredResume | null>(
    null,
  );
  const [fallbackResumeData, setFallbackResumeData] =
    useState<MasterResumeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [mode, setMode] = useState<'preview' | 'edit'>('preview');

  // Form Edit State
  const [summaryDraft, setSummaryDraft] = useState('');
  const [skillsDraft, setSkillsDraft] = useState('');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [experienceDraft, setExperienceDraft] = useState<any[]>([]);

  const loadResume = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await api.getTailoredResumeForApplication(applicationId);
      setTailoredResume(data);
      initFormState(
        data.resume_data as MasterResumeData,
        data.core_competencies,
      );
    } catch (err) {
      console.warn(
        'Tailored resume not found, trying default Resume Profile fallback...',
        err,
      );
      try {
        const profiles = await api.careerProfiles();
        const defaultProfile =
          profiles.find((p) => p.is_default) ?? profiles[0];
        if (
          defaultProfile?.resume_data &&
          Object.keys(defaultProfile.resume_data).length > 0
        ) {
          const resData = defaultProfile.resume_data as MasterResumeData;
          setFallbackResumeData(resData);
          initFormState(resData, []);
        } else {
          setError(
            err instanceof Error ?
              err.message
            : 'Could not load candidate resume.',
          );
        }
      } catch (fallbackErr) {
        setError(
          fallbackErr instanceof Error ?
            fallbackErr.message
          : 'Could not load candidate resume.',
        );
      }
    } finally {
      setLoading(false);
    }
  };

  const initFormState = (resData: MasterResumeData, comps: string[]) => {
    setSummaryDraft(resData?.summary || '');
    const fallbackComps =
      (resData as unknown as Record<string, string[]>)?.core_competencies || [];
    setSkillsDraft((comps.length > 0 ? comps : fallbackComps).join(', '));
    setExperienceDraft(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (resData?.experience as any[]) || [],
    );
  };

  const handleGenerate = async () => {
    setGenerating(true);
    setError('');
    try {
      const data =
        await api.generateTailoredResumeForApplication(applicationId);
      setTailoredResume(data);
      setFallbackResumeData(null);
      initFormState(
        data.resume_data as MasterResumeData,
        data.core_competencies,
      );
    } catch (err) {
      console.error('Failed to generate tailored resume', err);
      setError(
        err instanceof Error ?
          err.message
        : 'Failed to generate tailored resume.',
      );
    } finally {
      setGenerating(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setError('');
    try {
      const currentResData = (tailoredResume?.resume_data ||
        fallbackResumeData ||
        {}) as MasterResumeData;
      const updatedResumeData: MasterResumeData = {
        ...currentResData,
        summary: summaryDraft,
        experience: experienceDraft as MasterResumeData['experience'],
      };
      const updatedCompetencies = skillsDraft
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);

      const updated = await api.updateTailoredResumeForApplication(
        applicationId,
        {
          resume_data: updatedResumeData as Record<string, unknown>,
          core_competencies: updatedCompetencies,
        },
      );

      setTailoredResume(updated);
      setMode('preview');
    } catch (err) {
      console.error('Failed to save tailored resume', err);
      setError(
        err instanceof Error ? err.message : 'Failed to save resume edits.',
      );
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    void loadResume();
  }, [applicationId]);

  const pdfFilename = `${title || 'Role'}_${company || 'Company'}_Resume.pdf`
    .replace(/\s+/g, '_')
    .replace(/[^a-zA-Z0-9_\-\.]/g, '');

  const resumeData = (tailoredResume?.resume_data ||
    fallbackResumeData ||
    {}) as MasterResumeData;
  const competencies =
    tailoredResume?.core_competencies ||
    tailoredResume?.key_qualifications ||
    [];
  const isTailored = Boolean(tailoredResume);

  return (
    <div className='fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm animate-in fade-in duration-200'>
      <div className='flex h-[90vh] w-full max-w-5xl flex-col rounded-2xl border border-border/80 bg-background shadow-2xl overflow-hidden'>
        {/* Header */}
        <header className='flex shrink-0 items-center justify-between border-b border-border/60 px-6 py-4 bg-panel'>
          <div className='flex items-center gap-3 min-w-0'>
            <div className='flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary'>
              <FileText className='h-5 w-5' />
            </div>
            <div className='min-w-0'>
              <h3 className='text-base font-bold text-ink-primary truncate'>
                {title || 'Untitled Role'} · {company || 'Unknown Company'}
              </h3>
              <p className='text-xs text-ink-secondary flex items-center gap-2'>
                <span>
                  {isTailored ? 'Tailored Resume' : 'Default Candidate Resume'}
                </span>
                {tailoredResume?.created_at && (
                  <span>
                    · {new Date(tailoredResume.created_at).toLocaleDateString()}
                  </span>
                )}
              </p>
            </div>
          </div>

          <div className='flex items-center gap-3'>
            {/* View Mode Toggle */}
            {!loading && (
              <div className='inline-flex rounded-xl border border-border/60 p-1 bg-background-secondary'>
                <button
                  type='button'
                  onClick={() => setMode('preview')}
                  className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1 text-xs font-semibold transition ${
                    mode === 'preview' ?
                      'bg-background text-ink-primary shadow-xs'
                    : 'text-ink-secondary hover:text-ink-primary'
                  }`}
                >
                  <Eye className='h-3.5 w-3.5' />
                  Preview
                </button>
                <button
                  type='button'
                  onClick={() => setMode('edit')}
                  className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1 text-xs font-semibold transition ${
                    mode === 'edit' ?
                      'bg-background text-ink-primary shadow-xs'
                    : 'text-ink-secondary hover:text-ink-primary'
                  }`}
                >
                  <Edit3 className='h-3.5 w-3.5' />
                  Edit Resume
                </button>
              </div>
            )}

            {mode === 'edit' ?
              <button
                type='button'
                onClick={handleSave}
                disabled={saving}
                className='inline-flex items-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 px-4 py-2 text-xs font-semibold text-white transition disabled:opacity-60 cursor-pointer'
              >
                {saving ?
                  <Loader2 className='h-4 w-4 animate-spin' />
                : <Check className='h-4 w-4' />}
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            : !isTailored &&
              !loading && (
                <button
                  type='button'
                  onClick={handleGenerate}
                  disabled={generating}
                  className='inline-flex items-center gap-2 rounded-xl bg-primary px-3.5 py-1.5 text-xs font-semibold text-white transition hover:opacity-90 disabled:opacity-60 cursor-pointer'
                >
                  {generating ?
                    <Loader2 className='h-3.5 w-3.5 animate-spin' />
                  : <RefreshCw className='h-3.5 w-3.5' />}
                  {generating ?
                    'Generating AI Resume...'
                  : 'Generate Tailored Resume'}
                </button>
              )
            }

            <button
              type='button'
              onClick={onClose}
              className='flex h-9 w-9 items-center justify-center rounded-xl border border-border/60 text-ink-secondary hover:bg-background-secondary transition cursor-pointer'
              aria-label='Close modal'
            >
              <X className='h-4 w-4' />
            </button>
          </div>
        </header>

        {/* Content Body */}
        <div className='flex-1 overflow-y-auto p-6 bg-background/50'>
          {loading ?
            <div className='flex h-full flex-col items-center justify-center gap-3 text-ink-secondary'>
              <Loader2 className='h-8 w-8 animate-spin text-primary' />
              <p className='text-sm font-medium'>Loading resume...</p>
            </div>
          : mode === 'edit' ?
            /* Edit Form View */
            <div className='mx-auto max-w-3xl space-y-6 pb-8'>
              {error && (
                <div className='rounded-xl bg-rose-500/10 border border-rose-500/20 p-3 text-xs text-rose-500 flex items-center gap-2'>
                  <AlertCircle className='h-4 w-4 shrink-0' />
                  <span>{error}</span>
                </div>
              )}

              {/* Executive Summary */}
              <div className='rounded-2xl border border-border/60 bg-panel p-5 space-y-2'>
                <label className='block text-xs font-bold uppercase tracking-wider text-ink-secondary'>
                  Executive Summary
                </label>
                <textarea
                  rows={4}
                  value={summaryDraft}
                  onChange={(e) => setSummaryDraft(e.target.value)}
                  placeholder='Write professional summary tailored for this position...'
                  className='w-full rounded-xl border border-border/60 bg-background p-3 text-sm text-ink-primary focus:border-primary focus:outline-none'
                />
              </div>

              {/* Core Competencies / Skills */}
              <div className='rounded-2xl border border-border/60 bg-panel p-5 space-y-2'>
                <label className='block text-xs font-bold uppercase tracking-wider text-ink-secondary'>
                  Core Competencies & Skills (Comma-Separated)
                </label>
                <textarea
                  rows={2}
                  value={skillsDraft}
                  onChange={(e) => setSkillsDraft(e.target.value)}
                  placeholder='Python, FastAPI, Next.js, PostgreSQL, Docker, AI Agents...'
                  className='w-full rounded-xl border border-border/60 bg-background p-3 text-sm text-ink-primary focus:border-primary focus:outline-none'
                />
              </div>

              {/* Work Experience */}
              <div className='rounded-2xl border border-border/60 bg-panel p-5 space-y-4'>
                <div className='flex items-center justify-between border-b border-border/40 pb-3'>
                  <label className='block text-xs font-bold uppercase tracking-wider text-ink-secondary'>
                    Work Experience Highlights
                  </label>
                </div>

                <div className='space-y-6'>
                  {experienceDraft.map((exp, expIdx) => {
                    const companyName = String(
                      exp.company || exp.organization || 'Company',
                    );
                    const positionTitle = String(
                      exp.position || exp.role || exp.title || 'Role',
                    );
                    const highlights =
                      Array.isArray(exp.highlights) ?
                        (exp.highlights as string[])
                      : [];

                    return (
                      <div
                        key={expIdx}
                        className='rounded-xl border border-border/40 bg-background/60 p-4 space-y-3'
                      >
                        <div className='flex items-center justify-between'>
                          <h4 className='text-sm font-bold text-ink-primary'>
                            {positionTitle} ·{' '}
                            <span className='text-primary'>{companyName}</span>
                          </h4>
                        </div>

                        {/* Summary */}
                        {exp.summary !== undefined && (
                          <div>
                            <span className='block text-[11px] text-ink-secondary mb-1 font-medium'>
                              Role Overview
                            </span>
                            <textarea
                              rows={2}
                              value={String(exp.summary || '')}
                              onChange={(e) => {
                                const newExp = [...experienceDraft];
                                newExp[expIdx] = {
                                  ...newExp[expIdx],
                                  summary: e.target.value,
                                };
                                setExperienceDraft(newExp);
                              }}
                              className='w-full rounded-lg border border-border/60 bg-background p-2.5 text-xs text-ink-primary focus:border-primary focus:outline-none'
                            />
                          </div>
                        )}

                        {/* Highlights */}
                        <div className='space-y-2'>
                          <span className='block text-[11px] text-ink-secondary font-medium'>
                            Key Bullet Points & Achievements
                          </span>
                          {highlights.map((bullet, bulletIdx) => (
                            <div
                              key={bulletIdx}
                              className='flex items-center gap-2'
                            >
                              <input
                                type='text'
                                value={bullet}
                                onChange={(e) => {
                                  const newExp = [...experienceDraft];
                                  const newBullets = [...highlights];
                                  newBullets[bulletIdx] = e.target.value;
                                  newExp[expIdx] = {
                                    ...newExp[expIdx],
                                    highlights: newBullets,
                                  };
                                  setExperienceDraft(newExp);
                                }}
                                className='flex-1 rounded-lg border border-border/60 bg-background px-3 py-2 text-xs text-ink-primary focus:border-primary focus:outline-none'
                              />
                              <button
                                type='button'
                                onClick={() => {
                                  const newExp = [...experienceDraft];
                                  const newBullets = highlights.filter(
                                    (_, i) => i !== bulletIdx,
                                  );
                                  newExp[expIdx] = {
                                    ...newExp[expIdx],
                                    highlights: newBullets,
                                  };
                                  setExperienceDraft(newExp);
                                }}
                                className='p-1.5 text-ink-secondary hover:text-rose-500 rounded-lg hover:bg-rose-500/10'
                                title='Delete bullet'
                              >
                                <Trash2 className='h-3.5 w-3.5' />
                              </button>
                            </div>
                          ))}

                          <button
                            type='button'
                            onClick={() => {
                              const newExp = [...experienceDraft];
                              const newBullets = [
                                ...highlights,
                                'New achievement point...',
                              ];
                              newExp[expIdx] = {
                                ...newExp[expIdx],
                                highlights: newBullets,
                              };
                              setExperienceDraft(newExp);
                            }}
                            className='inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline pt-1'
                          >
                            <Plus className='h-3.5 w-3.5' />
                            Add Bullet Point
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          : /* Preview View */
            <div className='h-full w-full'>
              <ResumePdfPreview
                data={resumeData}
                filename={pdfFilename}
                coreCompetencies={competencies}
              />
            </div>
          }
        </div>
      </div>
    </div>
  );
}
