/** @format */

'use client';

import { useEffect, useState } from 'react';
import { Play, Plus, Trash2 } from 'lucide-react';
import { api } from '@/lib/api';
import testFieldsSeed from './test-fields.json';
import type {
  FormAutofillTestField,
  FormAutofillTestResponse,
  FormAutofillTrace,
} from '@/lib/types';

const YES_NO = [
  { label: 'Yes', value: 'Yes' },
  { label: 'No', value: 'No' },
];

type TestField = FormAutofillTestField & { group: string };
type TestTemplate = Omit<TestField, 'key'> & { key: string };

type JsonQuestion = string | {
  group?: string;
  label: string;
  type?: string;
  required?: boolean;
};
type JsonGroup = { id: string; label: string; questions: string[] };
type TestConfig = {
  groups: JsonGroup[];
  activeQuestions?: JsonQuestion[];
};

function fieldTypeFor(label: string): string {
  const normalized = label.toLowerCase();
  if (/(upload|photo|transcript|work sample|cover letter|cv)/.test(normalized)) return 'file';
  if (/(email)/.test(normalized)) return 'email';
  if (/(phone|telephone|contact number|mobile|cell)/.test(normalized)) return 'tel';
  if (/(date|expiry|available from|graduation)/.test(normalized)) return 'date';
  if (/(salary|compensation|rate|gpa|percentage|years|age|number|code|extension|\bid\b)/.test(normalized)) return 'number';
  if (/^(can|are|do|will|would|is|have you|do you now)|authorized|sponsorship|permanent residency|own a vehicle|work weekends|night shifts|overtime/.test(normalized)) return 'radio';
  return 'text';
}

function buildGroups(config: TestConfig): Array<{ id: string; label: string; cases: TestTemplate[] }> {
  return config.groups.map((group) => ({
  id: group.id,
  label: group.label,
  cases: group.questions.map((label, index) => {
    const type = fieldTypeFor(label);
    return {
      key: `${group.id}-${index}`,
      label,
      type,
      required: false,
      options: type === 'radio' || type === 'select' ? YES_NO : [],
      group: group.label,
    };
  }),
  }));
}

const groups = buildGroups(testFieldsSeed as TestConfig);

const firstCase = (): TestField => ({ ...groups[0].cases[0] });

function activeFields(config: TestConfig): TestField[] {
  const configGroups = buildGroups(config);
  const allCases = configGroups.flatMap((group) => group.cases);
  const activeQuestions = config.activeQuestions;
  if (!Array.isArray(activeQuestions)) return [allCases[0] || firstCase()];
  if (!activeQuestions.length) return [];
  return activeQuestions.map((item, index) => {
    const question = typeof item === 'string' ? { label: item } : item;
    const group = question.group || 'Custom';
    const type = question.type || fieldTypeFor(question.label);
    return {
      key: `saved-${index}-${question.label.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40)}`,
      label: question.label,
      type,
      required: Boolean(question.required),
      options: type === 'radio' || type === 'select' ? YES_NO : [],
      group,
    };
  });
}

function cloneCases(cases: TestTemplate[]): TestField[] {
  const suffix = `-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  return cases.map((item) => ({ ...item, key: `${item.key}${suffix}` }));
}

function fieldIdentity(field: Pick<TestField, 'group' | 'label'>): string {
  return `${field.group.trim().toLowerCase()}::${field.label.trim().replace(/\s+/g, ' ').toLowerCase()}`;
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
  const className = 'w-full border border-border bg-background px-3 text-sm text-ink-primary outline-none focus:border-primary';
  if (field.type === 'textarea') {
    return <textarea id={controlId} name={controlId} aria-label={field.label} value={typeof value === 'string' ? value : ''} onChange={(event) => onChange(event.target.value)} className={`${className} min-h-20 py-2`} />;
  }
  if (field.type === 'select') {
    return <select id={controlId} name={controlId} aria-label={field.label} value={typeof value === 'string' ? value : ''} onChange={(event) => onChange(event.target.value)} className={`${className} h-10`}><option value=''>Select an answer</option>{field.options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select>;
  }
  if (field.type === 'radio') {
    return <div className='flex min-h-10 items-center gap-4' role='radiogroup' aria-label={field.label}>{field.options.map((option) => <label key={option.value} htmlFor={`${controlId}-${option.value.toLowerCase()}`} className='inline-flex items-center gap-2 text-sm text-ink-primary'><input id={`${controlId}-${option.value.toLowerCase()}`} type='radio' name={field.key} value={option.value} aria-label={option.label} checked={value === option.value} onChange={() => onChange(option.value)} />{option.label}</label>)}</div>;
  }
  if (field.type === 'checkbox') {
    return <label className='inline-flex min-h-10 items-center gap-2 text-sm text-ink-primary'><input id={controlId} name={controlId} type='checkbox' value='true' aria-label={field.label} checked={value === true} onChange={(event) => onChange(event.target.checked)} />Yes</label>;
  }
  if (field.type === 'file') {
    return <input id={controlId} name={controlId} type='file' aria-label={field.label} onChange={() => undefined} className={`${className} h-10 py-1.5`} />;
  }
  return <input id={controlId} name={controlId} aria-label={field.label} type={field.type === 'number' ? 'number' : field.type} value={typeof value === 'string' ? value : ''} onChange={(event) => onChange(event.target.value)} className={`${className} h-10`} />;
}

function sourceLabel(source: string): string {
  return { profile: 'Autofill Profile', answer_library: 'AI Memory', observation: 'Observed answer', none: 'No saved answer' }[source] || source;
}

function traceStatus(trace: FormAutofillTrace | undefined): string {
  if (!trace) return '';
  if (trace.status === 'filled') return 'Filled';
  if (trace.intent_key) return 'Recognized, no answer';
  return 'Not recognized';
}

export default function AutofillTestPage() {
  const [fields, setFields] = useState<TestField[]>([firstCase()]);
  const [availableGroups, setAvailableGroups] = useState(groups);
  const [values, setValues] = useState<Record<string, string | boolean>>({});
  const [traces, setTraces] = useState<FormAutofillTrace[]>([]);
  const [error, setError] = useState('');
  const [running, setRunning] = useState(false);

  useEffect(() => {
    void fetch('/api/test-autofill', { cache: 'no-store' })
      .then(async (response) => {
        if (!response.ok) throw new Error('Could not read test-fields.json.');
        return response.json() as Promise<TestConfig>;
      })
      .then((config) => {
        setAvailableGroups(buildGroups(config));
        setFields(activeFields(config));
      })
      .catch((cause: unknown) => setError(cause instanceof Error ? cause.message : 'Could not read test-fields.json.'));
  }, []);

  const traceByKey = new Map(traces.map((trace) => [trace.key, trace]));

  const saveFields = async (next: TestField[]) => {
    setFields(next);
    try {
      const response = await fetch('/api/test-autofill', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ activeQuestions: next.map((field) => ({ label: field.label, group: field.group, type: field.type, required: field.required })) }),
      });
      if (!response.ok) throw new Error('Could not save test-fields.json.');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not save test-fields.json.');
    }
  };

  const addCases = (cases: TestTemplate[]) => {
    const existing = new Set(fields.map(fieldIdentity));
    const additions = cases.filter((item) => !existing.has(fieldIdentity(item)));
    if (!additions.length) return;
    void saveFields([...fields, ...cloneCases(additions)]);
  };
  const addCustom = (label: string, type: string) => {
    const trimmed = label.trim();
    if (!trimmed) return;
    const customField = { group: 'Custom', label: trimmed };
    if (fields.some((field) => fieldIdentity(field) === fieldIdentity(customField))) return;
    void saveFields([...fields, {
      key: `custom-${Date.now()}`,
      label: trimmed,
      type,
      required: false,
      options: type === 'select' || type === 'radio' ? YES_NO : [],
      group: 'Custom',
    }]);
  };

  const runAutofill = async () => {
    setRunning(true);
    setError('');
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

  return (
    <main className='mx-auto flex w-full max-w-5xl flex-col gap-5 pb-10'>
      <header className='flex items-end justify-between gap-4 border-b border-border/60 pb-4'>
        <div>
          <h1 className='title-page text-ink-primary'>Autofill Test Form</h1>
          <p className='mt-1 text-sm text-ink-secondary'>Add real questions, then run Autofill against the current user data.</p>
        </div>
        <div className='flex items-center gap-2'>
          <button type='button' onClick={() => { if (window.confirm('Delete all questions from this test form?')) { void saveFields([]); setValues({}); setTraces([]); } }} disabled={!fields.length} className='inline-flex h-10 items-center gap-2 border border-red-300 px-3 text-sm text-red-600 hover:bg-red-50 disabled:opacity-50'>
            <Trash2 className='size-4' />
            Delete all
          </button>
          <button type='button' onClick={() => void runAutofill()} disabled={running || !fields.length} className='inline-flex h-10 items-center gap-2 bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-50'>
          <Play className='size-4' />
          {running ? 'Filling...' : 'Run Autofill'}
          </button>
        </div>
      </header>

      <section className='flex flex-wrap gap-2'>
        <button type='button' onClick={() => addCases(availableGroups.flatMap((group) => group.cases))} className='inline-flex h-9 items-center gap-1.5 border border-primary/40 bg-primary/5 px-3 text-xs text-primary hover:bg-primary/10'><Plus className='size-3.5' />All cases</button>
        {availableGroups.map((group) => <button key={group.id} type='button' onClick={() => addCases(group.cases)} className='inline-flex h-9 items-center gap-1.5 border border-border px-3 text-xs text-ink-secondary hover:bg-background-secondary hover:text-ink-primary'><Plus className='size-3.5' />{group.label}</button>)}
      </section>

      {error && <p className='text-sm text-red-600'>{error}</p>}

      <form aria-label='Autofill test form' onSubmit={(event) => event.preventDefault()}>
        <section className='border border-border/70 bg-panel'>
          <div className='border-b border-border/60 px-4 py-3'>
            <h2 className='text-sm font-semibold text-ink-primary'>Test form</h2>
            <p className='mt-0.5 text-xs text-ink-secondary'>The questions below are actual form controls. Added questions are saved in this browser.</p>
          </div>
          <div className='divide-y divide-border/50'>
            {fields.map((field) => {
              const trace = traceByKey.get(field.key);
              const status = traceStatus(trace);
              return <div key={field.key} className='grid gap-3 px-4 py-4 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,1fr)_minmax(0,1fr)_auto] lg:items-start'>
                <div>
                  <p className='text-[10px] font-semibold uppercase tracking-wide text-ink-secondary'>{field.group}</p>
                  {field.type === 'radio' ? <p className='mt-1 text-sm font-medium text-ink-primary'>{field.label}{field.required && <span className='ml-1 text-red-600'>*</span>}</p> : <label htmlFor={`test-field-${field.key}`} className='mt-1 block text-sm font-medium text-ink-primary'>{field.label}{field.required && <span className='ml-1 text-red-600'>*</span>}</label>}
                </div>
                {field.type === 'radio' ? <fieldset><legend className='sr-only'>{field.label}</legend><TestControl field={field} controlId={`test-field-${field.key}`} value={values[field.key]} onChange={(value) => setValues((current) => ({ ...current, [field.key]: value }))} /></fieldset> : <TestControl field={field} controlId={`test-field-${field.key}`} value={values[field.key]} onChange={(value) => setValues((current) => ({ ...current, [field.key]: value }))} />}
                <div className='min-w-0 text-xs text-ink-secondary'>
                  {status && <p className={trace?.status === 'filled' ? 'font-medium text-emerald-600' : 'font-medium text-amber-600'}>{status}</p>}
                  {trace?.intent_key && <p className='mt-1 break-words'>Intent: <code className='text-primary'>{trace.intent_key}</code></p>}
                  {trace?.source && <p className='mt-1'>Source: {sourceLabel(trace.source)}</p>}
                  {trace?.reason && <p className='mt-1 text-amber-700'>{trace.reason}</p>}
                </div>
                <button type='button' title='Delete this question' onClick={() => { if (window.confirm(`Delete "${field.label}" from this test form?`)) void saveFields(fields.filter((item) => item.key !== field.key)); }} className='p-1 text-ink-secondary hover:text-red-600'><Trash2 className='size-4' /></button>
              </div>;
            })}
            {!fields.length && <p className='px-4 py-10 text-center text-sm text-ink-secondary'>Add a question group to begin.</p>}
          </div>
        </section>
      </form>

      <AddQuestion onAdd={addCustom} />
    </main>
  );
}

function AddQuestion({ onAdd }: { onAdd: (label: string, type: string) => void }) {
  const [label, setLabel] = useState('');
  const [type, setType] = useState('text');
  return <section className='border border-border/70 bg-panel p-4'>
    <div className='mb-3 flex items-center gap-2'><Plus className='size-4 text-primary' /><h2 className='text-sm font-semibold text-ink-primary'>Add question</h2></div>
    <div className='grid gap-3 md:grid-cols-[minmax(0,1fr)_9rem_auto]'>
      <input value={label} onChange={(event) => setLabel(event.target.value)} placeholder='Question label, for example: First name' className='h-10 border border-border bg-background px-3 text-sm text-ink-primary outline-none focus:border-primary' />
      <select value={type} onChange={(event) => setType(event.target.value)} className='h-10 border border-border bg-background px-3 text-sm text-ink-primary outline-none focus:border-primary'>
        <option value='text'>Text</option><option value='number'>Number</option><option value='select'>Select (Yes / No)</option><option value='radio'>Radio (Yes / No)</option><option value='checkbox'>Checkbox</option><option value='textarea'>Textarea</option>
      </select>
      <button type='button' disabled={!label.trim()} onClick={() => { onAdd(label, type); setLabel(''); }} className='inline-flex h-10 items-center justify-center gap-2 border border-border px-4 text-sm text-ink-primary hover:bg-background-secondary disabled:opacity-50'><Plus className='size-4' />Add</button>
    </div>
  </section>;
}
