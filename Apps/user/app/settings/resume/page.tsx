/** @format */

'use client';
import {
  ChangeEvent,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  CheckCircle2,
  ExternalLink,
  FileText,
  FileUp,
  FileSearch,
  Loader2,
  Pencil,
  User,
  Plus,
  Save,
  Trash2,
  UploadCloud,
  Phone,
  MapPin,
  Mail,
  Briefcase,
  X,
} from 'lucide-react';
import { api } from '@/lib/api';
import { showGlobalToast } from '@/lib/toast';
import type {
  MasterResume,
  MasterResumeData,
  ResumeAsset,
  ResumeCertification,
  ResumeCertificationGroup,
  ResumeLink,
  ResumeLocation,
  ResumeOtherItem,
  ResumeSkillGroup,
  ResumeSource,
} from '@/lib/types';
import { useConsole } from '@/components/ConsoleContext';
import { Button } from '@/components/UI/Button';
import { Input } from '@/components/UI/input';
import { TagInput } from '@/components/UI/tag-input';
import { useGlobalModalStore } from '@/lib/store/global-modal-store';

type ResumeBasics = NonNullable<MasterResumeData['basics']>;
type ResumeExperience = NonNullable<MasterResumeData['experience']>[number];
type ResumeEducation = NonNullable<MasterResumeData['education']>[number];
type ResumeProject = NonNullable<MasterResumeData['projects']>[number];
type ResumeOther = ResumeOtherItem;

function asValue(value: string | null | undefined) {
  return value ?? '';
}

function splitList(value: string) {
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function joinList(value: string[]) {
  return value.join(', ');
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
          className='rounded-md border border-border bg-background-secondary px-2 py-1 text-xs text-ink-secondary'
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
}: {
  title: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <section className='border border-border bg-panel card'>
      <div className='flex items-center justify-between gap-3'>
        <h2 className='title-sub text-ink-primary'>{title}</h2>
        {action}
      </div>
      <div className='mt-4'>{children}</div>
    </section>
  );
}

function ResumeSourceDebugger({
  onRunAiParse,
  onRunAiRaw,
  parsing,
}: {
  onRunAiParse: (file: File) => Promise<void>;
  onRunAiRaw: (file: File) => Promise<Record<string, unknown>>;
  parsing: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [source, setSource] = useState<ResumeSource | null>(null);
  const [extracting, setExtracting] = useState(false);
  const [error, setError] = useState('');
  const [rawJson, setRawJson] = useState<Record<string, unknown> | null>(null);
  const [rawError, setRawError] = useState('');
  const [rawLoading, setRawLoading] = useState(false);

  if (process.env.NODE_ENV === 'production') return null;

  const inspect = async (nextFile?: File) => {
    if (!nextFile) return;
    if (
      nextFile.type !== 'application/pdf' &&
      !nextFile.name.toLowerCase().endsWith('.pdf')
    ) {
      setError('Upload a PDF resume.');
      return;
    }
    setFile(nextFile);
    setSource(null);
    setRawJson(null);
    setError('');
    setRawError('');
    setExtracting(true);
    try {
      setSource(await api.extractResumeSource(nextFile));
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Could not extract PDF text.',
      );
    } finally {
      setExtracting(false);
    }
  };

  const inspectRaw = async () => {
    if (!file) return;
    setRawError('');
    setRawJson(null);
    setRawLoading(true);
    try {
      setRawJson(await onRunAiRaw(file));
    } catch (err) {
      setRawError(
        err instanceof Error ? err.message : 'Could not test AI output.',
      );
    } finally {
      setRawLoading(false);
    }
  };

  return (
    <section className='mt-6 max-w-4xl border border-dashed border-amber-500/50 bg-amber-500/5 p-5'>
      <div className='flex flex-wrap items-start justify-between gap-4'>
        <div>
          <div className='flex items-center gap-2 text-amber-700 dark:text-amber-300'>
            <FileSearch className='size-4' />
            <h2 className='label'>Development: PDF source check</h2>
          </div>
          <p className='body-sm mt-2 max-w-2xl text-ink-secondary'>
            Extract the PDF text, then test the raw AI JSON without saving
            anything.
          </p>
        </div>
        <Button
          variant='secondary'
          size='md'
          Icon={FileSearch}
          isLoading={extracting}
          onClick={() => inputRef.current?.click()}
        >
          Test source extraction
        </Button>
      </div>
      <input
        ref={inputRef}
        className='hidden'
        type='file'
        accept='application/pdf,.pdf'
        onChange={(event: ChangeEvent<HTMLInputElement>) =>
          void inspect(event.target.files?.[0])
        }
      />
      {error && (
        <p className='body-sm mt-4 rounded-md bg-red-500/10 p-3 text-red-600'>
          {error}
        </p>
      )}
      {source && (
        <div className='mt-5'>
          <div className='flex flex-wrap items-center justify-between gap-3'>
            <p className='body-sm text-ink-secondary'>
              {source.original_filename} · {source.page_count} pages ·{' '}
              {source.character_count.toLocaleString()} characters
            </p>
            {file && (
              <div className='flex flex-wrap gap-2'>
                <Button
                  size='md'
                  Icon={FileUp}
                  isLoading={rawLoading}
                  onClick={() => void inspectRaw()}
                >
                  Test AI raw JSON
                </Button>
                <Button
                  variant='secondary'
                  size='md'
                  Icon={FileUp}
                  isLoading={parsing}
                  onClick={() => void onRunAiParse(file)}
                >
                  Run AI parser
                </Button>
              </div>
            )}
          </div>
          <textarea
            readOnly
            value={source.text}
            className='textarea mt-3 min-h-72 w-full resize-y font-mono text-xs leading-5'
            aria-label='Extracted resume source text'
          />
          {rawError && (
            <p className='body-sm mt-4 rounded-md bg-red-500/10 p-3 text-red-600'>
              {rawError}
            </p>
          )}
          {rawJson && (
            <div className='mt-4 border border-border bg-background-secondary p-4'>
              <p className='label text-ink-primary'>AI raw JSON</p>
              <p className='body-sm mt-1 text-ink-secondary'>
                Direct model output before any server-side cleanup.
              </p>
              <textarea
                readOnly
                value={JSON.stringify(rawJson, null, 2)}
                className='textarea mt-3 min-h-72 w-full resize-y font-mono text-xs leading-5'
                aria-label='AI raw JSON output'
              />
            </div>
          )}
        </div>
      )}
    </section>
  );
}

function ActiveResumeModal({
  currentUrl,
  onClose,
  onSelected,
  onUpload,
}: {
  currentUrl: string;
  onClose: () => void;
  onSelected: (resume: MasterResume) => Promise<void>;
  onUpload: () => void;
}) {
  const [assets, setAssets] = useState<ResumeAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectingId, setSelectingId] = useState('');
  const [deletingId, setDeletingId] = useState('');

  const loadAssets = async () => {
    setAssets(await api.resumeAssets());
  };

  useEffect(() => {
    void loadAssets()
      .catch((error) =>
        showGlobalToast(
          error instanceof Error ? error.message : 'Could not load resumes.',
        ),
      )
      .finally(() => setLoading(false));
  }, []);

  const selectAsset = async (asset: ResumeAsset) => {
    const isCurrent = asset.url === currentUrl;
    if (isCurrent) {
      onClose();
      return;
    }
    setSelectingId(asset.profile_id);
    try {
      const nextResume = await api.selectResumeAsset(asset.profile_id);
      await onSelected(nextResume);
      showGlobalToast('Resume and job profile switched.');
      onClose();
    } catch (error) {
      showGlobalToast(
        error instanceof Error ? error.message : 'Could not switch profile.',
      );
    } finally {
      setSelectingId('');
    }
  };

  const deleteAsset = async (asset: ResumeAsset) => {
    if (
      !window.confirm(
        `Delete ${asset.filename}? The PDF will also be removed from storage.`,
      )
    ) {
      return;
    }
    setDeletingId(asset.profile_id);
    try {
      await api.deleteResumeAsset(asset.profile_id);
      await loadAssets();
      showGlobalToast('Resume deleted and storage released.');
    } catch (error) {
      showGlobalToast(
        error instanceof Error ? error.message : 'Could not delete the resume.',
      );
    } finally {
      setDeletingId('');
    }
  };

  return (
    <div className='flex max-h-[82vh] min-h-[420px] flex-col'>
      <header className='flex items-start justify-between gap-5 border-b border-border/60 px-6 py-5'>
        <div>
          <h2 className='title-section text-ink-primary'>Active Resume</h2>
          <p className='body-sm mt-1 max-w-xl text-ink-secondary'>
            Each resume has its own job targets and application settings.
            Switching resumes switches the complete profile used for
            applications.
          </p>
        </div>
        <button
          type='button'
          title='Close'
          aria-label='Close active resume'
          onClick={onClose}
          className='flex size-9 shrink-0 items-center justify-center rounded-md text-ink-secondary hover:bg-background-secondary hover:text-ink-primary'
        >
          <X className='size-4' />
        </button>
      </header>

      <div className='custom-scrollbar-primary flex-1 overflow-y-auto px-6 py-5'>
        {loading ?
          <p className='body-sm text-ink-secondary'>Loading resumes...</p>
        : assets.length ?
          <div className='space-y-3'>
            {assets.map((asset) => {
              const isCurrent = asset.url === currentUrl;
              return (
                <article
                  key={asset.profile_id}
                  className={`border p-4 ${isCurrent ? 'border-primary bg-primary/5' : 'border-border bg-panel'}`}
                >
                  <div className='flex flex-wrap items-start justify-between gap-3'>
                    <div className='min-w-0'>
                      <div className='flex items-center gap-2'>
                        <FileText className='size-4 shrink-0 text-primary' />
                        <h3 className='truncate label text-ink-primary'>
                          {asset.filename}
                        </h3>
                      </div>
                      <p className='body-sm mt-1 text-ink-secondary'>
                        Updated{' '}
                        {new Date(asset.updated_at).toLocaleDateString()}
                      </p>
                    </div>
                    {isCurrent && (
                      <span className='rounded-md bg-emerald-500/10 px-2 py-1 text-xs font-semibold text-emerald-600'>
                        Active profile
                      </span>
                    )}
                  </div>
                  <div className='mt-4 flex flex-wrap gap-2'>
                    <Button
                      size='sm'
                      Icon={CheckCircle2}
                      variant={isCurrent ? 'secondary' : 'default'}
                      isLoading={selectingId === asset.profile_id}
                      disabled={isCurrent}
                      onClick={() => void selectAsset(asset)}
                    >
                      {isCurrent ? 'Current profile' : 'Switch profile'}
                    </Button>
                    <a href={asset.url} target='_blank' rel='noreferrer'>
                      <Button size='sm' variant='secondary' Icon={ExternalLink}>
                        View PDF
                      </Button>
                    </a>
                    {!isCurrent && (
                      <Button
                        size='sm'
                        variant='secondary'
                        Icon={Trash2}
                        isLoading={deletingId === asset.profile_id}
                        onClick={() => void deleteAsset(asset)}
                      >
                        Delete
                      </Button>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        : <p className='body-sm text-ink-secondary'>
            No saved resume versions.
          </p>
        }
      </div>

      <footer className='footer'>
        <Button variant='secondary' onClick={onClose}>
          Close
        </Button>
        <Button Icon={UploadCloud} onClick={onUpload}>
          Upload new resume
        </Button>
      </footer>
    </div>
  );
}

export default function ResumePage() {
  const inputRef = useRef<HTMLInputElement>(null);
  const { setProfile, setJobHuntingProfile, loadData } = useConsole();
  const openModal = useGlobalModalStore((state) => state.actions.openModal);
  const closeModal = useGlobalModalStore((state) => state.actions.closeModal);
  const [resume, setResume] = useState<MasterResume | null>(null);
  const [data, setData] = useState<MasterResumeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState('');

  const openActiveResume = () => {
    if (!resume) return;
    openModal({
      layoutId: 'active-resume',
      className: 'w-[94vw] max-w-2xl max-h-[86vh] rounded-lg',
      content: (
        <ActiveResumeModal
          currentUrl={resume.original_url}
          onClose={closeModal}
          onUpload={() => {
            closeModal();
            inputRef.current?.click();
          }}
          onSelected={async (nextResume) => {
            setResume(nextResume);
            setData(nextResume.resume_data);
            setEditing(false);
            const nextProfile = await api.jobHuntingProfile();
            setJobHuntingProfile(nextProfile);
            loadData();
          }}
        />
      ),
      onClose: closeModal,
    });
  };
  useEffect(() => {
    void (async () => {
      try {
        const nextResume = await api.masterResume();
        setResume(nextResume);
        setData(nextResume.resume_data);
      } catch (err) {
        if (
          !(err instanceof Error) ||
          (!err.message.includes('No master resume') &&
            !err.message.includes('Not Found'))
        ) {
          setError(
            err instanceof Error ?
              err.message
            : 'Could not load your master resume.',
          );
        }
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (resume?.status !== 'processing') return;

    const onResumeProcessed = async (event: Event) => {
      const detail = (
        event as CustomEvent<{
          resume_id?: string;
          status?: string;
          detail?: string;
        }>
      ).detail;
      if (detail?.resume_id !== resume.id) return;
      if (detail.status === 'failed') {
        setResume((current) =>
          current ? { ...current, status: 'failed' } : current,
        );
        showGlobalToast(
          detail.detail || 'AI resume analysis could not be completed.',
        );
        return;
      }
      if (detail.status !== 'review') return;
      try {
        const [nextResume, nextJobProfile] = await Promise.all([
          api.masterResume(),
          api.jobHuntingProfile(),
        ]);
        setResume(nextResume);
        setData(nextResume.resume_data);
        setJobHuntingProfile(nextJobProfile);
        loadData();
        setEditing(true);
        showGlobalToast(
          'Resume analysis complete. Review the details before confirming.',
        );
      } catch (err) {
        showGlobalToast(
          err instanceof Error ?
            err.message
          : 'Could not load the analysed resume.',
        );
      }
    };

    window.addEventListener('jobby:master-resume-event', onResumeProcessed);
    return () =>
      window.removeEventListener(
        'jobby:master-resume-event',
        onResumeProcessed,
      );
  }, [resume?.id, resume?.status, setJobHuntingProfile]);

  const updateBasics = (field: keyof ResumeBasics, value: string) => {
    if (!data) return;
    setData({
      ...data,
      basics: { ...(data.basics ?? {}), [field]: value || null },
    });
  };

  const updateLocation = (
    field: keyof NonNullable<ResumeBasics['location']>,
    value: string,
  ) => {
    if (!data) return;
    const current = (data.basics?.location ?? {}) as Partial<ResumeLocation>;
    setData({
      ...data,
      basics: {
        ...(data.basics ?? {}),
        location: { ...current, [field]: value || null } as ResumeLocation,
      },
    });
  };

  const updateArray = <T,>(items: T[] | undefined, index: number, next: T) => {
    const list = [...(items ?? [])];
    list[index] = next;
    return list;
  };

  const upload = async (file?: File) => {
    if (!file) return;
    if (
      file.type !== 'application/pdf' &&
      !file.name.toLowerCase().endsWith('.pdf')
    ) {
      setError('Upload a PDF resume.');
      return;
    }
    setUploading(true);
    setError('');
    try {
      const nextResume = await api.uploadMasterResume(file);
      setResume(nextResume);
      setData(null);
      setEditing(false);
      showGlobalToast('Resume uploaded. AI is analysing your resume...');
    } catch (err) {
      showGlobalToast(
        err instanceof Error ? err.message : 'Could not upload the resume.',
      );
    } finally {
      setUploading(false);
    }
  };

  const runRawAi = async (file?: File) => {
    if (!file) throw new Error('Upload a PDF resume.');
    if (
      file.type !== 'application/pdf' &&
      !file.name.toLowerCase().endsWith('.pdf')
    ) {
      throw new Error('Upload a PDF resume.');
    }
    return api.debugResumeAi(file);
  };

  const save = async (confirm = false) => {
    if (!data) return;
    setSaving(true);
    setError('');
    try {
      const nextResume =
        confirm ?
          await api.confirmMasterResume(data)
        : await api.updateMasterResume(data);
      setResume(nextResume);
      setData(nextResume.resume_data);
      setEditing(false);
      const nextJobProfile = await api.jobHuntingProfile();
      setJobHuntingProfile(nextJobProfile);
      loadData();
      if (confirm) {
        const nextProfile = await api.profile();
        setProfile(nextProfile);
        showGlobalToast(
          'Master resume confirmed and profile details pre-filled.',
        );
      } else {
        showGlobalToast('Resume changes saved.');
      }
    } catch (err) {
      showGlobalToast(
        err instanceof Error ? err.message : 'Could not save the resume.',
      );
    } finally {
      setSaving(false);
    }
  };

  const updateExperience = (
    index: number,
    field: keyof ResumeExperience,
    value: string,
  ) => {
    if (!data) return;
    const experience = updateArray(data.experience, index, {
      ...(data.experience?.[index] ?? { description: [], technologies: [] }),
      [field]:
        field === 'description' || field === 'technologies' ?
          value
        : value || null,
    } as ResumeExperience);
    if (field === 'description') {
      experience[index].description = value
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean);
    }
    if (field === 'technologies') {
      experience[index].technologies = splitList(value);
    }
    setData({ ...data, experience });
  };

  const updateEducation = (
    index: number,
    field: keyof ResumeEducation,
    value: string,
  ) => {
    if (!data) return;
    const education = updateArray(data.education, index, {
      ...(data.education?.[index] ?? { highlights: [] }),
      [field]: field === 'highlights' ? value : value || null,
    } as ResumeEducation);
    if (field === 'highlights') {
      education[index].highlights = value
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean);
    }
    setData({ ...data, education });
  };

  const updateProject = (
    index: number,
    field: keyof ResumeProject,
    value: string,
  ) => {
    if (!data) return;
    const projects = updateArray(data.projects, index, {
      ...(data.projects?.[index] ?? { description: [], technologies: [] }),
      [field]:
        field === 'description' || field === 'technologies' ?
          value
        : value || null,
    } as ResumeProject);
    if (field === 'description') {
      projects[index].description = value
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean);
    }
    if (field === 'technologies') {
      projects[index].technologies = splitList(value);
    }
    setData({ ...data, projects });
  };

  const updateOther = (
    index: number,
    field: keyof ResumeOther,
    value: string,
  ) => {
    if (!data) return;
    const other = updateArray(data.other, index, {
      ...(data.other?.[index] ?? { description: [] }),
      [field]: field === 'description' ? value : value || null,
    } as ResumeOther);
    if (field === 'description') {
      other[index].description = value
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean);
    }
    setData({ ...data, other });
  };

  const updateLinks = (
    index: number,
    field: keyof ResumeLink,
    value: string,
  ) => {
    if (!data) return;
    const links = updateArray(data.links, index, {
      ...(data.links?.[index] ?? {}),
      [field]: value || null,
    } as ResumeLink);
    setData({ ...data, links });
  };

  const updateSkillGroup = (
    index: number,
    field: keyof ResumeSkillGroup,
    value: string,
  ) => {
    if (!data) return;
    const skills = updateArray(data.skills, index, {
      ...(data.skills?.[index] ?? { skills: [] }),
      [field]: field === 'skills' ? value : value || null,
    } as ResumeSkillGroup);
    if (field === 'skills') {
      skills[index].skills = splitList(value);
    }
    setData({ ...data, skills });
  };

  const updateSkillGroupValues = (index: number, values: string[]) => {
    if (!data) return;
    const skills = updateArray(data.skills, index, {
      ...(data.skills?.[index] ?? { skills: [] }),
      skills: values,
    } as ResumeSkillGroup);
    setData({ ...data, skills });
  };

  const updateCertificationGroup = (
    index: number,
    field: keyof ResumeCertificationGroup,
    value: string,
  ) => {
    if (!data) return;
    const certifications = updateArray(data.certifications, index, {
      ...(data.certifications?.[index] ?? { certifications: [] }),
      [field]: value || null,
    } as ResumeCertificationGroup);
    setData({ ...data, certifications });
  };

  const updateCertification = (
    groupIndex: number,
    certIndex: number,
    field: keyof ResumeCertification,
    value: string,
  ) => {
    if (!data) return;
    const groups = [...(data.certifications ?? [])];
    const group = { ...(groups[groupIndex] ?? { certifications: [] }) };
    const certs = [...(group.certifications ?? [])];
    certs[certIndex] = {
      ...(certs[certIndex] ?? {}),
      [field]: value || null,
    } as ResumeCertification;
    group.certifications = certs;
    groups[groupIndex] = group;
    setData({ ...data, certifications: groups });
  };

  const addItem = (
    key:
      | 'links'
      | 'skills'
      | 'certifications'
      | 'experience'
      | 'education'
      | 'projects'
      | 'other',
  ) => {
    if (!data) return;
    if (key === 'links')
      setData({
        ...data,
        links: [...(data.links ?? []), { type: null, link: null }],
      });
    if (key === 'skills')
      setData({
        ...data,
        skills: [...(data.skills ?? []), { type: 'Other', skills: [] }],
      });
    if (key === 'certifications')
      setData({
        ...data,
        certifications: [
          ...(data.certifications ?? []),
          { type: 'Other', certifications: [] },
        ],
      });
    if (key === 'experience')
      setData({
        ...data,
        experience: [
          ...(data.experience ?? []),
          { description: [], technologies: [] },
        ],
      });
    if (key === 'education')
      setData({
        ...data,
        education: [...(data.education ?? []), { highlights: [] }],
      });
    if (key === 'projects')
      setData({
        ...data,
        projects: [
          ...(data.projects ?? []),
          { description: [], technologies: [] },
        ],
      });
    if (key === 'other')
      setData({
        ...data,
        other: [...(data.other ?? []), { type: 'Other', description: [] }],
      });
  };

  const removeItem = (
    key:
      | 'links'
      | 'skills'
      | 'certifications'
      | 'experience'
      | 'education'
      | 'projects'
      | 'other',
    index: number,
  ) => {
    if (!data) return;
    const next = { ...data };
    next[key] = (next[key] ?? []).filter((_, i) => i !== index) as never;
    setData(next);
  };

  if (loading) {
    return (
      <div className='flex h-full items-center justify-center text-ink-secondary'>
        <Loader2 className='mr-2 size-5 animate-spin' />
        Loading master resume
      </div>
    );
  }

  if (resume?.status === 'processing') {
    return (
      <div className='flex w-full h-full items-center justify-center'>
        <section className='col justify-center '>
          <div className='mx-auto flex size-30 items-center justify-center rounded-full bg-primary/10 text-primary'>
            <FileSearch className='size-14' />
          </div>

          <h1 className='text-2xl mt-4 text-ink-primary  animate-text-shimmer animate-text-shimmer-primary  '>
            AI is analysing your resume
          </h1>
          <p className='body-sm mx-auto  max-w-md text-ink-secondary'>
            Your PDF has been uploaded successfully. You can leave this page and
            return later to review the extracted details.
          </p>
          <div className='mx-auto mt-6 gap-6 col w-full '>
            <div className='flex items-center gap-3 body-sm text-ink-primary'>
              <CheckCircle2 className='size-4 shrink-0 text-emerald-500' />
              Upload complete
            </div>
            <div className='flex items-center gap-3 body-sm text-ink-secondary'>
              <FileSearch className='size-4 shrink-0 text-primary' />
              Extracting experience, education, skills, and projects
            </div>
          </div>
          <Button
            className='mt-7'
            // variant='secondary'
            onClick={() => {
              window.location.href = '/';
            }}
          >
            Back to dashboard
          </Button>
        </section>
      </div>
    );
  }

  if (!resume || !data) {
    return (
      <div className='flex h-full flex-col'>
        <div className='mb-6'>
          <h1 className='title-card text-ink-primary'>Resume</h1>
          <p className='body-sm mt-1 text-ink-secondary'>
            Upload one resume to create the profile used across Jobby.
          </p>
        </div>
        <section className='flex col panel-xl justify-center items-center w-full h-full'>
          <div
            onClick={() => inputRef.current?.click()}
            className='flex gap-6 col items-center cursor-pointer border-dashed w-max-xl rounded-2xl  p-12 border-2 border-ink-secondary/30'
          >
            <div className='flex size-14 items-center justify-center rounded-full bg-primary/10 text-primary'>
              <UploadCloud className='size-7' />
            </div>
            <h2 className='title-sub mt-5 text-ink-primary'>
              Upload your resume
            </h2>
            <p className='body-sm mt-2 text-ink-secondary'>
              We will extract factual details into a structured master resume
              for you to review.
            </p>
            <Button
              className='mt-6'
              Icon={FileUp}
              isLoading={uploading}
              onClick={() => inputRef.current?.click()}
            >
              Choose PDF
            </Button>
            <p className='body-sm mt-3 text-ink-secondary'>
              PDF only, up to 12 MB
            </p>
            {error && <p className='body-sm mt-4 text-red-600'>{error}</p>}
            <input
              ref={inputRef}
              className='hidden'
              type='file'
              accept='application/pdf,.pdf'
              onChange={(event: ChangeEvent<HTMLInputElement>) =>
                void upload(event.target.files?.[0])
              }
            />
          </div>
        </section>
        {/* <ResumeSourceDebugger
          onRunAiParse={upload}
          onRunAiRaw={runRawAi}
          parsing={uploading}
        /> */}
      </div>
    );
  }

  const basics = data.basics ?? {};
  const location = (basics.location ?? {}) as Partial<ResumeLocation>;
  const experienceItems = Array.isArray(data.experience) ? data.experience : [];
  const projectItems = Array.isArray(data.projects) ? data.projects : [];
  const educationItems = Array.isArray(data.education) ? data.education : [];
  const skillItems = Array.isArray(data.skills) ? data.skills : [];
  const certificationGroups =
    Array.isArray(data.certifications) ? data.certifications : [];
  const languageItems = Array.isArray(data.languages) ? data.languages : [];
  const otherItems = Array.isArray(data.other) ? data.other : [];
  const hasPersonalInfo = Boolean(
    basics.first_name ||
    basics.middle_name ||
    basics.last_name ||
    basics.email ||
    basics.phone ||
    basics.headline ||
    basics.linkedin_id ||
    location.city ||
    location.state ||
    location.country,
  );
  const otherTypes = [
    ...new Set(
      otherItems
        .map((item) => item.type?.trim())
        .filter((type): type is string => Boolean(type && type !== 'Other')),
    ),
  ];
  const otherSectionTitle =
    otherTypes.length === 1 ? otherTypes[0] : 'Additional information';
  const isConfirmed = resume.status === 'confirmed';
  return (
    <div className='flex h-full flex-col overflow-hidden'>
      <div className='mb-6 flex shrink-0 flex-wrap items-start justify-between gap-4'>
        <div>
          <div className='flex items-center gap-3'>
            <h1 className='title-card text-ink-primary'>Resume</h1>
            <span
              className={
                isConfirmed ?
                  'rounded-md bg-emerald-500/10 px-2 py-1 text-xs font-semibold text-emerald-600'
                : 'rounded-md bg-amber-500/10 px-2 py-1 text-xs font-semibold text-amber-700'
              }
            >
              {isConfirmed ? 'Confirmed' : 'Needs review'}
            </span>
          </div>
          <a
            className='body-sm mt-1 inline-flex items-center gap-1 text-primary hover:underline'
            href={resume.original_url}
            target='_blank'
            rel='noreferrer'
          >
            <FileText className='size-4' />
            {resume.original_filename}
          </a>
        </div>
        <div className='flex flex-wrap justify-end gap-2'>
          <Button
            variant='secondary'
            size='md'
            Icon={FileText}
            layoutId='active-resume'
            onClick={openActiveResume}
          >
            Active Resume
          </Button>
          <Button
            variant='secondary'
            size='md'
            Icon={UploadCloud}
            disabled={uploading}
            onClick={() => inputRef.current?.click()}
          >
            Upload new
          </Button>
          {!editing && (
            <Button size='md' Icon={Pencil} onClick={() => setEditing(true)}>
              Edit
            </Button>
          )}
          {editing && (
            <Button
              variant='secondary'
              size='md'
              Icon={Save}
              isLoading={saving}
              onClick={() => void save(false)}
            >
              Save draft
            </Button>
          )}
          {!isConfirmed && (
            <Button
              size='md'
              Icon={CheckCircle2}
              isLoading={saving}
              onClick={() => void save(true)}
            >
              Confirm resume
            </Button>
          )}
        </div>
        <input
          ref={inputRef}
          className='hidden'
          type='file'
          accept='application/pdf,.pdf'
          onChange={(event: ChangeEvent<HTMLInputElement>) =>
            void upload(event.target.files?.[0])
          }
        />
      </div>

      <div className='flex-1 overflow-y-auto pr-2 custom-scrollbar-primary'>
        {error && (
          <p className='body-sm mb-4 rounded-md bg-red-500/10 p-3 text-red-600'>
            {error}
          </p>
        )}
        {!isConfirmed && (
          <div className='mb-5 border-l-2 border-primary bg-primary/5 px-4 py-3 body-sm text-ink-secondary'>
            Review the extracted details, then confirm to pre-fill your profile
            and make this your source of truth.
          </div>
        )}
        <div className='grid gap-5 xl:grid-cols-[minmax(0,1.4fr)_minmax(260px,0.6fr)]'>
          <section className='space-y-5'>
            {(editing || hasPersonalInfo) && (
              <SectionCard title='Personal info'>
                {editing ?
                  <div className='grid gap-3 md:grid-cols-2'>
                    <Input
                      value={asValue(basics.first_name)}
                      placeholder='First name'
                      onChange={(event) =>
                        updateBasics('first_name', event.target.value)
                      }
                    />
                    <Input
                      value={asValue(basics.last_name)}
                      placeholder='Last name'
                      onChange={(event) =>
                        updateBasics('last_name', event.target.value)
                      }
                    />
                    <Input
                      value={asValue(basics.email)}
                      placeholder='Email'
                      onChange={(event) =>
                        updateBasics('email', event.target.value)
                      }
                    />
                    <Input
                      value={asValue(basics.phone)}
                      placeholder='Phone'
                      onChange={(event) =>
                        updateBasics('phone', event.target.value)
                      }
                    />
                    <Input
                      value={asValue(location.city)}
                      placeholder='City'
                      onChange={(event) =>
                        updateLocation('city', event.target.value)
                      }
                    />
                    <Input
                      value={asValue(location.country)}
                      placeholder='Country'
                      onChange={(event) =>
                        updateLocation('country', event.target.value)
                      }
                    />
                    <Input
                      className='md:col-span-2'
                      value={asValue(basics.linkedin_id)}
                      placeholder='LinkedIn ID'
                      onChange={(event) =>
                        updateBasics('linkedin_id', event.target.value)
                      }
                    />
                    <Input
                      className='md:col-span-2'
                      value={asValue(basics.headline)}
                      placeholder='Professional headline'
                      onChange={(event) =>
                        updateBasics('headline', event.target.value)
                      }
                    />
                  </div>
                : <div className='row flex-wrap gap-5 text-ink-primary'>
                    <h3 className='flex items-center gap-2 text-lg font-semibold text-ink-primary'>
                      <User className='h-5 w-5 text-primary' />
                      {[basics.first_name, basics.last_name]
                        .filter(Boolean)
                        .join(' ') || 'Name not listed'}
                    </h3>

                    {basics.headline && (
                      <p className='mt-1 flex items-center gap-2 text-ink-primary'>
                        <Briefcase className='h-4 w-4 text-primary' />
                        {basics.headline}
                      </p>
                    )}

                    {basics.email && (
                      <div className='flex items-center gap-2'>
                        <Mail className='h-4 w-4 text-primary shrink-0' />
                        <span>{basics.email}</span>
                      </div>
                    )}

                    {basics.phone && (
                      <div className='flex items-center gap-2'>
                        <Phone className='h-4 w-4 text-primary shrink-0' />
                        <span>{basics.phone}</span>
                      </div>
                    )}

                    {[location.city, location.state, location.country]
                      .filter(Boolean)
                      .join(', ') && (
                      <div className='flex items-center gap-2'>
                        <MapPin className='h-4 w-4 text-primary shrink-0' />
                        <span>
                          {[location.city, location.state, location.country]
                            .filter(Boolean)
                            .join(', ')}
                        </span>
                      </div>
                    )}

                    {basics.linkedin_id ?
                      <div className='flex items-center gap-2'>
                        <svg
                          xmlns='http://www.w3.org/2000/svg'
                          id='linkedin-bug-blue-medium'
                          width='14'
                          height='14'
                          aria-hidden='false'
                          data-supported-dps='34x34'
                          viewBox='0 0 34 34'
                          data-token-id='417'
                          role='img'
                          aria-label='LinkedIn'
                        >
                          <path
                            // fill='#0a66c2'
                            className='fill-primary stroke-primary '
                            d='M34 2.5v29a2.5 2.5 0 0 1-2.5 2.5h-29A2.5 2.5 0 0 1 0 31.5v-29A2.5 2.5 0 0 1 2.5 0h29A2.5 2.5 0 0 1 34 2.5M10 13H5v16h5zm.45-5.5a2.88 2.88 0 0 0-2.86-2.9H7.5a2.9 2.9 0 0 0 0 5.8 2.88 2.88 0 0 0 2.95-2.81zM29 19.28c0-4.81-3.06-6.68-6.1-6.68a5.7 5.7 0 0 0-5.06 2.58h-.14V13H13v16h5v-8.51a3.32 3.32 0 0 1 3-3.58h.19c1.59 0 2.77 1 2.77 3.52V29h5z'
                            display='var(--svgDisplayLight)'
                          ></path>
                          <path
                            className='fill-primary stroke-primary '
                            d='M34 2.5v29a2.5 2.5 0 0 1-2.5 2.5h-29A2.5 2.5 0 0 1 0 31.5v-29A2.5 2.5 0 0 1 2.5 0h29A2.5 2.5 0 0 1 34 2.5M10 13H5v16h5zm.45-5.5a2.88 2.88 0 0 0-2.86-2.9H7.5a2.9 2.9 0 0 0 0 5.8 2.88 2.88 0 0 0 2.95-2.81zM29 19.28c0-4.81-3.06-6.68-6.1-6.68a5.7 5.7 0 0 0-5.06 2.58h-.14V13H13v16h5v-8.51a3.32 3.32 0 0 1 3-3.58h.19c1.59 0 2.77 1 2.77 3.52V29h5z'
                            display='var(--svgDisplayDark)'
                          ></path>
                        </svg>
                        <span>{basics.linkedin_id}</span>
                      </div>
                    : <div className='flex items-center gap-2 text-ink-tertiary'>
                        <svg
                          xmlns='http://www.w3.org/2000/svg'
                          id='linkedin-bug-blue-medium'
                          width='14'
                          height='14'
                          aria-hidden='false'
                          data-supported-dps='34x34'
                          viewBox='0 0 34 34'
                          data-token-id='417'
                          role='img'
                          aria-label='LinkedIn'
                        >
                          <path
                            className='fill-primary stroke-primary '
                            d='M34 2.5v29a2.5 2.5 0 0 1-2.5 2.5h-29A2.5 2.5 0 0 1 0 31.5v-29A2.5 2.5 0 0 1 2.5 0h29A2.5 2.5 0 0 1 34 2.5M10 13H5v16h5zm.45-5.5a2.88 2.88 0 0 0-2.86-2.9H7.5a2.9 2.9 0 0 0 0 5.8 2.88 2.88 0 0 0 2.95-2.81zM29 19.28c0-4.81-3.06-6.68-6.1-6.68a5.7 5.7 0 0 0-5.06 2.58h-.14V13H13v16h5v-8.51a3.32 3.32 0 0 1 3-3.58h.19c1.59 0 2.77 1 2.77 3.52V29h5z'
                            display='var(--svgDisplayLight)'
                          ></path>
                          <path
                            className='fill-primary stroke-primary '
                            d='M34 2.5v29a2.5 2.5 0 0 1-2.5 2.5h-29A2.5 2.5 0 0 1 0 31.5v-29A2.5 2.5 0 0 1 2.5 0h29A2.5 2.5 0 0 1 34 2.5M10 13H5v16h5zm.45-5.5a2.88 2.88 0 0 0-2.86-2.9H7.5a2.9 2.9 0 0 0 0 5.8 2.88 2.88 0 0 0 2.95-2.81zM29 19.28c0-4.81-3.06-6.68-6.1-6.68a5.7 5.7 0 0 0-5.06 2.58h-.14V13H13v16h5v-8.51a3.32 3.32 0 0 1 3-3.58h.19c1.59 0 2.77 1 2.77 3.52V29h5z'
                            display='var(--svgDisplayDark)'
                          ></path>
                        </svg>
                      </div>
                    }
                  </div>
                }
              </SectionCard>
            )}

            {(editing || Boolean(data.summary)) && (
              <SectionCard title='Summary'>
                {editing ?
                  <textarea
                    className='textarea min-h-28 w-full'
                    value={asValue(data.summary)}
                    onChange={(event) =>
                      setData({ ...data, summary: event.target.value || null })
                    }
                  />
                : <p className='body-sm whitespace-pre-wrap text-ink-secondary'>
                    {data.summary || 'No summary listed.'}
                  </p>
                }
              </SectionCard>
            )}

            {(editing || experienceItems.length > 0) && (
              <SectionCard
                title='Experience'
                action={
                  editing ?
                    <Button
                      size='sm'
                      variant='secondary'
                      Icon={Plus}
                      onClick={() => addItem('experience')}
                    >
                      Add
                    </Button>
                  : null
                }
              >
                <div className='space-y-5'>
                  {experienceItems.length ?
                    experienceItems.map((item, index) => (
                      <article
                        key={`${item.company ?? 'experience'}-${index}`}
                        className=''
                      >
                        {editing ?
                          <>
                            <div className='grid gap-3 md:grid-cols-2'>
                              <Input
                                value={asValue(item.title)}
                                placeholder='Job title'
                                onChange={(event) =>
                                  updateExperience(
                                    index,
                                    'title',
                                    event.target.value,
                                  )
                                }
                              />
                              <Input
                                value={asValue(item.company)}
                                placeholder='Company'
                                onChange={(event) =>
                                  updateExperience(
                                    index,
                                    'company',
                                    event.target.value,
                                  )
                                }
                              />
                              <Input
                                value={asValue(item.location)}
                                placeholder='Location'
                                onChange={(event) =>
                                  updateExperience(
                                    index,
                                    'location',
                                    event.target.value,
                                  )
                                }
                              />
                              <Input
                                value={asValue(item.start_date)}
                                placeholder='Start date'
                                onChange={(event) =>
                                  updateExperience(
                                    index,
                                    'start_date',
                                    event.target.value,
                                  )
                                }
                              />
                              <Input
                                value={asValue(item.end_date)}
                                placeholder='End date'
                                onChange={(event) =>
                                  updateExperience(
                                    index,
                                    'end_date',
                                    event.target.value,
                                  )
                                }
                              />
                            </div>
                            <textarea
                              className='textarea mt-3 min-h-24 w-full '
                              value={(item.description ?? []).join('\n')}
                              placeholder='One achievement per line'
                              onChange={(event) =>
                                updateExperience(
                                  index,
                                  'description',
                                  event.target.value,
                                )
                              }
                            />
                            <Input
                              className='mt-3'
                              value={joinList(item.technologies ?? [])}
                              placeholder='Technologies, comma separated'
                              onChange={(event) =>
                                updateExperience(
                                  index,
                                  'technologies',
                                  event.target.value,
                                )
                              }
                            />
                          </>
                        : <div>
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
                                .join(' · ')}
                            </p>
                            {(item.technologies ?? []).length > 0 && (
                              <div className='mt-3'>
                                <TagList values={item.technologies ?? []} />
                              </div>
                            )}
                            <div className='border-l-6 border-primary/20 ml-4 pl-4'>
                              {(item.description ?? []).length > 0 && (
                                <ul className='body-sm mt-3 list-disc space-y-1 pl-4 text-ink-secondary'>
                                  {(item.description ?? []).map((line) => (
                                    <li key={line}>{line}</li>
                                  ))}
                                </ul>
                              )}
                            </div>
                          </div>
                        }
                        {editing && (
                          <div className='mt-3'>
                            <Button
                              variant='secondary'
                              size='sm'
                              Icon={Trash2}
                              onClick={() => removeItem('experience', index)}
                            >
                              Remove
                            </Button>
                          </div>
                        )}
                      </article>
                    ))
                  : <p className='body-sm text-ink-secondary'>Not listed</p>}
                </div>
              </SectionCard>
            )}

            {(editing || projectItems.length > 0) && (
              <SectionCard
                title='Projects'
                action={
                  editing ?
                    <Button
                      size='sm'
                      variant='secondary'
                      Icon={Plus}
                      onClick={() => addItem('projects')}
                    >
                      Add
                    </Button>
                  : null
                }
              >
                <div className='space-y-5'>
                  {projectItems.length ?
                    projectItems.map((item, index) => (
                      <article
                        key={`${item.name ?? 'project'}-${index}`}
                        className='border-l-2 border-primary/50 pl-4'
                      >
                        {editing ?
                          <>
                            <div className='grid gap-3 md:grid-cols-2'>
                              <Input
                                value={asValue(item.name)}
                                placeholder='Project name'
                                onChange={(event) =>
                                  updateProject(
                                    index,
                                    'name',
                                    event.target.value,
                                  )
                                }
                              />
                              <Input
                                value={asValue(item.url)}
                                placeholder='URL'
                                onChange={(event) =>
                                  updateProject(
                                    index,
                                    'url',
                                    event.target.value,
                                  )
                                }
                              />
                              <Input
                                value={asValue(item.start_date)}
                                placeholder='Start date'
                                onChange={(event) =>
                                  updateProject(
                                    index,
                                    'start_date',
                                    event.target.value,
                                  )
                                }
                              />
                              <Input
                                value={asValue(item.end_date)}
                                placeholder='End date'
                                onChange={(event) =>
                                  updateProject(
                                    index,
                                    'end_date',
                                    event.target.value,
                                  )
                                }
                              />
                            </div>
                            <textarea
                              className='textarea mt-3 min-h-24 w-full'
                              value={(item.description ?? []).join('\n')}
                              placeholder='One bullet per line'
                              onChange={(event) =>
                                updateProject(
                                  index,
                                  'description',
                                  event.target.value,
                                )
                              }
                            />
                            <Input
                              className='mt-3'
                              value={joinList(item.technologies ?? [])}
                              placeholder='Technologies, comma separated'
                              onChange={(event) =>
                                updateProject(
                                  index,
                                  'technologies',
                                  event.target.value,
                                )
                              }
                            />
                          </>
                        : <>
                            <div className='flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1'>
                              <p className='label text-ink-primary'>
                                {item.name || 'Project'}
                              </p>
                              {(item.start_date || item.end_date) && (
                                <span className='body-sm text-ink-secondary'>
                                  {dateRange(item.start_date, item.end_date)}
                                </span>
                              )}
                            </div>
                            {item.url && (
                              <a
                                href={item.url}
                                target='_blank'
                                rel='noreferrer'
                                className='body-sm mt-1 block break-all text-primary hover:underline'
                              >
                                {item.url}
                              </a>
                            )}
                            {(item.description ?? []).length > 0 && (
                              <ul className='body-sm mt-3 list-disc space-y-1.5 pl-5 text-ink-secondary'>
                                {(item.description ?? []).map(
                                  (line, lineIndex) => (
                                    <li key={`${line}-${lineIndex}`}>{line}</li>
                                  ),
                                )}
                              </ul>
                            )}
                            {(item.technologies ?? []).length > 0 && (
                              <div className='mt-3'>
                                <TagList values={item.technologies ?? []} />
                              </div>
                            )}
                          </>
                        }
                        {editing && (
                          <div className='mt-3'>
                            <Button
                              variant='secondary'
                              size='sm'
                              Icon={Trash2}
                              onClick={() => removeItem('projects', index)}
                            >
                              Remove
                            </Button>
                          </div>
                        )}
                      </article>
                    ))
                  : <p className='body-sm text-ink-secondary'>Not listed</p>}
                </div>
              </SectionCard>
            )}
            {(editing || (data.links ?? []).length > 0) && (
              <SectionCard
                title='Links'
                action={
                  editing ?
                    <Button
                      size='sm'
                      variant='secondary'
                      Icon={Plus}
                      onClick={() => addItem('links')}
                    >
                      Add
                    </Button>
                  : null
                }
              >
                <div className='space-y-3'>
                  {(data.links ?? []).length ?
                    (data.links ?? []).map((item, index) => (
                      <div
                        key={`${item.type ?? 'link'}-${index}`}
                        className='grid gap-2 md:grid-cols-[160px_minmax(0,1fr)_auto]'
                      >
                        {editing ?
                          <>
                            <Input
                              value={asValue(item.type)}
                              placeholder='Type'
                              onChange={(event) =>
                                updateLinks(index, 'type', event.target.value)
                              }
                            />
                            <Input
                              value={asValue(item.link)}
                              placeholder='Link'
                              onChange={(event) =>
                                updateLinks(index, 'link', event.target.value)
                              }
                            />
                            <Button
                              variant='secondary'
                              size='sm'
                              Icon={Trash2}
                              onClick={() => removeItem('links', index)}
                            >
                              Remove
                            </Button>
                          </>
                        : <>
                            <p className='body-sm text-ink-primary'>
                              {item.type || 'Link'}
                            </p>
                            <p className='body-sm text-ink-secondary md:col-span-2'>
                              {item.link || 'Not listed'}
                            </p>
                          </>
                        }
                      </div>
                    ))
                  : <p className='body-sm text-ink-secondary'>Not listed</p>}
                </div>
              </SectionCard>
            )}
            {(editing || otherItems.length > 0) && (
              <SectionCard
                title={otherSectionTitle}
                action={
                  editing ?
                    <Button
                      size='sm'
                      variant='secondary'
                      Icon={Plus}
                      onClick={() => addItem('other')}
                    >
                      Add
                    </Button>
                  : null
                }
              >
                <div className='space-y-4'>
                  {otherItems.length ?
                    otherItems.map((item, index) => (
                      <div
                        key={`${item.type ?? 'other'}-${item.title ?? index}`}
                        className=''
                      >
                        {editing ?
                          <>
                            <div className='grid gap-2 md:grid-cols-2'>
                              <Input
                                value={asValue(item.type)}
                                placeholder='Type'
                                onChange={(event) =>
                                  updateOther(index, 'type', event.target.value)
                                }
                              />
                              <Input
                                value={asValue(item.title)}
                                placeholder='Role or title'
                                onChange={(event) =>
                                  updateOther(
                                    index,
                                    'title',
                                    event.target.value,
                                  )
                                }
                              />
                              <Input
                                value={asValue(item.organization)}
                                placeholder='Organization'
                                onChange={(event) =>
                                  updateOther(
                                    index,
                                    'organization',
                                    event.target.value,
                                  )
                                }
                              />
                              <Input
                                value={asValue(item.location)}
                                placeholder='Location'
                                onChange={(event) =>
                                  updateOther(
                                    index,
                                    'location',
                                    event.target.value,
                                  )
                                }
                              />
                              <Input
                                value={asValue(item.date)}
                                placeholder='Date'
                                onChange={(event) =>
                                  updateOther(index, 'date', event.target.value)
                                }
                              />
                            </div>
                            <textarea
                              className='textarea mt-3 min-h-20 w-full'
                              value={(item.description ?? []).join('\n')}
                              placeholder='One detail per line'
                              onChange={(event) =>
                                updateOther(
                                  index,
                                  'description',
                                  event.target.value,
                                )
                              }
                            />
                            <div className='mt-2'>
                              <Button
                                variant='secondary'
                                size='sm'
                                Icon={Trash2}
                                onClick={() => removeItem('other', index)}
                              >
                                Remove
                              </Button>
                            </div>
                          </>
                        : <>
                            <div className='flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1'>
                              <p className='label text-ink-primary'>
                                {item.title || item.type || 'Other'}
                              </p>
                              {item.date ?
                                <span className='body-sm text-ink-secondary'>
                                  {item.date}
                                </span>
                              : null}
                            </div>
                            {(
                              [item.organization, item.location]
                                .filter(Boolean)
                                .join(' · ')
                            ) ?
                              <p className='body-sm mt-1 text-ink-secondary'>
                                {[item.organization, item.location]
                                  .filter(Boolean)
                                  .join(' · ')}
                              </p>
                            : null}
                            {(item.description ?? []).length > 0 ?
                              <ul className='body-sm mt-3 list-disc space-y-1 pl-4 text-ink-secondary'>
                                {(item.description ?? []).map((line) => (
                                  <li key={line}>{line}</li>
                                ))}
                              </ul>
                            : null}
                          </>
                        }
                      </div>
                    ))
                  : <p className='body-sm text-ink-secondary'>Not listed</p>}
                </div>
              </SectionCard>
            )}
          </section>

          <aside className='space-y-5'>
            {(editing || skillItems.length > 0) && (
              <SectionCard
                title='Skills'
                action={
                  editing ?
                    <Button
                      size='sm'
                      variant='secondary'
                      Icon={Plus}
                      onClick={() => addItem('skills')}
                    >
                      Add
                    </Button>
                  : null
                }
              >
                <div className='space-y-4'>
                  {skillItems.length ?
                    skillItems.map((group, index) => (
                      <div
                        key={`${group.type ?? 'skills'}-${index}`}
                        className=''
                      >
                        {editing ?
                          <>
                            <Input
                              value={asValue(group.type)}
                              placeholder='Type'
                              onChange={(event) =>
                                updateSkillGroup(
                                  index,
                                  'type',
                                  event.target.value,
                                )
                              }
                            />
                            <TagInput
                              className='mt-2'
                              values={group.skills ?? []}
                              onChange={(values) =>
                                updateSkillGroupValues(index, values)
                              }
                              placeholder='Add a skill'
                            />
                            <div className='mt-2'>
                              <Button
                                variant='secondary'
                                size='sm'
                                Icon={Trash2}
                                onClick={() => removeItem('skills', index)}
                              >
                                Remove
                              </Button>
                            </div>
                          </>
                        : <>
                            <p className='body-sm mb-2 capitalize text-ink-secondary'>
                              {group.type || 'Other'}
                            </p>
                            <TagList values={group.skills ?? []} />
                          </>
                        }
                      </div>
                    ))
                  : <p className='body-sm text-ink-secondary'>Not listed</p>}
                </div>
              </SectionCard>
            )}

            {(editing || certificationGroups.length > 0) && (
              <SectionCard
                title='Certifications'
                action={
                  editing ?
                    <Button
                      size='sm'
                      variant='secondary'
                      Icon={Plus}
                      onClick={() => addItem('certifications')}
                    >
                      Add
                    </Button>
                  : null
                }
              >
                <div className='space-y-4'>
                  {certificationGroups.length ?
                    certificationGroups.map((group, groupIndex) => (
                      <div
                        key={`${group.type ?? 'certs'}-${groupIndex}`}
                        className=''
                      >
                        {editing ?
                          <>
                            <Input
                              value={asValue(group.type)}
                              placeholder='Type'
                              onChange={(event) =>
                                updateCertificationGroup(
                                  groupIndex,
                                  'type',
                                  event.target.value,
                                )
                              }
                            />
                            <div className='mt-3 space-y-3'>
                              {(group.certifications ?? []).map(
                                (cert, certIndex) => (
                                  <div
                                    key={`${cert.name ?? 'cert'}-${certIndex}`}
                                    className='rounded border border-border/60 p-3'
                                  >
                                    <div className='grid gap-2 md:grid-cols-2'>
                                      <Input
                                        value={asValue(cert.name)}
                                        placeholder='Name'
                                        onChange={(event) =>
                                          updateCertification(
                                            groupIndex,
                                            certIndex,
                                            'name',
                                            event.target.value,
                                          )
                                        }
                                      />
                                      <Input
                                        value={asValue(cert.issuer)}
                                        placeholder='Issuer'
                                        onChange={(event) =>
                                          updateCertification(
                                            groupIndex,
                                            certIndex,
                                            'issuer',
                                            event.target.value,
                                          )
                                        }
                                      />
                                      <Input
                                        value={asValue(cert.issue_date)}
                                        placeholder='Issue date'
                                        onChange={(event) =>
                                          updateCertification(
                                            groupIndex,
                                            certIndex,
                                            'issue_date',
                                            event.target.value,
                                          )
                                        }
                                      />
                                      <Input
                                        value={asValue(cert.expiry_date)}
                                        placeholder='Expiry date'
                                        onChange={(event) =>
                                          updateCertification(
                                            groupIndex,
                                            certIndex,
                                            'expiry_date',
                                            event.target.value,
                                          )
                                        }
                                      />
                                      <Input
                                        className='md:col-span-2'
                                        value={asValue(cert.credential_url)}
                                        placeholder='Credential URL'
                                        onChange={(event) =>
                                          updateCertification(
                                            groupIndex,
                                            certIndex,
                                            'credential_url',
                                            event.target.value,
                                          )
                                        }
                                      />
                                    </div>
                                  </div>
                                ),
                              )}
                            </div>
                          </>
                        : <>
                            {group.type && group.type !== 'Other' ?
                              <p className='body-sm mb-2 capitalize text-ink-secondary'>
                                {group.type}
                              </p>
                            : null}
                            <div className='space-y-2'>
                              {(group.certifications ?? []).map(
                                (cert, certIndex) => (
                                  <div
                                    key={`${cert.name ?? 'cert'}-${certIndex}`}
                                    className='text-sm text-ink-secondary'
                                  >
                                    <span className='text-ink-primary'>
                                      {cert.name || 'Certification'}
                                    </span>
                                    {cert.issuer ? ` · ${cert.issuer}` : ''}
                                  </div>
                                ),
                              )}
                            </div>
                          </>
                        }
                        {editing && (
                          <div className='mt-3'>
                            <Button
                              variant='secondary'
                              size='sm'
                              Icon={Trash2}
                              onClick={() =>
                                removeItem('certifications', groupIndex)
                              }
                            >
                              Remove group
                            </Button>
                          </div>
                        )}
                      </div>
                    ))
                  : <p className='body-sm text-ink-secondary'>Not listed</p>}
                </div>
              </SectionCard>
            )}

            {(editing || educationItems.length > 0) && (
              <SectionCard title='Education'>
                <div className='space-y-4'>
                  {educationItems.length ?
                    educationItems.map((item, index) => (
                      <div
                        key={`${item.institution ?? 'education'}-${index}`}
                        className=''
                      >
                        {editing ?
                          <div className='grid gap-2'>
                            <Input
                              value={asValue(item.degree)}
                              placeholder='Degree'
                              onChange={(event) =>
                                updateEducation(
                                  index,
                                  'degree',
                                  event.target.value,
                                )
                              }
                            />
                            <Input
                              value={asValue(item.field_of_study)}
                              placeholder='Field of study'
                              onChange={(event) =>
                                updateEducation(
                                  index,
                                  'field_of_study',
                                  event.target.value,
                                )
                              }
                            />
                            <Input
                              value={asValue(item.institution)}
                              placeholder='Institution'
                              onChange={(event) =>
                                updateEducation(
                                  index,
                                  'institution',
                                  event.target.value,
                                )
                              }
                            />
                            <Input
                              value={asValue(item.location)}
                              placeholder='Location'
                              onChange={(event) =>
                                updateEducation(
                                  index,
                                  'location',
                                  event.target.value,
                                )
                              }
                            />
                            <Input
                              value={asValue(item.start_date)}
                              placeholder='Start date'
                              onChange={(event) =>
                                updateEducation(
                                  index,
                                  'start_date',
                                  event.target.value,
                                )
                              }
                            />
                            <Input
                              value={asValue(item.end_date)}
                              placeholder='End date'
                              onChange={(event) =>
                                updateEducation(
                                  index,
                                  'end_date',
                                  event.target.value,
                                )
                              }
                            />
                            <textarea
                              className='textarea min-h-20 w-full'
                              value={(item.highlights ?? []).join('\n')}
                              placeholder='Highlights, one per line'
                              onChange={(event) =>
                                updateEducation(
                                  index,
                                  'highlights',
                                  event.target.value,
                                )
                              }
                            />
                          </div>
                        : <>
                            <p className='label text-ink-primary'>
                              {item.degree ||
                                item.field_of_study ||
                                'Education'}
                            </p>
                            <p className='body-sm mt-1 text-ink-secondary'>
                              {item.institution || 'Institution not listed'}
                            </p>
                            <p className='body-sm text-ink-secondary'>
                              {dateRange(item.start_date, item.end_date)}
                            </p>
                          </>
                        }
                      </div>
                    ))
                  : <p className='body-sm text-ink-secondary'>Not listed</p>}
                </div>
              </SectionCard>
            )}

            {(editing || languageItems.length > 0) && (
              <SectionCard title='Language'>
                <div className='space-y-2'>
                  {languageItems.length ?
                    languageItems.map((item, index) => (
                      <div
                        key={`${item.name ?? 'language'}-${index}`}
                        className=''
                      >
                        <p className='body-sm text-ink-primary'>
                          {item.name || 'Language'}
                        </p>
                        <p className='body-sm text-ink-secondary'>
                          {item.proficiency || 'Not listed'}
                        </p>
                      </div>
                    ))
                  : <p className='body-sm text-ink-secondary'>Not listed</p>}
                </div>
              </SectionCard>
            )}
          </aside>
        </div>
        <ResumeSourceDebugger
          onRunAiParse={upload}
          onRunAiRaw={runRawAi}
          parsing={uploading}
        />
      </div>
    </div>
  );
}
