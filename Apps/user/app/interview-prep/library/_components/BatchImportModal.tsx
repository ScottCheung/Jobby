/** @format */

'use client';

import React, { useState, useEffect } from 'react';
import { FileText, X, Trash2, ArrowLeft, Loader, Folder } from 'lucide-react';
import { api } from '@/lib/api';
import type {
  InterviewCategory,
  InterviewTag,
  InterviewQuestion,
} from '@/lib/types';
import { cn, cleanName } from '@/lib/utils';
import { CategorySelector } from './selectors';
import { Button } from '@/components/UI/Button';
import { Textarea } from '@/components/UI/textarea';
import { Modal } from '@/components/layout/modal';
import { H3 } from '@/components/UI/text/typography';
import { Tooltip } from '@/components/UI/tooltip';
import { div } from 'framer-motion/client';
import { Info, List } from 'lucide-react';

interface BatchImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  categories: InterviewCategory[];
  tags: InterviewTag[];
  selectedCategoryId: string | null;
  onImportSuccess: () => Promise<void>;
  addNotification: (notification: {
    type: 'success' | 'error' | 'info' | 'warning';
    message: string;
  }) => void;
}

const parseQuestions = (text: string): string[] => {
  if (!text) return [];
  const lines = text.split(/\r?\n/);
  let questions = lines
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  if (questions.length === 1 && text.includes('?')) {
    const splitByQM = text.split(/(?<=\?)\s+/);
    if (splitByQM.length > 1) {
      questions = splitByQM.map((q) => q.trim()).filter((q) => q.length > 0);
    }
  }

  return questions
    .map((q) => {
      return q
        .replace(/^([0-9]+[\.\)\-\s]+|[\-\*\u2022]\s*)/i, '')
        .replace(/^(question|q)\s*[0-9]+\s*[:\-\)]\s*/i, '')
        .trim();
    })
    .filter((q) => q.length > 0);
};

export function BatchImportModal({
  isOpen,
  onClose,
  categories,
  tags,
  selectedCategoryId,
  onImportSuccess,
  addNotification,
}: BatchImportModalProps) {
  const [importText, setImportText] = useState('');
  const [importDefaultCategory, setImportDefaultCategory] =
    useState<string>('');
  const [step, setStep] = useState<1 | 2>(1);
  const [parsedQuestions, setParsedQuestions] = useState<
    Array<{
      id: string;
      title: string;
      category_id: string | null;
      frequency: string;
      importance_score: number;
      answer_objective: string;
      tags: string[];
      selected: boolean;
    }>
  >([]);
  const [isBatchSubmitting, setIsBatchSubmitting] = useState(false);

  // Batch Update Toolbar values
  const [batchCategory, setBatchCategory] = useState<string>('keep');
  const [batchFrequency, setBatchFrequency] = useState<string>('keep');
  const [batchImportance, setBatchImportance] = useState<string>('keep');

  // Sync default category when opened
  useEffect(() => {
    if (isOpen) {
      setImportDefaultCategory(selectedCategoryId || '');
      setImportText('');
      setStep(1);
      setParsedQuestions([]);
    }
  }, [isOpen, selectedCategoryId]);

  const handleParseText = () => {
    if (!importText.trim()) return;
    const rawTitles = parseQuestions(importText);
    const questionsList = rawTitles.map((title) => ({
      id: Math.random().toString(36).substring(7),
      title,
      category_id: importDefaultCategory || null,
      frequency: '',
      importance_score: 0,
      answer_objective: '',
      tags: [] as string[],
      selected: true,
    }));
    setParsedQuestions(questionsList);
    setStep(2);
  };

  const handleApplyBatchUpdate = () => {
    setParsedQuestions((prev) =>
      prev.map((q) => {
        if (!q.selected) return q;
        const updated = { ...q };
        if (batchCategory !== 'keep') {
          updated.category_id = batchCategory === 'none' ? null : batchCategory;
        }
        if (batchFrequency !== 'keep') {
          updated.frequency = batchFrequency;
        }
        if (batchImportance !== 'keep') {
          updated.importance_score = Number(batchImportance);
        }
        return updated;
      }),
    );
    addNotification({
      type: 'info',
      message: 'Batch properties applied to selected questions',
    });
  };

  const handleImportSubmit = async () => {
    const toImport = parsedQuestions.filter(
      (q) => q.selected && q.title.trim(),
    );
    if (toImport.length === 0) {
      addNotification({
        type: 'warning',
        message: 'No questions selected for import',
      });
      return;
    }

    setIsBatchSubmitting(true);
    try {
      const payload = toImport.map((q) => ({
        title: q.title.trim(),
        category_id: q.category_id,
        frequency: q.frequency || null,
        importance_score: q.importance_score > 0 ? q.importance_score : null,
        answer_objective: q.answer_objective.trim() || null,
        my_answer: null,
        improvement_notes: null,
        tags: [] as any,
      }));

      await api.batchCreateInterviewQuestions(payload);
      addNotification({
        type: 'success',
        message: `Successfully imported ${toImport.length} questions`,
      });
      await onImportSuccess();
      onClose();
    } catch (err: any) {
      console.error('Failed to batch import questions:', err);
      addNotification({
        type: 'error',
        message: err.message || 'Failed to import questions',
      });
    } finally {
      setIsBatchSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      layoutId='Import Questions'
      className='w-[90vw] max-h-[85vh] max-w-6xl text-ink-primary'
    >
      {/* Modal Header */}
      <div className=' flex items-center justify-between shrink-0 '>
        <div className='flex items-center gap-2'>
          <FileText className='w-5 h-5 text-primary' />
          <H3>Import Questions</H3>
        </div>
        <button
          type='button'
          onClick={onClose}
          className='text-ink-secondary hover:text-ink-primary p-1.5 rounded-lg hover:bg-background-secondary hover:bg-background-secondary transition-colors'
        >
          <X className='w-5 h-5' />
        </button>
      </div>

      {/* Step 1: Input Area */}
      {step === 1 && (
        <div className='flex-1 p-6 flex flex-col gap-5 overflow-y-auto'>
          <div className='flex flex-col gap-1.5  '>
            <label className='label'>Paste Questions Text</label>
            <Tooltip
              content={
                <div className='col gap-5'>
                  <div className='space-y-1'>
                    <h3 className='title-sub flex items-center gap-2'>
                      <List className='size-4 text-primary' />
                      Supported formats
                    </h3>

                    <p className='body-sm'>
                      Enter{' '}
                      <span className='font-semibold text-primary'>
                        ONE question per line
                      </span>
                      .
                    </p>
                  </div>

                  <div className='rounded-xl border border-border/40 bg-background-secondary/40 p-4 font-mono text-sm leading-7'>
                    <div className='text-ink-secondary'>
                      1. Tell me about yourself.
                    </div>

                    <div className='text-ink-secondary'>
                      2. Why do you want to work here?
                    </div>

                    <div className='text-ink-secondary'>
                      3. Describe a challenging project.
                    </div>

                    <div className='my-3 border-t border-dashed border-border/50' />

                    <div className='text-ink-secondary'>
                      • Tell me about yourself.
                    </div>

                    <div className='text-ink-secondary'>
                      • Why do you want to work here?
                    </div>

                    <div className='text-ink-secondary'>
                      • Describe a challenging project.
                    </div>
                  </div>

                  <div className='space-y-3'>
                    <div className='flex gap-2'>
                      <span className='mt-1 size-1.5 rounded-full bg-primary shrink-0' />
                      <p className='body-sm'>
                        Numbering and bullet points are automatically removed.
                      </p>
                    </div>

                    <div className='flex gap-2'>
                      <span className='mt-1 size-1.5 rounded-full bg-primary shrink-0' />
                      <p className='body-sm'>
                        Detection may occasionally be incorrect. Please review
                        the extracted questions before submitting.
                      </p>
                    </div>
                  </div>

                  <div className='flex gap-3 rounded-xl border border-primary/20 bg-primary/5 p-3'>
                    <Info className='mt-0.5 size-4 shrink-0 text-primary' />

                    <p className='body-sm'>
                      Large uploads may take a little longer because each
                      question is automatically matched with relevant keywords
                      on the server. We suggest limit it to{' '}
                      <span className='text-primary'>&lt; 30 - 50</span> at a
                      time.
                    </p>
                  </div>
                </div>
              }
            >
              <Textarea
                placeholder='Paste your questions here, one per line:'
                value={importText}
                onChange={(e) => setImportText(e.target.value)}
                minHeight={160}
              />
            </Tooltip>
          </div>

          <div className='flex flex-col gap-2.5 shrink-0 max-w-full'>
            <label className='label'>
              Default Category for Imported Questions
            </label>
            <CategorySelector
              importDefaultCategory={importDefaultCategory}
              setImportDefaultCategory={setImportDefaultCategory}
              categories={categories}
            />
          </div>

          {/* Footer buttons for step 1 */}
          <div className='flex justify-end gap-2 pt-4 border-t border-border/40 shrink-0'>
            <Button variant='ghost' onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={handleParseText} disabled={!importText.trim()}>
              Next: Configure & Preview
            </Button>
          </div>
        </div>
      )}

      {/* Step 2: Configuration & Preview Table */}
      {step === 2 && (
        <div className='flex-1 flex flex-col overflow-hidden'>
          {/* Batch Actions Toolbar */}
          <div className='flex flex-wrap gap-4 items-center justify-between shrink-0'>
            <div className='flex flex-wrap items-center gap-3'>
              <span className='label-overline'>
                Batch edit selected (
                {parsedQuestions.filter((q) => q.selected).length}):
              </span>
              <select
                value={batchCategory}
                onChange={(e) => setBatchCategory(e.target.value)}
                className='body-sm px-3 py-1.5 rounded-lg dark:border-border text-ink-primary focus:outline-none'
              >
                <option value='keep'>Keep Original Category</option>
                <option value='none'>Set Classified-free</option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cleanName(cat.name)}
                  </option>
                ))}
              </select>
              <select
                value={batchFrequency}
                onChange={(e) => setBatchFrequency(e.target.value)}
                className='body-sm px-3 py-1.5 rounded-lg dark:border-border text-ink-primary focus:outline-none'
              >
                <option value='keep'>Keep Original Frequency</option>
                <option value='Low'>Low</option>
                <option value='Medium'>Medium</option>
                <option value='High'>High</option>
              </select>
              <select
                value={batchImportance}
                onChange={(e) => setBatchImportance(e.target.value)}
                className='body-sm px-3 py-1.5 rounded-lg dark:border-border text-ink-primary focus:outline-none'
              >
                <option value='keep'>Keep Original Importance</option>
                <option value='1'>1 Star</option>
                <option value='2'>2 Stars</option>
                <option value='3'>3 Stars</option>
                <option value='4'>4 Stars</option>
                <option value='5'>5 Stars</option>
              </select>
              <Button
                size='sm'
                onClick={handleApplyBatchUpdate}
                disabled={
                  parsedQuestions.filter((q) => q.selected).length === 0
                }
                className='body-sm rounded-lg'
              >
                Apply to all Select
              </Button>
            </div>
          </div>

          {/* Table Preview header */}
          <div className='grid grid-cols-[50px_minmax(0,2fr)_minmax(0,1.2fr)_minmax(0,0.8fr)_minmax(0,0.8fr)_minmax(0,2fr)_50px] text-[11px] font-bold text-ink-secondary uppercase tracking-wider px-6 py-3 border-b border-border/40 bg-background-secondary/20 shrink-0'>
            <div className='flex justify-center items-center'>
              <input
                type='checkbox'
                checked={
                  parsedQuestions.length > 0 &&
                  parsedQuestions.every((q) => q.selected)
                }
                onChange={(e) => {
                  const checked = e.target.checked;
                  setParsedQuestions((prev) =>
                    prev.map((q) => ({ ...q, selected: checked })),
                  );
                }}
                className='w-4 h-4 rounded border-zinc-300 text-primary focus:ring-primary accent-primary'
              />
            </div>
            <div className='px-2'>Title</div>
            <div className='px-2'>Category</div>
            <div className='px-2'>Frequency</div>
            <div className='px-2'>Importance</div>
            <div className='px-2'>Contributor's Answer</div>
            <div className='text-center'></div>
          </div>

          {/* Table Preview list */}
          <div className='body'>
            {parsedQuestions.length === 0 ?
              <div className='p-8 text-center text-ink-secondary italic'>
                No questions parsed.
              </div>
            : parsedQuestions.map((q) => (
                <div
                  key={q.id}
                  className={cn(
                    'grid grid-cols-[50px_minmax(0,2fr)_minmax(0,1.2fr)_minmax(0,0.8fr)_minmax(0,0.8fr)_minmax(0,2fr)_50px] items-center py-2.5 hover:bg-background-secondary/10 transition-colors',
                    !q.selected && 'opacity-60',
                  )}
                >
                  {/* Selector */}
                  <div className='flex justify-center items-center'>
                    <input
                      type='checkbox'
                      checked={q.selected}
                      onChange={(e) => {
                        const val = e.target.checked;
                        setParsedQuestions((prev) =>
                          prev.map((item) =>
                            item.id === q.id ?
                              { ...item, selected: val }
                            : item,
                          ),
                        );
                      }}
                      className='w-4 h-4 rounded border-zinc-300 text-primary focus:ring-primary accent-primary'
                    />
                  </div>

                  {/* Title input */}
                  <div className='px-2'>
                    <input
                      type='text'
                      value={q.title}
                      onChange={(e) => {
                        const val = e.target.value;
                        setParsedQuestions((prev) =>
                          prev.map((item) =>
                            item.id === q.id ? { ...item, title: val } : item,
                          ),
                        );
                      }}
                      placeholder='Title is required'
                      required
                      className='body-sm w-full px-2 py-1 rounded dark:border-border focus:outline-none focus:border-primary/50 text-ink-primary'
                    />
                  </div>

                  {/* Category Select */}
                  <div className='px-2'>
                    <select
                      value={q.category_id || ''}
                      onChange={(e) => {
                        const val = e.target.value || null;
                        setParsedQuestions((prev) =>
                          prev.map((item) =>
                            item.id === q.id ?
                              { ...item, category_id: val }
                            : item,
                          ),
                        );
                      }}
                      className='body-sm w-full px-2 py-1 rounded dark:border-border focus:outline-none text-ink-primary'
                    >
                      <option value=''>No Category</option>
                      {categories.map((cat) => (
                        <option key={cat.id} value={cat.id}>
                          {cleanName(cat.name)}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Frequency Select */}
                  <div className='px-2'>
                    <select
                      value={q.frequency}
                      onChange={(e) => {
                        const val = e.target.value;
                        setParsedQuestions((prev) =>
                          prev.map((item) =>
                            item.id === q.id ?
                              { ...item, frequency: val }
                            : item,
                          ),
                        );
                      }}
                      className='body-sm w-full px-2 py-1 rounded dark:border-border focus:outline-none text-ink-primary'
                    >
                      <option value='Low'>Low</option>
                      <option value='Medium'>Medium</option>
                      <option value='High'>High</option>
                    </select>
                  </div>

                  {/* Importance Select */}
                  <div className='px-2'>
                    <select
                      value={q.importance_score}
                      onChange={(e) => {
                        const val = Number(e.target.value);
                        setParsedQuestions((prev) =>
                          prev.map((item) =>
                            item.id === q.id ?
                              { ...item, importance_score: val }
                            : item,
                          ),
                        );
                      }}
                      className='body-sm w-full px-2 py-1 rounded dark:border-border focus:outline-none text-ink-primary'
                    >
                      <option value={1}>1 Star</option>
                      <option value={2}>2 Stars</option>
                      <option value={3}>3 Stars</option>
                      <option value={4}>4 Stars</option>
                      <option value={5}>5 Stars</option>
                    </select>
                  </div>

                  {/* Your Answer Textarea */}
                  <div className='px-2'>
                    <Textarea
                      value={q.answer_objective}
                      onChange={(e) => {
                        const val = e.target.value;
                        setParsedQuestions((prev) =>
                          prev.map((item) =>
                            item.id === q.id ?
                              { ...item, answer_objective: val }
                            : item,
                          ),
                        );
                      }}
                      placeholder='Your answer...'
                      rows={1}
                      minHeight={36}
                    />
                  </div>

                  {/* Delete Row */}
                  <div className='flex justify-center items-center'>
                    <button
                      type='button'
                      onClick={() =>
                        setParsedQuestions((prev) =>
                          prev.filter((item) => item.id !== q.id),
                        )
                      }
                      className='p-1 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 rounded transition-colors'
                    >
                      <Trash2 className='w-4 h-4' />
                    </button>
                  </div>
                </div>
              ))
            }
          </div>

          {/* Footer buttons for step 2 */}
          <div className='footer'>
            <div className='flex gap-4'>
              <Button variant='ghost' onClick={onClose}>
                Cancel
              </Button>
              <Button
                variant='outline'
                onClick={() => setStep(1)}
                Icon={ArrowLeft}
              >
                Back to text
              </Button>
              <Button
                onClick={handleImportSubmit}
                isLoading={isBatchSubmitting}
                disabled={
                  isBatchSubmitting ||
                  parsedQuestions.filter((q) => q.selected && q.title.trim())
                    .length === 0
                }
              >
                {isBatchSubmitting ?
                  <>
                    <Loader className='w-4 h-4 animate-spin' />
                    Importing...
                  </>
                : `Import ${parsedQuestions.filter((q) => q.selected && q.title.trim()).length} Questions`
                }
              </Button>
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
}
