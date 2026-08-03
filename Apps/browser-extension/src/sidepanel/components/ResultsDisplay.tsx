/** @format */

import { useEffect, useRef, useState } from 'react';
import type {
  FormFieldObservation,
  FormInspection,
} from '../../shared/contracts/form-inspection';
import type { UploadSyncState } from '../hooks/useInspection';

interface ResultsDisplayProps {
  latestForm: FormInspection | null;
  isInspectingForm: boolean;
  onFocusField: (field: FormFieldObservation) => Promise<void>;
  onUploadDefaultResume: (field: FormFieldObservation) => Promise<void>;
  onEditField: (
    field: FormFieldObservation,
    value: string | boolean,
  ) => Promise<void>;
  uploadStates: Record<string, UploadSyncState>;
}

export function ResultsDisplay({
  latestForm,
  isInspectingForm,
  onFocusField,
  onUploadDefaultResume,
  onEditField,
  uploadStates,
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
          {latestForm.kind === 'application_form' ?
            <>
              <p className='form-summary'>
                <strong>字段：</strong>
                {latestForm.fields.length}
                {latestForm.hasSubmitAction ?
                  ` · ${latestForm.submitLabel || '可提交'}`
                : ''}
              </p>
              <FormFields
                fields={formFields}
                onFocusField={onFocusField}
                onUploadDefaultResume={onUploadDefaultResume}
                onEditField={onEditField}
                uploadStates={uploadStates}
              />
            </>
          : <FormFields
              fields={formFields}
              onFocusField={onFocusField}
              onUploadDefaultResume={onUploadDefaultResume}
              onEditField={onEditField}
              uploadStates={uploadStates}
            />
          }
        </div>
      : null}
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
  onUploadDefaultResume: (field: FormFieldObservation) => Promise<void>;
  onEditField: (
    field: FormFieldObservation,
    value: string | boolean,
  ) => Promise<void>;
  uploadStates: Record<string, UploadSyncState>;
}

function FormFields({
  fields,
  onFocusField,
  onUploadDefaultResume,
  onEditField,
  uploadStates,
}: FormFieldsProps) {
  return (
    <div className='form-fields'>
      <p className='form-summary'>
        <strong>页面输入项：</strong>
        {fields.length}
      </p>
      {fields.map((field) => (
        <FormFieldRow
          key={`${field.key}:${field.id || field.name || ''}`}
          field={field}
          onFocusField={onFocusField}
          onUploadDefaultResume={onUploadDefaultResume}
          onEditField={onEditField}
          uploadState={uploadStates[field.key]}
        />
      ))}
    </div>
  );
}

interface FormFieldRowProps {
  field: FormFieldObservation;
  onFocusField: (field: FormFieldObservation) => Promise<void>;
  onUploadDefaultResume: (field: FormFieldObservation) => Promise<void>;
  onEditField: (
    field: FormFieldObservation,
    value: string | boolean,
  ) => Promise<void>;
  uploadState?: UploadSyncState;
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
  if (field.type === 'checkbox') return field.filled ? '已勾选' : '未勾选';
  if (field.type === 'file') return field.upload?.filename || (field.filled ? '已上传' : '未上传');
  const value = field.currentValue || '';
  return field.options.find((option) => option.value === value)?.label || value || '未填写';
}

function FormFieldRow({
  field,
  onFocusField,
  onUploadDefaultResume,
  onEditField,
  uploadState,
}: FormFieldRowProps) {
  const [draft, setDraft] = useState(() => formValue(field));
  const [editing, setEditing] = useState(false);
  const timer = useRef<number | undefined>(undefined);
  // Track the most recent value we've dispatched to the page so we don't
  // overwrite the user's in-progress input when the inspection poll fires
  // before the page has accepted the change.
  const pendingValue = useRef<string | boolean | undefined>(undefined);
  const editable =
    !field.sensitive && !['file', 'password', 'unknown'].includes(field.type);
  const isResumeUpload =
    field.type === 'file' &&
    /resume|curriculum vitae|\bcv\b/i.test(field.label);
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
    <article className='form-field-row'>
      <div className='form-field-heading'>
        <button
          type='button'
          className='form-field-focus'
          title='定位到网页中的字段'
          aria-label={`定位 ${field.label}`}
          onClick={() => void onFocusField(field)}
        >
          <span className='form-field-label'>
            {field.label}
            {field.required && <span className='text-red-500'> *</span>}
          </span>
          <span className={`form-field-value ${field.filled ? '' : 'is-empty'}`}>
            {currentValue}
          </span>
        </button>
        <span
          className={`form-field-status ${field.filled ? 'is-filled' : ''}`}
          aria-label={field.filled ? '已填写' : '未填写'}
          title={field.filled ? '已填写' : '未填写'}
        />
        {editable && (
          <button
            type='button'
            className='form-field-edit'
            onClick={editing ? finishEditing : () => setEditing(true)}
          >
            {editing ? '完成' : '编辑'}
          </button>
        )}
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
                '正在上传默认简历'
              : field.filled ?
                '重新上传默认简历'
              : '自动上传默认简历'
            : '前往网页上传'}
          </button>
          <button type='button' onClick={() => void onFocusField(field)}>
            前往网页管理
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
        `网页已确认：${field.upload.filename}`
      : '网页已确认文件已就绪。'
    : field.upload?.state === 'rejected' ?
      field.upload.detail || '网页拒绝了该文件。'
    : isResumeUpload ? '从 Jobby 简历库读取默认简历并上传。'
    : '请在网页中选择要上传的文件。');

  return (
    <>
      <p className={`form-upload-status form-upload-status--${phase}`}>
        {message}
      </p>
      <details className='form-upload-debug'>
        <summary>上传诊断</summary>
        <dl>
          <div>
            <dt>网页状态</dt>
            <dd>{field.upload?.state || 'unknown'}</dd>
          </div>
          <div>
            <dt>字段</dt>
            <dd>{field.key}</dd>
          </div>
          {field.upload?.filename && (
            <div>
              <dt>文件</dt>
              <dd>{field.upload.filename}</dd>
            </div>
          )}
          {state && (
            <div>
              <dt>同步</dt>
              <dd>{state.phase}</dd>
            </div>
          )}
          {state && (
            <div>
              <dt>更新</dt>
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
        已勾选
      </label>
    );
  }

  if (field.type === 'select') {
    return (
      <select
        className='form-field-input'
        value={draft}
        onFocus={onFocus}
        onChange={(event) => onValueChange(event.target.value)}
      >
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
