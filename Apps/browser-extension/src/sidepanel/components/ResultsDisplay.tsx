import { useEffect, useRef, useState } from 'react';
import {
  Check,
  RotateCw,
  Circle,
  History,
  ChevronDown,
  Sparkles,
  Trash2,
  Star,
} from 'lucide-react';
import { IPEmotion } from '@jobby/ui/components/UI/IPEmotion';
import { Tooltip } from '@jobby/ui/components/UI/tooltip';
import { cn } from '@jobby/ui/lib/utils';
import type {
  FormFieldObservation,
  FormInspection,
} from '../../shared/contracts/form-inspection';
import type {
  DocType,
  TailoredResume,
} from '../../shared/contracts/tailored-resume';
import { fileFieldPurpose } from '../../shared/utils/form-field-resolution';
export { fileFieldPurpose };
export type { FileFieldPurpose } from '../../shared/utils/form-field-resolution';
import { formatRelativeTime } from '@jobby/ui/lib/date-formatter';
import type { UploadSyncState } from '../hooks/useInspection';

type CurrentJob = {
  title?: string;
  company?: string;
};

function matchesCurrentJob(resume: TailoredResume, currentJob?: CurrentJob) {
  const currentTitle = currentJob?.title?.trim().toLowerCase();
  const currentCompany = currentJob?.company?.trim().toLowerCase();
  const resumeTitle = resume.job_title?.trim().toLowerCase();
  const resumeCompany = resume.company?.trim().toLowerCase();

  if (!currentTitle || !currentCompany || !resumeTitle || !resumeCompany) {
    return false;
  }

  const titleMatches = Boolean(
    currentTitle &&
      resumeTitle &&
      (currentTitle.includes(resumeTitle) || resumeTitle.includes(currentTitle)),
  );
  const companyMatches = Boolean(
    currentCompany &&
      resumeCompany &&
      (currentCompany.includes(resumeCompany) ||
        resumeCompany.includes(currentCompany)),
  );

  return titleMatches && companyMatches;
}

function createdAtTime(resume: TailoredResume) {
  return resume.created_at ? new Date(resume.created_at).getTime() || 0 : 0;
}

export function sortRecentTailoredResumes(
  resumes: TailoredResume[],
  currentJob: CurrentJob | undefined,
  defaultResumeId: string,
) {
  const currentJobResumeId = resumes
    .filter((resume) => matchesCurrentJob(resume, currentJob))
    .sort((a, b) => createdAtTime(b) - createdAtTime(a))[0]?.id;

  return [...resumes].sort((a, b) => {
    const rank = (resume: TailoredResume) =>
      resume.id === currentJobResumeId ? 0
      : resume.id === defaultResumeId ? 1
      : 2;

    return rank(a) - rank(b) || createdAtTime(b) - createdAtTime(a);
  });
}

interface ResultsDisplayProps {
  latestForm: FormInspection | null;
  isInspectingForm: boolean;
  onFocusField: (field: FormFieldObservation) => Promise<void>;
  onFillSingleField: (field: FormFieldObservation) => Promise<boolean | void>;
  onUploadTailoredResume: (
    field: FormFieldObservation,
    resume: TailoredResume,
  ) => Promise<void>;
  onUploadDefaultResume?: (
    field: FormFieldObservation,
    defaultResume?: TailoredResume,
  ) => Promise<void> | void;
  onDeleteTailoredResume?: (id: string) => Promise<void> | void;
  onEditField: (
    field: FormFieldObservation,
    value: string | boolean,
  ) => Promise<void>;
  uploadStates: Record<string, UploadSyncState>;
  tailoredResumes: TailoredResume[];
  isAutofilling: boolean;
  onTailor?: (type: DocType) => void;
  existingDocuments?: {
    resume: boolean;
    cover_letter: boolean;
  };
  currentJob?: CurrentJob;
  selectedDocumentId?: string;
  onSelectDocument?: (id: string) => void;
}

export function ResultsDisplay({
  latestForm,
  isInspectingForm,
  onFocusField,
  onFillSingleField,
  onUploadTailoredResume,
  onUploadDefaultResume,
  onDeleteTailoredResume,
  onEditField,
  uploadStates,
  tailoredResumes = [],
  isAutofilling,
  onTailor,
  existingDocuments,
  currentJob,
  selectedDocumentId,
  onSelectDocument,
}: ResultsDisplayProps) {
  const formFields =
    (
      latestForm?.kind === 'application_form' ||
      latestForm?.kind === 'page_input_fields'
    ) ?
      latestForm.fields
    : [];
  const hasFormFields = formFields.length > 0;

  return (
    <>
      {isInspectingForm && !hasFormFields ?
        <ResultSkeleton label='Inspecting form' />
      : hasFormFields && latestForm ?
        <div className=''>
          <FormFields
            fields={formFields}
            onFocusField={onFocusField}
            onFillSingleField={onFillSingleField}
            onUploadTailoredResume={onUploadTailoredResume}
            onUploadDefaultResume={onUploadDefaultResume}
            onDeleteTailoredResume={onDeleteTailoredResume}
            onEditField={onEditField}
            uploadStates={uploadStates}
            tailoredResumes={tailoredResumes}
            isAutofilling={isAutofilling}
            onTailor={onTailor}
            existingDocuments={existingDocuments}
            currentJob={currentJob}
            selectedDocumentId={selectedDocumentId}
            onSelectDocument={onSelectDocument}
          />
        </div>
      : <div className='relative page-class-banner--job flex flex-col items-center justify-center text-center p-6  bg-panel/50 rounded-2xl gap-3 mt-2'>
          <IPEmotion
            emotionId={5}
            className={'absolute w-40 top-10 h-40 mx-auto  '}
          />
          <div className='grid gap-1 pt-40'>
            <span className='text-xs font-bold text-foreground uppercase tracking-wider'>
              Scan Required
            </span>
            <p className='text-[11px] leading-relaxed text-muted-foreground max-w-[220px]'>
              No form fields detected yet. Click the{' '}
              <strong className='text-primary font-bold'>Autofill Form</strong>{' '}
              button above to scan and fill the page.
            </p>
          </div>
        </div>
      }
    </>
  );
}

function ResultSkeleton({ label }: { label: string }) {
  return (
    <div className='result-skeleton' aria-label={label} aria-busy='true'>
      <span className='skeleton-line short' />
      <span className='skeleton-line' />
      <span className='skeleton-line medium' />
    </div>
  );
}

interface FormFieldsProps {
  fields: FormFieldObservation[];
  onFocusField: (field: FormFieldObservation) => Promise<void>;
  onFillSingleField: (field: FormFieldObservation) => Promise<boolean | void>;
  onUploadTailoredResume: (
    field: FormFieldObservation,
    resume: TailoredResume,
  ) => Promise<void>;
  onUploadDefaultResume?: (
    field: FormFieldObservation,
    defaultResume?: TailoredResume,
  ) => Promise<void> | void;
  onDeleteTailoredResume?: (id: string) => Promise<void> | void;
  onEditField: (
    field: FormFieldObservation,
    value: string | boolean,
  ) => Promise<void>;
  uploadStates: Record<string, UploadSyncState>;
  tailoredResumes: TailoredResume[];
  isAutofilling: boolean;
  onTailor?: (type: DocType) => void;
  existingDocuments?: {
    resume: boolean;
    cover_letter: boolean;
  };
  currentJob?: CurrentJob;
  selectedDocumentId?: string;
  onSelectDocument?: (id: string) => void;
}

function FormFields({
  fields,
  onFocusField,
  onFillSingleField,
  onUploadTailoredResume,
  onUploadDefaultResume,
  onDeleteTailoredResume,
  onEditField,
  uploadStates,
  tailoredResumes,
  isAutofilling,
  onTailor,
  existingDocuments,
  currentJob,
  selectedDocumentId,
  onSelectDocument,
}: FormFieldsProps) {
  return (
    <div className='page-class-banner--job form-fields'>
      {fields.map((field) => (
        <FormFieldRow
          key={`${field.key}:${field.id || field.name || ''}`}
          field={field}
          onFocusField={onFocusField}
          onFillSingleField={onFillSingleField}
          onUploadTailoredResume={onUploadTailoredResume}
          onUploadDefaultResume={onUploadDefaultResume}
          onDeleteTailoredResume={onDeleteTailoredResume}
          onEditField={onEditField}
          uploadState={uploadStates[field.key]}
          tailoredResumes={tailoredResumes}
          isAutofilling={isAutofilling}
          onTailor={onTailor}
          existingDocuments={existingDocuments}
          currentJob={currentJob}
          selectedDocumentId={selectedDocumentId}
          onSelectDocument={onSelectDocument}
        />
      ))}
    </div>
  );
}

interface FormFieldRowProps {
  field: FormFieldObservation;
  onFocusField: (field: FormFieldObservation) => Promise<void>;
  onFillSingleField: (field: FormFieldObservation) => Promise<boolean | void>;
  onUploadTailoredResume: (
    field: FormFieldObservation,
    resume: TailoredResume,
  ) => Promise<void>;
  onUploadDefaultResume?: (
    field: FormFieldObservation,
    defaultResume?: TailoredResume,
  ) => Promise<void> | void;
  onDeleteTailoredResume?: (id: string) => Promise<void> | void;
  onEditField: (
    field: FormFieldObservation,
    value: string | boolean,
  ) => Promise<void>;
  uploadState?: UploadSyncState;
  tailoredResumes: TailoredResume[];
  isAutofilling: boolean;
  onTailor?: (type: DocType) => void;
  existingDocuments?: {
    resume: boolean;
    cover_letter: boolean;
  };
  currentJob?: CurrentJob;
  selectedDocumentId?: string;
  onSelectDocument?: (id: string) => void;
}

function formValue(field: FormFieldObservation): string {
  if (field.type === 'select') {
    return (
      field.options.find(
        (option) =>
          option.label === field.currentValue ||
          Boolean(
            field.currentValue &&
            (field.currentValue.startsWith(`${option.label} `) ||
              field.currentValue.startsWith(`${option.label},`)),
          ),
      )?.value ||
      field.currentValue ||
      ''
    );
  }
  return field.currentValue || '';
}

export function displayValue(field: FormFieldObservation): string {
  if (field.type === 'checkbox') return field.filled ? 'Checked' : 'Unchecked';
  if (field.type === 'file')
    return field.upload?.filename || (field.filled ? 'Uploaded' : 'None');
  if (field.type === 'password' && field.filled) return 'Filled securely';
  const value = field.currentValue || '';
  return (
    field.options.find((option) => option.value === value)?.label ||
    value ||
    'None'
  );
}

function displayLabel(field: FormFieldObservation): string {
  const purpose = fileFieldPurpose(field);
  if (purpose === 'resume') return 'Resume';
  if (purpose === 'cover_letter') return 'Cover letter';
  if (purpose === 'profile_image') return 'Profile image';
  if (purpose === 'portfolio') return 'Portfolio / work sample';
  return field.label;
}

interface ExpandableAnswerProps {
  value: string;
  isFilled: boolean;
  isAutofilling: boolean;
}

export function ExpandableAnswer({
  value,
  isFilled,
  isAutofilling,
}: ExpandableAnswerProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isClamped, setIsClamped] = useState(false);
  const [measuredHeight, setMeasuredHeight] = useState<number | undefined>(
    undefined,
  );
  const textRef = useRef<HTMLSpanElement>(null);

  const displayText = isAutofilling && !isFilled ? 'AI is thinking...' : value;

  useEffect(() => {
    const el = textRef.current;
    if (!el) return;

    const measure = () => {
      const computed = window.getComputedStyle(el);
      const lineHeight = parseFloat(computed.lineHeight) || 19.25;
      const twoLinesMax = lineHeight * 2 + 3;

      const scrollH = el.scrollHeight;
      const exceeds = scrollH > twoLinesMax;

      setIsClamped(exceeds);
      if (exceeds) {
        setMeasuredHeight(scrollH);
      } else {
        setIsExpanded(false);
        setMeasuredHeight(undefined);
      }
    };

    measure();

    const resizeObserver = new ResizeObserver(() => {
      measure();
    });
    resizeObserver.observe(el);

    return () => {
      resizeObserver.disconnect();
    };
  }, [displayText, isFilled]);

  useEffect(() => {
    setIsExpanded(false);
  }, [value]);

  return (
    <div className='flex flex-col min-w-0 max-w-full'>
      <div
        className={cn(
          'transition-[max-height] duration-300 ease-in-out min-w-0 max-w-full overflow-hidden',
          isClamped && !isExpanded ? 'max-h-[2.85em]' : '',
        )}
        style={
          isClamped && isExpanded && measuredHeight ?
            { maxHeight: `${measuredHeight + 8}px` }
          : undefined
        }
      >
        <span
          ref={textRef}
          className={cn(
            'break-all block transition-colors duration-200',
            isAutofilling && !isFilled ?
              'animate-text-shimmer animate-text-shimmer-primary'
            : '',
            isClamped && !isExpanded ?
              'line-clamp-2 [-webkit-box-orient:vertical] [display:-webkit-box] overflow-hidden'
            : '',
          )}
        >
          {displayText}
        </span>
      </div>


    </div>
  );
}

function FormFieldRow({
  field,
  onFocusField,
  onFillSingleField,
  onUploadTailoredResume,
  onUploadDefaultResume,
  onDeleteTailoredResume,
  onEditField,
  uploadState,
  tailoredResumes,
  isAutofilling,
  onTailor,
  existingDocuments,
  currentJob,
  selectedDocumentId,
  onSelectDocument,
}: FormFieldRowProps) {
  const [draft, setDraft] = useState(() => formValue(field));
  const [editing, setEditing] = useState(false);
  const [isSingleFilling, setIsSingleFilling] = useState(false);
  const [isRecentTailorExpanded, setIsRecentTailorExpanded] = useState(true);
  const timer = useRef<number | undefined>(undefined);
  const isStructuredSummary = field.semanticFeatures?.includes(
    'workday-structured-summary',
  );

  const pendingValue = useRef<string | boolean | undefined>(undefined);
  const editable = !['file', 'unknown', 'multiselect'].includes(field.type);
  const purpose = fileFieldPurpose(field);
  const isResumeUpload = purpose === 'resume';
  const isCoverLetterUpload = purpose === 'cover_letter';
  const isDocumentUpload =
    isResumeUpload || isCoverLetterUpload || purpose === 'other';
  const documentLabel =
    isCoverLetterUpload ? 'Cover Letter'
    : isResumeUpload ? 'Resume'
    : 'Document';
  const showGenerateNew = Boolean(
    onTailor &&
      ((isResumeUpload && !existingDocuments?.resume) ||
        (isCoverLetterUpload && !existingDocuments?.cover_letter)),
  );
  const cardListRef = useRef<HTMLDivElement | null>(null);
  const hasManuallySelectedResume = useRef(false);
  const DEFAULT_RESUME_STORAGE_KEY = 'jobby_default_tailored_resume_id';
  const [defaultResumeId, setDefaultResumeId] = useState<string>(() => {
    try {
      return localStorage?.getItem(DEFAULT_RESUME_STORAGE_KEY) || '';
    } catch {
      return '';
    }
  });
  const [confirmDeleteTarget, setConfirmDeleteTarget] =
    useState<TailoredResume | null>(null);
  const [confirmDefaultTarget, setConfirmDefaultTarget] =
    useState<TailoredResume | null>(null);

  const handleSetDefaultResume = (id: string) => {
    setDefaultResumeId(id);
    try {
      localStorage?.setItem(DEFAULT_RESUME_STORAGE_KEY, id);
    } catch {
      // ignore
    }
  };

  const rawRecentResumes = tailoredResumes.filter((resume) => {
    if (resume.isGenerating) return false;
    const generated = resume.raw_ai_response?.generated_documents as
      | { resume?: boolean; cover_letter?: boolean }
      | undefined;
    if (isCoverLetterUpload) {
      return Boolean(
        resume.cover_letter ||
          (resume.raw_ai_response as any)?.cover_letter ||
          generated?.cover_letter === true,
      );
    }
    const hasGeneratedResume =
      generated && ('resume' in generated || 'cover_letter' in generated) ?
        generated.resume === true
      : Boolean(resume.resume_data);
    return hasGeneratedResume;
  });

  const recentTailoredResumes = sortRecentTailoredResumes(
    rawRecentResumes,
    currentJob,
    defaultResumeId,
  );

  const [selectedResumeId, setSelectedResumeId] = useState(() => {
    if (recentTailoredResumes.length > 0) {
      const match = recentTailoredResumes.find((r) =>
        matchesCurrentJob(r, currentJob),
      );
      if (match) return match.id;
      if (
        defaultResumeId &&
        recentTailoredResumes.some((r) => r.id === defaultResumeId)
      ) {
        return defaultResumeId;
      }
    }
    return '';
  });
  const selectedResume = recentTailoredResumes.find(
    (resume) => resume.id === selectedResumeId,
  );

  const handleSelectResume = (id: string, manual = true) => {
    if (manual) hasManuallySelectedResume.current = true;
    setSelectedResumeId(id);
    onSelectDocument?.(id);
    requestAnimationFrame(() => {
      const cardEl = cardListRef.current?.querySelector<HTMLElement>(
        `[data-resume-id="${id}"]`,
      );
      cardEl?.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
        inline: 'center',
      });
    });
  };

  const handleSingleFill = async (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    e.nativeEvent?.stopImmediatePropagation?.();
    if (isSingleFilling) return;
    setIsSingleFilling(true);
    try {
      if (field.type === 'file') {
        const purpose = fileFieldPurpose(field);
        if (purpose === 'resume' || purpose === 'cover_letter') {
          if (selectedResume) {
            try {
              await onUploadTailoredResume(field, selectedResume);
            } catch {
              // handled
            }
          } else {
            const defaultTarget = recentTailoredResumes.find(
              (r) => r.id === defaultResumeId,
            );
            try {
              await onUploadDefaultResume?.(field, defaultTarget);
            } catch {
              // handled
            }
          }
        }
        return;
      }
      await onFillSingleField(field);
    } finally {
      setIsSingleFilling(false);
    }
  };

  useEffect(() => {
    if (
      selectedDocumentId &&
      recentTailoredResumes.some((resume) => resume.id === selectedDocumentId)
    ) {
      setSelectedResumeId(selectedDocumentId);
    }
  }, [recentTailoredResumes, selectedDocumentId]);

  useEffect(() => {
    const selectedExists = recentTailoredResumes.some(
      (resume) => resume.id === selectedResumeId,
    );
    if (hasManuallySelectedResume.current && selectedExists) return;
    if (!selectedExists) hasManuallySelectedResume.current = false;

    const matchingResume = recentTailoredResumes.find((resume) =>
      matchesCurrentJob(resume, currentJob),
    );
    const preferredId =
      matchingResume?.id ||
      (defaultResumeId &&
      recentTailoredResumes.some((resume) => resume.id === defaultResumeId) ?
        defaultResumeId
      : '');
    if (preferredId !== selectedResumeId) {
      setSelectedResumeId(preferredId);
    }
  }, [recentTailoredResumes, selectedResumeId, defaultResumeId, currentJob]);

  useEffect(() => {
    if (selectedResumeId && isRecentTailorExpanded) {
      const timer = setTimeout(() => {
        const cardEl = cardListRef.current?.querySelector<HTMLElement>(
          `[data-resume-id="${selectedResumeId}"]`,
        );
        cardEl?.scrollIntoView({
          behavior: 'smooth',
          block: 'nearest',
          inline: 'center',
        });
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [selectedResumeId, isRecentTailorExpanded]);

  const isUploadInFlight = uploadState?.phase === 'uploading';
  const currentValue = displayValue(field);

  useEffect(() => {
    if (editing || timer.current !== undefined) return;
    const incoming = formValue(field);
    if (
      pendingValue.current !== undefined &&
      incoming === String(pendingValue.current)
    ) {
      pendingValue.current = undefined;
    }
    if (pendingValue.current !== undefined) return;
    setDraft(incoming);
  }, [field, editing]);

  useEffect(
    () => () => {
      if (timer.current !== undefined) window.clearTimeout(timer.current);
    },
    [],
  );

  const commit = (value: string | boolean, immediate = false) => {
    pendingValue.current = value;
    if (timer.current !== undefined) window.clearTimeout(timer.current);
    const save = () => {
      void onEditField(field, value).then(() => {
        if (pendingValue.current === value) pendingValue.current = undefined;
      });
    };
    if (immediate) save();
    else
      timer.current = window.setTimeout(() => {
        timer.current = undefined;
        save();
      }, 150);
  };

  const finishEditing = () => {
    setEditing(false);
    commit(draft, true);
  };

  const commitOnBlur = () => {
    setEditing(false);
    commit(draft, true);
  };

  const isFile = field.type === 'file';
  const isSelectedTailoredForJob = Boolean(
    selectedResume && matchesCurrentJob(selectedResume, currentJob),
  );

  const resolvedUploadedDocumentId = uploadState?.sourceDocumentId || null;

  const uploadedDocument = recentTailoredResumes.find(
    (resume) => resume.id === resolvedUploadedDocumentId,
  );
  const uploadedDocumentName =
    uploadedDocument?.company ||
    uploadedDocument?.job_title ||
    uploadState?.sourceLabel ||
    field.upload?.filename ||
    currentValue;
  const hasKnownSource = Boolean(
    uploadedDocument || uploadState?.sourceLabel,
  );
  const hasUploadedFile = Boolean(
    field.filled ||
      field.upload?.state === 'ready' ||
      uploadState?.phase === 'confirmed' ||
      uploadState?.phase === 'unconfirmed',
  );

  return (
    <article className='form-field-row min-w-0 max-w-full overflow-hidden'>
      <div className='form-field-heading min-w-0 max-w-full'>
        <div
          role='button'
          tabIndex={0}
          className='form-field-focus min-w-0 max-w-full overflow-hidden cursor-pointer'
          title='Locate field on webpage'
          aria-label={`Locate ${field.label}`}
          onClick={() => void onFocusField(field)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              void onFocusField(field);
            }
          }}
        >
          <span
            className={`transition-all duration-700 min-w-0 max-w-full block overflow-hidden ${!field.filled ? 'form-field-value' : 'form-field-label'}`}
          >
            <span
              className={`truncate block ${
                isAutofilling && !field.filled ?
                  'animate-text-shimmer animate-text-shimmer-primary'
                : ''
              }`}
            >
              {displayLabel(field)}
              {field.required && (
                <span className='text-red-500 text-md shrink-0'> *</span>
              )}
            </span>
          </span>
          <span
            className={`transition-all duration-700 min-w-0 max-w-full block overflow-hidden ${field.filled ? 'form-field-value' : 'form-field-label'} `}
          >
            {isFile ? (
              <Tooltip
                content={
                  <div className='flex flex-col gap-0.5 text-xs max-w-64'>
                    <div className='flex items-center gap-1.5'>
                      <span className='font-semibold text-foreground truncate'>
                        {uploadedDocumentName}
                      </span>
                      {hasKnownSource && (
                        <span className='text-[10px] px-1.5 py-0.2 rounded bg-primary/20 text-primary font-medium shrink-0'>
                          Source
                        </span>
                      )}
                    </div>
                    {uploadedDocument?.job_title && (
                      <span className='text-[10px] text-muted-foreground truncate'>
                        {uploadedDocument.job_title}
                      </span>
                    )}

                    <div className='mt-3 text-[10px] text-muted-foreground '>

                      Filename adjusted for this application. Your source {documentLabel.toLowerCase()} as above remains unchanged.

                    </div>

                  </div>
                }
                side='top'
                align='start'
                delay={150}
              >
                <span className='truncate block font-semibold text-xs text-foreground whitespace-nowrap'>
                  {currentValue}
                </span>
              </Tooltip>
            ) : (
              <ExpandableAnswer
                value={currentValue}
                isFilled={field.filled}
                isAutofilling={isAutofilling}
              />
            )}
          </span>
        </div>
        {editable && (
          <button
            type='button'
            className='form-field-edit'
            onClick={editing ? finishEditing : () => setEditing(true)}
          >
            {editing ? 'Done' : 'Edit'}
          </button>
        )}
        <button
          type='button'
          disabled={isSingleFilling || isStructuredSummary}
          className={`group form-field-status ${
            field.filled ? 'is-filled' : 'is-unfilled'
          } ${isSingleFilling ? 'is-loading' : ''}`}
          aria-label={
            isStructuredSummary ? `${field.label} summary`
            : field.filled ?
              `Filled, click to re-autofill ${field.label}`
            : `Unfilled, click to autofill ${field.label}`
          }
          title={
            isStructuredSummary ? `${field.label} summary`
            : isSingleFilling ? 'Autofilling field...'
            : field.filled ?
              'Filled (click to re-autofill)'
            : 'Unfilled (click to autofill)'
          }
          onClick={handleSingleFill}
        >
          {isSingleFilling ?
            <RotateCw className='w-3 h-3 animate-spin' />
          : <>
              <span className='flex items-center justify-center group-hover:hidden'>
                {field.filled ?
                  <Check className='w-3 h-3 stroke-[2.5]' />
                : <Circle className='w-2.5 h-2.5 stroke-[2] opacity-40' />}
              </span>
              {!isStructuredSummary && (
                <span className='hidden items-center justify-center group-hover:flex'>
                  <RotateCw className='w-3 h-3 stroke-[2.5]' />
                </span>
              )}
            </>
          }
        </button>
      </div>
      {editable && editing ?
        <FieldEditor
          field={field}
          draft={draft}
          onFocus={() => setEditing(true)}
          onBlur={commitOnBlur}
          onTextChange={(val) => setDraft(val)}
          onValueChange={(val, imm = true) => {
            if (typeof val === 'string') setDraft(val);
            commit(val, imm);
          }}
        />
      : field.type === 'file' ?
        <div className='form-file-action'>
          {field.options.length > 0 && (
            <div className='form-file-options'>
              {field.options.map((option) => (
                <label key={option.value}>
                  <input
                    type='radio'
                    name={`panel-file-${field.key}`}
                    value={option.value}
                    checked={field.currentValue === option.label}
                    onChange={() => void onEditField(field, option.value)}
                  />
                  {option.label}
                </label>
              ))}
            </div>
          )}
          {isDocumentUpload && (
            <div className='form-resume-picker'>
              <div
                role='button'
                tabIndex={0}
                className='flex items-center justify-between w-full cursor-pointer select-none py-1'
                onClick={() => setIsRecentTailorExpanded((prev) => !prev)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setIsRecentTailorExpanded((prev) => !prev);
                  }
                }}
                aria-expanded={isRecentTailorExpanded}
              >
                <div className='flex items-center gap-1.5 min-w-0'>
                  <History className='h-3 w-3 text-primary shrink-0' />
                  <span className='form-resume-picker-title'>
                    Recent Tailor ({recentTailoredResumes.length})
                  </span>
                </div>
                <div className='flex items-center gap-1 text-[10px] font-semibold text-primary/80 hover:text-primary transition-colors'>
                  <span>
                    {isRecentTailorExpanded ? 'Show less' : 'Show more'}
                  </span>
                  <ChevronDown
                    className={cn(
                      'w-3 h-3 transition-transform duration-200',
                      isRecentTailorExpanded ? 'rotate-180' : 'rotate-0',
                    )}
                  />
                </div>
              </div>
              {isRecentTailorExpanded && (
                <div
                  ref={cardListRef}
                  className='form-resume-card-list no-scrollbar'
                  aria-label='Select from Recent Tailor'
                >
                  {recentTailoredResumes.length > 0 ?
                    recentTailoredResumes.map((resume) => {
                      const isSelected = resume.id === selectedResumeId;
                      const isDefault = resume.id === defaultResumeId;
                      const isUploaded = Boolean(
                        hasUploadedFile &&
                          resolvedUploadedDocumentId === resume.id,
                      );
                      return (
                        <button
                          key={resume.id}
                          data-resume-id={resume.id}
                          type='button'
                          className={`form-resume-card group/card ${isSelected ? 'is-selected' : ''}`}
                          disabled={isUploadInFlight}
                          aria-pressed={isSelected}
                          onClick={() => handleSelectResume(resume.id)}
                        >
                          <span className='form-resume-card-topline'>
                            <span
                              className='form-resume-card-role truncate'
                              title={resume.job_title || 'Tailored Resume'}
                            >
                              {resume.job_title || 'Tailored Resume'}
                            </span>
                            <div className='flex items-center gap-0.5 shrink-0'>
                              <span
                                role='button'
                                tabIndex={0}
                                className={`p-0.5 transition-opacity cursor-pointer ${
                                  isDefault ? 'opacity-100 text-amber-400'
                                  : 'opacity-0 group-hover/card:opacity-100 hover:text-amber-400 text-muted-foreground/60'
                                }`}
                                title={
                                  isDefault ? 'Default resume'
                                  : 'Set as default resume'
                                }
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (!isDefault)
                                    setConfirmDefaultTarget(resume);
                                }}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter' || e.key === ' ') {
                                    e.stopPropagation();
                                    if (!isDefault)
                                      setConfirmDefaultTarget(resume);
                                  }
                                }}
                              >
                                <Star
                                  className={`w-2.5 h-2.5 ${isDefault ? 'fill-amber-400 text-amber-400' : ''}`}
                                />
                              </span>
                              {onDeleteTailoredResume && (
                                <span
                                  role='button'
                                  tabIndex={0}
                                  className='opacity-0 group-hover/card:opacity-100 hover:text-destructive p-0.5 text-muted-foreground/60 transition-opacity cursor-pointer'
                                  title='Delete tailored record'
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setConfirmDeleteTarget(resume);
                                  }}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter' || e.key === ' ') {
                                      e.stopPropagation();
                                      setConfirmDeleteTarget(resume);
                                    }
                                  }}
                                >
                                  <Trash2 className='w-2.5 h-2.5' />
                                </span>
                              )}
                            </div>
                          </span>
                          <span className='form-resume-card-company'>
                            <span
                              className='truncate'
                              title={resume.company || 'Job Application'}
                            >
                              {resume.company || 'Job Application'}
                            </span>
                          </span>
                          <div className='flex items-center justify-between gap-1 mt-1'>
                            <div className='flex items-center gap-1 min-w-0'>
                              {isDefault && (
                                <Star className='w-2.5 h-2.5 fill-amber-400 text-amber-400 shrink-0' />
                              )}
                              <span className='form-resume-card-time shrink-0'>
                                {formatRelativeTime(resume.created_at)}
                              </span>
                            </div>
                            <div className='flex items-center gap-1 shrink-0'>
                              {isUploaded && (
                                <span className='text-[8px] font-bold px-1 py-0.5 rounded bg-primary/20 text-primary uppercase tracking-tight'>
                                  Uploaded
                                </span>
                              )}
                              {isSelected && (
                                <Check className='h-3 w-3 shrink-0 text-primary' />
                              )}
                            </div>
                          </div>
                        </button>
                      );
                    })
                  : <span className='form-resume-empty'>
                      No tailored resumes available. Create one in Studio first.
                    </span>
                  }
                </div>
              )}
            </div>
          )}
          {isDocumentUpload && showGenerateNew && (
            <div className='flex items-center gap-2 w-full'>
              <button
                type='button'
                className='flex-1 min-h-[28px] py-1 px-2.5 rounded-full text-xs font-medium bg-muted/80 hover:bg-muted text-foreground border border-border/40 transition-all active:scale-95 cursor-pointer flex items-center justify-center gap-1 shadow-2xs'
                onClick={() =>
                  onTailor?.(isCoverLetterUpload ? 'cover_letter' : 'resume')
                }
              >
                <Sparkles className='w-3 h-3 text-primary shrink-0' />
                <span>Generate New</span>
              </button>
              <button
                type='button'
                className='flex-1 min-h-[28px] py-1 px-2.5 rounded-full text-xs font-medium bg-muted/80 hover:bg-muted text-foreground border border-border/40 transition-all active:scale-95 cursor-pointer flex items-center justify-center gap-1 shadow-2xs disabled:opacity-50 disabled:cursor-not-allowed'
                disabled={isUploadInFlight}
                onClick={async () => {
                  const defaultTarget = recentTailoredResumes.find(
                    (r) => r.id === defaultResumeId,
                  );
                  try {
                    await onUploadDefaultResume?.(field, defaultTarget);
                    if (defaultTarget) {
                      handleSelectResume(defaultTarget.id, false);
                    }
                  } catch {
                    // handled
                  }
                }}
              >
                Upload default one
              </button>
            </div>
          )}
          <button
            type='button'
            className='w-full min-h-[30px] py-1.5 px-3 rounded-full text-xs font-bold bg-primary-gradient text-primary-foreground shadow-xs hover:opacity-95 active:scale-95 transition-all cursor-pointer border-0 disabled:opacity-50 disabled:cursor-not-allowed'
            disabled={isUploadInFlight || (isDocumentUpload && !selectedResume)}
            onClick={async () => {
              if (isDocumentUpload && selectedResume) {
                try {
                  await onUploadTailoredResume(field, selectedResume);
                } catch {
                  // handled
                }
              } else {
                await onFocusField(field);
              }
            }}
          >
            {isDocumentUpload ?
              isUploadInFlight ?
                `Uploading ${isSelectedTailoredForJob ? 'Tailored' : 'selected'} ${documentLabel}...`
              : field.filled ?
                resolvedUploadedDocumentId &&
                resolvedUploadedDocumentId === selectedResumeId ?
                  `Reupload ${isSelectedTailoredForJob ? 'Tailored' : 'selected'} ${documentLabel}`
                : `Upload selected ${documentLabel} to replace`
              : `Upload ${isSelectedTailoredForJob ? 'Tailored' : 'selected'} ${documentLabel}`
            : 'Go to Upload'}
          </button>
        </div>
      : null}

      {confirmDeleteTarget && (
        <div className='fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4'>
          <div
            className='w-full max-w-[320px] rounded-xl bg-panel p-4 shadow-xl border border-border flex flex-col gap-3'
            role='dialog'
            aria-modal='true'
          >
            <div className='flex flex-col gap-1'>
              <h3 className='text-sm font-bold text-foreground'>
                Delete Tailored Record
              </h3>
              <p className='text-xs text-muted-foreground leading-relaxed'>
                Are you sure you want to permanently delete the tailored record for{' '}
                <strong className='text-foreground font-semibold'>
                  {confirmDeleteTarget.job_title || 'this role'}
                  {confirmDeleteTarget.company ?
                    ` at ${confirmDeleteTarget.company}`
                  : ''}
                </strong>
                ?
              </p>
            </div>
            <div className='flex items-center justify-end gap-2 pt-1'>
              <button
                type='button'
                className='min-h-[28px] px-3 py-1 rounded-full text-xs font-medium bg-muted hover:bg-muted/80 text-foreground transition-colors cursor-pointer'
                onClick={() => setConfirmDeleteTarget(null)}
              >
                Cancel
              </button>
              <button
                type='button'
                className='min-h-[28px] px-3 py-1 rounded-full text-xs font-medium bg-destructive text-destructive-foreground hover:bg-destructive/90 transition-colors cursor-pointer'
                onClick={async () => {
                  const target = confirmDeleteTarget;
                  setConfirmDeleteTarget(null);
                  if (target && onDeleteTailoredResume) {
                    await onDeleteTailoredResume(target.id);
                  }
                }}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmDefaultTarget && (
        <div className='fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4'>
          <div
            className='w-full max-w-[320px] rounded-xl bg-panel p-4 shadow-xl border border-border flex flex-col gap-3'
            role='dialog'
            aria-modal='true'
          >
            <div className='flex flex-col gap-1'>
              <h3 className='text-sm font-bold text-foreground'>
                Set as Default Resume
              </h3>
              <p className='text-xs text-muted-foreground leading-relaxed'>
                Set the tailored resume for{' '}
                <strong className='text-foreground font-semibold'>
                  {confirmDefaultTarget.job_title || 'this role'}
                  {confirmDefaultTarget.company ?
                    ` at ${confirmDefaultTarget.company}`
                  : ''}
                </strong>{' '}
                as your default resume?
              </p>
            </div>
            <div className='flex items-center justify-end gap-2 pt-1'>
              <button
                type='button'
                className='min-h-[28px] px-3 py-1 rounded-full text-xs font-medium bg-muted hover:bg-muted/80 text-foreground transition-colors cursor-pointer'
                onClick={() => setConfirmDefaultTarget(null)}
              >
                Cancel
              </button>
              <button
                type='button'
                className='min-h-[28px] px-3 py-1 rounded-full text-xs font-medium bg-primary text-primary-foreground hover:opacity-90 transition-colors cursor-pointer'
                onClick={() => {
                  const target = confirmDefaultTarget;
                  setConfirmDefaultTarget(null);
                  if (target) {
                    handleSetDefaultResume(target.id);
                  }
                }}
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </article>
  );
}

interface FieldEditorProps {
  field: FormFieldObservation;
  draft: string;
  onFocus: () => void;
  onBlur: () => void;
  onTextChange: (value: string) => void;
  onValueChange: (value: string | boolean, immediate?: boolean) => void;
}

function FieldEditor({
  field,
  draft,
  onFocus,
  onBlur,
  onTextChange,
  onValueChange,
}: FieldEditorProps) {
  if (field.type === 'checkbox') {
    return (
      <label className='form-checkbox'>
        <input
          type='checkbox'
          checked={field.filled}
          onChange={(event) => onValueChange(event.target.checked)}
        />
        Checked
      </label>
    );
  }

  if (field.type === 'select') {
    if (field.options.length === 0) {
      return (
        <input
          className='form-field-input'
          value={draft}
          onFocus={onFocus}
          onBlur={onBlur}
          onChange={(event) => onTextChange(event.target.value)}
        />
      );
    }
    return (
      <select
        className='form-field-input'
        value={draft}
        onFocus={onFocus}
        onChange={(event) => onValueChange(event.target.value)}
      >
        {!draft && <option value=''>Select...</option>}
        {field.options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    );
  }

  if (field.type === 'radio') {
    return (
      <div className='form-radio-options'>
        {field.options.map((option) => (
          <label key={option.value}>
            <input
              type='radio'
              name={`panel-${field.key}`}
              checked={draft === option.label || draft === option.value}
              onChange={() => onValueChange(option.value)}
            />
            {option.label}
          </label>
        ))}
      </div>
    );
  }

  if (field.type === 'textarea') {
    return (
      <textarea
        className='form-field-input'
        value={draft}
        onFocus={onFocus}
        onChange={(event) => onTextChange(event.target.value)}
        onBlur={onBlur}
      />
    );
  }

  return (
    <input
      className='form-field-input'
      type={field.type === 'text' ? 'text' : field.type}
      value={draft}
      onFocus={onFocus}
      onChange={(event) => onTextChange(event.target.value)}
      onBlur={onBlur}
    />
  );
}
