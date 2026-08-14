/** @format */

'use client';
import { Button, CircularProgress, Tooltip } from '@jobby/ui';

import { motion } from 'framer-motion';
import { Plus, RefreshCw, TicketCheck, Timer, X } from 'lucide-react';

import type {
  MasterResumeData,
  MasterResumeEvaluation,
  MasterResumeEvaluationHistoryItem,
} from '@/lib/types';

import { useGlobalModalStore } from '@/lib/store/global-modal-store';
import { ResumePdfPreview } from './resume-pdf-preview';

const EVALUATION_DIMENSIONS = {
  factual_completeness: { label: 'Factual completeness', weight: 25 },
  experience_quality: { label: 'Experience quality', weight: 45 },
  skill_evidence: { label: 'Skills backed by experience', weight: 20 },
  information_density: { label: 'Information density', weight: 10 },
} as const;

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
          className='rounded-md border border-border bg-background-secondary px-2 py-1 text-xs text-ink-secondary'
        >
          {value}
        </span>
      ))}
    </div>
  );
}
export function ResumeScoreSidebar({
  evaluation,
  evaluationIsCurrent,
  evaluating,
  onEvaluate,
  onOpenHistory,
}: {
  evaluation: MasterResumeEvaluation | null;
  evaluationIsCurrent: boolean;
  evaluating: boolean;
  onEvaluate: () => void;
  onOpenHistory: () => void;
}) {
  const openModal = useGlobalModalStore((state) => state.actions.openModal);
  const closeModal = useGlobalModalStore((state) => state.actions.closeModal);

  return (
    <Tooltip
      size='md'
      content={`Resume score is a measure of the quality of your resume. It is calculated based on the factual completeness, experience quality, skill evidence, and information density of your resume.`}
      side='top'
    >
      <motion.div
        role='button'
        tabIndex={0}
        layoutId='career-profile-score'
        transition={{
          type: 'spring',
          duration: 0.7,
          bounce: 0.2,
          ease: [0.22, 1, 0.36, 1],
        }}
        onClick={() =>
          openModal({
            layoutId: 'career-profile-score',
            className: ' w-full max-w-[70vw] overflow-auto',
            content: (
              <ScoreDetails
                evaluation={evaluation}
                evaluationIsCurrent={evaluationIsCurrent}
                evaluating={evaluating}
                onEvaluate={onEvaluate}
                onOpenHistory={onOpenHistory}
                onClose={closeModal}
              />
            ),
            onClose: closeModal,
          })
        }
        className='panel-xl col cursor-zoom-in group border border-border'
      >
        <div className='header items-start! '>
          <div className='col'>
            <p className='label text-left text-ink-secondary'>Resume score</p>
            <div className='-mt-4 flex items-baseline gap-2'>
              <span className='text-4xl font-semibold text-ink-primary'>
                {evaluation?.overall_score ?? '—'}
              </span>
              <span className='text-sm text-ink-secondary/50'>/ 100</span>
            </div>
          </div>
        </div>
        <div className='mt-4 grid grid-cols-2 gap-2 opacity-70 w-full group-hover:opacity-100 transition-opacity'>
          {evaluation?.evaluation?.map((dimension, index) => {
            const config = EVALUATION_DIMENSIONS[dimension.type];
            return (
              <motion.div
                layoutId={config.label}
                transition={{
                  type: 'spring',
                  duration: 0.7,
                  bounce: 0.2,
                  ease: [0.22, 1, 0.36, 1],
                }}
                key={dimension.type}
                className=''
              >
                <div className='flex flex-col items-center justify-center p-3 text-center rounded-2xl bg-background-secondary/50 border border-border/40'>
                  <CircularProgress
                    value={dimension.score}
                    size='sm'
                    thickness={6}
                    showValue
                    duration={0.45 + index * 0.15}
                  />
                  <p className='text-xs mt-2 font-medium text-ink-primary line-clamp-1'>
                    {config.label}
                  </p>
                  <p className='mt-0.5 text-[10px] text-ink-secondary'>
                    {config.weight}% weight
                  </p>
                </div>
              </motion.div>
            );
          })}
        </div>
        <Button
          className='self-end mt-4 opacity-0 group-hover:opacity-100'
          layoutId='score  history'
          size={'icon'}
        >
          <Plus />
        </Button>
      </motion.div>
    </Tooltip>
  );
}

export function ResumePreviewSidebar({
  data,
  filename,
}: {
  data: MasterResumeData;
  filename: string;
}) {
  return (
    <section className='panel-xl col group border border-border'>
      <div className='header items-start!'>
        <div className='min-w-0'>
          <p className='label text-left text-ink-secondary'>Resume preview</p>
          <p className='mt-1 truncate text-sm font-medium text-ink-primary'>
            {filename}
          </p>
        </div>
      </div>
      <ResumePdfPreview data={data} filename={filename} />
    </section>
  );
}

function ScoreDetails({
  evaluation,
  evaluationIsCurrent,
  evaluating,
  onEvaluate,
  onOpenHistory,
  onClose,
}: {
  evaluation: MasterResumeEvaluation | null;
  evaluationIsCurrent: boolean;
  evaluating: boolean;
  onEvaluate: () => void;
  onOpenHistory: () => void;
  onClose: () => void;
}) {
  const dimensions = evaluation?.evaluation ?? [];
  return (
    <motion.section
      transition={{
        type: 'spring',
        duration: 0.7,
        bounce: 0.2,
        ease: [0.22, 1, 0.36, 1],
      }}
      className='p-6 col '
    >
      <header className='header '>
        <div>
          <div className='flex items-baseline gap-2'>
            <span className='text-7xl font-semibold text-ink-primary'>
              {evaluation?.overall_score ?? '—'}
            </span>
            <span className='text-xl text-ink-secondary'>/ 100</span>
          </div>
          <p className='text-xl text-ink-secondary'>Resume score</p>
        </div>
        <div className='row'>
          <Button Icon={Timer} variant='secondary' onClick={onOpenHistory}>
            Score history
          </Button>
          {!evaluationIsCurrent && (
            <Button
              Icon={RefreshCw}
              isLoading={evaluating}
              onClick={onEvaluate}
            >
              Evaluate · 10 Coins
            </Button>
          )}
        </div>
        {/* <button
          type='button'
          aria-label='Close score details'
          onClick={onClose}
          className='flex h-9 w-9 items-center justify-center rounded-full text-ink-secondary hover:bg-background-secondary'
        >
          <X className='h-4 w-4' />
        </button> */}
      </header>
      <div className=''>
        {!evaluation ?
          <p className='body-md text-ink-secondary'>
            Score this Resume Profile to see how well the current resume
            performs.
          </p>
        : <div className='grid gap-4 lg:grid-cols-2'>
            {dimensions.map((dimension, index) => {
              const config = EVALUATION_DIMENSIONS[dimension.type];
              if (!config) return null;
              return (
                <motion.section
                  transition={{
                    type: 'spring',
                    duration: 0.7,
                    bounce: 0.2,
                    ease: [0.22, 1, 0.36, 1],
                  }}
                  layoutId={config.label}
                  key={dimension.type}
                  className='panel-lg bg-background-secondary/50! border border-primary/10'
                >
                  <span className='text-3xl font-extrabold text-ink-primary'>
                    {dimension.score}
                  </span>
                  <div className='flex items-start justify-between gap-3'>
                    <p className='text-lg font-semibold text-ink-primary'>
                      {config.label} · {config.weight}%
                    </p>
                  </div>
                  <div className='mt-3 h-4 overflow-hidden rounded-full bg-background'>
                    <motion.div
                      className='h-full bg-primary rounded-full-gradient rounded-full '
                      style={{
                        width: `${Math.max(0, Math.min(100, dimension.score))}%`,
                      }}
                      // initial={{ width: 0 }}
                      // animate={{
                      //   width: `${Math.max(0, Math.min(100, dimension.score))}%`,
                      // }}
                      // transition={{
                      //   duration: 0.7,
                      //   delay: index * 0.2,
                      //   ease: [0.22, 1, 0.36, 1],
                      // }}
                    />
                  </div>
                  <p className='mt-3 text-sm leading-6 text-ink-secondary'>
                    {dimension.overview}
                  </p>

                  {dimension.suggestions.length > 0 && (
                    <ul className='mt-3 space-y-2 list-disc border-l-4 border-primary/30 pl-8 text-sm leading-6 text-ink-secondary'>
                      {dimension.suggestions.map((suggestion) => (
                        <li key={suggestion} className='text-xs'>
                          {suggestion}
                        </li>
                      ))}
                    </ul>
                  )}
                </motion.section>
              );
            })}
          </div>
        }
      </div>
    </motion.section>
  );
}

export function ResumeVersionPreview({
  item,
  onClose,
}: {
  item: MasterResumeEvaluationHistoryItem;
  onClose: () => void;
}) {
  const snapshot = item.resume_data;
  if (!snapshot) return null;
  const hasEvaluation = Array.isArray(item.evaluation?.evaluation);
  const basics = snapshot.basics ?? {};
  const fullName = [basics.first_name, basics.middle_name, basics.last_name]
    .filter(Boolean)
    .join(' ');
  const experiences =
    Array.isArray(snapshot.experience) ? snapshot.experience : [];
  const education = Array.isArray(snapshot.education) ? snapshot.education : [];
  const projects = Array.isArray(snapshot.projects) ? snapshot.projects : [];
  const skills = Array.isArray(snapshot.skills) ? snapshot.skills : [];

  return (
    <div className='flex max-h-[88vh] min-h-[560px] flex-col'>
      <header className='header px-8'>
        <p className='body-sm  text-ink-secondary'>
          {hasEvaluation ?
            `Evaluated ${new Date(item.created_at).toLocaleString()} · v${item.resume_version} · Score ${item.evaluation.overall_score}/100`
          : `Published ${new Date(item.created_at).toLocaleString()} · v${item.resume_version} · Not evaluated`
          }
        </p>

        <button
          type='button'
          title='Close'
          aria-label='Close resume snapshot'
          onClick={onClose}
          className='flex size-9 shrink-0 items-center justify-center rounded-md text-ink-secondary hover:bg-background-secondary hover:text-ink-primary'
        >
          <X className='size-4' />
        </button>
      </header>
      <div className='body grid flex-1 overflow-y-auto lg:grid-cols-[260px_minmax(0,1fr)]'>
        <aside className='border-b border-border bg-background-secondary p-5 lg:border-b-0 lg:border-r'>
          <p className='label text-ink-primary'>Evaluation</p>
          <div className='mt-4 space-y-4'>
            {(item.evaluation?.evaluation ?? []).map((dimension) => {
              const config = EVALUATION_DIMENSIONS[dimension.type];
              return (
                <div key={dimension.type}>
                  <div className='flex justify-between gap-3 text-sm'>
                    <span className='text-ink-secondary'>{config.label}</span>
                    <span className='font-semibold text-ink-primary'>
                      {dimension.score}
                    </span>
                  </div>
                  <div className='mt-2 h-1.5 overflow-hidden rounded-full bg-border'>
                    <div
                      className='h-full bg-primary rounded-full'
                      style={{ width: `${dimension.score}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </aside>
        <main className='space-y-6 p-6'>
          <section>
            <h3 className='text-xl font-semibold text-ink-primary'>
              {fullName || 'Name not listed'}
            </h3>
            {basics.headline && (
              <p className='body-sm mt-1 text-ink-secondary'>
                {basics.headline}
              </p>
            )}
            <p className='mt-2 text-xs text-ink-secondary'>
              {[basics.email, basics.phone].filter(Boolean).join(' · ') ||
                'Contact details not listed'}
            </p>
          </section>
          {snapshot.summary && (
            <section className='border-t border-border pt-5'>
              <h3 className='label text-ink-primary'>Summary</h3>
              <p className='body-sm mt-2 whitespace-pre-line text-ink-secondary'>
                {snapshot.summary}
              </p>
            </section>
          )}
          {experiences.length > 0 && (
            <section className='border-t border-border pt-5'>
              <h3 className='label text-ink-primary'>Experience</h3>
              <div className='mt-3 space-y-5'>
                {experiences.map((experience, index) => (
                  <div
                    key={`${experience.company}-${experience.title}-${index}`}
                  >
                    <div className='flex flex-wrap justify-between gap-2'>
                      <p className='font-medium text-ink-primary'>
                        {[experience.title, experience.company]
                          .filter(Boolean)
                          .join(' · ') || 'Experience'}
                      </p>
                      <p className='text-xs text-ink-secondary'>
                        {dateRange(experience.start_date, experience.end_date)}
                      </p>
                    </div>
                    {experience.description?.length > 0 && (
                      <ul className='body-sm mt-2 list-disc space-y-1 pl-5 text-ink-secondary'>
                        {experience.description.map((line) => (
                          <li key={line}>{line}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}
          {education.length > 0 && (
            <section className='border-t border-border pt-5'>
              <h3 className='label text-ink-primary'>Education</h3>
              <div className='mt-3 space-y-3'>
                {education.map((entry, index) => (
                  <div key={`${entry.institution}-${index}`}>
                    <p className='font-medium text-ink-primary'>
                      {[entry.degree, entry.field_of_study]
                        .filter(Boolean)
                        .join(' in ') || 'Education'}
                    </p>
                    <p className='body-sm text-ink-secondary'>
                      {entry.institution}
                    </p>
                  </div>
                ))}
              </div>
            </section>
          )}
          {projects.length > 0 && (
            <section className='border-t border-border pt-5'>
              <h3 className='label text-ink-primary'>Projects</h3>
              <div className='mt-3 space-y-3'>
                {projects.map((project, index) => (
                  <div key={`${project.name}-${index}`}>
                    <p className='font-medium text-ink-primary'>
                      {project.name || 'Project'}
                    </p>
                    {project.description?.length > 0 && (
                      <p className='body-sm mt-1 text-ink-secondary'>
                        {project.description.join(' ')}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}
          {skills.length > 0 && (
            <section className='border-t border-border pt-5'>
              <h3 className='label text-ink-primary'>Skills</h3>
              <div className='mt-3 space-y-3'>
                {skills.map((group, index) => (
                  <div key={`${group.type}-${index}`}>
                    <p className='text-xs text-ink-secondary'>{group.type}</p>
                    <TagList values={group.skills ?? []} />
                  </div>
                ))}
              </div>
            </section>
          )}
        </main>
      </div>
      {/* <footer className='footer'>
        <Button onClick={onClose}>Close preview</Button>
      </footer> */}
    </div>
  );
}
