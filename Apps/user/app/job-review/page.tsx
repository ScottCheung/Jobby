/** @format */

'use client';

import { Suspense, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import {
  Button,
  EmptyPlaceHolder,
  SectionHeading,
} from '@jobby/ui';
import {
  Briefcase,
  Check,
  Download,
  FolderGit2,
  Globe,
  History,
  Loader2,
  Mail,
  MapPin,
  Pencil,
  Phone,
  Sparkles,
  User,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { api, type TailoredResume } from '@/lib/api';
import type {
  MasterResumeData,
  ResumeLocation,
  ResumeOtherItem,
} from '@/lib/types';
import { useGlobalModalStore } from '@/lib/store/global-modal-store';
import { showGlobalToast } from '@/lib/toast';
import { cn } from '@/lib/utils';
import { ResumePreviewCard } from '@/app/settings/resume/_component/resume-pdf-preview';
import {
  formatResumeFilename,
  renderResumePdfOnce,
} from '@jobby/ui/components/UI/Resume';
import {
  BasicsEditor,
  CertificationsEditor,
  EducationEditor,
  ExperienceEditor,
  LinksEditor,
  OtherEditor,
  ProjectsEditor,
  SkillsEditor,
  SummaryEditor,
} from '@/app/settings/resume/_component/career-profile-section-editors';

function LinkedinIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox='0 0 24 24'
      fill='none'
      stroke='currentColor'
      strokeWidth='2'
      strokeLinecap='round'
      strokeLinejoin='round'
      {...props}
    >
      <path d='M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z' />
      <rect x='2' y='9' width='4' height='12' />
      <circle cx='4' cy='4' r='2' />
    </svg>
  );
}

function dateRange(start?: string | null, end?: string | null) {
  return [start, end].filter(Boolean).join(' - ') || 'Date not listed';
}

function TagList({ values }: { values: string[] }) {
  if (!values.length)
    return <span className='body-sm text-ink-secondary'>Not listed</span>;
  return (
    <div className='flex flex-wrap gap-2'>
      {values.map((value) => (
        <span
          key={value}
          className='rounded-md bg-background-secondary px-2 py-1 text-xs text-ink-secondary'
        >
          {value}
        </span>
      ))}
    </div>
  );
}

function SectionCard({
  title,
  children,
  action,
  layoutId,
  onClick,
}: {
  title: string;
  children: ReactNode;
  action?: ReactNode;
  layoutId?: string;
  onClick?: () => void;
}) {
  return (
    <motion.section
      layoutId={layoutId}
      onClick={onClick}
      transition={{
        type: 'spring',
        duration: 0.7,
        bounce: 0.2,
        ease: [0.22, 1, 0.36, 1],
      }}
      className={cn(
        'bg-panel group rounded-2xl relative',
        onClick && 'cursor-pointer',
      )}
    >
      <div className='sticky top-0 z-20 flex items-center justify-between gap-3 pt-4 pb-3 px-5'>
        <div className='relative flex items-center'>
          <SectionHeading as='h2' size='md' withBackdrop>
            {title}
          </SectionHeading>
        </div>
        {action && (
          <div
            onClick={(e) => e.stopPropagation()}
            className='group-hover:opacity-100 opacity-0 transition-opacity'
          >
            {action}
          </div>
        )}
      </div>
      <div className='pt-4 pb-5 px-5'>{children}</div>
    </motion.section>
  );
}

function JobReviewContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const targetId = searchParams?.get('id');

  const [tailoredResumes, setTailoredResumes] = useState<TailoredResume[]>([]);
  const [currentResume, setCurrentResume] = useState<TailoredResume | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState('');

  const { openModal, closeModal } = useGlobalModalStore(
    (state) => state.actions,
  );

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
                setTailoredResumes((prev) => [single, ...prev.filter((i) => i.id !== single.id)]);
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
            err instanceof Error ? err.message : 'Failed to load tailored resumes.',
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
    router.replace(`/job-review?id=${resume.id}`);
  };

  const resumeData = (currentResume?.resume_data || {}) as MasterResumeData;
  const coreCompetencies: string[] = useMemo(() => {
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

  const pdfFilename = useMemo(() => {
    return formatResumeFilename(
      resumeData,
      currentResume?.company || '',
      currentResume?.job_title || '',
    );
  }, [resumeData, currentResume]);

  const handleSaveSection = async (
    nextResumeData: MasterResumeData,
    nextCompetencies?: string[],
  ) => {
    if (!currentResume) return;
    setSaving(true);
    try {
      const updatedCompetencies =
        nextCompetencies ??
        nextResumeData.core_competencies ??
        currentResume.core_competencies ??
        coreCompetencies;

      const updated = await api.updateTailoredResume(currentResume.id, {
        resume_data: nextResumeData,
        core_competencies: updatedCompetencies,
      });

      setCurrentResume(updated);
      setTailoredResumes((prev) =>
        prev.map((item) => (item.id === updated.id ? updated : item)),
      );
      showGlobalToast('Tailored resume changes saved successfully');
    } catch (err) {
      showGlobalToast(
        err instanceof Error ?
          err.message
        : 'Failed to save changes, please try again',
      );
    } finally {
      setSaving(false);
    }
  };

  const handleDownloadPdf = async () => {
    if (!resumeData || !currentResume) return;
    setDownloading(true);
    try {
      const { blob } = await renderResumePdfOnce(
        resumeData,
        1,
        coreCompetencies,
        [],
      );
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${pdfFilename.replace(/\.pdf$/i, '') || 'tailored-resume'}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      showGlobalToast('Tailored resume downloaded successfully.');
    } catch {
      showGlobalToast('Could not download resume PDF.');
    } finally {
      setDownloading(false);
    }
  };

  const openSectionModal = (layoutId: string, content: ReactNode) => {
    openModal({
      layoutId,
      className: 'w-[94vw] max-w-4xl max-h-[88vh] rounded-2xl',
      content,
      onClose: closeModal,
    });
  };

  const openHistoryModal = () => {
    openModal({
      layoutId: 'tailored-resumes-switcher',
      className: 'w-[94vw] max-w-2xl max-h-[86vh] rounded-2xl',
      content: (
        <div className='flex max-h-[78vh] flex-col gap-5 p-6'>
          <div>
            <h2 className='title-card text-ink-primary'>
              Switch Tailored Resume
            </h2>
            <p className='body-sm mt-1 text-ink-secondary'>
              Select a tailored resume generated for your previous job applications.
            </p>
          </div>
          <div className='custom-scrollbar-primary min-h-0 space-y-2 overflow-y-auto'>
            {tailoredResumes.map((item) => {
              const selected = item.id === currentResume?.id;
              return (
                <div
                  key={item.id}
                  onClick={() => {
                    selectTailoredResume(item);
                    closeModal();
                  }}
                  className={cn(
                    'flex cursor-pointer items-center justify-between gap-3 rounded-xl p-3.5 transition-colors',
                    selected ?
                      'bg-primary/10 text-primary'
                    : 'bg-background-secondary/60 hover:bg-background-secondary text-ink-primary',
                  )}
                >
                  <div className='min-w-0'>
                    <div className='flex items-center gap-2'>
                      <p className='truncate text-sm font-semibold'>
                        {item.job_title || 'Untitled Role'}
                      </p>
                      {selected && (
                        <span className='rounded bg-primary/20 px-2 py-0.5 text-[11px] font-medium text-primary'>
                          Current
                        </span>
                      )}
                    </div>
                    <p className='mt-0.5 truncate text-xs text-ink-secondary'>
                      {item.company || 'Company not specified'} ·{' '}
                      {new Date(item.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <Button size='sm' variant={selected ? 'default' : 'secondary'}>
                    {selected ? 'Active' : 'Select'}
                  </Button>
                </div>
              );
            })}
          </div>
        </div>
      ),
      onClose: closeModal,
    });
  };

  if (loading) {
    return (
      <div className='flex h-[60vh] items-center justify-center'>
        <div className='flex flex-col items-center gap-3 text-ink-secondary'>
          <Loader2 className='h-8 w-8 animate-spin text-primary' />
          <p className='text-sm font-medium'>Loading tailored resume...</p>
        </div>
      </div>
    );
  }

  if (error || !currentResume) {
    return (
      <div className='mx-auto flex w-full max-w-4xl flex-col gap-6 p-6 lg:p-10'>
        <EmptyPlaceHolder
          title='No Tailored Resumes Found'
          message={
            error ||
            'No tailored resumes have been created yet. Generate one directly from the browser extension or job application page.'
          }
          className='py-16'
        />
      </div>
    );
  }

  const basics = resumeData.basics || {};
  const location = (basics.location || {}) as ResumeLocation;
  const experienceItems = resumeData.experience ?? [];
  const projectItems = resumeData.projects ?? [];
  const educationItems = resumeData.education ?? [];
  const certGroups = resumeData.certifications ?? [];
  const linkItems = resumeData.links ?? [];
  const otherItems = (resumeData.other ?? []) as ResumeOtherItem[];
  const otherTypes = Array.from(
    new Set(otherItems.map((item) => item.type).filter(Boolean)),
  );
  const otherSectionTitle =
    otherTypes.length === 1 ?
      otherTypes[0] || 'Additional information'
    : 'Additional information';

  return (
    <div className='mx-auto flex w-full flex-col gap-6 p-6 lg:p-10'>
      <header className='app-drag flex flex-wrap items-center justify-between gap-4 border-b border-primary/20 pb-6'>
        <div className='min-w-0'>
          <div className='flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-primary'>
            <Sparkles className='h-4 w-4' />
            Tailored Resume
          </div>
          <div className='mt-1 flex flex-wrap items-baseline gap-2.5'>
            <h1 className='text-2xl font-bold tracking-tight text-ink-primary sm:text-3xl'>
              {currentResume.job_title || 'Tailored Position'}
            </h1>
            {currentResume.company && (
              <span className='rounded-full bg-background-secondary px-3 py-1 text-xs font-semibold text-ink-secondary'>
                {currentResume.company}
              </span>
            )}
          </div>
          <p className='mt-1.5 text-xs text-ink-secondary'>
            Created {new Date(currentResume.created_at).toLocaleString()} · Edits on the left live-sync to the PDF
          </p>
        </div>

        <div className='flex flex-wrap items-center gap-2.5'>
          {tailoredResumes.length > 1 && (
            <Button
              variant='secondary'
              size='sm'
              Icon={History}
              onClick={openHistoryModal}
            >
              Switch Role ({tailoredResumes.length})
            </Button>
          )}

          <Button
            variant='default'
            size='sm'
            Icon={Download}
            isLoading={downloading}
            onClick={() => void handleDownloadPdf()}
          >
            Download PDF
          </Button>
        </div>
      </header>

      {saving && (
        <div className='fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-xl bg-panel px-4 py-2.5 shadow-lg'>
          <Loader2 className='h-4 w-4 animate-spin text-primary' />
          <span className='text-xs font-medium text-ink-primary'>Saving changes...</span>
        </div>
      )}

      <div className='grid min-h-[600px] items-start gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(360px,0.8fr)] xl:grid-cols-[minmax(0,1.3fr)_minmax(420px,0.7fr)]'>
        <div className='space-y-5'>
          <SectionCard
            title='Personal info'
            layoutId='job-review-section-basics'
            onClick={() =>
              openSectionModal(
                'job-review-section-basics',
                <BasicsEditor
                  data={resumeData}
                  onClose={closeModal}
                  onSave={async (next) => {
                    await handleSaveSection(next);
                    closeModal();
                  }}
                />,
              )
            }
            action={
              <Button
                size='sm'
                variant='ghost'
                Icon={Pencil}
                onClick={() =>
                  openSectionModal(
                    'job-review-section-basics',
                    <BasicsEditor
                      data={resumeData}
                      onClose={closeModal}
                      onSave={async (next) => {
                        await handleSaveSection(next);
                        closeModal();
                      }}
                    />,
                  )
                }
              >
                Edit
              </Button>
            }
          >
            <div className='flex flex-wrap items-center gap-x-6 gap-y-3.5 text-ink-primary'>
              <h3 className='flex items-center gap-2 text-base font-bold text-ink-primary'>
                <User className='h-4.5 w-4.5 shrink-0 text-primary' />
                <span className='font-semibold text-ink-primary'>
                  {[basics.first_name, basics.last_name]
                    .filter(Boolean)
                    .join(' ') || 'Name not listed'}
                </span>
              </h3>

              {basics.headline && (
                <p className='flex items-center gap-2 text-sm font-semibold text-ink-primary'>
                  <Briefcase className='h-4 w-4 shrink-0 text-primary' />
                  <span className='font-semibold text-ink-primary'>
                    {basics.headline}
                  </span>
                </p>
              )}

              {basics.email && (
                <div className='flex items-center gap-2 text-sm'>
                  <Mail className='h-4 w-4 shrink-0 text-primary' />
                  <span className='font-semibold text-ink-primary'>
                    {basics.email}
                  </span>
                </div>
              )}

              {basics.phone && (
                <div className='flex items-center gap-2 text-sm'>
                  <Phone className='h-4 w-4 shrink-0 text-primary' />
                  <span className='font-semibold text-ink-primary'>
                    {basics.phone}
                  </span>
                </div>
              )}

              {[location.city, location.state, location.country]
                .filter(Boolean)
                .join(', ') && (
                <div className='flex items-center gap-2 text-sm'>
                  <MapPin className='h-4 w-4 shrink-0 text-primary' />
                  <span className='font-semibold text-ink-primary'>
                    {[location.city, location.state, location.country]
                      .filter(Boolean)
                      .join(', ')}
                  </span>
                </div>
              )}

              {basics.linkedin_id && (
                <div className='flex items-center gap-2 text-sm'>
                  <LinkedinIcon className='h-4 w-4 shrink-0 text-primary' />
                  <span className='text-xs text-ink-secondary'>linkedin:</span>
                  <a
                    href={
                      basics.linkedin_id.startsWith('http') ?
                        basics.linkedin_id
                      : `https://www.linkedin.com/in/${basics.linkedin_id.replace(/^\/+|\/+$/g, '')}/`
                    }
                    target='_blank'
                    rel='noreferrer'
                    className='font-semibold text-ink-primary hover:text-primary'
                  >
                    {basics.linkedin_id
                      .replace(/^https?:\/\/(www\.)?linkedin\.com\/in\//i, '')
                      .replace(/\/$/, '')}
                  </a>
                </div>
              )}

              {basics.portfolio_url && (
                <div className='flex items-center gap-2 text-sm'>
                  <FolderGit2 className='h-4 w-4 shrink-0 text-primary' />
                  <span className='text-xs text-ink-secondary'>Portfolio:</span>
                  <a
                    href={
                      basics.portfolio_url.startsWith('http') ?
                        basics.portfolio_url
                      : `https://${basics.portfolio_url}`
                    }
                    target='_blank'
                    rel='noreferrer'
                    className='font-semibold text-ink-primary hover:text-primary'
                  >
                    {basics.portfolio_url
                      .replace(/^https?:\/\//i, '')
                      .replace(/\/$/, '')}
                  </a>
                </div>
              )}

              {basics.website && (
                <div className='flex items-center gap-2 text-sm'>
                  <Globe className='h-4 w-4 shrink-0 text-primary' />
                  <span className='text-xs text-ink-secondary'>Website:</span>
                  <a
                    href={
                      basics.website.startsWith('http') ?
                        basics.website
                      : `https://${basics.website}`
                    }
                    target='_blank'
                    rel='noreferrer'
                    className='font-semibold text-ink-primary hover:text-primary'
                  >
                    {basics.website
                      .replace(/^https?:\/\//i, '')
                      .replace(/\/$/, '')}
                  </a>
                </div>
              )}
            </div>
          </SectionCard>

          <SectionCard
            title='Executive Summary'
            layoutId='job-review-section-summary'
            onClick={() =>
              openSectionModal(
                'job-review-section-summary',
                <SummaryEditor
                  data={resumeData}
                  onClose={closeModal}
                  onSave={async (next) => {
                    await handleSaveSection(next);
                    closeModal();
                  }}
                />,
              )
            }
            action={
              <Button
                size='sm'
                variant='ghost'
                Icon={Pencil}
                onClick={() =>
                  openSectionModal(
                    'job-review-section-summary',
                    <SummaryEditor
                      data={resumeData}
                      onClose={closeModal}
                      onSave={async (next) => {
                        await handleSaveSection(next);
                        closeModal();
                      }}
                    />,
                  )
                }
              >
                Edit
              </Button>
            }
          >
            <p className='body-sm whitespace-pre-wrap leading-relaxed text-ink-secondary'>
              {resumeData.summary || 'No summary listed.'}
            </p>
          </SectionCard>

          <SectionCard
            title='Skills & Core Competencies'
            layoutId='job-review-section-skills'
            onClick={() =>
              openSectionModal(
                'job-review-section-skills',
                <SkillsEditor
                  data={resumeData}
                  initialCoreCompetencies={coreCompetencies}
                  onClose={closeModal}
                  onSave={async (next, nextCompetencies) => {
                    await handleSaveSection(next, nextCompetencies);
                    closeModal();
                  }}
                />,
              )
            }
            action={
              <Button
                size='sm'
                variant='ghost'
                Icon={Pencil}
                onClick={() =>
                  openSectionModal(
                    'job-review-section-skills',
                    <SkillsEditor
                      data={resumeData}
                      initialCoreCompetencies={coreCompetencies}
                      onClose={closeModal}
                      onSave={async (next, nextCompetencies) => {
                        await handleSaveSection(next, nextCompetencies);
                        closeModal();
                      }}
                    />,
                  )
                }
              >
                Edit
              </Button>
            }
          >
            <div className='space-y-4'>
              {coreCompetencies.length > 0 && (
                <div>
                  <p className='label text-ink-primary'>
                    Targeted Key Qualifications
                  </p>
                  <ul className='body-sm mt-2 list-disc space-y-1 pl-4 text-ink-secondary'>
                    {coreCompetencies.map((comp, idx) => (
                      <li key={`cc-${idx}`}>{comp}</li>
                    ))}
                  </ul>
                </div>
              )}

              <div className='space-y-3'>
                {(resumeData.skills ?? []).length ?
                  (resumeData.skills ?? []).map((group, index) => (
                    <div key={`skill-group-${index}`}>
                      <p className='body-sm font-medium text-ink-primary'>
                        {group.type || 'Skill group'}
                      </p>
                      <div className='mt-1.5'>
                        <TagList values={group.skills ?? []} />
                      </div>
                    </div>
                  ))
                : <p className='body-sm text-ink-secondary'>Not listed</p>}
              </div>
            </div>
          </SectionCard>

          <SectionCard
            title='Experience'
            layoutId='job-review-section-experience'
            onClick={() =>
              openSectionModal(
                'job-review-section-experience',
                <ExperienceEditor
                  data={resumeData}
                  onClose={closeModal}
                  onSave={async (next) => {
                    await handleSaveSection(next);
                    closeModal();
                  }}
                />,
              )
            }
            action={
              <Button
                size='sm'
                variant='ghost'
                Icon={Pencil}
                onClick={() =>
                  openSectionModal(
                    'job-review-section-experience',
                    <ExperienceEditor
                      data={resumeData}
                      onClose={closeModal}
                      onSave={async (next) => {
                        await handleSaveSection(next);
                        closeModal();
                      }}
                    />,
                  )
                }
              >
                Edit
              </Button>
            }
          >
            <div className='space-y-6'>
              {experienceItems.length ?
                experienceItems.map((item, index) => (
                  <article key={`experience-view-${index}`}>
                    <div className='flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1'>
                      <h3 className='label text-ink-primary'>
                        {item.title || 'Role not listed'}
                      </h3>
                      <span className='body-sm text-ink-secondary'>
                        {dateRange(item.start_date, item.end_date)}
                      </span>
                    </div>
                    <p className='body-sm mt-1 text-ink-secondary'>
                      {[item.company, item.location]
                        .filter(Boolean)
                        .join(' · ') || 'Company not listed'}
                    </p>
                    {(item.technologies ?? []).length > 0 && (
                      <div className='mt-2.5'>
                        <TagList values={item.technologies ?? []} />
                      </div>
                    )}
                    {(item.description ?? []).length > 0 && (
                      <ul className='body-sm mt-3 list-disc space-y-1.5 pl-4 text-ink-secondary'>
                        {(item.description ?? []).map((line, lIdx) => (
                          <li key={`exp-l-${lIdx}`}>{line}</li>
                        ))}
                      </ul>
                    )}
                  </article>
                ))
              : <p className='body-sm text-ink-secondary'>Not listed</p>}
            </div>
          </SectionCard>

          <SectionCard
            title='Projects'
            layoutId='job-review-section-projects'
            onClick={() =>
              openSectionModal(
                'job-review-section-projects',
                <ProjectsEditor
                  data={resumeData}
                  onClose={closeModal}
                  onSave={async (next) => {
                    await handleSaveSection(next);
                    closeModal();
                  }}
                />,
              )
            }
            action={
              <Button
                size='sm'
                variant='ghost'
                Icon={Pencil}
                onClick={() =>
                  openSectionModal(
                    'job-review-section-projects',
                    <ProjectsEditor
                      data={resumeData}
                      onClose={closeModal}
                      onSave={async (next) => {
                        await handleSaveSection(next);
                        closeModal();
                      }}
                    />,
                  )
                }
              >
                Edit
              </Button>
            }
          >
            <div className='space-y-6'>
              {projectItems.length ?
                projectItems.map((item, index) => (
                  <article key={`proj-view-${index}`}>
                    <div className='flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1'>
                      <h3 className='label text-ink-primary'>
                        {item.name || 'Project not listed'}
                      </h3>
                      <span className='body-sm text-ink-secondary'>
                        {dateRange(item.start_date, item.end_date)}
                      </span>
                    </div>
                    {item.url && (
                      <p className='body-sm mt-1'>
                        <a
                          href={item.url.startsWith('http') ? item.url : `https://${item.url}`}
                          target='_blank'
                          rel='noreferrer'
                          className='text-primary hover:underline'
                        >
                          {item.url.replace(/^https?:\/\//i, '').replace(/\/$/, '')}
                        </a>
                      </p>
                    )}
                    {(item.technologies ?? []).length > 0 && (
                      <div className='mt-2.5'>
                        <TagList values={item.technologies ?? []} />
                      </div>
                    )}
                    {(item.description ?? []).length > 0 && (
                      <ul className='body-sm mt-3 list-disc space-y-1.5 pl-4 text-ink-secondary'>
                        {(item.description ?? []).map((line, lIdx) => (
                          <li key={`proj-l-${lIdx}`}>{line}</li>
                        ))}
                      </ul>
                    )}
                  </article>
                ))
              : <p className='body-sm text-ink-secondary'>Not listed</p>}
            </div>
          </SectionCard>

          <SectionCard
            title='Education'
            layoutId='job-review-section-education'
            onClick={() =>
              openSectionModal(
                'job-review-section-education',
                <EducationEditor
                  data={resumeData}
                  onClose={closeModal}
                  onSave={async (next) => {
                    await handleSaveSection(next);
                    closeModal();
                  }}
                />,
              )
            }
            action={
              <Button
                size='sm'
                variant='ghost'
                Icon={Pencil}
                onClick={() =>
                  openSectionModal(
                    'job-review-section-education',
                    <EducationEditor
                      data={resumeData}
                      onClose={closeModal}
                      onSave={async (next) => {
                        await handleSaveSection(next);
                        closeModal();
                      }}
                    />,
                  )
                }
              >
                Edit
              </Button>
            }
          >
            <div className='space-y-5'>
              {educationItems.length ?
                educationItems.map((item, index) => (
                  <div key={`edu-view-${index}`}>
                    <p className='label text-ink-primary'>
                      {[item.degree, item.field_of_study]
                        .filter(Boolean)
                        .join(' · ') || 'Education'}
                    </p>
                    <p className='body-sm mt-0.5 text-ink-secondary'>
                      {item.institution || 'Institution not listed'}
                    </p>
                    <p className='body-sm text-ink-secondary'>
                      {dateRange(item.start_date, item.end_date)}
                    </p>
                    {(item.highlights ?? []).length > 0 && (
                      <ul className='body-sm mt-2 list-disc space-y-1 pl-4 text-ink-secondary'>
                        {(item.highlights ?? []).map((h, hIdx) => (
                          <li key={`edu-h-${hIdx}`}>{h}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                ))
              : <p className='body-sm text-ink-secondary'>Not listed</p>}
            </div>
          </SectionCard>

          {certGroups.length > 0 && (
            <SectionCard
              title='Certifications'
              layoutId='job-review-section-certifications'
              onClick={() =>
                openSectionModal(
                  'job-review-section-certifications',
                  <CertificationsEditor
                    data={resumeData}
                    onClose={closeModal}
                    onSave={async (next) => {
                      await handleSaveSection(next);
                      closeModal();
                    }}
                  />,
                )
              }
              action={
                <Button
                  size='sm'
                  variant='ghost'
                  Icon={Pencil}
                  onClick={() =>
                    openSectionModal(
                      'job-review-section-certifications',
                      <CertificationsEditor
                        data={resumeData}
                        onClose={closeModal}
                        onSave={async (next) => {
                          await handleSaveSection(next);
                          closeModal();
                        }}
                      />,
                    )
                  }
                >
                  Edit
                </Button>
              }
            >
              <div className='space-y-4'>
                {certGroups.map((group, groupIndex) => (
                  <div key={`cert-group-${groupIndex}`}>
                    <p className='body-sm font-semibold text-ink-primary'>
                      {group.type || 'Certifications'}
                    </p>
                    <div className='mt-2 space-y-2'>
                      {(group.certifications ?? []).map((cert, certIndex) => (
                        <div key={`cert-item-${certIndex}`} className='flex flex-wrap items-baseline justify-between gap-2'>
                          <span className='body-sm text-ink-primary font-medium'>
                            {[cert.name, cert.issuer].filter(Boolean).join(' · ')}
                          </span>
                          {cert.issue_date && (
                            <span className='body-xs text-ink-secondary'>
                              {cert.issue_date}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </SectionCard>
          )}

          {linkItems.length > 0 && (
            <SectionCard
              title='Links'
              layoutId='job-review-section-links'
              onClick={() =>
                openSectionModal(
                  'job-review-section-links',
                  <LinksEditor
                    data={resumeData}
                    onClose={closeModal}
                    onSave={async (next) => {
                      await handleSaveSection(next);
                      closeModal();
                    }}
                  />,
                )
              }
              action={
                <Button
                  size='sm'
                  variant='ghost'
                  Icon={Pencil}
                  onClick={() =>
                    openSectionModal(
                      'job-review-section-links',
                      <LinksEditor
                        data={resumeData}
                        onClose={closeModal}
                        onSave={async (next) => {
                          await handleSaveSection(next);
                          closeModal();
                        }}
                      />,
                    )
                  }
                >
                  Edit
                </Button>
              }
            >
              <div className='space-y-3'>
                {linkItems.map((item, index) => (
                  <div key={`link-view-${index}`} className='flex items-center gap-3'>
                    <p className='body-sm min-w-28 font-medium text-ink-primary'>
                      {item.type || 'Link'}
                    </p>
                    <a
                      href={
                        item.link ?
                          item.link.startsWith('http') ?
                            item.link
                          : `https://${item.link}`
                        : '#'
                      }
                      target='_blank'
                      rel='noreferrer'
                      className='body-sm truncate font-semibold text-primary hover:underline'
                    >
                      {item.link ?
                        item.link.replace(/^https?:\/\//i, '').replace(/\/$/, '')
                      : 'Not listed'}
                    </a>
                  </div>
                ))}
              </div>
            </SectionCard>
          )}

          {otherItems.length > 0 && (
            <SectionCard
              title={otherSectionTitle}
              layoutId='job-review-section-other'
              onClick={() =>
                openSectionModal(
                  'job-review-section-other',
                  <OtherEditor
                    data={resumeData}
                    onClose={closeModal}
                    onSave={async (next) => {
                      await handleSaveSection(next);
                      closeModal();
                    }}
                  />,
                )
              }
              action={
                <Button
                  size='sm'
                  variant='ghost'
                  Icon={Pencil}
                  onClick={() =>
                    openSectionModal(
                      'job-review-section-other',
                      <OtherEditor
                        data={resumeData}
                        onClose={closeModal}
                        onSave={async (next) => {
                          await handleSaveSection(next);
                          closeModal();
                        }}
                      />,
                    )
                  }
                >
                  Edit
                </Button>
              }
            >
              <div className='space-y-4'>
                {otherItems.map((item, index) => (
                  <div key={`other-view-${index}`}>
                    <div className='flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1'>
                      <p className='label text-ink-primary'>
                        {item.title || item.type || 'Other'}
                      </p>
                      {item.date && (
                        <span className='body-sm text-ink-secondary'>
                          {item.date}
                        </span>
                      )}
                    </div>
                    {(item.description ?? []).length > 0 && (
                      <ul className='body-sm mt-1 list-disc space-y-1 pl-4 text-ink-secondary'>
                        {(item.description ?? []).map((line, lIdx) => (
                          <li key={`other-l-${lIdx}`}>{line}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                ))}
              </div>
            </SectionCard>
          )}
        </div>

        <aside className='sticky top-6 self-start space-y-5'>
          <ResumePreviewCard
            data={resumeData}
            filename={pdfFilename}
            badge={currentResume.company || undefined}
            jobTitle={currentResume.job_title || undefined}
            coreCompetencies={coreCompetencies}
            onDownload={handleDownloadPdf}
          />
        </aside>
      </div>
    </div>
  );
}

export default function JobReviewPage() {
  return (
    <Suspense
      fallback={
        <div className='flex h-[60vh] items-center justify-center'>
          <Loader2 className='h-8 w-8 animate-spin text-primary' />
        </div>
      }
    >
      <JobReviewContent />
    </Suspense>
  );
}
