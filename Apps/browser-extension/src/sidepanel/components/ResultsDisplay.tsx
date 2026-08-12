/** @format */

import { useEffect, useRef, useState } from 'react';
import { Check, RotateCw, Circle } from 'lucide-react';
import type {
  FormFieldObservation,
  FormInspection,
} from '../../shared/contracts/form-inspection';
import type { UploadSyncState } from '../hooks/useInspection';

interface ResultsDisplayProps {
  latestForm: FormInspection | null;
  isInspectingForm: boolean;
  onFocusField: (field: FormFieldObservation) => Promise<void>;
  onFillSingleField: (field: FormFieldObservation) => Promise<boolean | void>;
  onUploadDefaultResume: (field: FormFieldObservation) => Promise<void>;
  onEditField: (
    field: FormFieldObservation,
    value: string | boolean,
  ) => Promise<void>;
  uploadStates: Record<string, UploadSyncState>;
  isAutofilling: boolean;
}

export function ResultsDisplay({
  latestForm,
  isInspectingForm,
  onFocusField,
  onFillSingleField,
  onUploadDefaultResume,
  onEditField,
  uploadStates,
  isAutofilling,
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
            onUploadDefaultResume={onUploadDefaultResume}
            onEditField={onEditField}
            uploadStates={uploadStates}
            isAutofilling={isAutofilling}
          />
        </div>
      : <div className='p-3 text-xs text-center text-muted-foreground bg-slate-50 dark:bg-slate-900/50 rounded-lg border border-dashed border-slate-200 dark:border-slate-800'>
          No form fields detected yet. Click <strong>Autofill Form</strong> to scan and fill the page.
        </div>}
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
  onUploadDefaultResume: (field: FormFieldObservation) => Promise<void>;
  onEditField: (
    field: FormFieldObservation,
    value: string | boolean,
  ) => Promise<void>;
  uploadStates: Record<string, UploadSyncState>;
  isAutofilling: boolean;
}

function FormFields({
  fields,
  onFocusField,
  onFillSingleField,
  onUploadDefaultResume,
  onEditField,
  uploadStates,
  isAutofilling,
}: FormFieldsProps) {
  return (
    <div className=''>
      {fields.map((field) => (
        <FormFieldRow
          key={`${field.key}:${field.id || field.name || ''}`}
          field={field}
          onFocusField={onFocusField}
          onFillSingleField={onFillSingleField}
          onUploadDefaultResume={onUploadDefaultResume}
          onEditField={onEditField}
          uploadState={uploadStates[field.key]}
          isAutofilling={isAutofilling}
        />
      ))}
    </div>
  );
}

interface FormFieldRowProps {
  field: FormFieldObservation;
  onFocusField: (field: FormFieldObservation) => Promise<void>;
  onFillSingleField: (field: FormFieldObservation) => Promise<boolean | void>;
  onUploadDefaultResume: (field: FormFieldObservation) => Promise<void>;
  onEditField: (
    field: FormFieldObservation,
    value: string | boolean,
  ) => Promise<void>;
  uploadState?: UploadSyncState;
  isAutofilling: boolean;
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

function displayValue(field: FormFieldObservation): string {
  if (field.type === 'checkbox') return field.filled ? 'Checked' : 'Unchecked';
  if (field.type === 'file')
    return field.upload?.filename || (field.filled ? 'Uploaded' : 'None');
  const value = field.currentValue || '';
  return (
    field.options.find((option) => option.value === value)?.label ||
    value ||
    'None'
  );
}

function FormFieldRow({
  field,
  onFocusField,
  onFillSingleField,
  onUploadDefaultResume,
  onEditField,
  uploadState,
  isAutofilling,
}: FormFieldRowProps) {
  const [draft, setDraft] = useState(() => formValue(field));
  const [editing, setEditing] = useState(false);
  const [isSingleFilling, setIsSingleFilling] = useState(false);
  const timer = useRef<number | undefined>(undefined);

  const handleSingleFill = async (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    e.nativeEvent?.stopImmediatePropagation?.();
    if (isSingleFilling) return;
    setIsSingleFilling(true);
    try {
      await onFocusField(field);
      await onFillSingleField(field);
    } finally {
      setIsSingleFilling(false);
    }
  };
  // Track the most recent value we've dispatched to the page so we don't
  // overwrite the user's in-progress input when the inspection poll fires
  // before the page has accepted the change.
  const pendingValue = useRef<string | boolean | undefined>(undefined);
  const editable =
    !field.sensitive && !['file', 'password', 'unknown'].includes(field.type);
  const isResumeUpload =
    field.type === 'file' &&
    (/resume|curriculum vitae|\bcv\b|简历|履历|document|upload/i.test(
      field.label,
    ) ||
      field.type === 'file');
  const isUploadInFlight = uploadState?.phase === 'uploading';
  const currentValue = displayValue(field);

  useEffect(() => {
    // Don't reset while the user is actively typing or has a save in-flight.
    if (editing || timer.current !== undefined) return;
    const incoming = formValue(field);
    // If the page value matches what we last sent, no need to reset at all —
    // the user's draft is already consistent with the source of truth.
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
        // Once the page has accepted the value, clear the pending marker so
        // the next inspection poll can freely reset draft if the page diverges.
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

  const updateText = (value: string) => {
    setDraft(value);
    commit(value);
  };

  const commitOnBlur = () => {
    setEditing(false);
    if (timer.current !== undefined) {
      window.clearTimeout(timer.current);
      timer.current = undefined;
    }
    void onEditField(field, draft).then(() => {
      if (pendingValue.current === draft) pendingValue.current = undefined;
    });
  };

  const finishEditing = () => {
    setEditing(false);
    if (timer.current !== undefined) {
      window.clearTimeout(timer.current);
      timer.current = undefined;
    }
    void onEditField(field, draft).then(() => {
      if (pendingValue.current === draft) pendingValue.current = undefined;
    });
  };

  return (
    <article className='form-field-row min-w-0 max-w-full overflow-hidden'>
      <div className='form-field-heading min-w-0 max-w-full'>
        <button
          type='button'
          className='form-field-focus min-w-0 max-w-full overflow-hidden'
          title='Locate field on webpage'
          aria-label={`Locate ${field.label}`}
          onClick={() => void onFocusField(field)}
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
              {field.label}
              {field.required && (
                <span className='text-red-500 text-md shrink-0'> *</span>
              )}
            </span>
          </span>
          <span
            className={`transition-all duration-700 min-w-0 max-w-full block overflow-hidden ${field.filled ? 'form-field-value' : 'form-field-label'} `}
          >
            <span
              className={`break-all block ${
                isAutofilling && !field.filled ?
                  'animate-text-shimmer animate-text-shimmer-primary'
                : ''
              }`}
            >
              {isAutofilling && !field.filled ? 'AI is thinking...' : currentValue}
            </span>
          </span>
        </button>
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
          disabled={isSingleFilling}
          className={`group form-field-status ${
            field.filled ? 'is-filled' : 'is-unfilled'
          } ${isSingleFilling ? 'is-loading' : ''}`}
          aria-label={
            field.filled ?
              `Filled, click to re-autofill ${field.label}`
            : `Unfilled, click to autofill ${field.label}`
          }
          title={
            isSingleFilling ? 'Autofilling field...'
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
              <span className='hidden items-center justify-center group-hover:flex'>
                <RotateCw className='w-3 h-3 stroke-[2.5]' />
              </span>
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
          onTextChange={updateText}
          onValueChange={(value, immediate = true) => {
            if (typeof value === 'string') setDraft(value);
            commit(value, immediate);
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
                    checked={field.currentValue === option.label}
                    onChange={() => void onEditField(field, option.value)}
                  />
                  {option.label}
                </label>
              ))}
            </div>
          )}
          <button
            type='button'
            disabled={isUploadInFlight}
            onClick={() =>
              void (isResumeUpload ?
                onUploadDefaultResume(field)
              : onFocusField(field))
            }
          >
            {isResumeUpload ?
              isUploadInFlight ?
                'Uploading default Resume...'
              : field.filled ?
                'Reupload default Resume'
              : 'Upload default Resume'
            : 'Go to Upload'}
          </button>
          <UploadState
            field={field}
            state={uploadState}
            isResumeUpload={isResumeUpload}
          />
        </div>
      : null}
    </article>
  );
}

function UploadState({
  field,
  state,
  isResumeUpload,
}: {
  field: FormFieldObservation;
  state?: UploadSyncState;
  isResumeUpload: boolean;
}) {
  const phase =
    state?.phase ||
    (field.upload?.state === 'ready' ? 'confirmed'
    : field.upload?.state === 'rejected' ? 'failed'
    : 'idle');
  const message =
    state?.message ||
    (field.upload?.state === 'ready' ?
      field.upload.filename ?
        `Comfirm: ${field.upload.filename}`
      : 'Comfirm: file is ready.'
    : field.upload?.state === 'rejected' ?
      field.upload.detail || 'The website rejected the file.'
    : isResumeUpload ? 'Reading default Resume from Jobby and uploading...'
    : 'Please select a file on the webpage.');

  return (
    <>
      <p className={`form-upload-status form-upload-status--${phase}`}>
        {message}
      </p>
      <details className='form-upload-debug'>
        <summary>Upload diagnostic</summary>
        <dl>
          <div>
            <dt>Website status</dt>
            <dd>{field.upload?.state || 'unknown'}</dd>
          </div>
          <div>
            <dt>Field</dt>
            <dd>{field.key}</dd>
          </div>
          {field.upload?.filename && (
            <div>
              <dt>File</dt>
              <dd>{field.upload.filename}</dd>
            </div>
          )}
          {state && (
            <div>
              <dt>Sync</dt>
              <dd>{state.phase}</dd>
            </div>
          )}
          {state && (
            <div>
              <dt>Updated</dt>
              <dd>{new Date(state.updatedAt).toLocaleTimeString()}</dd>
            </div>
          )}
        </dl>
      </details>
    </>
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
