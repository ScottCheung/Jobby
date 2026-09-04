'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Button,
  EmptyPlaceHolder,
  StructuredJobDescription,
} from '@jobby/ui';
import {
  formatCoverLetterFilename,
  formatResumeFilename,
} from '@jobby/ui/components/UI/Resume/helpers';
import { renderResumePdfOnce } from '@jobby/ui/components/UI/Resume/ResumePdfPreview';
import { renderCoverLetterPdfOnce } from '@jobby/ui/components/UI/Resume/CoverLetterPdfPreview';
import { api, type TailoredResume } from '@/lib/api';
import type { MasterResumeData } from '@/lib/types';
import { showGlobalToast } from '@/lib/toast';
import { formatRelativeTime } from '@/lib/use-relative-time';
import { cn } from '@/lib/utils';
import { useConfirmStore } from '@/lib/store/confirm-store';
import {
  BasicsEditor,
  CoreCompetenciesEditor,
  SummaryEditor,
  ExperienceEditor,
  SkillsEditor,
  EducationEditor,
  ProjectsEditor,
  CertificationsEditor,
} from '@/app/settings/resume/_component/career-profile-section-editors';
import { TailorCoverLetterEditor } from './TailorCoverLetterEditor';
import {
  PdfCanvasPreview,
  type PdfEditableSectionKey,
} from './pdf-canvas-preview';

type EditableSectionKey = PdfEditableSectionKey;

interface TailoredResumeStudioProps {
  targetId?: string;
  baseUrl?: string;
}

const SECTION_ITEMS: { key: EditableSectionKey; label: string }[] = [
  { key: 'basics', label: 'Personal Info' },
  { key: 'summary', label: 'Summary' },
  { key: 'core_competencies', label: 'Core Competencies' },
  { key: 'experience', label: 'Experience' },
  { key: 'skills', label: 'Skills' },
  { key: 'education', label: 'Education' },
  { key: 'projects', label: 'Projects' },
  { key: 'certifications', label: 'Certifications' },
];

const TRANSITION_SPRING = {
  duration: 0.32,
  ease: [0.16, 1, 0.3, 1] as const,
};

export function TailoredResumeStudio({
  targetId,
  baseUrl = '/ai-studio/tailor',
}: TailoredResumeStudioProps) {
  const router = useRouter();
  const confirm = useConfirmStore((state) => state.confirm);

  const [tailoredResumes, setTailoredResumes] = useState<TailoredResume[]>([]);
  const [currentResume, setCurrentResume] = useState<TailoredResume | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedDoc, setSelectedDoc] = useState<'resume' | 'cover_letter'>('resume');
  const [activeSection, setActiveSection] = useState<EditableSectionKey | null>(null);
  const [isSwitcherOpen, setIsSwitcherOpen] = useState(false);
  const [isClGenerating, setIsClGenerating] = useState(false);

  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [isCompilingPdf, setIsCompilingPdf] = useState(false);
  const [pdfError, setPdfError] = useState('');
  const activeUrlRef = useRef<string | null>(null);

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
    if (doc !== selectedDoc) {
      setPdfUrl(null);
      setIsCompilingPdf(true);
      setPdfError('');
    }
    setSelectedDoc(doc);
    setActiveSection(null);
    if (currentResume) {
      updateUrl(currentResume.id, doc);
    }
  };

  useEffect(() => {
    const syncFromHash = () => {
      const hash = window.location.hash.toLowerCase();
      if (hash.includes('cl')) {
        setSelectedDoc((prev) => {
          if (prev !== 'cover_letter') {
            setPdfUrl(null);
            setIsCompilingPdf(true);
            setPdfError('');
          }
          return 'cover_letter';
        });
      } else if (hash.includes('cv')) {
        setSelectedDoc((prev) => {
          if (prev !== 'resume') {
            setPdfUrl(null);
            setIsCompilingPdf(true);
            setPdfError('');
          }
          return 'resume';
        });
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
      const applyInitialDoc = (item: TailoredResume) => {
        const hash = typeof window !== 'undefined' ? window.location.hash.toLowerCase() : '';
        if (hash.includes('cl')) {
          setSelectedDoc('cover_letter');
        } else if (hash.includes('cv')) {
          setSelectedDoc('resume');
        } else {
          const genDocs = (item.raw_ai_response as any)?.generated_documents;
          const hasCl = Boolean(item.cover_letter || (item.raw_ai_response as any)?.cover_letter);
          const hasResumeData = Boolean(
            item.resume_data &&
              Object.keys(item.resume_data).length > 0 &&
              item.resume_data.basics,
          );
          if (genDocs?.cover_letter && !genDocs?.resume && !hasResumeData && hasCl) {
            setSelectedDoc('cover_letter');
          }
        }
      };

      try {
        const list = await api.tailoredResumes(50);
        if (isCancelled) return;
        setTailoredResumes(list);

        if (targetId) {
          const matched = list.find((item) => item.id === targetId);
          if (matched) {
            setCurrentResume(matched);
            applyInitialDoc(matched);
          } else {
            try {
              const single = await api.tailoredResume(targetId);
              if (!isCancelled) {
                setCurrentResume(single);
                applyInitialDoc(single);
                setTailoredResumes((prev) => [
                  single,
                  ...prev.filter((i) => i.id !== single.id),
                ]);
              }
            } catch {
              if (!isCancelled && list.length > 0) {
                const first = list[0];
                if (first) {
                  setCurrentResume(first);
                  applyInitialDoc(first);
                }
              }
            }
          }
        } else if (list.length > 0) {
          const first = list[0];
          if (first) {
            setCurrentResume(first);
            applyInitialDoc(first);
          }
        }
      } catch (err) {
        if (!isCancelled) {
          setError(
            err instanceof Error ?
              err.message
            : 'Failed to load tailored resume.',
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

  const selectTailoredResume = (resume: TailoredResume) => {
    setCurrentResume(resume);
    setIsSwitcherOpen(false);
    setActiveSection(null);
    setPdfUrl(null);
    setIsCompilingPdf(true);
    setPdfError('');
    updateUrl(resume.id, selectedDoc);
  };

  const handleDeleteResume = async (item: TailoredResume) => {
    const roleName =
      [item.job_title, item.company].filter(Boolean).join(' at ') ||
      'this tailored record';

    const confirmed = await confirm({
      title: 'Delete Record',
      message: `Are you sure you want to delete "${roleName}"?`,
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
        if (updated[0]) {
          setCurrentResume(updated[0]);
          updateUrl(updated[0].id);
        } else {
          router.push('/ai-studio');
        }
      }
      showGlobalToast('Deleted');
    } catch {
      showGlobalToast('Failed to delete');
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

      const updatedLocal: TailoredResume = {
        ...currentResume,
        resume_data: nextResumeData,
        core_competencies: updatedCompetencies,
      };
      setCurrentResume(updatedLocal);

      const updated = await api.updateTailoredResume(currentResume.id, {
        resume_data: nextResumeData,
        core_competencies: updatedCompetencies,
      });

      setCurrentResume(updated);
      setTailoredResumes((prev) =>
        prev.map((item) => (item.id === updated.id ? updated : item)),
      );
      window.postMessage(
        { source: 'jobby-web-app', type: 'JOBBY_TAILORED_RESUME_UPDATED' },
        window.location.origin,
      );
      showGlobalToast('Saved');
    } catch (err) {
      showGlobalToast(
        err instanceof Error ? err.message : 'Failed to save changes',
      );
    }
  };

  const handleSaveCoverLetter = async (nextCoverLetter: string) => {
    if (!currentResume) return;
    try {
      const updatedLocal: TailoredResume = {
        ...currentResume,
        cover_letter: nextCoverLetter,
      };
      setCurrentResume(updatedLocal);

      const updated = await api.updateTailoredResume(currentResume.id, {
        cover_letter: nextCoverLetter,
      });
      setCurrentResume(updated);
      setTailoredResumes((prev) =>
        prev.map((item) => (item.id === updated.id ? updated : item)),
      );
      window.postMessage(
        { source: 'jobby-web-app', type: 'JOBBY_TAILORED_RESUME_UPDATED' },
        window.location.origin,
      );
      showGlobalToast('Cover letter saved');
    } catch (err) {
      showGlobalToast(
        err instanceof Error ? err.message : 'Failed to save cover letter',
      );
    }
  };

  const handleGenerateCoverLetter = async () => {
    if (!currentResume || !currentResume.job_description) return;
    setIsClGenerating(true);
    setPdfError('');
    try {
      const result = await api.reviewJob({
        tailored_resume_id: currentResume.id,
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
        setSelectedDoc('cover_letter');
        updateUrl(updated.id, 'cover_letter');
        showGlobalToast('Cover letter generated');
      }
    } catch (err) {
      showGlobalToast(
        err instanceof Error ? err.message : 'Failed to generate cover letter',
      );
    } finally {
      setIsClGenerating(false);
    }
  };

  const resumeData = (currentResume?.resume_data || {}) as MasterResumeData;
  const roleTitle = currentResume?.job_title || 'Tailored Role';
  const companyName = currentResume?.company || 'Target Company';

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
    if (typeof currentResume.cover_letter === 'string' && currentResume.cover_letter.trim()) {
      return currentResume.cover_letter.trim();
    }
    const rawCl = (currentResume.raw_ai_response as any)?.cover_letter;
    return typeof rawCl === 'string' && rawCl.trim() ? rawCl.trim() : null;
  }, [currentResume]);

  const activeSectionLabel =
    activeSection === 'basics' ? 'Personal Info'
    : activeSection === 'core_competencies' ? 'Core Competencies'
    : activeSection === 'cover_letter' ? 'Cover Letter'
    : activeSection ? activeSection[0].toUpperCase() + activeSection.slice(1)
    : '';

  useEffect(() => {
    if (!currentResume) return;
    let isCancelled = false;
    setIsCompilingPdf(true);
    setPdfError('');

    const timer = setTimeout(() => {
      if (selectedDoc === 'resume') {
        renderResumePdfOnce(resumeData, 1, coreCompetencies)
          .then(({ blob }) => {
            if (isCancelled) return;
            const nextUrl = URL.createObjectURL(blob);
            if (activeUrlRef.current) URL.revokeObjectURL(activeUrlRef.current);
            activeUrlRef.current = nextUrl;
            setPdfUrl(nextUrl);
            setIsCompilingPdf(false);
          })
          .catch((err) => {
            if (isCancelled) return;
            setPdfError(err instanceof Error ? err.message : 'Could not compile PDF');
            setIsCompilingPdf(false);
          });
      } else if (coverLetter) {
        renderCoverLetterPdfOnce(
          coverLetter,
          resumeData,
          companyName,
          roleTitle,
        )
          .then(({ blob }) => {
            if (isCancelled) return;
            const nextUrl = URL.createObjectURL(blob);
            if (activeUrlRef.current) URL.revokeObjectURL(activeUrlRef.current);
            activeUrlRef.current = nextUrl;
            setPdfUrl(nextUrl);
            setIsCompilingPdf(false);
          })
          .catch((err) => {
            if (isCancelled) return;
            setPdfError(err instanceof Error ? err.message : 'Could not compile PDF');
            setIsCompilingPdf(false);
          });
      } else {
        setPdfUrl(null);
        setIsCompilingPdf(false);
      }
    }, 200);

    return () => {
      isCancelled = true;
      clearTimeout(timer);
    };
  }, [currentResume, resumeData, coreCompetencies, selectedDoc, coverLetter, companyName, roleTitle]);

  useEffect(
    () => () => {
      if (activeUrlRef.current) URL.revokeObjectURL(activeUrlRef.current);
    },
    [],
  );

  const handleDownloadPdf = () => {
    if (!pdfUrl) return;
    const downloadName =
      selectedDoc === 'resume' ?
        formatResumeFilename(resumeData, companyName, roleTitle)
      : formatCoverLetterFilename(resumeData, companyName, roleTitle);

    const link = document.createElement('a');
    link.href = pdfUrl;
    link.download = downloadName;
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  if (loading) {
    return (
      <div className='flex h-[75vh] flex-col items-center justify-center gap-2'>
        <p className='text-xs text-ink-secondary'>Loading...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className='p-6 space-y-4 text-center'>
        <p className='text-sm text-destructive'>{error}</p>
        <Link
          href='/ai-studio'
          className='inline-block rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-white'
        >
          Back to AI Studio
        </Link>
      </div>
    );
  }

  if (!currentResume) {
    return (
      <div className='p-6 space-y-4 text-center'>
        <p className='text-sm text-ink-secondary'>No Tailored Application Found</p>
        <Link
          href='/ai-studio'
          className='inline-block rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-white'
        >
          Create New Application
        </Link>
      </div>
    );
  }

  return (
    <div className='flex flex-col h-[calc(100vh-64px)] w-full overflow-hidden font-sans'>
      {/* Header */}
      <header className='shrink-0 px-4 py-2.5 bg-background-primary border-b border-border/60'>
        <div className='flex items-center justify-between gap-3 w-full max-w-[1920px] mx-auto'>
          {/* Left: Back & Switcher */}
          <div className='flex items-center gap-3 min-w-0'>
            <Link
              href='/ai-studio'
              className='text-xs font-semibold text-ink-secondary hover:text-primary transition-colors shrink-0'
            >
              AI Studio
            </Link>

            <span className='text-border/70'>/</span>

            <div className='relative'>
              <button
                type='button'
                onClick={() => setIsSwitcherOpen(!isSwitcherOpen)}
                className='flex items-center gap-2 rounded-lg border border-border/70 bg-panel px-2.5 py-1 text-xs font-semibold text-ink-primary hover:border-primary/40 transition-colors cursor-pointer max-w-[240px] sm:max-w-md'
              >
                <span className='truncate text-primary'>{roleTitle}</span>
                <span className='text-ink-secondary truncate hidden md:inline'>
                  · {companyName}
                </span>
              </button>

              {isSwitcherOpen && (
                <>
                  <div
                    className='fixed inset-0 z-40'
                    onClick={() => setIsSwitcherOpen(false)}
                  />
                  <div className='absolute left-0 top-full mt-1.5 z-50 w-72 rounded-xl border border-border/80 bg-panel p-2 shadow-lg'>
                    <div className='max-h-60 overflow-y-auto space-y-1 py-1'>
                      {tailoredResumes.map((item) => {
                        const isSelected = item.id === currentResume.id;
                        return (
                          <div
                            key={item.id}
                            onClick={() => selectTailoredResume(item)}
                            className={cn(
                              'rounded-lg px-2.5 py-1.5 text-xs transition-colors cursor-pointer select-none',
                              isSelected ?
                                'bg-primary text-white font-semibold'
                              : 'text-ink-primary hover:bg-primary/10 hover:text-primary',
                            )}
                          >
                            <p className='truncate font-medium'>
                              {item.job_title || 'Untitled'}
                            </p>
                            <p
                              className={cn(
                                'truncate text-[10px]',
                                isSelected ? 'text-white/80' : 'text-ink-secondary',
                              )}
                            >
                              {item.company || 'Job Application'} ·{' '}
                              {formatRelativeTime(item.created_at)}
                            </p>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Center: Tabs */}
          <div className='flex items-center rounded-lg bg-background-secondary p-0.5 border border-border/60'>
            <button
              type='button'
              onClick={() => handleSelectDoc('resume')}
              className={cn(
                'rounded-md px-3 py-1 text-xs font-semibold transition-colors cursor-pointer select-none',
                selectedDoc === 'resume' ?
                  'bg-panel text-primary shadow-xs'
                : 'text-ink-secondary hover:text-ink-primary',
              )}
            >
              Resume
            </button>
            <button
              type='button'
              onClick={() => handleSelectDoc('cover_letter')}
              className={cn(
                'rounded-md px-3 py-1 text-xs font-semibold transition-colors cursor-pointer select-none',
                selectedDoc === 'cover_letter' ?
                  'bg-panel text-primary shadow-xs'
                : 'text-ink-secondary hover:text-ink-primary',
              )}
            >
              Cover Letter
            </button>
          </div>

          {/* Right: Actions */}
          <div>
            <Button
              size='sm'
              variant='default'
              disabled={!pdfUrl || isCompilingPdf}
              onClick={handleDownloadPdf}
              className='!h-7 !px-3 text-xs font-semibold !rounded-lg'
            >
              Download PDF
            </Button>
          </div>
        </div>
      </header>

      {/* Main Studio Dynamic Animated Workspace */}
      <main className='flex-1 flex min-h-0 w-full max-w-[1920px] mx-auto gap-4 p-4 overflow-hidden'>
        {/* Left Column: Job Info & JD (Collapses smoothly when in edit mode) */}
        <AnimatePresence initial={false}>
          {!activeSection && (
            <motion.aside
              key='jd-panel'
              layout
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 280, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={TRANSITION_SPRING}
              className='flex flex-col h-full min-h-0 overflow-hidden shrink-0 rounded-xl border border-border/70 bg-panel shadow-2xs'
            >
              <div className='w-[280px] flex flex-col h-full min-h-0 p-3.5 space-y-3'>
                <div className='shrink-0 space-y-1 border-b border-border/50 pb-2.5'>
                  <div className='text-xs text-ink-secondary truncate'>
                    {companyName}
                  </div>
                  <h2 className='text-sm font-bold text-ink-primary truncate'>
                    {roleTitle}
                  </h2>
                  <div className='text-[11px] text-ink-secondary'>
                    {formatRelativeTime(currentResume.created_at)}
                  </div>
                </div>

                {currentResume.job_description && (
                  <div className='flex-1 flex flex-col min-h-0 space-y-1.5'>
                    <h3 className='shrink-0 text-xs font-semibold text-ink-primary'>
                      Job Requirements
                    </h3>
                    <div className='flex-1 overflow-y-auto rounded-lg bg-background-primary p-2.5 text-xs leading-relaxed text-ink-secondary border border-border/50'>
                      <StructuredJobDescription
                        content={currentResume.job_description}
                      />
                    </div>
                  </div>
                )}

                <div className='shrink-0 pt-1 border-t border-border/40'>
                  <button
                    type='button'
                    onClick={() => void handleDeleteResume(currentResume)}
                    className='text-[11px] text-destructive hover:underline cursor-pointer'
                  >
                    Delete
                  </button>
                </div>
              </div>
            </motion.aside>
          )}
        </AnimatePresence>

        {/* Center Column: PDF Canvas Preview (Animates size smoothly when entering/exiting edit mode) */}
        <motion.section
          layout
          transition={TRANSITION_SPRING}
          className='flex flex-col h-full min-h-0 flex-1 min-w-0 overflow-hidden rounded-xl border border-border/70 bg-panel shadow-2xs'
        >
          <div className='relative flex-1 h-full min-h-0 w-full overflow-hidden'>
            {isCompilingPdf && !pdfUrl && (
              <div className='absolute inset-0 z-20 flex items-center justify-center bg-background-primary/80'>
                <p className='text-xs text-ink-secondary'>Compiling PDF...</p>
              </div>
            )}

            {pdfError ? (
              <div className='flex h-full items-center justify-center p-6 text-center text-xs text-destructive'>
                {pdfError}
              </div>
            ) : pdfUrl ? (
              <PdfCanvasPreview
                url={pdfUrl}
                documentType={selectedDoc}
                activeSection={activeSection}
                onSectionSelect={setActiveSection}
              />
            ) : selectedDoc === 'cover_letter' && !coverLetter ? (
              <div className='flex h-full flex-col items-center justify-center p-6 text-center space-y-3'>
                <p className='text-xs text-ink-secondary'>No cover letter generated</p>
                <Button
                  size='sm'
                  variant='default'
                  isLoading={isClGenerating}
                  onClick={() => void handleGenerateCoverLetter()}
                  className='text-xs font-semibold !rounded-lg'
                >
                  Generate Cover Letter
                </Button>
              </div>
            ) : (
              <div className='flex h-full items-center justify-center text-xs text-ink-secondary'>
                Loading...
              </div>
            )}
          </div>
        </motion.section>

        {/* Right Column: Section Navigation (compact) <-> Large Section Editor (expands smoothly) */}
        <motion.aside
          layout
          transition={TRANSITION_SPRING}
          className={cn(
            'flex flex-col h-full min-h-0 overflow-hidden rounded-xl border border-border/70 bg-panel p-3.5 shadow-2xs shrink-0',
            activeSection ?
              'w-[440px] lg:w-[500px] xl:w-[580px] 2xl:w-[640px]'
            : 'w-[240px] xl:w-[280px]',
          )}
        >
          <AnimatePresence mode='wait' initial={false}>
            {activeSection ? (
              <motion.div
                key={`editor-${activeSection}`}
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                transition={{ duration: 0.18, ease: 'easeOut' }}
                className='flex flex-col h-full min-h-0 space-y-3'
              >
                <div className='shrink-0 flex items-center justify-between border-b border-border/50 pb-2'>
                  <h3 className='text-xs font-bold text-ink-primary'>
                    Edit {activeSectionLabel}
                  </h3>
                  <Button
                    size='sm'
                    variant='ghost'
                    onClick={() => setActiveSection(null)}
                    className='!h-6 !px-2 text-xs text-ink-secondary hover:text-ink-primary'
                  >
                    Close
                  </Button>
                </div>

                <div className='flex-1 min-h-0 overflow-y-auto space-y-3'>
                  {activeSection === 'basics' && (
                    <BasicsEditor
                      data={resumeData}
                      onSave={handleSaveSectionEdits}
                      onClose={() => setActiveSection(null)}
                    />
                  )}

                  {activeSection === 'summary' && (
                    <SummaryEditor
                      data={resumeData}
                      onSave={handleSaveSectionEdits}
                      onClose={() => setActiveSection(null)}
                    />
                  )}

                  {activeSection === 'core_competencies' && (
                    <CoreCompetenciesEditor
                      data={resumeData}
                      initialCoreCompetencies={coreCompetencies}
                      onSave={handleSaveSectionEdits}
                      onClose={() => setActiveSection(null)}
                    />
                  )}

                  {activeSection === 'experience' && (
                    <ExperienceEditor
                      data={resumeData}
                      onSave={handleSaveSectionEdits}
                      onClose={() => setActiveSection(null)}
                    />
                  )}

                  {activeSection === 'skills' && (
                    <SkillsEditor
                      data={resumeData}
                      onSave={handleSaveSectionEdits}
                      onClose={() => setActiveSection(null)}
                    />
                  )}

                  {activeSection === 'education' && (
                    <EducationEditor
                      data={resumeData}
                      onSave={handleSaveSectionEdits}
                      onClose={() => setActiveSection(null)}
                    />
                  )}

                  {activeSection === 'projects' && (
                    <ProjectsEditor
                      data={resumeData}
                      onSave={handleSaveSectionEdits}
                      onClose={() => setActiveSection(null)}
                    />
                  )}

                  {activeSection === 'certifications' && (
                    <CertificationsEditor
                      data={resumeData}
                      onSave={handleSaveSectionEdits}
                      onClose={() => setActiveSection(null)}
                    />
                  )}

                  {activeSection === 'cover_letter' && (
                    <TailorCoverLetterEditor
                      coverLetter={coverLetter}
                      isGenerating={isClGenerating}
                      onGenerateCoverLetter={handleGenerateCoverLetter}
                      onSave={handleSaveCoverLetter}
                    />
                  )}
                </div>
              </motion.div>
            ) : (
              <motion.div
                key='section-list'
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                transition={{ duration: 0.18, ease: 'easeOut' }}
                className='flex flex-col h-full min-h-0 space-y-3'
              >
                <div className='shrink-0 border-b border-border/50 pb-2'>
                  <h3 className='text-xs font-bold text-ink-primary'>
                    Sections
                  </h3>
                </div>

                <div className='flex-1 min-h-0 overflow-y-auto space-y-1.5'>
                  {selectedDoc === 'resume' ? (
                    SECTION_ITEMS.map((item) => (
                      <button
                        key={item.key}
                        type='button'
                        onClick={() => setActiveSection(item.key)}
                        className='w-full text-left rounded-lg border border-border/60 bg-background-secondary/30 px-3 py-2 text-xs font-medium text-ink-primary hover:border-primary/40 hover:bg-primary/5 hover:text-primary transition-colors cursor-pointer'
                      >
                        {item.label}
                      </button>
                    ))
                  ) : (
                    <div className='space-y-2'>
                      <button
                        type='button'
                        onClick={() => setActiveSection('cover_letter')}
                        className='w-full text-left rounded-lg border border-border/60 bg-background-secondary/30 px-3 py-2 text-xs font-medium text-ink-primary hover:border-primary/40 hover:bg-primary/5 hover:text-primary transition-colors cursor-pointer'
                      >
                        Edit Cover Letter
                      </button>

                      <Button
                        size='sm'
                        variant='outline'
                        isLoading={isClGenerating}
                        onClick={() => void handleGenerateCoverLetter()}
                        className='w-full !h-8 text-xs font-medium !rounded-lg'
                      >
                        Regenerate
                      </Button>
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.aside>
      </main>
    </div>
  );
}
