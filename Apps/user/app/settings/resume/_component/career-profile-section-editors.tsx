/** @format */

'use client';
import { BulletListInput, Button, Input, TagInput, Textarea } from '@jobby/ui';

import { useState } from 'react';
import {
  Check,
  Plus,
  Trash2,
  User,
  FileText,
  Briefcase,
  FolderGit2,
  Wrench,
  GraduationCap,
  Award,
  Link as LinkIcon,
  Layers,
  X,
  ChevronUp,
  ChevronDown,
  GripVertical,
} from 'lucide-react';

import type {
  MasterResumeData,
  ResumeLocation,
  ResumeSkillGroup,
  ResumeCertificationGroup,
  ResumeCertification,
  ResumeLink,
  ResumeOtherItem,
} from '@/lib/types';

type ResumeBasics = NonNullable<MasterResumeData['basics']>;
type ResumeExperience = NonNullable<MasterResumeData['experience']>[number];
type ResumeEducation = NonNullable<MasterResumeData['education']>[number];
type ResumeProject = NonNullable<MasterResumeData['projects']>[number];

function asValue(val?: string | null) {
  return val ?? '';
}

function ModalHeader({
  title,
  description,
  icon: Icon,
  onClose,
}: {
  title: string;
  description: string;
  icon: React.ElementType;
  onClose: () => void;
}) {
  return (
    <header className='header'>
      <div className='flex min-w-0 items-start gap-3'>
        <div className='flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary'>
          <Icon className='h-5 w-5' />
        </div>
        <div>
          <h2 className='title-section text-ink-primary'>{title}</h2>
          <p className='body-md mt-1 text-ink-secondary'>{description}</p>
        </div>
      </div>
      <button
        type='button'
        title='Close editor'
        aria-label='Close editor'
        onClick={onClose}
        className='flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-ink-secondary hover:bg-background-secondary hover:text-ink-primary'
      >
        <X className='h-4 w-4' />
      </button>
    </header>
  );
}

function ModalFooter({
  onClose,
  onSave,
  saving,
}: {
  onClose: () => void;
  onSave: () => void;
  saving?: boolean;
}) {
  return (
    <footer className='footer'>
      <Button variant='ghost' onClick={onClose} disabled={saving}>
        Cancel
      </Button>
      <Button Icon={Check} isLoading={saving} onClick={onSave}>
        Save changes
      </Button>
    </footer>
  );
}

/* ========================================================================== */
/* Personal Info Editor                                                       */
/* ========================================================================== */
export function BasicsEditor({
  data,
  onSave,
  onClose,
}: {
  data: MasterResumeData;
  onSave: (next: MasterResumeData) => Promise<void>;
  onClose: () => void;
}) {
  const basics = data.basics ?? {};
  const location = (basics.location ?? {}) as Partial<ResumeLocation>;
  const [draft, setDraft] = useState<{
    first_name: string;
    last_name: string;
    email: string;
    phone: string;
    headline: string;
    linkedin_id: string;
    website: string;
    portfolio_url: string;
    city: string;
    state: string;
    country: string;
  }>({
    first_name: asValue(basics.first_name),
    last_name: asValue(basics.last_name),
    email: asValue(basics.email),
    phone: asValue(basics.phone),
    headline: asValue(basics.headline),
    linkedin_id: asValue(basics.linkedin_id),
    website: asValue(basics.website),
    portfolio_url: asValue(basics.portfolio_url),
    city: asValue(location.city),
    state: asValue(location.state),
    country: asValue(location.country),
  });
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      const nextBasics: ResumeBasics = {
        ...basics,
        first_name: draft.first_name || null,
        last_name: draft.last_name || null,
        email: draft.email || null,
        phone: draft.phone || null,
        headline: draft.headline || null,
        linkedin_id: draft.linkedin_id || null,
        website: draft.website || null,
        portfolio_url: draft.portfolio_url || null,
        location: {
          ...location,
          city: draft.city || null,
          state: draft.state || null,
          country: draft.country || null,
        } as ResumeLocation,
      };
      await onSave({ ...data, basics: nextBasics });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className='flex max-h-[88vh] min-h-[420px] flex-col'>
      <ModalHeader
        title='Personal Info'
        description='Update your name, contact information, and headline.'
        icon={User}
        onClose={onClose}
      />
      <div className='body space-y-4'>
        <div className='grid gap-4 md:grid-cols-2'>
          <div>
            <label className='text-xs font-medium text-ink-secondary mb-1 block'>
              First Name
            </label>
            <Input
              className='font-semibold text-ink-primary'
              value={draft.first_name}
              placeholder='First name'
              onChange={(e) =>
                setDraft({ ...draft, first_name: e.target.value })
              }
            />
          </div>
          <div>
            <label className='text-xs font-medium text-ink-secondary mb-1 block'>
              Last Name
            </label>
            <Input
              className='font-semibold text-ink-primary'
              value={draft.last_name}
              placeholder='Last name'
              onChange={(e) =>
                setDraft({ ...draft, last_name: e.target.value })
              }
            />
          </div>
          <div>
            <label className='text-xs font-medium text-ink-secondary mb-1 block'>
              Email
            </label>
            <Input
              className='font-semibold text-ink-primary'
              value={draft.email}
              placeholder='email@example.com'
              onChange={(e) => setDraft({ ...draft, email: e.target.value })}
            />
          </div>
          <div>
            <label className='text-xs font-medium text-ink-secondary mb-1 block'>
              Phone
            </label>
            <Input
              className='font-semibold text-ink-primary'
              value={draft.phone}
              placeholder='+1 (555) 000-0000'
              onChange={(e) => setDraft({ ...draft, phone: e.target.value })}
            />
          </div>
          <div>
            <label className='text-xs font-medium text-ink-secondary mb-1 block'>
              City
            </label>
            <Input
              className='font-semibold text-ink-primary'
              value={draft.city}
              placeholder='City'
              onChange={(e) => setDraft({ ...draft, city: e.target.value })}
            />
          </div>
          <div>
            <label className='text-xs font-medium text-ink-secondary mb-1 block'>
              Country
            </label>
            <Input
              className='font-semibold text-ink-primary'
              value={draft.country}
              placeholder='Country'
              onChange={(e) => setDraft({ ...draft, country: e.target.value })}
            />
          </div>
          <div>
            <label className='text-xs font-medium text-ink-secondary mb-1 block'>
              LinkedIn ID
            </label>
            <Input
              className='font-semibold text-ink-primary'
              value={draft.linkedin_id}
              placeholder='e.g. scottzhang1110'
              onChange={(e) =>
                setDraft({ ...draft, linkedin_id: e.target.value })
              }
            />
          </div>
          <div>
            <label className='text-xs font-medium text-ink-secondary mb-1 block'>
              Portfolio / Project URL
            </label>
            <Input
              className='font-semibold text-ink-primary'
              value={draft.portfolio_url}
              placeholder='https://...'
              onChange={(e) =>
                setDraft({ ...draft, portfolio_url: e.target.value })
              }
            />
          </div>
          <div className='md:col-span-2'>
            <label className='text-xs font-medium text-ink-secondary mb-1 block'>
              Personal Website
            </label>
            <Input
              className='font-semibold text-ink-primary'
              value={draft.website}
              placeholder='https://...'
              onChange={(e) =>
                setDraft({ ...draft, website: e.target.value })
              }
            />
          </div>
          <div className='md:col-span-2'>
            <label className='text-xs font-medium text-ink-secondary mb-1 block'>
              Professional Headline
            </label>
            <Input
              className='font-semibold text-ink-primary'
              value={draft.headline}
              placeholder='e.g. Senior Software Engineer'
              onChange={(e) => setDraft({ ...draft, headline: e.target.value })}
            />
          </div>
        </div>
      </div>
      <ModalFooter onClose={onClose} onSave={handleSave} saving={saving} />
    </div>
  );
}

/* ========================================================================== */
/* Summary Editor                                                             */
/* ========================================================================== */
export function SummaryEditor({
  data,
  onSave,
  onClose,
}: {
  data: MasterResumeData;
  onSave: (next: MasterResumeData) => Promise<void>;
  onClose: () => void;
}) {
  const [summary, setSummary] = useState(asValue(data.summary));
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave({ ...data, summary: summary.trim() || null });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className='flex max-h-[88vh] min-h-[380px] flex-col'>
      <ModalHeader
        title='Summary'
        description='Write a professional overview summarizing your expertise and value.'
        icon={FileText}
        onClose={onClose}
      />
      <div className='body'>
        <Textarea
          label='Professional Summary'
          value={summary}
          placeholder='Brief professional summary...'
          onChange={(e) => setSummary(e.target.value)}
          minHeight={220}
        />
      </div>
      <ModalFooter onClose={onClose} onSave={handleSave} saving={saving} />
    </div>
  );
}

/* ========================================================================== */
/* Experience Editor                                                          */
/* ========================================================================== */
export function ExperienceEditor({
  data,
  onSave,
  onClose,
}: {
  data: MasterResumeData;
  onSave: (next: MasterResumeData) => Promise<void>;
  onClose: () => void;
}) {
  const [items, setItems] = useState<ResumeExperience[]>(
    Array.isArray(data.experience) ? data.experience : [],
  );
  const [saving, setSaving] = useState(false);

  const updateItem = (index: number, patch: Partial<ResumeExperience>) => {
    const list = [...items];
    list[index] = { ...list[index], ...patch };
    setItems(list);
  };

  const removeItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const moveItem = (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= items.length) return;
    const next = [...items];
    const [moved] = next.splice(index, 1);
    next.splice(targetIndex, 0, moved);
    setItems(next);
  };

  const addItem = () => {
    setItems([
      ...items,
      {
        title: '',
        company: '',
        location: '',
        start_date: '',
        end_date: '',
        description: [],
        technologies: [],
      },
    ]);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave({ ...data, experience: items });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className='flex max-h-[88vh] min-h-[480px] flex-col'>
      <ModalHeader
        title='Experience'
        description='Manage work history, bullet points, and key technologies. Reorder experiences using the arrow buttons.'
        icon={Briefcase}
        onClose={onClose}
      />
      <div className='body space-y-4'>
        {items.map((item, index) => (
          <div
            key={`exp-${index}`}
            className='rounded-xl border border-border bg-panel p-4 md:p-5 space-y-4 shadow-xs'
          >
            <div className='flex items-center justify-between gap-3 border-b border-border/40 pb-3'>
              <div className='flex items-center gap-2 min-w-0'>
                <span className='inline-flex h-5 min-w-5 items-center justify-center rounded-md bg-primary/10 px-1.5 text-[11px] font-bold text-primary shrink-0'>
                  {index + 1}
                </span>
                <h3 className='font-semibold text-ink-primary truncate text-sm'>
                  {item.title || item.company ?
                    `${item.title || 'Role'} at ${item.company || 'Company'}`
                  : `Experience #${index + 1}`}
                </h3>
              </div>
              <div className='flex items-center gap-1 shrink-0'>
                <button
                  type='button'
                  title='Move role up'
                  aria-label='Move role up'
                  disabled={index === 0}
                  onClick={() => moveItem(index, 'up')}
                  className='p-1 rounded-md text-ink-secondary hover:text-ink-primary hover:bg-background-secondary disabled:opacity-30 cursor-pointer'
                >
                  <ChevronUp className='size-4' />
                </button>
                <button
                  type='button'
                  title='Move role down'
                  aria-label='Move role down'
                  disabled={index === items.length - 1}
                  onClick={() => moveItem(index, 'down')}
                  className='p-1 rounded-md text-ink-secondary hover:text-ink-primary hover:bg-background-secondary disabled:opacity-30 cursor-pointer'
                >
                  <ChevronDown className='size-4' />
                </button>
                <Button
                  type='button'
                  size='sm'
                  variant='ghost'
                  className='text-red-500 hover:bg-red-500/10 hover:text-red-600'
                  Icon={Trash2}
                  onClick={() => removeItem(index)}
                >
                  Delete Role
                </Button>
              </div>
            </div>

            <div className='grid gap-3 md:grid-cols-2'>
              <div>
                <label className='text-xs font-medium text-ink-secondary mb-1 block'>
                  Job Title
                </label>
                <Input
                  value={asValue(item.title)}
                  placeholder='Job title'
                  onChange={(e) =>
                    updateItem(index, { title: e.target.value || null })
                  }
                />
              </div>
              <div>
                <label className='text-xs font-medium text-ink-secondary mb-1 block'>
                  Company
                </label>
                <Input
                  value={asValue(item.company)}
                  placeholder='Company name'
                  onChange={(e) =>
                    updateItem(index, { company: e.target.value || null })
                  }
                />
              </div>
              <div>
                <label className='text-xs font-medium text-ink-secondary mb-1 block'>
                  Location
                </label>
                <Input
                  value={asValue(item.location)}
                  placeholder='Location'
                  onChange={(e) =>
                    updateItem(index, { location: e.target.value || null })
                  }
                />
              </div>
              <div className='grid grid-cols-2 gap-2'>
                <div>
                  <label className='text-xs font-medium text-ink-secondary mb-1 block'>
                    Start Date
                  </label>
                  <Input
                    value={asValue(item.start_date)}
                    placeholder='e.g. Jan 2022'
                    onChange={(e) =>
                      updateItem(index, { start_date: e.target.value || null })
                    }
                  />
                </div>
                <div>
                  <label className='text-xs font-medium text-ink-secondary mb-1 block'>
                    End Date
                  </label>
                  <Input
                    value={asValue(item.end_date)}
                    placeholder='e.g. Present'
                    onChange={(e) =>
                      updateItem(index, { end_date: e.target.value || null })
                    }
                  />
                </div>
              </div>
            </div>

            <div>
              <label className='text-xs font-semibold text-ink-secondary mb-1 block'>
                Key Achievements / Responsibilities <span className='text-ink-secondary/70 font-normal'>(Drag to reorder)</span>
              </label>
              <BulletListInput
                values={item.description ?? []}
                placeholder='Add an achievement point...'
                onChange={(desc) => updateItem(index, { description: desc })}
              />
            </div>

            <div>
              <label className='text-xs font-semibold text-ink-secondary mb-1 block'>
                Technologies Used
              </label>
              <TagInput
                values={item.technologies ?? []}
                placeholder='Add technology'
                onChange={(techs) => updateItem(index, { technologies: techs })}
              />
            </div>
          </div>
        ))}

        <Button
          type='button'
          variant='secondary'
          className='w-full'
          Icon={Plus}
          onClick={addItem}
        >
          Add Experience Entry
        </Button>
      </div>
      <ModalFooter onClose={onClose} onSave={handleSave} saving={saving} />
    </div>
  );
}

/* ========================================================================== */
/* Projects Editor                                                            */
/* ========================================================================== */
export function ProjectsEditor({
  data,
  onSave,
  onClose,
}: {
  data: MasterResumeData;
  onSave: (next: MasterResumeData) => Promise<void>;
  onClose: () => void;
}) {
  const [items, setItems] = useState<ResumeProject[]>(
    Array.isArray(data.projects) ? data.projects : [],
  );
  const [saving, setSaving] = useState(false);

  const updateItem = (index: number, patch: Partial<ResumeProject>) => {
    const list = [...items];
    list[index] = { ...list[index], ...patch };
    setItems(list);
  };

  const removeItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const addItem = () => {
    setItems([
      ...items,
      {
        name: '',
        url: '',
        start_date: '',
        end_date: '',
        description: [],
        technologies: [],
      },
    ]);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave({ ...data, projects: items });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className='flex max-h-[88vh] min-h-[480px] flex-col'>
      <ModalHeader
        title='Projects'
        description='Manage portfolio projects, descriptions (point by point), and technology tags.'
        icon={FolderGit2}
        onClose={onClose}
      />
      <div className='body'>
        {items.map((item, index) => (
          <div
            key={`project-item-${index}`}
            className='rounded-xl border border-border bg-panel p-4 md:p-5 space-y-4'
          >
            <div className='flex items-center justify-between gap-3 border-b border-border/40 pb-3'>
              <h3 className='font-semibold text-ink-primary'>
                {item.name || `Project #${index + 1}`}
              </h3>
              <Button
                type='button'
                size='sm'
                variant='ghost'
                className='text-red-500 hover:bg-red-500/10 hover:text-red-600'
                Icon={Trash2}
                onClick={() => removeItem(index)}
              >
                Delete Project
              </Button>
            </div>

            <div className='grid gap-3 md:grid-cols-2'>
              <div>
                <label className='body-sm mb-1 block text-ink-secondary'>
                  Project Name
                </label>
                <Input
                  value={asValue(item.name)}
                  placeholder='Project title'
                  onChange={(e) =>
                    updateItem(index, { name: e.target.value || null })
                  }
                />
              </div>
              <div>
                <label className='body-sm mb-1 block text-ink-secondary'>
                  URL / Link
                </label>
                <Input
                  value={asValue(item.url)}
                  placeholder='https://github.com/...'
                  onChange={(e) =>
                    updateItem(index, { url: e.target.value || null })
                  }
                />
              </div>
              <div>
                <label className='body-sm mb-1 block text-ink-secondary'>
                  Start Date
                </label>
                <Input
                  value={asValue(item.start_date)}
                  placeholder='e.g. Jan 2023'
                  onChange={(e) =>
                    updateItem(index, { start_date: e.target.value || null })
                  }
                />
              </div>
              <div>
                <label className='body-sm mb-1 block text-ink-secondary'>
                  End Date
                </label>
                <Input
                  value={asValue(item.end_date)}
                  placeholder='e.g. Dec 2023'
                  onChange={(e) =>
                    updateItem(index, { end_date: e.target.value || null })
                  }
                />
              </div>
            </div>

            <div>
              <label className='body-sm mb-1 block font-medium text-ink-primary'>
                Project Highlights / Features (Drag to reorder)
              </label>
              <BulletListInput
                values={item.description ?? []}
                placeholder='Add a project feature or achievement point...'
                onChange={(desc) => updateItem(index, { description: desc })}
              />
            </div>

            <div>
              <label className='body-sm mb-1 block font-medium text-ink-primary'>
                Technologies Used
              </label>
              <TagInput
                values={item.technologies ?? []}
                placeholder='Add technology tag'
                onChange={(techs) => updateItem(index, { technologies: techs })}
              />
            </div>
          </div>
        ))}

        <Button
          type='button'
          variant='secondary'
          className='w-full'
          Icon={Plus}
          onClick={addItem}
        >
          Add Project
        </Button>
      </div>
      <ModalFooter onClose={onClose} onSave={handleSave} saving={saving} />
    </div>
  );
}

/* ========================================================================== */
/* Skills Editor                                                              */
/* ========================================================================== */
export function SkillsEditor({
  data,
  onSave,
  onClose,
}: {
  data: MasterResumeData;
  onSave: (next: MasterResumeData) => Promise<void>;
  onClose: () => void;
}) {
  const [groups, setGroups] = useState<ResumeSkillGroup[]>(
    Array.isArray(data.skills) ? data.skills : [],
  );
  const [saving, setSaving] = useState(false);

  const updateGroup = (index: number, patch: Partial<ResumeSkillGroup>) => {
    const list = [...groups];
    list[index] = { ...list[index], ...patch };
    setGroups(list);
  };

  const removeGroup = (index: number) => {
    setGroups(groups.filter((_, i) => i !== index));
  };

  const addGroup = () => {
    setGroups([...groups, { type: 'Languages & Frameworks', skills: [] }]);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave({ ...data, skills: groups });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className='flex max-h-[88vh] min-h-[440px] flex-col'>
      <ModalHeader
        title='Skills'
        description='Organize your technical and professional skills into categories.'
        icon={Wrench}
        onClose={onClose}
      />
      <div className='body'>
        {groups.map((group, index) => (
          <div
            key={`skill-group-${index}`}
            className='rounded-lg border border-border bg-panel p-4 md:p-5 space-y-3'
          >
            <div className='flex items-center justify-between gap-3'>
              <div className='flex-1 max-w-sm'>
                <label className='body-sm mb-1 block text-ink-secondary'>
                  Category Name
                </label>
                <Input
                  value={asValue(group.type)}
                  placeholder='e.g. Programming Languages'
                  onChange={(e) =>
                    updateGroup(index, { type: e.target.value || 'Other' })
                  }
                />
              </div>
              <Button
                type='button'
                size='sm'
                variant='ghost'
                className='text-red-500 hover:bg-red-500/10 hover:text-red-600 self-end'
                Icon={Trash2}
                onClick={() => removeGroup(index)}
              >
                Remove All
              </Button>
            </div>

            <div>
              <label className='body-sm mb-1 block font-medium text-ink-primary'>
                Skills (Drag to reorder)
              </label>
              <TagInput
                values={group.skills ?? []}
                placeholder='Add a skill tag'
                onChange={(skills) => updateGroup(index, { skills })}
              />
            </div>
          </div>
        ))}

        <Button
          type='button'
          variant='ghost'
          className='w-full'
          Icon={Plus}
          onClick={addGroup}
        >
          Add Skill Category
        </Button>
      </div>
      <ModalFooter onClose={onClose} onSave={handleSave} saving={saving} />
    </div>
  );
}

/* ========================================================================== */
/* Education Editor                                                           */
/* ========================================================================== */
export function EducationEditor({
  data,
  onSave,
  onClose,
}: {
  data: MasterResumeData;
  onSave: (next: MasterResumeData) => Promise<void>;
  onClose: () => void;
}) {
  const [items, setItems] = useState<ResumeEducation[]>(
    Array.isArray(data.education) ? data.education : [],
  );
  const [saving, setSaving] = useState(false);

  const updateItem = (index: number, patch: Partial<ResumeEducation>) => {
    const list = [...items];
    list[index] = { ...list[index], ...patch };
    setItems(list);
  };

  const removeItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const addItem = () => {
    setItems([
      ...items,
      {
        institution: '',
        degree: '',
        field_of_study: '',
        location: '',
        start_date: '',
        end_date: '',
        highlights: [],
      },
    ]);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave({ ...data, education: items });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className='flex max-h-[88vh] min-h-[460px] flex-col'>
      <ModalHeader
        title='Education'
        description='Manage degree details, field of study, institutions, and achievements.'
        icon={GraduationCap}
        onClose={onClose}
      />
      <div className='body'>
        {items.map((item, index) => (
          <div
            key={`edu-${index}`}
            className='rounded-xl border border-border bg-panel p-4 md:p-5 space-y-4'
          >
            <div className='flex items-center justify-between gap-3 border-b border-border/40 pb-3'>
              <h3 className='font-semibold text-ink-primary'>
                {item.degree || item.institution ?
                  `${item.degree || 'Education'} - ${item.institution || 'School'}`
                : `Education #${index + 1}`}
              </h3>
              <Button
                type='button'
                size='sm'
                variant='ghost'
                className='text-red-500 hover:bg-red-500/10 hover:text-red-600'
                Icon={Trash2}
                onClick={() => removeItem(index)}
              >
                Delete Entry
              </Button>
            </div>

            <div className='grid gap-3 md:grid-cols-2'>
              <div>
                <label className='body-sm mb-1 block text-ink-secondary'>
                  Degree
                </label>
                <Input
                  value={asValue(item.degree)}
                  placeholder='e.g. Bachelor of Science'
                  onChange={(e) =>
                    updateItem(index, { degree: e.target.value || null })
                  }
                />
              </div>
              <div>
                <label className='body-sm mb-1 block text-ink-secondary'>
                  Field of Study
                </label>
                <Input
                  value={asValue(item.field_of_study)}
                  placeholder='e.g. Computer Science'
                  onChange={(e) =>
                    updateItem(index, {
                      field_of_study: e.target.value || null,
                    })
                  }
                />
              </div>
              <div className='md:col-span-2'>
                <label className='body-sm mb-1 block text-ink-secondary'>
                  Institution / University
                </label>
                <Input
                  value={asValue(item.institution)}
                  placeholder='University name'
                  onChange={(e) =>
                    updateItem(index, { institution: e.target.value || null })
                  }
                />
              </div>
              <div>
                <label className='body-sm mb-1 block text-ink-secondary'>
                  Location
                </label>
                <Input
                  value={asValue(item.location)}
                  placeholder='City, Country'
                  onChange={(e) =>
                    updateItem(index, { location: e.target.value || null })
                  }
                />
              </div>
              <div className='grid grid-cols-2 gap-2'>
                <div>
                  <label className='body-sm mb-1 block text-ink-secondary'>
                    Start Date
                  </label>
                  <Input
                    value={asValue(item.start_date)}
                    placeholder='e.g. Sep 2018'
                    onChange={(e) =>
                      updateItem(index, { start_date: e.target.value || null })
                    }
                  />
                </div>
                <div>
                  <label className='body-sm mb-1 block text-ink-secondary'>
                    End Date
                  </label>
                  <Input
                    value={asValue(item.end_date)}
                    placeholder='e.g. May 2022'
                    onChange={(e) =>
                      updateItem(index, { end_date: e.target.value || null })
                    }
                  />
                </div>
              </div>
            </div>

            <div>
              <label className='body-sm mb-1 block font-medium text-ink-primary'>
                Highlights / Honors (Drag to reorder)
              </label>
              <BulletListInput
                values={item.highlights ?? []}
                placeholder='Add an education highlight or honor...'
                onChange={(highlights) => updateItem(index, { highlights })}
              />
            </div>
          </div>
        ))}

        <Button
          type='button'
          variant='secondary'
          className='w-full'
          Icon={Plus}
          onClick={addItem}
        >
          Add Education Entry
        </Button>
      </div>
      <ModalFooter onClose={onClose} onSave={handleSave} saving={saving} />
    </div>
  );
}

/* ========================================================================== */
/* Certifications Editor                                                      */
/* ========================================================================== */
export function CertificationsEditor({
  data,
  onSave,
  onClose,
}: {
  data: MasterResumeData;
  onSave: (next: MasterResumeData) => Promise<void>;
  onClose: () => void;
}) {
  const [groups, setGroups] = useState<ResumeCertificationGroup[]>(
    Array.isArray(data.certifications) ? data.certifications : [],
  );
  const [saving, setSaving] = useState(false);

  const updateGroup = (
    index: number,
    patch: Partial<ResumeCertificationGroup>,
  ) => {
    const list = [...groups];
    list[index] = { ...list[index], ...patch };
    setGroups(list);
  };

  const removeGroup = (index: number) => {
    setGroups(groups.filter((_, i) => i !== index));
  };

  const addGroup = () => {
    setGroups([
      ...groups,
      { type: 'Professional Certifications', certifications: [] },
    ]);
  };

  const addCert = (groupIndex: number) => {
    const list = [...groups];
    const certs = [...(list[groupIndex].certifications ?? [])];
    certs.push({
      name: '',
      issuer: '',
      issue_date: '',
      expiry_date: '',
      credential_url: '',
    });
    list[groupIndex] = { ...list[groupIndex], certifications: certs };
    setGroups(list);
  };

  const updateCert = (
    groupIndex: number,
    certIndex: number,
    patch: Partial<ResumeCertification>,
  ) => {
    const list = [...groups];
    const certs = [...(list[groupIndex].certifications ?? [])];
    certs[certIndex] = { ...certs[certIndex], ...patch };
    list[groupIndex] = { ...list[groupIndex], certifications: certs };
    setGroups(list);
  };

  const removeCert = (groupIndex: number, certIndex: number) => {
    const list = [...groups];
    const certs = (list[groupIndex].certifications ?? []).filter(
      (_, i) => i !== certIndex,
    );
    list[groupIndex] = { ...list[groupIndex], certifications: certs };
    setGroups(list);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave({ ...data, certifications: groups });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className='flex max-h-[88vh] min-h-[460px] flex-col'>
      <ModalHeader
        title='Certifications'
        description='Manage professional certificates and credentials.'
        icon={Award}
        onClose={onClose}
      />
      <div className='body'>
        {groups.map((group, groupIndex) => (
          <div
            key={`cert-group-${groupIndex}`}
            className='rounded-xl border border-border bg-panel p-4 md:p-5 space-y-4'
          >
            <div className='flex items-center justify-between gap-3'>
              <div className='flex-1 max-w-sm'>
                <label className='body-sm mb-1 block text-ink-secondary'>
                  Category
                </label>
                <Input
                  value={asValue(group.type)}
                  placeholder='e.g. Cloud & DevOps'
                  onChange={(e) =>
                    updateGroup(groupIndex, { type: e.target.value || 'Other' })
                  }
                />
              </div>
              <Button
                type='button'
                size='sm'
                variant='ghost'
                className='text-red-500 hover:bg-red-500/10 hover:text-red-600 self-end'
                Icon={Trash2}
                onClick={() => removeGroup(groupIndex)}
              >
                Remove Group
              </Button>
            </div>

            <div className='space-y-3 pt-2'>
              {(group.certifications ?? []).map((cert, certIndex) => (
                <div
                  key={`cert-${groupIndex}-${certIndex}`}
                  className='rounded-md border border-border/80 bg-background-secondary p-3 space-y-3'
                >
                  <div className='flex items-center justify-between gap-2'>
                    <span className='body-sm font-medium text-ink-primary'>
                      Certification #{certIndex + 1}
                    </span>
                    <button
                      type='button'
                      onClick={() => removeCert(groupIndex, certIndex)}
                      className='text-ink-secondary hover:text-red-500'
                      title='Remove certification'
                    >
                      <Trash2 className='size-3.5' />
                    </button>
                  </div>
                  <div className='grid gap-3 md:grid-cols-2'>
                    <Input
                      value={asValue(cert.name)}
                      placeholder='Certification Name'
                      onChange={(e) =>
                        updateCert(groupIndex, certIndex, {
                          name: e.target.value || null,
                        })
                      }
                    />
                    <Input
                      value={asValue(cert.issuer)}
                      placeholder='Issuer (e.g. AWS, Google)'
                      onChange={(e) =>
                        updateCert(groupIndex, certIndex, {
                          issuer: e.target.value || null,
                        })
                      }
                    />
                    <Input
                      value={asValue(cert.issue_date)}
                      placeholder='Issue Date'
                      onChange={(e) =>
                        updateCert(groupIndex, certIndex, {
                          issue_date: e.target.value || null,
                        })
                      }
                    />
                    <Input
                      value={asValue(cert.expiry_date)}
                      placeholder='Expiry Date'
                      onChange={(e) =>
                        updateCert(groupIndex, certIndex, {
                          expiry_date: e.target.value || null,
                        })
                      }
                    />
                    <Input
                      className='md:col-span-2'
                      value={asValue(cert.credential_url)}
                      placeholder='Credential URL'
                      onChange={(e) =>
                        updateCert(groupIndex, certIndex, {
                          credential_url: e.target.value || null,
                        })
                      }
                    />
                  </div>
                </div>
              ))}

              <Button
                type='button'
                size='sm'
                variant='secondary'
                Icon={Plus}
                onClick={() => addCert(groupIndex)}
              >
                Add Certification
              </Button>
            </div>
          </div>
        ))}

        <Button
          type='button'
          variant='secondary'
          className='w-full'
          Icon={Plus}
          onClick={addGroup}
        >
          Add Certification Group
        </Button>
      </div>
      <ModalFooter onClose={onClose} onSave={handleSave} saving={saving} />
    </div>
  );
}

/* ========================================================================== */
/* Links Editor                                                               */
/* ========================================================================== */
export function LinksEditor({
  data,
  onSave,
  onClose,
}: {
  data: MasterResumeData;
  onSave: (next: MasterResumeData) => Promise<void>;
  onClose: () => void;
}) {
  const [items, setItems] = useState<ResumeLink[]>(
    Array.isArray(data.links) ? data.links : [],
  );
  const [saving, setSaving] = useState(false);

  const updateItem = (index: number, patch: Partial<ResumeLink>) => {
    const list = [...items];
    list[index] = { ...list[index], ...patch };
    setItems(list);
  };

  const removeItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const addItem = () => {
    setItems([...items, { type: '', link: '' }]);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave({ ...data, links: items });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className='flex max-h-[88vh] min-h-[400px] flex-col'>
      <ModalHeader
        title='Links'
        description='Add online portfolio, GitHub, blog, or personal website links.'
        icon={LinkIcon}
        onClose={onClose}
      />
      <div className='body space-y-4'>
        {items.map((item, index) => (
          <div
            key={`link-${index}`}
            className='flex items-center gap-3 rounded-lg border border-border bg-panel p-3'
          >
            <div className='w-1/3'>
              <Input
                value={asValue(item.type)}
                placeholder='Type (e.g. GitHub)'
                onChange={(e) =>
                  updateItem(index, { type: e.target.value || null })
                }
              />
            </div>
            <div className='flex-1'>
              <Input
                value={asValue(item.link)}
                placeholder='https://...'
                onChange={(e) =>
                  updateItem(index, { link: e.target.value || null })
                }
              />
            </div>
            <button
              type='button'
              onClick={() => removeItem(index)}
              className='text-ink-secondary hover:text-red-500 p-1'
              title='Remove link'
            >
              <Trash2 className='size-4' />
            </button>
          </div>
        ))}

        <Button
          type='button'
          variant='secondary'
          className='w-full'
          Icon={Plus}
          onClick={addItem}
        >
          Add Link
        </Button>
      </div>
      <ModalFooter onClose={onClose} onSave={handleSave} saving={saving} />
    </div>
  );
}

/* ========================================================================== */
/* Other Section Editor                                                       */
/* ========================================================================== */
export function OtherEditor({
  data,
  onSave,
  onClose,
}: {
  data: MasterResumeData;
  onSave: (next: MasterResumeData) => Promise<void>;
  onClose: () => void;
}) {
  const [items, setItems] = useState<ResumeOtherItem[]>(
    Array.isArray(data.other) ? data.other : [],
  );
  const [saving, setSaving] = useState(false);

  const updateItem = (index: number, patch: Partial<ResumeOtherItem>) => {
    const list = [...items];
    list[index] = { ...list[index], ...patch };
    setItems(list);
  };

  const removeItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const addItem = () => {
    setItems([
      ...items,
      {
        type: 'Volunteering',
        title: '',
        organization: '',
        location: '',
        date: '',
        description: [],
      },
    ]);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave({ ...data, other: items });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className='flex max-h-[88vh] min-h-[460px] flex-col'>
      <ModalHeader
        title='Additional Information'
        description='Manage volunteering, publications, awards, or extra activities.'
        icon={Layers}
        onClose={onClose}
      />
      <div className='body'>
        {items.map((item, index) => (
          <div
            key={`other-${index}`}
            className='rounded-xl border border-border bg-panel p-4 md:p-5 space-y-4'
          >
            <div className='flex items-center justify-between gap-3 border-b border-border/40 pb-3'>
              <h3 className='font-semibold text-ink-primary'>
                {item.title || item.type || `Entry #${index + 1}`}
              </h3>
              <Button
                type='button'
                size='sm'
                variant='ghost'
                className='text-red-500 hover:bg-red-500/10 hover:text-red-600'
                Icon={Trash2}
                onClick={() => removeItem(index)}
              >
                Delete Entry
              </Button>
            </div>

            <div className='grid gap-3 md:grid-cols-2'>
              <div>
                <label className='body-sm mb-1 block text-ink-secondary'>
                  Category Type
                </label>
                <Input
                  value={asValue(item.type)}
                  placeholder='e.g. Volunteer, Publication'
                  onChange={(e) =>
                    updateItem(index, { type: e.target.value || null })
                  }
                />
              </div>
              <div>
                <label className='body-sm mb-1 block text-ink-secondary'>
                  Role / Title
                </label>
                <Input
                  value={asValue(item.title)}
                  placeholder='Role or activity title'
                  onChange={(e) =>
                    updateItem(index, { title: e.target.value || null })
                  }
                />
              </div>
              <div>
                <label className='body-sm mb-1 block text-ink-secondary'>
                  Organization
                </label>
                <Input
                  value={asValue(item.organization)}
                  placeholder='Organization name'
                  onChange={(e) =>
                    updateItem(index, { organization: e.target.value || null })
                  }
                />
              </div>
              <div>
                <label className='body-sm mb-1 block text-ink-secondary'>
                  Date / Duration
                </label>
                <Input
                  value={asValue(item.date)}
                  placeholder='e.g. 2023'
                  onChange={(e) =>
                    updateItem(index, { date: e.target.value || null })
                  }
                />
              </div>
            </div>

            <div>
              <label className='body-sm mb-1 block font-medium text-ink-primary'>
                Details (Drag to reorder)
              </label>
              <BulletListInput
                values={item.description ?? []}
                placeholder='Add a detail point...'
                onChange={(desc) => updateItem(index, { description: desc })}
              />
            </div>
          </div>
        ))}

        <Button
          type='button'
          variant='secondary'
          className='w-full'
          Icon={Plus}
          onClick={addItem}
        >
          Add Entry
        </Button>
      </div>
      <ModalFooter onClose={onClose} onSave={handleSave} saving={saving} />
    </div>
  );
}
