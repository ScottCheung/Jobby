/** @format */

'use client';

import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { Check, Play, Plus, Trash2, X } from 'lucide-react';
import { api } from '@/lib/api';
import testFieldsSeed from './test-fields.json';
import type {
  FormAutofillTestField,
  FormAutofillTestResponse,
  FormAutofillTrace,
} from '@/lib/types';

const QUESTION_TYPES = [
  'text',
  'number',
  'select',
  'radio',
  'textarea',
  'checkbox',
  'email',
  'tel',
  'url',
  'date',
  'file',
] as const;

type TestFieldType = (typeof QUESTION_TYPES)[number];
type Option = { label: string; value: string };

const TYPE_LABELS: Record<TestFieldType, string> = {
  text: 'Text',
  number: 'Number',
  select: 'Select',
  radio: 'Radio',
  textarea: 'Long text',
  checkbox: 'Checkbox',
  email: 'Email',
  tel: 'Phone',
  url: 'URL',
  date: 'Date',
  file: 'File',
};

const DEFAULT_OPTIONS: Option[] = [
  { label: 'Yes', value: 'Yes' },
  { label: 'No', value: 'No' },
];

const STORAGE_KEY = 'jobby:test-autofill:active-questions';

type TestField = FormAutofillTestField & {
  group: string;
  groupId: string;
};

type JsonQuestion = string | {
  group?: string;
  label: string;
  type?: string;
  required?: boolean;
  options?: Option[];
};

type JsonGroup = {
  id: string;
  label: string;
  description?: string;
  questions: JsonQuestion[];
};

type TestConfig = {
  version?: number;
  groups: JsonGroup[];
  activeQuestions?: JsonQuestion[];
};

type QuestionGroup = {
  id: string;
  label: string;
  description?: string;
  cases: TestField[];
};

type QuestionDraft = {
  label: string;
  group: string;
  type: TestFieldType;
  required: boolean;
  options: Option[];
};

function isQuestionType(value: unknown): value is TestFieldType {
  return typeof value === 'string' && QUESTION_TYPES.includes(value as TestFieldType);
}

function fieldTypeFor(label: string): TestFieldType {
  const normalized = label.toLowerCase();
  if (/(upload|photo|transcript|work sample|cover letter|cv|resume)/.test(normalized)) return 'file';
  if (/(email|e-mail)/.test(normalized)) return 'email';
  if (/(phone|telephone|contact number|mobile|cell)/.test(normalized)) return 'tel';
  if (/(date|expiry|available from|graduation)/.test(normalized)) return 'date';
  if (/(salary|compensation|rate|gpa|percentage|years|age|number|code|extension|postcode|zip|hours|count|size|notice period)/.test(normalized)) return 'number';
  if (/^(can|are|do|will|would|is|have you|do you now)|authorized|sponsorship|permanent residency|own a vehicle|work weekends|night shifts|overtime|right to work|driver'?s licence|white card|police check|working with children/.test(normalized)) return 'radio';
  return 'text';
}

function cleanOptions(type: TestFieldType, options?: Option[]): Option[] {
  if (type !== 'select' && type !== 'radio') return [];
  const cleaned = (Array.isArray(options) ? options : [])
    .map((option) => ({
      label: String(option?.label || '').trim(),
      value: String(option?.value || option?.label || '').trim(),
    }))
    .filter((option) => option.label && option.value);
  return cleaned.length ? cleaned : DEFAULT_OPTIONS.map((option) => ({ ...option }));
}

function questionObject(item: JsonQuestion): Exclude<JsonQuestion, string> {
  if (typeof item === 'string') return { label: item };
  if (!item || typeof item !== 'object' || typeof item.label !== 'string') return { label: '' };
  return item;
}

function makeField(
  item: JsonQuestion,
  key: string,
  group: string,
  groupId: string,
): TestField {
  const question = questionObject(item);
  const type = isQuestionType(question.type) ? question.type : fieldTypeFor(question.label);
  return {
    key,
    label: question.label.trim(),
    type,
    required: Boolean(question.required),
    options: cleanOptions(type, question.options),
    group,
    groupId,
  };
}

function buildGroups(config: TestConfig): QuestionGroup[] {
  if (!Array.isArray(config.groups)) return [];
  return config.groups
    .filter((group) => group && typeof group.label === 'string' && Array.isArray(group.questions))
    .map((group, groupIndex) => {
      const id = String(group.id || `group-${groupIndex}`);
      return {
        id,
        label: group.label.trim() || `Group ${groupIndex + 1}`,
        description: group.description,
        cases: group.questions
          .map((item, questionIndex) => makeField(item, `${id}-${questionIndex}`, group.label, id))
          .filter((field) => field.label),
      };
    })
    .filter((group) => group.cases.length > 0);
}

const seedGroups = buildGroups(testFieldsSeed as TestConfig);

function firstCase(): TestField {
  return seedGroups[0]?.cases[0] || makeField({ label: 'First name', type: 'text' }, 'fallback-first-name', 'Custom', 'custom');
}

function activeFields(config: TestConfig): TestField[] {
  const configGroups = buildGroups(config);
  const allCases = configGroups.flatMap((group) => group.cases);
  const activeQuestions = config.activeQuestions;
  if (!Array.isArray(activeQuestions)) return allCases.length ? allCases : [firstCase()];
  if (!activeQuestions.length) return [];

  return activeQuestions
    .map((item, index) => {
      const question = questionObject(item);
      const groupLabel = String(question.group || 'Custom').trim() || 'Custom';
      const group = configGroups.find((candidate) => candidate.label.toLowerCase() === groupLabel.toLowerCase());
      const groupId = group?.id || 'custom';
      return makeField(item, `saved-${index}-${question.label.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40) || 'question'}`, groupLabel, groupId);
    })
    .filter((field) => field.label);
}

function fieldIdentity(field: Pick<TestField, 'group' | 'label'>): string {
  return `${field.group.trim().toLowerCase()}::${field.label.trim().replace(/\s+/g, ' ').toLowerCase()}`;
}

function serializeField(field: TestField): Exclude<JsonQuestion, string> {
  const result: Exclude<JsonQuestion, string> = {
    label: field.label,
    group: field.group,
    type: field.type,
    required: field.required,
  };
  if (field.type === 'select' || field.type === 'radio') result.options = field.options;
  return result;
}

function typeLabel(type: string): string {
  return isQuestionType(type) ? TYPE_LABELS[type] : type;
}

function TestControl({
  field,
  controlId,
  value,
  onChange,
}: {
  field: TestField;
  controlId: string;
  value: string | boolean | undefined;
  onChange: (value: string | boolean) => void;
}) {
  const className = 'w-full border border-border bg-background px-3 text-sm text-ink-primary outline-none transition focus:border-primary focus:ring-1 focus:ring-primary/20';
  if (field.type === 'textarea') {
    return <textarea id={controlId} name={controlId} aria-label={field.label} value={typeof value === 'string' ? value : ''} onChange={(event) => onChange(event.target.value)} className={`${className} min-h-20 py-2`} />;
  }
  if (field.type === 'select') {
    return <select id={controlId} name={controlId} aria-label={field.label} value={typeof value === 'string' ? value : ''} onChange={(event) => onChange(event.target.value)} className={`${className} h-10`}>
      <option value=''>Select an answer</option>
      {field.options.map((option, index) => <option key={`${option.value}-${index}`} value={option.value}>{option.label}</option>)}
    </select>;
  }
  if (field.type === 'radio') {
    return <div className='flex min-h-10 flex-wrap items-center gap-x-4 gap-y-2' role='radiogroup' aria-label={field.label}>
      {field.options.map((option, index) => {
        const optionId = `${controlId}-${index}`;
        return <label key={`${option.value}-${index}`} htmlFor={optionId} className='inline-flex items-center gap-2 text-sm text-ink-primary'>
          <input id={optionId} type='radio' name={field.key} value={option.value} aria-label={option.label} checked={value === option.value} onChange={() => onChange(option.value)} />
          {option.label}
        </label>;
      })}
    </div>;
  }
  if (field.type === 'checkbox') {
    return <label className='inline-flex min-h-10 items-center gap-2 text-sm text-ink-primary'>
      <input id={controlId} name={controlId} type='checkbox' value='true' aria-label={field.label} checked={value === true} onChange={(event) => onChange(event.target.checked)} />
      Yes
    </label>;
  }
  if (field.type === 'file') {
    return <input id={controlId} name={controlId} type='file' aria-label={field.label} onChange={() => undefined} className={`${className} h-10 py-1.5`} />;
  }
  return <input id={controlId} name={controlId} aria-label={field.label} type={field.type} value={typeof value === 'string' ? value : ''} onChange={(event) => onChange(event.target.value)} className={`${className} h-10`} />;
}

function sourceLabel(source: string): string {
  return {
    profile: 'Profile',
    core_profile: 'Profile',
    answer_library: 'AI Memory',
    observation: 'Observed answer',
    system_rule: 'System rule',
    user_rule: 'Your rule',
    none: 'No saved answer',
  }[source] || source;
}

function traceStatus(trace: FormAutofillTrace | undefined): string {
  if (!trace) return '';
  if (trace.status === 'filled') return 'Filled';
  if (trace.intent_key) return 'Recognized, no answer';
  return 'Not recognized';
}

function AddQuestion({
  groups,
  disabled,
  onAdd,
}: {
  groups: QuestionGroup[];
  disabled: boolean;
  onAdd: (draft: QuestionDraft) => boolean;
}) {
  const [label, setLabel] = useState('');
  const [group, setGroup] = useState('custom');
  const [customGroup, setCustomGroup] = useState('Custom');
  const [type, setType] = useState<TestFieldType>('text');
  const [required, setRequired] = useState(false);
  const [options, setOptions] = useState<Option[]>(() => DEFAULT_OPTIONS.map((option) => ({ ...option })));
  const isChoice = type === 'select' || type === 'radio';

  const handleTypeChange = (nextType: TestFieldType) => {
    setType(nextType);
    if ((nextType === 'select' || nextType === 'radio') && options.length === 0) {
      setOptions(DEFAULT_OPTIONS.map((option) => ({ ...option })));
    }
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmedLabel = label.trim();
    if (!trimmedLabel) return;
    const result = onAdd({
      label: trimmedLabel,
      group: group === 'custom' ? (customGroup.trim() || 'Custom') : groups.find((item) => item.id === group)?.label || 'Custom',
      type,
      required,
      options: isChoice ? cleanOptions(type, options) : [],
    });
    if (!result) return;
    setLabel('');
    setRequired(false);
  };

  return <section className='border border-border/70 bg-panel'>
    <div className='border-b border-border/60 px-4 py-3'>
      <h2 className='text-sm font-semibold text-ink-primary'>Add your own question</h2>
      <p className='mt-0.5 text-xs text-ink-secondary'>Create a control that matches a real Australian application form.</p>
    </div>
    <form onSubmit={handleSubmit} className='grid gap-4 p-4'>
      <div className='grid gap-3 md:grid-cols-[minmax(0,1fr)_10rem_10rem]'>
        <label className='grid gap-1 text-xs font-medium text-ink-secondary'>Question label
          <input value={label} onChange={(event) => setLabel(event.target.value)} placeholder='For example: Do you hold a current First Aid certificate?' className='h-10 border border-border bg-background px-3 text-sm text-ink-primary outline-none focus:border-primary' disabled={disabled} />
        </label>
        <label className='grid gap-1 text-xs font-medium text-ink-secondary'>Group
          <select value={group} onChange={(event) => setGroup(event.target.value)} className='h-10 border border-border bg-background px-3 text-sm text-ink-primary outline-none focus:border-primary' disabled={disabled}>
            <option value='custom'>Custom group</option>
            {groups.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
          </select>
        </label>
        <label className='grid gap-1 text-xs font-medium text-ink-secondary'>Field type
          <select value={type} onChange={(event) => handleTypeChange(event.target.value as TestFieldType)} className='h-10 border border-border bg-background px-3 text-sm text-ink-primary outline-none focus:border-primary' disabled={disabled}>
            {QUESTION_TYPES.map((item) => <option key={item} value={item}>{TYPE_LABELS[item]}</option>)}
          </select>
        </label>
      </div>
      {group === 'custom' && <label className='grid max-w-md gap-1 text-xs font-medium text-ink-secondary'>Group name
        <input value={customGroup} onChange={(event) => setCustomGroup(event.target.value)} placeholder='Custom' className='h-10 border border-border bg-background px-3 text-sm text-ink-primary outline-none focus:border-primary' disabled={disabled} />
      </label>}
      {isChoice && <div className='grid gap-2'>
        <div className='flex items-center justify-between gap-3'>
          <span className='text-xs font-medium text-ink-secondary'>Answer options</span>
          <button type='button' onClick={() => setOptions((current) => [...current, { label: '', value: '' }])} className='inline-flex items-center gap-1 text-xs font-medium text-primary hover:text-primary/80' disabled={disabled}><Plus className='size-3.5' />Add option</button>
        </div>
        <div className='grid gap-2'>
          {options.map((option, index) => <div key={`draft-option-${index}`} className='grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]'>
            <input value={option.label} onChange={(event) => setOptions((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, label: event.target.value } : item))} aria-label={`Option ${index + 1} label`} placeholder='Display label' className='h-9 border border-border bg-background px-3 text-sm text-ink-primary outline-none focus:border-primary' disabled={disabled} />
            <input value={option.value} onChange={(event) => setOptions((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, value: event.target.value } : item))} aria-label={`Option ${index + 1} value`} placeholder='Submitted value' className='h-9 border border-border bg-background px-3 text-sm text-ink-primary outline-none focus:border-primary' disabled={disabled} />
            <button type='button' onClick={() => setOptions((current) => current.filter((_, itemIndex) => itemIndex !== index))} title='Remove option' aria-label={`Remove option ${index + 1}`} className='inline-flex size-9 items-center justify-center text-ink-secondary hover:text-red-600 disabled:opacity-40' disabled={disabled || options.length <= 2}><X className='size-4' /></button>
          </div>)}
        </div>
      </div>}
      <div className='flex flex-wrap items-center justify-between gap-3'>
        <label className='inline-flex items-center gap-2 text-sm text-ink-primary'><input type='checkbox' checked={required} onChange={(event) => setRequired(event.target.checked)} disabled={disabled} />Required question</label>
        <button type='submit' disabled={disabled || !label.trim()} className='inline-flex h-10 items-center gap-2 bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-50'><Plus className='size-4' />Add question</button>
      </div>
    </form>
  </section>;
}

export default function AutofillTestPage() {
  const [fields, setFields] = useState<TestField[]>(() => activeFields(testFieldsSeed as TestConfig));
  const [availableGroups, setAvailableGroups] = useState<QuestionGroup[]>(seedGroups);
  const [values, setValues] = useState<Record<string, string | boolean>>({});
  const [traces, setTraces] = useState<FormAutofillTrace[]>([]);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [running, setRunning] = useState(false);
  const [saving, setSaving] = useState(false);
  const [librarySearch, setLibrarySearch] = useState('');
  const saveVersion = useRef(0);

  useEffect(() => {
    let cancelled = false;
    void fetch('/api/test-autofill', { cache: 'no-store' })
      .then(async (response) => {
        if (!response.ok) throw new Error('Could not read the test question library.');
        return response.json() as Promise<TestConfig>;
      })
      .then((config) => {
        if (cancelled) return;
        const nextGroups = buildGroups(config);
        setAvailableGroups(nextGroups.length ? nextGroups : seedGroups);
        let nextFields = activeFields(config);
        try {
          const localQuestions = window.localStorage.getItem(STORAGE_KEY);
          if (localQuestions) {
            const parsed: unknown = JSON.parse(localQuestions);
            if (Array.isArray(parsed)) nextFields = activeFields({ ...config, activeQuestions: parsed as JsonQuestion[] });
          }
        } catch {
          // A malformed local override should not prevent the server library from loading.
        }
        setFields(nextFields);
      })
      .catch((cause: unknown) => {
        if (!cancelled) setError(cause instanceof Error ? cause.message : 'Could not read the test question library.');
      });
    return () => { cancelled = true; };
  }, []);

  const traceByKey = new Map(traces.map((trace) => [trace.key, trace]));
  const activeIdentities = useMemo(() => new Set(fields.map(fieldIdentity)), [fields]);
  const filteredGroups = useMemo(() => {
    const term = librarySearch.trim().toLowerCase();
    if (!term) return availableGroups;
    return availableGroups
      .map((group) => ({ ...group, cases: group.cases.filter((field) => field.label.toLowerCase().includes(term)) }))
      .filter((group) => group.cases.length);
  }, [availableGroups, librarySearch]);
  const typeCounts = useMemo(() => QUESTION_TYPES
    .map((type) => ({ type, count: fields.filter((field) => field.type === type).length }))
    .filter((item) => item.count), [fields]);

  const persistFields = async (next: TestField[]) => {
    const version = ++saveVersion.current;
    setFields(next);
    setTraces([]);
    setNotice('');
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next.map(serializeField)));
    } catch {
      // The API persistence below remains available when storage is blocked.
    }
    setSaving(true);
    try {
      const response = await fetch('/api/test-autofill', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ activeQuestions: next.map(serializeField) }),
      });
      if (!response.ok) throw new Error('server persistence unavailable');
      if (version === saveVersion.current) setNotice('Saved for the next test run.');
    } catch {
      if (version === saveVersion.current) setNotice('Saved in this browser.');
    } finally {
      if (version === saveVersion.current) setSaving(false);
    }
  };

  const addCases = (cases: TestField[]) => {
    const additions = cases.filter((item) => !activeIdentities.has(fieldIdentity(item)));
    if (!additions.length) return;
    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    void persistFields([...fields, ...additions.map((item, index) => ({ ...item, key: `${item.key}-${suffix}-${index}` }))]);
  };

  const addCustom = (draft: QuestionDraft): boolean => {
    const identity = fieldIdentity({ group: draft.group, label: draft.label });
    if (fields.some((field) => fieldIdentity(field) === identity)) {
      setError('A question with the same label already exists in that group.');
      return false;
    }
    setError('');
    const key = `custom-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    void persistFields([...fields, {
      key,
      label: draft.label,
      type: draft.type,
      required: draft.required,
      options: cleanOptions(draft.type, draft.options),
      group: draft.group,
      groupId: 'custom',
    }]);
    return true;
  };

  const removeField = (key: string) => {
    const next = fields.filter((field) => field.key !== key);
    setValues((current) => {
      const copy = { ...current };
      delete copy[key];
      return copy;
    });
    void persistFields(next);
  };

  const clearFields = () => {
    if (typeof window !== 'undefined' && !window.confirm('Clear every question from this test form?')) return;
    setValues({});
    void persistFields([]);
  };

  const runAutofill = async () => {
    setRunning(true);
    setError('');
    setNotice('');
    try {
      const response: FormAutofillTestResponse = await api.testFormAutofill({ platform: 'generic', fields });
      setTraces(response.traces);
      setValues((current) => ({
        ...current,
        ...Object.fromEntries(response.instructions.map((instruction) => [instruction.target.key, instruction.value])),
      }));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not run Autofill.');
    } finally {
      setRunning(false);
    }
  };

  return <main className='mx-auto flex w-full max-w-6xl flex-col gap-5 pb-10'>
    <header className='flex flex-col gap-4 border-b border-border/60 pb-4 sm:flex-row sm:items-end sm:justify-between'>
      <div>
        <h1 className='title-page text-ink-primary'>Autofill Test Form</h1>
        <p className='mt-1 text-sm text-ink-secondary'>Build a realistic Australian job application form and check which saved answers Autofill can use.</p>
      </div>
      <div className='flex shrink-0 items-center gap-2'>
        <button type='button' onClick={clearFields} disabled={!fields.length || saving} className='inline-flex h-10 items-center gap-2 border border-border px-3 text-sm text-ink-secondary hover:border-red-300 hover:text-red-600 disabled:opacity-50' title='Clear all questions'>
          <Trash2 className='size-4' />Clear
        </button>
        <button type='button' onClick={() => void runAutofill()} disabled={running || !fields.length || saving} className='inline-flex h-10 items-center gap-2 bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-50'>
          <Play className='size-4' />
          {running ? 'Filling...' : 'Run Autofill'}
        </button>
      </div>
    </header>

    {error && <p role='alert' className='text-sm text-red-600'>{error}</p>}
    {notice && <p role='status' className='inline-flex items-center gap-1.5 text-xs text-emerald-600'><Check className='size-3.5' />{notice}</p>}

    <section className='flex flex-wrap items-center gap-x-4 gap-y-2 border-y border-border/60 py-3'>
      <span className='text-sm font-semibold text-ink-primary'>{fields.length} questions</span>
      {typeCounts.map(({ type, count }) => <span key={type} className='text-xs text-ink-secondary'>{count} {typeLabel(type).toLowerCase()}</span>)}
      {saving && <span className='text-xs text-ink-secondary'>Saving...</span>}
    </section>

    <section className='border border-border/70 bg-panel'>
      <div className='flex flex-col gap-3 border-b border-border/60 px-4 py-3 sm:flex-row sm:items-center sm:justify-between'>
        <div>
          <h2 className='text-sm font-semibold text-ink-primary'>Question library</h2>
          <p className='mt-0.5 text-xs text-ink-secondary'>Add a whole category or pick individual sample questions.</p>
        </div>
        <div className='flex items-center gap-2'>
          <input value={librarySearch} onChange={(event) => setLibrarySearch(event.target.value)} placeholder='Search samples' aria-label='Search sample questions' className='h-9 w-full border border-border bg-background px-3 text-sm text-ink-primary outline-none focus:border-primary sm:w-52' />
          <button type='button' onClick={() => addCases(availableGroups.flatMap((group) => group.cases))} disabled={!availableGroups.some((group) => group.cases.some((item) => !activeIdentities.has(fieldIdentity(item)))) || saving} className='inline-flex h-9 shrink-0 items-center gap-1.5 border border-primary/40 bg-primary/5 px-3 text-xs font-medium text-primary hover:bg-primary/10 disabled:opacity-50'><Plus className='size-3.5' />Add all</button>
        </div>
      </div>
      <div className='divide-y divide-border/50'>
        {filteredGroups.map((group) => {
          const remaining = group.cases.filter((item) => !activeIdentities.has(fieldIdentity(item)));
          return <div key={group.id} className='flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-start sm:justify-between'>
            <div className='min-w-0'>
              <h3 className='text-sm font-medium text-ink-primary'>{group.label}</h3>
              <p className='mt-0.5 text-xs text-ink-secondary'>{group.description || `${group.cases.length} sample questions`}</p>
              <div className='mt-2 flex flex-wrap gap-x-2 gap-y-1'>
                {group.cases.slice(0, 6).map((item) => <span key={item.key} className='text-[11px] text-ink-secondary'>{item.label}</span>)}
                {group.cases.length > 6 && <span className='text-[11px] text-ink-secondary'>+{group.cases.length - 6} more</span>}
              </div>
            </div>
            <button type='button' onClick={() => addCases(remaining)} disabled={!remaining.length || saving} className='inline-flex h-8 shrink-0 items-center justify-center gap-1.5 border border-border px-3 text-xs text-ink-primary hover:bg-background-secondary disabled:opacity-50'><Plus className='size-3.5' />{remaining.length ? `Add ${remaining.length}` : 'Added'}</button>
          </div>;
        })}
        {!filteredGroups.length && <p className='px-4 py-8 text-center text-sm text-ink-secondary'>No sample questions match that search.</p>}
      </div>
    </section>

    <form aria-label='Autofill test form' onSubmit={(event) => event.preventDefault()}>
      <section className='border border-border/70 bg-panel'>
        <div className='border-b border-border/60 px-4 py-3'>
          <h2 className='text-sm font-semibold text-ink-primary'>Test form</h2>
          <p className='mt-0.5 text-xs text-ink-secondary'>Edit the controls below, then run Autofill to see the match and source for each answer.</p>
        </div>
        <div className='divide-y divide-border/50'>
          {fields.map((field) => {
            const trace = traceByKey.get(field.key);
            const status = traceStatus(trace);
            const controlId = `test-field-${field.key}`;
            return <div key={field.key} className='grid gap-3 px-4 py-4 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,1fr)_minmax(0,1fr)_auto] lg:items-start'>
              <div className='min-w-0'>
                <div className='flex flex-wrap items-center gap-2'>
                  <p className='text-[10px] font-semibold uppercase tracking-wide text-ink-secondary'>{field.group}</p>
                  <span className='border border-border/70 px-1.5 py-0.5 text-[10px] text-ink-secondary'>{typeLabel(field.type)}</span>
                </div>
                {field.type === 'radio' ? <p className='mt-1 text-sm font-medium text-ink-primary'>{field.label}{field.required && <span className='ml-1 text-red-600'>*</span>}</p> : <label htmlFor={controlId} className='mt-1 block text-sm font-medium text-ink-primary'>{field.label}{field.required && <span className='ml-1 text-red-600'>*</span>}</label>}
              </div>
              {field.type === 'radio' ? <fieldset><legend className='sr-only'>{field.label}</legend><TestControl field={field} controlId={controlId} value={values[field.key]} onChange={(value) => setValues((current) => ({ ...current, [field.key]: value }))} /></fieldset> : <TestControl field={field} controlId={controlId} value={values[field.key]} onChange={(value) => setValues((current) => ({ ...current, [field.key]: value }))} />}
              <div className='min-w-0 text-xs text-ink-secondary'>
                {status && <p className={trace?.status === 'filled' ? 'font-medium text-emerald-600' : 'font-medium text-amber-600'}>{status}</p>}
                {trace?.intent_key && <p className='mt-1 break-words'>Intent: <code className='text-primary'>{trace.intent_key}</code></p>}
                {trace?.source && <p className='mt-1'>Source: {sourceLabel(trace.source)}</p>}
                {trace?.reason && <p className='mt-1 text-amber-700'>{trace.reason}</p>}
              </div>
              <button type='button' title={`Remove ${field.label}`} aria-label={`Remove ${field.label}`} onClick={() => removeField(field.key)} disabled={saving} className='inline-flex size-8 items-center justify-center text-ink-secondary hover:text-red-600 disabled:opacity-50'><Trash2 className='size-4' /></button>
            </div>;
          })}
          {!fields.length && <p className='px-4 py-10 text-center text-sm text-ink-secondary'>Add a question from the library or create your own below.</p>}
        </div>
      </section>
    </form>

    <AddQuestion groups={availableGroups} disabled={saving} onAdd={addCustom} />
  </main>;
}
