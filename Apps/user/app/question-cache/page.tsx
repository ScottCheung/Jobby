/** @format */

'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import {
  BriefcaseBusiness,
  Check,
  CircleAlert,
  CircleDollarSign,
  LibraryBig,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Trash2,
} from 'lucide-react';
import { api } from '@/lib/api';
import type { AutofillAnswer, FormAnswerObservation } from '@/lib/types';

type MemoryCategory = 'all' | 'work' | 'eligibility' | 'compensation';

const memoryDefinitions = {
  'employment.office_attendance': {
    label: 'Office attendance',
    description:
      'Your availability for office, hybrid, or commuting questions.',
    category: 'work' as const,
    icon: BriefcaseBusiness,
  },
  'employment.work_authorization': {
    label: 'Work authorization',
    description: 'Your answer to work-rights and authorization questions.',
    category: 'eligibility' as const,
    icon: ShieldCheck,
  },
  'employment.visa_sponsorship': {
    label: 'Visa sponsorship',
    description: 'Whether you need employer visa sponsorship.',
    category: 'eligibility' as const,
    icon: ShieldCheck,
  },
  'compensation.desired_base_salary': {
    label: 'Desired base salary',
    description: 'Usually managed in your Autofill Profile.',
    category: 'compensation' as const,
    icon: CircleDollarSign,
  },
};

const categoryMeta: Array<{
  id: MemoryCategory;
  label: string;
  detail: string;
  icon: typeof LibraryBig;
}> = [
  {
    id: 'all',
    label: 'All memories',
    detail: 'Everything AI can reuse',
    icon: LibraryBig,
  },
  {
    id: 'work',
    label: 'Work setup',
    detail: 'Office and availability',
    icon: BriefcaseBusiness,
  },
  {
    id: 'eligibility',
    label: 'Eligibility',
    detail: 'Rights and sponsorship',
    icon: ShieldCheck,
  },
  {
    id: 'compensation',
    label: 'Compensation',
    detail: 'Salary expectations',
    icon: CircleDollarSign,
  },
];

function definitionFor(intentKey: string) {
  const definition =
    memoryDefinitions[intentKey as keyof typeof memoryDefinitions];
  return (
    definition || {
      label: intentKey
        .replace(/[._]/g, ' ')
        .replace(/\b\w/g, (letter) => letter.toUpperCase()),
      description: 'A reusable answer from an earlier version of AI Memory.',
      category: 'work' as const,
      icon: SlidersHorizontal,
    }
  );
}

export default function AiMemoryPage() {
  const [answers, setAnswers] = useState<AutofillAnswer[]>([]);
  const [observations, setObservations] = useState<FormAnswerObservation[]>([]);
  const [category, setCategory] = useState<MemoryCategory>('all');
  const [search, setSearch] = useState('');
  const [selectedKey, setSelectedKey] = useState(
    'employment.office_attendance',
  );
  const [answerValue, setAnswerValue] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');

  const load = async () => {
    try {
      setError('');
      const [loadedAnswers, loadedObservations] = await Promise.all([
        api.autofillAnswers(),
        api.formAutofillObservations(),
      ]);
      setAnswers(loadedAnswers);
      setObservations(loadedObservations);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : 'Could not load AI Memory.',
      );
    }
  };
  useEffect(() => {
    void load();
  }, []);

  const visible = useMemo(
    () =>
      answers.filter((answer) => {
        const definition = definitionFor(answer.intent_key);
        const matchesCategory =
          category === 'all' || definition.category === category;
        const term = search.trim().toLowerCase();
        return (
          matchesCategory &&
          (!term ||
            definition.label.toLowerCase().includes(term) ||
            answer.value.toLowerCase().includes(term))
        );
      }),
    [answers, category, search],
  );

  const saveMemory = async (event: FormEvent) => {
    event.preventDefault();
    const intentKey = selectedKey;
    if (!intentKey || !answerValue.trim()) return;
    setIsSaving(true);
    try {
      const existing = answers.find(
        (answer) => answer.intent_key === intentKey,
      );
      const saved =
        existing ?
          await api.updateAutofillAnswer({
            ...existing,
            value: answerValue.trim(),
            active: true,
          })
        : await api.createAutofillAnswer({
            intent_key: intentKey,
            value: answerValue.trim(),
            value_type: 'text',
            active: true,
          });
      setAnswers((current) =>
        existing ?
          current.map((answer) => (answer.id === saved.id ? saved : answer))
        : [saved, ...current],
      );
      setAnswerValue('');
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : 'Could not save memory.',
      );
    } finally {
      setIsSaving(false);
    }
  };

  const update = async (
    answer: AutofillAnswer,
    changes: Partial<AutofillAnswer>,
  ) => {
    const next = { ...answer, ...changes };
    setAnswers((current) =>
      current.map((item) => (item.id === answer.id ? next : item)),
    );
    try {
      const saved = await api.updateAutofillAnswer(next);
      setAnswers((current) =>
        current.map((item) => (item.id === saved.id ? saved : item)),
      );
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : 'Could not update memory.',
      );
      void load();
    }
  };

  return (
    <main className='mx-auto flex w-full max-w-6xl flex-col gap-6 pb-10'>
      <header className='border-b border-border/60 pb-5'>
        <div className='flex items-center gap-2 text-ink-primary'>
          <LibraryBig className='size-5 text-primary' />
          <h1 className='title-section'>AI Memory</h1>
        </div>
        <p className='mt-1 max-w-2xl text-sm text-ink-secondary'>
          Save the answers that need your judgement. Your name, contact details,
          location, and salary stay in your Autofill Profile and always win.
        </p>
      </header>

      <section className='grid gap-2 sm:grid-cols-2 lg:grid-cols-5'>
        {categoryMeta.map(({ id, label, detail, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setCategory(id)}
            className={`${category === id ? 'select-card-active' : 'select-card'}`}
          >
            <Icon
              className={`mb-2 size-4 ${category === id ? 'text-primary' : 'text-ink-secondary'}`}
            />
            <span className='block text-sm font-medium text-ink-primary'>
              {label}
            </span>
            <span className='mt-0.5 block text-[11px] text-ink-secondary'>
              {detail}
            </span>
          </button>
        ))}
      </section>

      <button
        type='button'
        onClick={() => document.getElementById('needs-review')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
        className='flex items-center justify-between gap-4 border border-amber-300/70 bg-amber-50/40 px-4 py-3 text-left hover:bg-amber-50/70'
      >
        <span className='flex min-w-0 items-center gap-2'>
          <CircleAlert className='size-4 shrink-0 text-amber-600' />
          <span>
            <span className='block text-sm font-medium text-ink-primary'>Needs review</span>
            <span className='mt-0.5 block text-xs text-ink-secondary'>Check answers recently captured from inspected forms.</span>
          </span>
        </span>
        <span className='shrink-0 text-xs text-ink-secondary'>{observations.length} pending</span>
      </button>

      <section className='border border-border/70 bg-panel p-4'>
        <div className='mb-3'>
          <h2 className='text-sm font-semibold text-ink-primary'>
            Remember an answer
          </h2>
          <p className='mt-0.5 text-xs text-ink-secondary'>
            Add one reusable answer. You can edit or turn it off later.
          </p>
        </div>
        <form
          onSubmit={saveMemory}
          className='grid gap-3 lg:grid-cols-[14rem_minmax(0,1fr)_auto]'
        >
          <select
            value={selectedKey}
            onChange={(event) => setSelectedKey(event.target.value)}
            className='h-10 border border-border bg-background px-3 text-sm text-ink-primary outline-none focus:border-primary'
          >
            {Object.entries(memoryDefinitions).map(([key, definition]) => (
              <option key={key} value={key}>
                {definition.label}
              </option>
            ))}
          </select>
          <input
            value={answerValue}
            onChange={(event) => setAnswerValue(event.target.value)}
            placeholder='Your answer'
            className='h-10 min-w-0 border border-border bg-background px-3 text-sm text-ink-primary outline-none focus:border-primary'
          />
          <button
            type='submit'
            disabled={isSaving || !answerValue.trim()}
            className='inline-flex h-10 items-center justify-center gap-2 bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-50'
          >
            <Plus className='size-4' />
            Save memory
          </button>
        </form>
      </section>

      <div className='flex items-center justify-between gap-4'>
        <h2 className='text-sm font-semibold text-ink-primary'>
          {categoryMeta.find((item) => item.id === category)?.label}
        </h2>
        <div className='relative w-full max-w-xs'>
          <Search className='pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-secondary' />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder='Search memories'
            className='h-9 w-full border border-border bg-background pl-9 pr-3 text-sm text-ink-primary outline-none focus:border-primary'
          />
        </div>
      </div>
      {error && <p className='text-sm text-red-600'>{error}</p>}

      <section className='grid gap-3 md:grid-cols-2'>
        {visible.map((answer) => {
          const detail = definitionFor(answer.intent_key);
          const Icon = detail.icon;
          return (
            <article
              key={answer.id}
              className={`border p-4 ${answer.active ? 'border-border bg-panel' : 'border-border/50 bg-background-secondary/40 opacity-65'}`}
            >
              <div className='flex items-start justify-between gap-3'>
                <div className='flex min-w-0 items-start gap-2'>
                  <Icon className='mt-0.5 size-4 shrink-0 text-primary' />
                  <div>
                    <h3 className='text-sm font-semibold text-ink-primary'>
                      {detail.label}
                    </h3>
                    <p className='mt-0.5 text-xs text-ink-secondary'>
                      {detail.description}
                    </p>
                  </div>
                </div>
                <button
                  title={answer.active ? 'Turn off memory' : 'Turn on memory'}
                  onClick={() =>
                    void update(answer, { active: !answer.active })
                  }
                  className='p-1 text-ink-secondary hover:text-ink-primary'
                >
                  <Check
                    className={`size-4 ${answer.active ? 'text-emerald-600' : ''}`}
                  />
                </button>
              </div>
              <input
                defaultValue={answer.value}
                onBlur={(event) =>
                  event.target.value !== answer.value &&
                  void update(answer, { value: event.target.value })
                }
                className='mt-4 h-10 w-full border border-border bg-background px-3 text-sm text-ink-primary outline-none focus:border-primary'
              />
              <div className='mt-3 flex items-center justify-between text-xs text-ink-secondary'>
                <span>
                  Used {answer.times_used} times · v{answer.version}
                </span>
                <button
                  title='Delete memory'
                  onClick={() =>
                    void api
                      .deleteAutofillAnswer(answer.id)
                      .then(() =>
                        setAnswers((current) =>
                          current.filter((item) => item.id !== answer.id),
                        ),
                      )
                  }
                  className='p-1 text-ink-secondary hover:text-red-600'
                >
                  <Trash2 className='size-4' />
                </button>
              </div>
            </article>
          );
        })}
        {!visible.length && (
          <div className='col-span-full border border-dashed border-border px-4 py-12 text-center'>
            <LibraryBig className='mx-auto size-5 text-ink-secondary' />
            <p className='mt-2 text-sm font-medium text-ink-primary'>
              No memories here yet
            </p>
            <p className='mt-1 text-xs text-ink-secondary'>
              Start with an answer such as your office attendance or work
              authorization.
            </p>
          </div>
        )}
      </section>

      <section id='needs-review' className='scroll-mt-5 border-t border-border/60 pt-6'>
        <div className='mb-3 flex items-start justify-between gap-4'>
          <div>
            <div className='flex items-center gap-2'>
              <CircleAlert className='size-4 text-amber-600' />
              <h2 className='text-sm font-semibold text-ink-primary'>
                Needs review
              </h2>
            </div>
            <p className='mt-1 text-xs text-ink-secondary'>
              Recent answers captured from inspected forms. Matching answers are promoted to AI Memory automatically; conflicts are never used.
            </p>
          </div>
          <div className='flex items-center gap-2'>
            {observations.length > 0 && (
              <span className='text-xs text-ink-secondary'>
                {observations.length} pending
              </span>
            )}
            <button
              type='button'
              title='Refresh observations'
              onClick={() => void load()}
              className='p-1 text-ink-secondary hover:text-ink-primary'
            >
              <RefreshCw className='size-4' />
            </button>
          </div>
        </div>
        <div className='grid gap-3 md:grid-cols-2'>
          {observations.map((observation) => {
            const hasConflict = observation.status === 'conflict';
            return (
              <article
                key={observation.id}
                className={`border p-4 ${hasConflict ? 'border-amber-400/70 bg-amber-50/30' : 'border-border bg-panel'}`}
              >
                <div className='flex items-start justify-between gap-3'>
                  <div className='min-w-0'>
                    <p className='text-[10px] font-medium uppercase text-ink-secondary'>
                      {hasConflict ? 'Conflict - not used for autofill' : 'Observed - waiting for a matching question'}
                    </p>
                    <h3 className='mt-1 text-sm font-semibold text-ink-primary'>
                      {observation.original_label}
                    </h3>
                  </div>
                  <button
                    title='Delete observation'
                    onClick={() =>
                      void api.deleteFormAutofillObservation(observation.id).then(() =>
                        setObservations((current) => current.filter((item) => item.id !== observation.id)),
                      )
                    }
                    className='shrink-0 p-1 text-ink-secondary hover:text-red-600'
                  >
                    <Trash2 className='size-4' />
                  </button>
                </div>
                <p className='mt-4 whitespace-pre-wrap text-base text-ink-primary'>
                  {observation.answer}
                </p>
                <div className='mt-3 flex flex-wrap gap-x-3 gap-y-1 text-xs text-ink-secondary'>
                  <span>{observation.platform}</span>
                  {observation.company_scope && <span>{observation.company_scope}</span>}
                  <span>Seen {observation.times_seen} time{observation.times_seen === 1 ? '' : 's'}</span>
                  <span>{new Date(observation.last_seen_at).toLocaleDateString()}</span>
                </div>
              </article>
            );
          })}
          {!observations.length && (
            <div className='col-span-full border border-dashed border-border px-4 py-8 text-center'>
              <p className='text-sm font-medium text-ink-primary'>Nothing needs review</p>
              <p className='mt-1 text-xs text-ink-secondary'>
                Enter an answer in an inspected form and it will appear here within a moment.
              </p>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
