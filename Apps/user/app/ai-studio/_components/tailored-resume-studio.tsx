'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Building2,
  Calendar,
  Check,
  ChevronDown,
  ChevronRight,
  Download,
  FileText,
  GraduationCap,
  Layers,
  Loader2,
  Mail,
  MousePointerClick,
  Pencil,
  Sparkles,
  Trash2,
  User,
  Wrench,
  X,
} from 'lucide-react';
import {
  Button,
  EmptyPlaceHolder,
  StructuredJobDescription,
} from '@jobby/ui';
import {
  formatResumeFilename,
  formatCoverLetterFilename,
  renderResumePdfOnce,
  renderCoverLetterPdfOnce,
} from '@jobby/ui/components/UI/Resume';
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

  // Active section currently open in the right inspector panel
  const [activeSection, setActiveSection] = useState<EditableSectionKey | null>(null);

  // Switcher state
  const [isSwitcherOpen, setIsSwitcherOpen] = useState(false);

  // Overlay state: enable interactive click hotzones over real PDF
  const [isInteractiveOverlayActive, setIsInteractiveOverlayActive] = useState(true);

  // Cover Letter generation state
  const [isClGenerating, setIsClGenerating] = useState(false);

  // Real Compiled PDF States
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [pdfPages, setPdfPages] = useState<number | null>(null);
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
      const applyInitialDoc = (item: TailoredResume) => {
        const hash = typeof window !== 'undefined' ? window.location.hash.toLowerCase() : '';
        if (hash.includes('cl')) {
          setSelectedDoc('cover_letter');
        } else if (hash.includes('cv')) {
          setSelectedDoc('resume');
        } else {
          const genDocs = (item.raw_ai_response as any)?.generated_documents;
          const hasCl = Boolean(item.cover_letter || (item.raw_ai_response as any)?.cover_letter);
          const hasResumeData = Boolean(item.resume_data && Object.keys(item.resume_data).length > 0 && item.resume_data.basics);
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
        if (updated[0]) {
          setCurrentResume(updated[0]);
          updateUrl(updated[0].id);
        } else {
          router.push('/ai-studio');
        }
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

      // Optimistic local state update for real-time responsiveness
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
      showGlobalToast('Changes saved & real PDF updated');
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
      showGlobalToast('Cover letter saved & real PDF updated');
    } catch (err) {
      showGlobalToast(
        err instanceof Error ? err.message : 'Failed to save cover letter',
      );
    }
  };

  const handleGenerateCoverLetter = async () => {
    if (!currentResume || !currentResume.job_description) return;
    setIsClGenerating(true);
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
        setSelectedDoc('cover_letter');
        setActiveSection('cover_letter');
        updateUrl(updated.id, 'cover_letter');
        showGlobalToast('Cover Letter generated & real PDF compiled!');
      }
    } catch (err) {
      showGlobalToast(
        err instanceof Error ? err.message : 'Failed to generate Cover Letter',
      );
    } finally {
      setIsClGenerating(false);
    }
  };

  const resumeData = (currentResume?.resume_data || {}) as MasterResumeData;
  const basics = resumeData.basics || {};
  const experienceList = resumeData.experience || [];
  const educationList = resumeData.education || [];
  const skillsList = resumeData.skills || [];
  const projectsList = resumeData.projects || [];
  const certificationsList = resumeData.certifications || [];

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

  const roleTitle = currentResume?.job_title || 'Tailored Role';
  const companyName = currentResume?.company || 'Target Company';
  const hasCoverLetter = Boolean(coverLetter && coverLetter.trim());
  const fullName = [basics.first_name, basics.last_name].filter(Boolean).join(' ') || 'Candidate Name';
  const activeSectionLabel =
    activeSection === 'basics' ? 'Personal Info'
    : activeSection === 'core_competencies' ? 'Core Competencies'
    : activeSection === 'cover_letter' ? 'Cover Letter'
    : activeSection ? activeSection[0].toUpperCase() + activeSection.slice(1)
    : '';

  // ── Compile 100% REAL PDF on data changes (Instant 200ms compilation) ──
  useEffect(() => {
    if (!currentResume) return;
    let isCancelled = false;
    setIsCompilingPdf(true);
    setPdfError('');

    const timer = setTimeout(() => {
      if (selectedDoc === 'resume') {
        renderResumePdfOnce(resumeData, 1, coreCompetencies)
          .then(({ blob, pages }) => {
            if (isCancelled) return;
            const nextUrl = URL.createObjectURL(blob);
            if (activeUrlRef.current) URL.revokeObjectURL(activeUrlRef.current);
            activeUrlRef.current = nextUrl;
            setPdfUrl(nextUrl);
            setPdfPages(pages);
            setIsCompilingPdf(false);
          })
          .catch((err) => {
            if (isCancelled) return;
            setPdfError(err instanceof Error ? err.message : 'Could not compile PDF');
            setIsCompilingPdf(false);
          });
      } else if (coverLetter) {
        renderCoverLetterPdfOnce(coverLetter, resumeData, companyName, roleTitle)
          .then(({ blob }) => {
            if (isCancelled) return;
            const nextUrl = URL.createObjectURL(blob);
            if (activeUrlRef.current) URL.revokeObjectURL(activeUrlRef.current);
            activeUrlRef.current = nextUrl;
            setPdfUrl(nextUrl);
            setPdfPages(1);
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
      <div className='flex h-[75vh] flex-col items-center justify-center gap-3.5'>
        <Loader2 className='h-8 w-8 animate-spin text-primary' />
        <p className='text-xs font-semibold text-ink-secondary'>
          Loading Tailored Application Workspace...
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className='p-6'>
        <EmptyPlaceHolder
          title='Error Loading Tailored Resume'
          description={error}
        />
        <div className='mt-4 flex justify-center'>
          <Link
            href='/ai-studio'
            className='inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-primary/90'
          >
            <ArrowLeft className='h-4 w-4' /> Back to AI Studio
          </Link>
        </div>
      </div>
    );
  }

  if (!currentResume) {
    return (
      <div className='p-6'>
        <EmptyPlaceHolder
          title='No Tailored Application Found'
          description='Create your first tailored resume & cover letter in the AI Studio.'
          icon={Sparkles}
        />
        <div className='mt-4 flex justify-center'>
          <Link
            href='/ai-studio'
            className='inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-primary/90'
          >
            <ArrowLeft className='h-4 w-4' /> Create New Application
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className='w-full min-h-screen space-y-4 pb-16 font-sans'>
      {/* ── 1. Minimal Studio Navigation Bar ── */}
      <header className='sticky top-0 z-30 -mx-4 sm:-mx-6 -mt-3 px-4 sm:px-6 py-2.5 bg-background-primary/90 backdrop-blur-xl border-b border-border/60 transition-all'>
        <div className='flex flex-wrap items-center justify-between gap-3 w-full max-w-[1920px] mx-auto'>
          {/* Left: Back Link & Role Switcher */}
          <div className='flex items-center gap-2.5 min-w-0'>
            <Link
              href='/ai-studio'
              className='flex items-center gap-1.5 rounded-xl border border-border/70 bg-panel px-2.5 py-1.5 text-xs font-semibold text-ink-secondary hover:border-primary/40 hover:bg-primary/10 hover:text-primary transition-all cursor-pointer shadow-2xs shrink-0'
              title='Back to AI Studio Home'
            >
              <ArrowLeft className='h-3.5 w-3.5' />
              <span className='hidden sm:inline'>AI Studio</span>
            </Link>

            <span className='text-border/70 hidden sm:inline'>/</span>

            {/* Target Role Dropdown Switcher */}
            <div className='relative'>
              <button
                type='button'
                onClick={() => setIsSwitcherOpen(!isSwitcherOpen)}
                className='flex items-center gap-2 rounded-xl border border-border/70 bg-panel px-3 py-1.5 text-xs font-bold text-ink-primary hover:border-primary/40 hover:bg-panel/90 transition-all cursor-pointer shadow-2xs max-w-[260px] sm:max-w-md'
              >
                <span className='truncate text-primary'>
                  {roleTitle}
                </span>
                <span className='text-ink-secondary font-normal truncate hidden md:inline'>
                  · {companyName}
                </span>
                <ChevronDown className='h-3.5 w-3.5 text-ink-secondary shrink-0 ml-auto' />
              </button>

              {/* Dropdown Menu */}
              {isSwitcherOpen && (
                <>
                  <div
                    className='fixed inset-0 z-40'
                    onClick={() => setIsSwitcherOpen(false)}
                  />
                  <div className='absolute left-0 top-full mt-1.5 z-50 w-72 sm:w-80 rounded-2xl border border-border/80 bg-panel p-2 shadow-xl backdrop-blur-xl animate-in fade-in zoom-in-95 duration-150'>
                    <div className='px-2 py-1 text-[11px] font-bold uppercase tracking-wider text-ink-secondary'>
                      Recent Tailored Applications ({tailoredResumes.length})
                    </div>
                    <div className='max-h-64 overflow-y-auto space-y-1 py-1'>
                      {tailoredResumes.map((item) => {
                        const isSelected = item.id === currentResume.id;
                        return (
                          <div
                            key={item.id}
                            onClick={() => selectTailoredResume(item)}
                            className={cn(
                              'group flex items-center justify-between rounded-xl px-3 py-2 text-xs transition-all cursor-pointer select-none',
                              isSelected ?
                                'bg-primary text-white font-bold'
                              : 'text-ink-primary hover:bg-primary/10 hover:text-primary',
                            )}
                          >
                            <div className='min-w-0 pr-2'>
                              <p className='truncate leading-tight font-semibold'>
                                {item.job_title || 'Untitled Role'}
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
                            {isSelected && (
                              <Check className='h-3.5 w-3.5 shrink-0 text-white' />
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Center: Document Tabs */}
          <div className='flex items-center rounded-2xl bg-background-secondary/80 dark:bg-black/30 p-1 border border-border/60 shadow-2xs'>
            <button
              type='button'
              onClick={() => handleSelectDoc('resume')}
              className={cn(
                'flex items-center gap-1.5 rounded-xl px-3.5 py-1.5 text-xs font-bold transition-all cursor-pointer select-none',
                selectedDoc === 'resume' ?
                  'bg-panel text-primary shadow-xs border border-border/50'
                : 'text-ink-secondary hover:text-ink-primary',
              )}
            >
              <FileText className='h-3.5 w-3.5' />
              <span>Resume (CV)</span>
            </button>

            <button
              type='button'
              onClick={() => handleSelectDoc('cover_letter')}
              className={cn(
                'flex items-center gap-1.5 rounded-xl px-3.5 py-1.5 text-xs font-bold transition-all cursor-pointer select-none',
                selectedDoc === 'cover_letter' ?
                  'bg-panel text-primary shadow-xs border border-border/50'
                : 'text-ink-secondary hover:text-ink-primary',
              )}
            >
              <Mail className='h-3.5 w-3.5' />
              <span>Cover Letter (CL)</span>
              {hasCoverLetter && (
                <span className='size-1.5 rounded-full bg-primary' />
              )}
            </button>
          </div>

          {/* Right: Download PDF Button */}
          <div className='flex items-center gap-2'>
            <Button
              size='sm'
              variant='default'
              Icon={Download}
              disabled={!pdfUrl || isCompilingPdf}
              onClick={handleDownloadPdf}
              className='!h-8 !px-3.5 text-xs font-bold !rounded-xl shadow-xs'
            >
              Download PDF
            </Button>
          </div>
        </div>
      </header>

      {/* ── 2. Responsive Studio Workspace ── */}
      <main
        className={cn(
          'grid w-full max-w-[1920px] items-start gap-5 px-1 transition-[grid-template-columns,gap] duration-300 ease-out sm:px-2 lg:grid-cols-[minmax(240px,320px)_minmax(0,1fr)] 2xl:grid-cols-[minmax(240px,320px)_minmax(0,1fr)_minmax(360px,450px)]',
          activeSection &&
            'lg:grid-cols-[minmax(0,1fr)_minmax(340px,44%)] 2xl:grid-cols-[minmax(240px,320px)_minmax(0,1fr)_minmax(360px,450px)]',
        )}
      >
        {/* ── Column 1: Left Job Info & Full Expanded JD Panel (~280px - 320px) ── */}
        <aside
          className={cn(
            'w-full space-y-3.5 transition-all duration-300 ease-out lg:sticky lg:top-16',
            activeSection && 'hidden 2xl:block',
          )}
        >
          {/* Target Role Meta Card */}
          <div className='rounded-2xl border border-border/70 bg-panel/80 p-4.5 backdrop-blur-md space-y-3 shadow-2xs'>
            <div className='space-y-1 border-b border-border/50 pb-2.5'>
              <div className='flex items-center gap-1.5 text-xs font-bold text-ink-primary'>
                <Building2 className='h-3.5 w-3.5 text-primary shrink-0' />
                <span className='truncate'>{companyName}</span>
              </div>
              <h2 className='text-sm font-extrabold text-ink-primary line-clamp-2 leading-snug'>
                {roleTitle}
              </h2>
            </div>

            <div className='flex flex-wrap items-center gap-2 text-[11px] text-ink-secondary'>
              <span className='inline-flex items-center gap-1 rounded-md bg-primary/15 px-2 py-0.5 text-[10px] font-bold text-primary'>
                ATS Tailored
              </span>
              <span className='flex items-center gap-1'>
                <Calendar className='h-3 w-3 text-ink-secondary/70' />
                {formatRelativeTime(currentResume.created_at)}
              </span>
            </div>

            {/* Directly Expanded Full Job Description (Generous Height) */}
            {currentResume.job_description && (
              <div className='space-y-2 pt-2 border-t border-border/40'>
                <div className='flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-ink-secondary'>
                  <Layers className='h-3.5 w-3.5 text-primary' />
                  <span>Job Requirements (JD)</span>
                </div>

                <div className='overflow-y-auto max-h-[calc(100vh-270px)] rounded-xl bg-background-primary/70 p-3 text-xs leading-relaxed text-ink-secondary border border-border/50 custom-scrollbar-primary'>
                  <StructuredJobDescription
                    content={currentResume.job_description}
                  />
                </div>
              </div>
            )}

            {/* Delete Record */}
            <div className='pt-1 border-t border-border/40'>
              <button
                type='button'
                onClick={() => void handleDeleteResume(currentResume)}
                className='flex items-center gap-1 text-[10px] font-medium text-destructive/80 hover:text-destructive transition-colors cursor-pointer'
              >
                <Trash2 className='h-3 w-3' />
                <span>Delete Application Record</span>
              </button>
            </div>
          </div>
        </aside>

        {/* ── Column 2: Center Main Stage: 100% REAL COMPILED PDF WITH DIRECT CLICK-TO-EDIT ── */}
        <section className='flex min-w-0 w-full flex-col items-center space-y-3 transition-all duration-300 ease-out'>
          {/* Top Status & Interactive Toggle Bar */}
          <div className='flex w-full max-w-[816px] items-center justify-between gap-3 rounded-2xl border border-border/70 bg-panel/80 px-3 py-2 text-xs shadow-2xs backdrop-blur-md sm:px-4'>
            <div className='flex items-center gap-2.5'>
              <div className='flex size-2 rounded-full bg-emerald-500 animate-pulse' />
              <span className='font-bold text-ink-primary text-xs'>
                100% Real ATS PDF
              </span>
              {pdfPages && (
                <span className='rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-bold text-primary'>
                  {pdfPages} Page{pdfPages > 1 ? 's' : ''} (A4/Letter)
                </span>
              )}
            </div>

            <div className='flex items-center gap-2'>
              {isCompilingPdf ? (
                <span className='flex items-center gap-1.5 text-primary font-semibold text-[11px]'>
                  <Loader2 className='size-3 animate-spin' /> Recompiling PDF...
                </span>
              ) : null}

              {/* Direct Click-to-Edit Hotzones Toggle */}
              <button
                type='button'
                onClick={() => setIsInteractiveOverlayActive(!isInteractiveOverlayActive)}
                className={cn(
                  'flex items-center gap-1.5 rounded-xl px-2.5 py-1 text-[11px] font-bold transition-all cursor-pointer shadow-2xs border',
                  isInteractiveOverlayActive ?
                    'bg-primary text-white border-primary/80 shadow-xs'
                  : 'bg-background-secondary text-ink-secondary border-border/60 hover:text-ink-primary',
                )}
                title='Toggle clickable hotspots on top of the real PDF'
              >
                <MousePointerClick className='size-3' />
                <span>{isInteractiveOverlayActive ? 'Click-to-Edit Active' : 'Native Scroll Mode'}</span>
              </button>
            </div>
          </div>

          {/* 100% Real PDF Container with Interactive Section Hotspots */}
          <div className='relative flex h-[calc(100vh-175px)] min-h-[600px] w-full max-w-[816px] select-none items-center justify-center overflow-hidden rounded-sm border border-border/80 bg-white shadow-2xl'>
            {isCompilingPdf && !pdfUrl && (
              <div className='absolute inset-0 z-20 flex flex-col items-center justify-center gap-2.5 bg-background-primary/90 backdrop-blur-xs'>
                <Loader2 className='size-8 animate-spin text-primary' />
                <p className='text-xs font-bold text-ink-primary'>Compiling Real PDF...</p>
                <p className='text-[11px] text-ink-secondary'>Applying ATS layout rules</p>
              </div>
            )}

            {pdfError ? (
              <div className='p-8 text-center text-xs text-destructive space-y-2'>
                <p className='font-bold text-sm'>Could Not Render PDF</p>
                <p className='text-ink-secondary'>{pdfError}</p>
              </div>
            ) : pdfUrl ? (
              <PdfCanvasPreview
                url={pdfUrl}
                documentType={selectedDoc}
                interactive={isInteractiveOverlayActive}
                activeSection={activeSection}
                onSectionSelect={setActiveSection}
              />
            ) : selectedDoc === 'cover_letter' && !coverLetter ? (
              <div className='p-8 text-center space-y-3 max-w-sm'>
                <Mail className='size-10 text-primary/40 mx-auto' />
                <h3 className='text-sm font-bold text-ink-primary'>No Cover Letter Generated</h3>
                <p className='text-xs text-ink-secondary'>
                  Generate a tailored cover letter based on this job requirements.
                </p>
                <Button
                  size='default'
                  variant='default'
                  Icon={Sparkles}
                  isLoading={isClGenerating}
                  onClick={() => void handleGenerateCoverLetter()}
                  className='!rounded-xl text-xs font-bold'
                >
                  Generate Tailored Cover Letter
                </Button>
              </div>
            ) : (
              <div className='text-center p-6 text-xs text-ink-secondary space-y-1.5'>
                <Loader2 className='size-6 animate-spin text-primary mx-auto' />
                <p>Generating PDF...</p>
              </div>
            )}
          </div>
        </section>

        {/* ── Column 3: Right Contextual Section Editor & Navigation Panel ── */}
        <aside
          className={cn(
            'w-full rounded-2xl border border-border/80 bg-panel/95 p-4.5 shadow-xl backdrop-blur-xl transition-all duration-300 ease-out lg:sticky lg:top-16 lg:max-h-[calc(100vh-80px)] lg:overflow-y-auto custom-scrollbar-primary space-y-4',
            activeSection ?
              'animate-in fade-in slide-in-from-right-4 duration-300'
            : 'hidden 2xl:block',
          )}
        >
          {activeSection ? (
            /* Mode A: Active Section Editor */
            <div className='space-y-4 animate-in fade-in duration-150'>
              <div className='flex items-center justify-between border-b border-border/50 pb-2.5'>
                <div className='flex items-center gap-2'>
                  <Pencil className='h-4 w-4 text-primary' />
                  <h3 className='text-sm font-bold text-ink-primary'>
                    Edit {activeSectionLabel}
                  </h3>
                </div>

                <Button
                  size='sm'
                  variant='ghost'
                  Icon={X}
                  onClick={() => setActiveSection(null)}
                  className='!h-7 !px-2 text-xs text-ink-secondary hover:text-ink-primary'
                >
                  Close
                </Button>
              </div>

              <div className='min-h-0'>
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
            </div>
          ) : (
            /* Mode B: Direct Section Quick Editor Hub */
            <div className='space-y-4'>
              <div className='border-b border-border/50 pb-2.5'>
                <h3 className='text-xs font-bold uppercase tracking-wider text-ink-primary flex items-center gap-1.5'>
                  <Pencil className='h-3.5 w-3.5 text-primary' />
                  <span>Edit Resume Sections</span>
                </h3>
                <p className='text-[11px] text-ink-secondary mt-0.5'>
                  Click directly on the Real PDF or select a section below:
                </p>
              </div>

              {selectedDoc === 'resume' ? (
                <div className='space-y-2'>
                  {[
                    { key: 'basics' as const, icon: User, label: 'Contact & Personal Info', desc: `${fullName}` },
                    { key: 'summary' as const, icon: FileText, label: 'Professional Summary', desc: 'Professional overview' },
                    { key: 'core_competencies' as const, icon: Sparkles, label: 'Core Competencies', desc: `${coreCompetencies.length} competencies` },
                    { key: 'experience' as const, icon: Building2, label: 'Work Experience', desc: `${experienceList.length} roles listed` },
                    { key: 'skills' as const, icon: Wrench, label: 'Skills & Technologies', desc: `${skillsList.length} skill groups` },
                    { key: 'education' as const, icon: GraduationCap, label: 'Education History', desc: `${educationList.length} degrees` },
                    { key: 'projects' as const, icon: Layers, label: 'Projects & Highlights', desc: `${projectsList.length} projects` },
                    { key: 'certifications' as const, icon: FileText, label: 'Certifications', desc: `${certificationsList.length} credentials` },
                  ].map((item) => {
                    const IconComp = item.icon;
                    return (
                      <button
                        key={item.key}
                        type='button'
                        onClick={() => setActiveSection(item.key)}
                        className='w-full flex items-center justify-between p-3 rounded-xl border border-border/70 bg-background-secondary/40 hover:bg-primary/10 hover:border-primary/50 hover:text-primary transition-all cursor-pointer text-left group shadow-2xs'
                      >
                        <div className='flex items-center gap-2.5 min-w-0 pr-2'>
                          <div className='flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary group-hover:bg-primary group-hover:text-white transition-colors'>
                            <IconComp className='size-4' />
                          </div>
                          <div className='min-w-0'>
                            <p className='text-xs font-bold text-ink-primary group-hover:text-primary transition-colors'>
                              {item.label}
                            </p>
                            <p className='text-[10px] text-ink-secondary truncate'>
                              {item.desc}
                            </p>
                          </div>
                        </div>
                        <div className='flex items-center gap-1 text-[11px] font-bold text-primary opacity-0 group-hover:opacity-100 transition-opacity shrink-0'>
                          <span>Edit</span>
                          <ChevronRight className='size-3.5' />
                        </div>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className='space-y-3'>
                  <button
                    type='button'
                    onClick={() => setActiveSection('cover_letter')}
                    className='w-full flex items-center justify-between p-3.5 rounded-xl border border-border/70 bg-background-secondary/40 hover:bg-primary/10 hover:border-primary/50 hover:text-primary transition-all cursor-pointer text-left group shadow-2xs'
                  >
                    <div className='flex items-center gap-2.5 min-w-0 pr-2'>
                      <div className='flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary group-hover:bg-primary group-hover:text-white transition-colors'>
                        <Mail className='size-4' />
                      </div>
                      <div className='min-w-0'>
                        <p className='text-xs font-bold text-ink-primary group-hover:text-primary transition-colors'>
                          Edit Cover Letter Narrative
                        </p>
                        <p className='text-[10px] text-ink-secondary truncate'>
                          {hasCoverLetter ? 'Custom narrative generated' : 'Not generated yet'}
                        </p>
                      </div>
                    </div>
                    <div className='flex items-center gap-1 text-[11px] font-bold text-primary opacity-0 group-hover:opacity-100 transition-opacity shrink-0'>
                      <span>Edit</span>
                      <ChevronRight className='size-3.5' />
                    </div>
                  </button>

                  <Button
                    size='sm'
                    variant='outline'
                    Icon={Sparkles}
                    isLoading={isClGenerating}
                    onClick={() => void handleGenerateCoverLetter()}
                    className='w-full !h-9 text-xs font-bold !rounded-xl'
                  >
                    Regenerate Cover Letter
                  </Button>
                </div>
              )}

              {/* Quick PDF Download in Inspector */}
              <div className='pt-2 border-t border-border/40'>
                <Button
                  size='sm'
                  variant='default'
                  Icon={Download}
                  disabled={!pdfUrl || isCompilingPdf}
                  onClick={handleDownloadPdf}
                  className='w-full !h-9 text-xs font-bold shadow-xs !rounded-xl'
                >
                  Download {selectedDoc === 'resume' ? 'Resume PDF' : 'Cover Letter PDF'}
                </Button>
              </div>
            </div>
          )}
        </aside>
      </main>
    </div>
  );
}
