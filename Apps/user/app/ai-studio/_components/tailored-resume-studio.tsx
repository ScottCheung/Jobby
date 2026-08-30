/** @format */

'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Sparkles } from 'lucide-react';
import { EmptyPlaceHolder } from '@jobby/ui';
import { api, type TailoredResume } from '@/lib/api';
import type { MasterResumeData } from '@/lib/types';
import { showGlobalToast } from '@/lib/toast';
import { RecentTailorCarousel } from './RecentTailorCarousel';
import { TwoDocumentPreviewShowcase } from './TwoDocumentPreviewShowcase';
import { TailorSectionsEditor } from './TailorSectionsEditor';
import { TailorCoverLetterEditor } from './TailorCoverLetterEditor';

import { useConfirmStore } from '@/lib/store/confirm-store';

interface TailoredResumeStudioProps {
  targetId?: string;
  baseUrl?: string;
  latestResume?: TailoredResume | null;
  compactEntry?: React.ReactNode;
}

export function TailoredResumeStudio({
  targetId,
  baseUrl = '/ai-studio/tailor',
  latestResume,
  compactEntry,
}: TailoredResumeStudioProps) {
  const router = useRouter();
  const confirm = useConfirmStore((state) => state.confirm);

  const [tailoredResumes, setTailoredResumes] = useState<TailoredResume[]>([]);
  const [currentResume, setCurrentResume] = useState<TailoredResume | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedDoc, setSelectedDoc] = useState<'resume' | 'cover_letter'>('resume');

  // Cover Letter generation state on this view
  const [isClGenerating, setIsClGenerating] = useState(false);
  const [clGenStartedAt, setClGenStartedAt] = useState<number | undefined>();

  const updateUrl = (resumeId?: string, docType?: 'resume' | 'cover_letter') => {
    if (typeof window === 'undefined') return;
    const id = resumeId || currentResume?.id;
    const doc = docType || selectedDoc;
    if (!id || id.startsWith('optimistic-')) return;
    const hash = doc === 'resume' ? '#cv' : '#cl';
    const targetPath = `${baseUrl}/${id}${hash}`;
    if (window.location.pathname + window.location.hash !== targetPath) {
      window.history.replaceState(null, '', targetPath);
    }
  };

  const handleSelectDoc = (doc: 'resume' | 'cover_letter') => {
    setSelectedDoc(doc);
    if (currentResume) {
      updateUrl(currentResume.id, doc);
    }
  };

  useEffect(() => {
    const syncFromHash = () => {
      const hash = window.location.hash.toLowerCase();
      if (hash.includes('cl')) {
        setSelectedDoc('cover_letter');
      } else if (hash.includes('cv')) {
        setSelectedDoc('resume');
      }
    };
    syncFromHash();
    window.addEventListener('hashchange', syncFromHash);
    return () => window.removeEventListener('hashchange', syncFromHash);
  }, []);

  useEffect(() => {
    let isCancelled = false;

    async function loadData() {
      setLoading(true);
      setError('');
      try {
        const list = await api.tailoredResumes(50);
        if (isCancelled) return;
        setTailoredResumes(list);

        if (targetId) {
          const matched = list.find((item) => item.id === targetId);
          if (matched) {
            setCurrentResume(matched);
          } else {
            try {
              const single = await api.tailoredResume(targetId);
              if (!isCancelled) {
                setCurrentResume(single);
                setTailoredResumes((prev) => [
                  single,
                  ...prev.filter((i) => i.id !== single.id),
                ]);
              }
            } catch {
              if (!isCancelled && list.length > 0) {
                setCurrentResume(list[0]);
              }
            }
          }
        } else if (list.length > 0) {
          setCurrentResume(list[0]);
        }
      } catch (err) {
        if (!isCancelled) {
          setError(
            err instanceof Error ?
              err.message
            : 'Failed to load tailored resumes.',
          );
        }
      } finally {
        if (!isCancelled) setLoading(false);
      }
    }

    void loadData();

    return () => {
      isCancelled = true;
    };
  }, [targetId]);

  useEffect(() => {
    if (!latestResume) return;
    setCurrentResume(latestResume);
    setTailoredResumes((prev) => [
      latestResume,
      ...prev.filter((item) => item.id !== latestResume.id),
    ]);
  }, [latestResume]);

  const selectTailoredResume = (resume: TailoredResume) => {
    setCurrentResume(resume);
    updateUrl(resume.id, selectedDoc);
  };

  const handleDeleteResume = async (item: TailoredResume) => {
    const roleName =
      [item.job_title, item.company].filter(Boolean).join(' at ') ||
      'this tailored record';

    const confirmed = await confirm({
      title: 'Delete Tailored Record',
      message: `Are you sure you want to delete "${roleName}"? This action cannot be undone.`,
      confirmLabel: 'Delete',
      cancelLabel: 'Cancel',
      type: 'delete',
    });

    if (!confirmed) return;

    try {
      await api.deleteTailoredResume(item.id);
      const updated = tailoredResumes.filter((i) => i.id !== item.id);
      setTailoredResumes(updated);
      if (currentResume?.id === item.id) {
        setCurrentResume(updated[0] || null);
        if (updated[0]) updateUrl(updated[0].id);
      }
      showGlobalToast('Tailored resume deleted');
    } catch {
      showGlobalToast('Failed to delete tailored record');
    }
  };

  const handleSaveSectionEdits = async (
    nextResumeData: MasterResumeData,
    nextCompetencies?: string[],
  ) => {
    if (!currentResume) return;
    try {
      const updatedCompetencies =
        nextCompetencies ??
        nextResumeData.core_competencies ??
        currentResume.core_competencies ??
        [];

      const updated = await api.updateTailoredResume(currentResume.id, {
        resume_data: nextResumeData,
        core_competencies: updatedCompetencies,
      });

      setCurrentResume(updated);
      setTailoredResumes((prev) =>
        prev.map((item) => (item.id === updated.id ? updated : item)),
      );
      showGlobalToast('Changes saved to tailored resume');
    } catch (err) {
      showGlobalToast(
        err instanceof Error ? err.message : 'Failed to save changes',
      );
    }
  };

  const handleSaveCoverLetter = async (nextCoverLetter: string) => {
    if (!currentResume) return;
    try {
      const updated = await api.updateTailoredResume(currentResume.id, {
        cover_letter: nextCoverLetter,
      });
      setCurrentResume(updated);
      setTailoredResumes((prev) =>
        prev.map((item) => (item.id === updated.id ? updated : item)),
      );
      showGlobalToast('Cover letter saved successfully');
    } catch (err) {
      showGlobalToast(
        err instanceof Error ? err.message : 'Failed to save cover letter',
      );
    }
  };

  const handleGenerateCoverLetter = async () => {
    if (!currentResume || !currentResume.job_description) return;
    setIsClGenerating(true);
    setClGenStartedAt(Date.now());
    try {
      const result = await api.reviewJob({
        job_description: currentResume.job_description,
        title: currentResume.job_title || undefined,
        company: currentResume.company || undefined,
        doc_type: 'cover_letter',
      });

      if (result.tailored_resume) {
        const updated = result.tailored_resume;
        setCurrentResume(updated);
        setTailoredResumes((prev) =>
          prev.map((item) => (item.id === updated.id ? updated : item)),
        );
        showGlobalToast('Cover Letter generated successfully!');
      }
    } catch (err) {
      showGlobalToast(
        err instanceof Error ? err.message : 'Failed to generate Cover Letter',
      );
    } finally {
      setIsClGenerating(false);
      setClGenStartedAt(undefined);
    }
  };

  const resumeData = (currentResume?.resume_data || {}) as MasterResumeData;
  const coreCompetencies = useMemo(() => {
    if (!currentResume) return [];
    return (
      currentResume.core_competencies ||
      currentResume.key_qualifications ||
      (Array.isArray(resumeData.core_competencies) ?
        (resumeData.core_competencies as string[])
      : []) ||
      []
    );
  }, [currentResume, resumeData]);

  const coverLetter = useMemo(() => {
    if (!currentResume) return null;
    if (currentResume.cover_letter) return currentResume.cover_letter;
    const rawCl = (currentResume.raw_ai_response as any)?.cover_letter;
    return typeof rawCl === 'string' && rawCl.trim() ? rawCl : null;
  }, [currentResume]);

  if (loading) {
    return (
      <div className='flex min-h-[400px] flex-col items-center justify-center gap-3'>
        <Loader2 className='h-8 w-8 animate-pulse text-primary' />
        <p className='text-xs font-medium text-ink-secondary'>
          Loading Recent Tailored Resumes...
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className='p-6'>
        <EmptyPlaceHolder
          title='Error Loading Tailored Resumes'
          description={error}
        />
      </div>
    );
  }

  if (!currentResume && tailoredResumes.length === 0) {
    return (
      <div className='p-6'>
        <EmptyPlaceHolder
          title='No Tailored Resumes Yet'
          description='Go to AI Studio Home or use our Chrome Extension to tailor your first resume & cover letter.'
          icon={Sparkles}
        />
      </div>
    );
  }

  return (
    <div className='space-y-6 pb-6'>


      {/* ── 2. Top Carousel: Horizontal Scrollable Cards ── */}
      {tailoredResumes.length > 0 && (
        <RecentTailorCarousel
          items={tailoredResumes}
          selectedId={currentResume?.id}
          onSelect={selectTailoredResume}
          onDelete={handleDeleteResume}
          headerMiddle={compactEntry}
          className='sticky top-0 z-30'
        />
      )}

      {/* ── 3. Two Horizontally Arranged Preview Cards ── */}
      {currentResume && (
        <TwoDocumentPreviewShowcase
          resumeData={resumeData}
          coreCompetencies={coreCompetencies}
          coverLetter={coverLetter}
          company={currentResume.company || ''}
          jobTitle={currentResume.job_title || ''}
          selectedDoc={selectedDoc}
          onSelectDoc={handleSelectDoc}
          isCoverLetterGenerating={isClGenerating}
          startedAt={clGenStartedAt}
          onCancelGeneration={() => setIsClGenerating(false)}
          onGenerateCoverLetter={handleGenerateCoverLetter}
        />
      )}

      {/* ── 4. Bottom Editable Sections: Switch between Resume and Cover Letter ── */}
      {currentResume && currentResume.status !== 'processing' && (
        selectedDoc === 'resume' ? (
          <TailorSectionsEditor
            resumeData={resumeData}
            coreCompetencies={coreCompetencies}
            onSave={handleSaveSectionEdits}
          />
        ) : (
          <TailorCoverLetterEditor
            coverLetter={coverLetter}
            isGenerating={isClGenerating}
            onGenerateCoverLetter={handleGenerateCoverLetter}
            onSave={handleSaveCoverLetter}
          />
        )
      )}
    </div>
  );
}
