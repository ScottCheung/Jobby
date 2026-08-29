/** @format */

'use client';

import React, { type ReactNode } from 'react';
import { Button, SectionHeading } from '@jobby/ui';
import {
  Briefcase,
  FolderGit2,
  GraduationCap,
  Mail,
  MapPin,
  Pencil,
  Phone,
  Sparkles,
  User,
} from 'lucide-react';
import { motion } from 'framer-motion';
import type {
  MasterResumeData,
  ResumeLocation,
} from '@/lib/types';
import { useGlobalModalStore } from '@/lib/store/global-modal-store';
import {
  BasicsEditor,
  CertificationsEditor,
  EducationEditor,
  ExperienceEditor,
  LinksEditor,
  ProjectsEditor,
  SkillsEditor,
  SummaryEditor,
} from '@/app/settings/resume/_component/career-profile-section-editors';

function SectionCard({
  title,
  action,
  children,
  layoutId,
  onClick,
}: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
  layoutId: string;
  onClick: () => void;
}) {
  return (
    <motion.section
      layout
      layoutId={layoutId}
      onClick={onClick}
      className='group relative cursor-pointer rounded-2xl bg-panel/70 p-5 backdrop-blur-md transition-all hover:bg-panel hover:shadow-md'
    >
      <div className='flex items-center justify-between border-b border-primary/20 pb-3'>
        <div className='flex items-center gap-2'>
          <SectionHeading className='text-sm font-bold text-ink-primary'>
            {title}
          </SectionHeading>
        </div>
        {action && (
          <div
            onClick={(e) => e.stopPropagation()}
            className='opacity-0 transition-opacity group-hover:opacity-100'
          >
            {action}
          </div>
        )}
      </div>
      <div className='px-1 pt-4 pb-2'>{children}</div>
    </motion.section>
  );
}

interface TailorSectionsEditorProps {
  resumeData: MasterResumeData;
  coreCompetencies: string[];
  onSave: (
    nextResumeData: MasterResumeData,
    nextCompetencies?: string[],
  ) => Promise<void>;
}

export function TailorSectionsEditor({
  resumeData,
  coreCompetencies,
  onSave,
}: TailorSectionsEditorProps) {
  const { openModal, closeModal } = useGlobalModalStore(
    (state) => state.actions,
  );

  const openSectionModal = (layoutId: string, content: ReactNode) => {
    openModal({
      layoutId,
      className: 'w-[94vw] max-w-4xl max-h-[88vh] rounded-2xl',
      content,
      onClose: closeModal,
    });
  };

  const basics = (resumeData.basics || {}) as Record<string, any>;
  const experienceList = resumeData.experience || [];
  const projectList = resumeData.projects || [];
  const educationList = resumeData.education || [];

  return (
    <div className='space-y-4 pt-2'>
      <div className='flex items-center justify-between'>
        <h3 className='text-base font-bold text-ink-primary'>
          Resume Sections & Detailed Edits
        </h3>
        <span className='text-xs text-ink-secondary'>
          Click any card to edit details
        </span>
      </div>

      <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
        {/* Personal info */}
        <SectionCard
          title='Personal info'
          layoutId='tailored-section-basics'
          onClick={() =>
            openSectionModal(
              'tailored-section-basics',
              <BasicsEditor
                data={resumeData}
                onClose={closeModal}
                onSave={async (next) => {
                  await onSave(next);
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
                  'tailored-section-basics',
                  <BasicsEditor
                    data={resumeData}
                    onClose={closeModal}
                    onSave={async (next) => {
                      await onSave(next);
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
          <div className='flex flex-wrap items-center gap-x-6 gap-y-2.5 text-xs text-ink-primary'>
            <h3 className='flex items-center gap-2 text-sm font-bold text-ink-primary'>
              <User className='h-4 w-4 shrink-0 text-primary' />
              <span>
                {[basics.first_name, basics.last_name]
                  .filter(Boolean)
                  .join(' ') || 'Name not listed'}
              </span>
            </h3>

            {basics.headline && (
              <p className='flex items-center gap-2 font-medium text-ink-primary'>
                <Briefcase className='h-3.5 w-3.5 shrink-0 text-primary' />
                <span>{basics.headline}</span>
              </p>
            )}

            {basics.email && (
              <div className='flex items-center gap-2'>
                <Mail className='h-3.5 w-3.5 shrink-0 text-primary' />
                <span>{basics.email}</span>
              </div>
            )}

            {basics.phone && (
              <div className='flex items-center gap-2'>
                <Phone className='h-3.5 w-3.5 shrink-0 text-primary' />
                <span>{basics.phone}</span>
              </div>
            )}
          </div>
        </SectionCard>

        {/* Professional summary */}
        <SectionCard
          title='Professional summary'
          layoutId='tailored-section-summary'
          onClick={() =>
            openSectionModal(
              'tailored-section-summary',
              <SummaryEditor
                data={resumeData}
                onClose={closeModal}
                onSave={async (next) => {
                  await onSave(next);
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
                  'tailored-section-summary',
                  <SummaryEditor
                    data={resumeData}
                    onClose={closeModal}
                    onSave={async (next) => {
                      await onSave(next);
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
          <p className='text-xs leading-relaxed text-ink-secondary line-clamp-3'>
            {resumeData.summary || 'No professional summary provided.'}
          </p>
        </SectionCard>
      </div>

      {/* Core Competencies */}
      <SectionCard
        title='Core Competencies & Skills'
        layoutId='tailored-section-skills'
        onClick={() =>
          openSectionModal(
            'tailored-section-skills',
            <SkillsEditor
              data={resumeData}
              initialCoreCompetencies={coreCompetencies}
              onClose={closeModal}
              onSave={async (next, nextCompetencies) => {
                await onSave(next, nextCompetencies);
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
                'tailored-section-skills',
                <SkillsEditor
                  data={resumeData}
                  initialCoreCompetencies={coreCompetencies}
                  onClose={closeModal}
                  onSave={async (next, nextCompetencies) => {
                    await onSave(next, nextCompetencies);
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
        <div className='flex flex-wrap gap-1.5'>
          {coreCompetencies.length > 0 ? (
            coreCompetencies.map((skill, idx) => (
              <span
                key={idx}
                className='rounded-md bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary'
              >
                {skill}
              </span>
            ))
          ) : (
            <p className='text-xs text-ink-secondary'>
              No core competencies listed.
            </p>
          )}
        </div>
      </SectionCard>

      {/* Work Experience */}
      <SectionCard
        title={`Work experience (${experienceList.length})`}
        layoutId='tailored-section-experience'
        onClick={() =>
          openSectionModal(
            'tailored-section-experience',
            <ExperienceEditor
              data={resumeData}
              onClose={closeModal}
              onSave={async (next) => {
                await onSave(next);
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
                'tailored-section-experience',
                <ExperienceEditor
                  data={resumeData}
                  onClose={closeModal}
                  onSave={async (next) => {
                    await onSave(next);
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
          {experienceList.map((exp, index) => (
            <div
              key={index}
              className='border-b border-primary/10 pb-2.5 last:border-b-0 last:pb-0'
            >
              <div className='flex flex-wrap items-baseline justify-between gap-2'>
                <h4 className='text-xs font-bold text-ink-primary'>
                  {exp.title} · {exp.company}
                </h4>
                <span className='text-[11px] text-ink-secondary'>
                  {[exp.start_date, exp.end_date || 'Present']
                    .filter(Boolean)
                    .join(' — ')}
                </span>
              </div>
              {exp.description && exp.description.length > 0 && (
                <ul className='mt-1 space-y-1 list-disc pl-4 text-xs text-ink-secondary'>
                  {exp.description.slice(0, 3).map((pt, pIdx) => (
                    <li key={pIdx} className='leading-relaxed'>
                      {pt}
                    </li>
                  ))}
                  {exp.description.length > 3 && (
                    <li className='list-none text-[11px] text-primary'>
                      +{exp.description.length - 3} more bullets
                    </li>
                  )}
                </ul>
              )}
            </div>
          ))}
        </div>
      </SectionCard>

      <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
        {/* Projects */}
        <SectionCard
          title={`Projects (${projectList.length})`}
          layoutId='tailored-section-projects'
          onClick={() =>
            openSectionModal(
              'tailored-section-projects',
              <ProjectsEditor
                data={resumeData}
                onClose={closeModal}
                onSave={async (next) => {
                  await onSave(next);
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
                  'tailored-section-projects',
                  <ProjectsEditor
                    data={resumeData}
                    onClose={closeModal}
                    onSave={async (next) => {
                      await onSave(next);
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
            {projectList.map((proj, index) => (
              <div
                key={index}
                className='border-b border-primary/10 pb-2 last:border-b-0 last:pb-0'
              >
                <h4 className='text-xs font-bold text-ink-primary'>
                  {proj.name}
                </h4>
                {proj.description && (
                  <p className='mt-0.5 text-xs text-ink-secondary line-clamp-2'>
                    {proj.description}
                  </p>
                )}
              </div>
            ))}
          </div>
        </SectionCard>

        {/* Education */}
        <SectionCard
          title={`Education (${educationList.length})`}
          layoutId='tailored-section-education'
          onClick={() =>
            openSectionModal(
              'tailored-section-education',
              <EducationEditor
                data={resumeData}
                onClose={closeModal}
                onSave={async (next) => {
                  await onSave(next);
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
                  'tailored-section-education',
                  <EducationEditor
                    data={resumeData}
                    onClose={closeModal}
                    onSave={async (next) => {
                      await onSave(next);
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
          <div className='space-y-2'>
            {educationList.map((edu, index) => (
              <div
                key={index}
                className='flex flex-wrap items-baseline justify-between gap-2 text-xs'
              >
                <div>
                  <span className='font-bold text-ink-primary'>
                    {edu.degree}
                  </span>
                  <span className='text-ink-secondary'> · {edu.institution}</span>
                </div>
                <span className='text-[11px] text-ink-secondary'>
                  {[edu.start_date, edu.end_date].filter(Boolean).join(' — ')}
                </span>
              </div>
            ))}
          </div>
        </SectionCard>
      </div>
    </div>
  );
}
