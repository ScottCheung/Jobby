/** @format */

'use client';

import React, { useEffect, useState } from 'react';
import { Mail, Sparkles, Save, Loader2, Download, Copy, Pencil, RefreshCw } from 'lucide-react';
import { Button, SectionHeading } from '@jobby/ui';
import { api } from '@/lib/api';
import type { MasterResumeData, JobHuntingProfile } from '@/lib/types';
import { useConsole } from '@/components/ConsoleContext';
import { showGlobalToast } from '@/lib/toast';
import { CoverLetterPreviewCard } from '@jobby/ui/components/UI/Resume';

const DEFAULT_COVER_LETTER_TEMPLATE = `Dear Hiring Manager,

I am writing to express my strong enthusiasm for the role at your esteemed company. With a proven track record of architecting scalable applications and driving impactful technical outcomes, I am excited about the opportunity to contribute to your team.

Throughout my career, I have specialized in building robust software solutions, optimizing workflows, and collaborating across cross-functional teams to deliver exceptional value. My background aligns closely with high-standard engineering requirements, and I thrive in agile environments where innovation and execution excellence are paramount.

I look forward to discussing how my experience, technical skills, and commitment to quality can benefit your upcoming initiatives. Thank you for your time and consideration.

Sincerely,`;

export default function MasterCoverLetterPage() {
  const { jobHuntingProfile, setJobHuntingProfile } = useConsole();
  const [masterResumeData, setMasterResumeData] = useState<MasterResumeData | null>(null);
  const [coverLetter, setCoverLetter] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      try {
        const [masterRes, profileRes] = await Promise.all([
          api.masterResume().catch(() => null),
          api.jobHuntingProfile().catch(() => null),
        ]);

        if (masterRes?.resume_data) {
          setMasterResumeData(masterRes.resume_data as MasterResumeData);
        }

        const existingCl =
          profileRes?.cover_letter ||
          jobHuntingProfile?.cover_letter ||
          DEFAULT_COVER_LETTER_TEMPLATE;
        setCoverLetter(existingCl);
      } catch {
        setCoverLetter(DEFAULT_COVER_LETTER_TEMPLATE);
      } finally {
        setLoading(false);
      }
    }

    void loadData();
  }, [jobHuntingProfile?.cover_letter]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const currentProfile = jobHuntingProfile || ({} as JobHuntingProfile);
      const updatedProfile = {
        ...currentProfile,
        cover_letter: coverLetter,
      } as JobHuntingProfile;

      await api.updateJobHuntingProfile(updatedProfile);
      setJobHuntingProfile(updatedProfile);
      showGlobalToast('Master Cover Letter saved successfully');
    } catch (err) {
      showGlobalToast(
        err instanceof Error ? err.message : 'Failed to save Master Cover Letter',
      );
    } finally {
      setSaving(false);
    }
  };

  const handleResetTemplate = () => {
    setCoverLetter(DEFAULT_COVER_LETTER_TEMPLATE);
    showGlobalToast('Reset to standard master template');
  };

  if (loading) {
    return (
      <div className='flex min-h-[400px] flex-col items-center justify-center gap-3'>
        <Loader2 className='h-8 w-8 animate-spin text-primary' />
        <p className='text-xs font-medium text-ink-secondary'>
          Loading Master Cover Letter...
        </p>
      </div>
    );
  }

  const basics = masterResumeData?.basics || {};
  const candidateName =
    [basics.first_name, basics.last_name].filter(Boolean).join(' ') ||
    'Candidate Name';

  return (
    <div className='space-y-6 pb-12'>
      {/* Header */}
      <header className='flex flex-wrap items-center justify-between gap-4'>
        <div>
          <div className='flex items-center gap-3'>
            <h1 className='text-xl font-bold tracking-tight text-ink-primary md:text-2xl flex items-center gap-2'>
              <Mail className='h-6 w-6 text-primary' />
              Master Cover Letter
            </h1>
            <span className='rounded-xl bg-primary/10 px-3 py-1 text-xs font-bold text-primary'>
              Ground Truth Profile
            </span>
          </div>
          <p className='mt-1 text-xs text-ink-secondary'>
            Your universal cover letter baseline used by AI when generating tailored application letters.
          </p>
        </div>

        <div className='flex items-center gap-2.5'>
          <Button
            variant='secondary'
            size='sm'
            Icon={RefreshCw}
            onClick={handleResetTemplate}
          >
            Reset Template
          </Button>
          <Button
            variant='default'
            size='sm'
            Icon={Save}
            isLoading={saving}
            onClick={() => void handleSave()}
          >
            Save Master CL
          </Button>
        </div>
      </header>

      {/* Main Two-Column View: Left Editor, Right Live PDF Preview */}
      <div className='grid min-h-[600px] items-start gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(380px,0.9fr)] xl:grid-cols-[minmax(0,1.2fr)_minmax(420px,0.8fr)]'>
        {/* Left: Text Editor */}
        <div className='rounded-2xl border border-primary/20 bg-panel/70 p-6 backdrop-blur-md space-y-4'>
          <div className='flex items-center justify-between border-b border-primary/20 pb-3'>
            <SectionHeading className='text-sm font-bold text-ink-primary'>
              Cover Letter Content & Narrative
            </SectionHeading>
            <span className='text-xs text-ink-secondary'>
              {coverLetter.length.toLocaleString()} characters
            </span>
          </div>

          <textarea
            value={coverLetter}
            onChange={(e) => setCoverLetter(e.target.value)}
            rows={18}
            className='w-full rounded-xl border border-primary/20 bg-background/80 p-4 font-sans text-xs leading-relaxed text-ink-primary placeholder:text-ink-secondary/50 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 resize-y'
            placeholder='Write your master cover letter body here...'
          />

          <div className='rounded-xl bg-primary/5 p-4 border border-primary/15 text-xs text-ink-secondary leading-relaxed space-y-1'>
            <p className='font-bold text-primary'>💡 Master CL Best Practice</p>
            <p>
              Keep your opening impactful and describe your core career strengths. When you use AI Tailor, the AI adapts this master letter directly to target company challenges and job specifications.
            </p>
          </div>
        </div>

        {/* Right: Live PDF Preview */}
        <div className='sticky top-4 space-y-4'>
          <CoverLetterPreviewCard
            coverLetter={coverLetter}
            candidateData={masterResumeData || undefined}
            title='Master Cover Letter Preview'
            badge='Master Base'
          />
        </div>
      </div>
    </div>
  );
}
