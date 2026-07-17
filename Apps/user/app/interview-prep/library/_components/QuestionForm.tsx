/** @format */

'use client';

import React, { useState } from 'react';
import { X, AlertCircle, Plus, Star } from 'lucide-react';
import { api } from '@/lib/api';
import type {
  InterviewQuestion,
  InterviewCategory,
  InterviewTag,
} from '@/lib/types';
import { cn, cleanName } from '@/lib/utils';

export interface QuestionFormProps {
  question: InterviewQuestion;
  categories: InterviewCategory[];
  tags: InterviewTag[];
  onTagCreated: (tag: InterviewTag) => void;
  onSave: (payload: Partial<InterviewQuestion>) => Promise<void>;
  onCancel: () => void;
}

export function QuestionForm({
  question,
  categories,
  tags,
  onTagCreated,
  onSave,
  onCancel,
}: QuestionFormProps) {
  const [title, setTitle] = useState(question?.title || '');
  const [categoryId, setCategoryId] = useState(question?.category_id || '');
  const [selectedTags, setSelectedTags] = useState<string[]>(
    question?.tags?.map((t) => t.id) || [],
  );
  const [frequency, setFrequency] = useState(question?.frequency || 'Medium');
  const [importanceScore, setImportanceScore] = useState(
    question?.importance_score || 3,
  );
  const [answerObjective, setAnswerObjective] = useState(
    question?.answer_objective || '',
  );

  const [frameworkType, setFrameworkType] = useState(() => {
    if (!question?.answer_framework) return 'STAR';
    const isDefault = ['STAR', 'PAR', 'CAR', '5W2H', 'STARE', 'SOAR', 'XYZ'].includes(
      question.answer_framework,
    );
    return isDefault ? question.answer_framework : 'custom';
  });
  const [customFramework, setCustomFramework] = useState(() => {
    if (!question?.answer_framework) return '';
    const isDefault = ['STAR', 'PAR', 'CAR', '5W2H'].includes(
      question.answer_framework,
    );
    return isDefault ? '' : question.answer_framework;
  });

  const [newTagName, setNewTagName] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleCreateTag = async () => {
    if (!newTagName.trim()) return;
    try {
      const created = await api.createInterviewTag({ name: newTagName.trim() });
      onTagCreated(created);
      setSelectedTags((prev) => [...prev, created.id]);
      setNewTagName('');
    } catch (err: any) {
      console.error('Failed to create tag:', err);
      setErrorMsg(err.message || 'Failed to create tag');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setErrorMsg('Title is required');
      return;
    }
    setErrorMsg('');
    setIsSubmitting(true);
    try {
      const frameworkValue =
        frameworkType === 'custom' ? customFramework.trim() : frameworkType;
      const payload: Partial<InterviewQuestion> = {
        title: title.trim(),
        frequency,
        importance_score: importanceScore,
        category_id: categoryId || null,
        tags: selectedTags as any,
        answer_objective: answerObjective.trim() || null,
        answer_framework: frameworkValue.trim() || null,
        my_answer: null,
        improvement_notes: null,
      };
      await onSave(payload);
    } catch (err: any) {
      console.error('Failed to save question:', err);
      setErrorMsg(err.message || 'Failed to save question');
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleTag = (tagId: string) => {
    setSelectedTags((prev) =>
      prev.includes(tagId) ?
        prev.filter((id) => id !== tagId)
      : [...prev, tagId],
    );
  };

  return (
    <form
      onSubmit={handleSubmit}
      className='flex flex-col h-full bg-panel text-ink-primary'
    >
      {/* Header */}
      <div className='p-5 border-b border-zinc-100 dark:border-zinc-800/60 flex items-center justify-between shrink-0 bg-zinc-50/20 dark:bg-zinc-900/10'>
        <h3 className='text-base font-bold'>Edit Question</h3>
        <button
          type='button'
          onClick={onCancel}
          className='text-ink-secondary hover:text-ink-primary p-1 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors'
        >
          <X className='w-5 h-5' />
        </button>
      </div>

      {/* Scrollable Content */}
      <div className='flex-1 overflow-y-auto p-6 flex flex-col gap-5 custom-scrollbar-primary'>
        {errorMsg && (
          <div className='p-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm rounded-lg flex items-center gap-2'>
            <AlertCircle className='w-4 h-4 shrink-0' />
            {errorMsg}
          </div>
        )}

        {/* Title */}
        <div className='flex flex-col gap-1.5'>
          <label className='text-xs font-bold text-ink-secondary uppercase tracking-wider'>
            Title <span className='text-red-500'>*</span>
          </label>
          <input
            type='text'
            required
            placeholder='Question title'
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className='w-full px-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-955 text-ink-primary text-sm focus:outline-none focus:border-zinc-400 focus:ring-1 focus:ring-zinc-400'
          />
        </div>

        {/* Category */}
        <div className='flex flex-col gap-1.5'>
          <label className='text-xs font-bold text-ink-secondary uppercase tracking-wider'>
            Category
          </label>
          <select
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            className='w-full px-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-955 text-ink-primary text-sm focus:outline-none focus:border-zinc-400'
          >
            <option value=''>No Category</option>
            {categories.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cleanName(cat.name)}
              </option>
            ))}
          </select>
        </div>

        {/* Tags */}
        <div className='flex flex-col gap-2'>
          <label className='text-xs font-bold text-ink-secondary uppercase tracking-wider'>
            Assign Tags
          </label>
          {/* Inline Tag Creator */}
          <div className='flex gap-2'>
            <input
              type='text'
              placeholder='New tag name'
              value={newTagName}
              onChange={(e) => setNewTagName(e.target.value)}
              className='flex-1 px-3 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-955 text-ink-primary text-xs focus:outline-none focus:border-zinc-400'
            />
            <button
              type='button'
              onClick={handleCreateTag}
              className='px-3 py-1.5 text-xs bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-ink-primary rounded-lg border border-zinc-200 dark:border-zinc-800 font-semibold'
            >
              Create Tag
            </button>
          </div>

          <div className='flex flex-wrap gap-1.5 max-h-28 overflow-y-auto p-1.5 border border-zinc-100 dark:border-zinc-800/80 rounded-lg'>
            {tags.length === 0 ?
              <span className='text-xs text-ink-secondary italic p-1'>
                No tags created yet.
              </span>
            : tags.map((tag) => {
                const active = selectedTags.includes(tag.id);
                return (
                  <button
                    type='button'
                    key={tag.id}
                    onClick={() => toggleTag(tag.id)}
                    className={cn(
                      'px-2.5 py-1 text-xs rounded-lg transition-colors border',
                      active ?
                        'bg-primary border-primary text-primary-foreground font-semibold'
                      : 'bg-zinc-50 border-zinc-200 hover:bg-zinc-100 text-ink-secondary dark:bg-zinc-900 dark:border-zinc-800 dark:hover:bg-zinc-800',
                    )}
                  >
                    {cleanName(tag.name)}
                  </button>
                );
              })
            }
          </div>
        </div>

        {/* Frequency & Importance */}
        <div className='flex gap-4'>
          <div className='flex-1 flex flex-col gap-1.5'>
            <label className='text-xs font-bold text-ink-secondary uppercase tracking-wider'>
              Frequency
            </label>
            <select
              value={frequency}
              onChange={(e) => setFrequency(e.target.value)}
              className='w-full px-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-955 text-ink-primary text-sm focus:outline-none focus:border-zinc-400'
            >
              <option value='Low'>Low Frequency</option>
              <option value='Medium'>Medium Frequency</option>
              <option value='High'>High Frequency</option>
            </select>
          </div>
          <div className='flex-1 flex flex-col gap-1.5'>
            <label className='text-xs font-bold text-ink-secondary uppercase tracking-wider'>
              Importance
            </label>
            <select
              value={importanceScore}
              onChange={(e) => setImportanceScore(Number(e.target.value))}
              className='w-full px-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-955 text-ink-primary text-sm focus:outline-none focus:border-zinc-400'
            >
              <option value={1}>1 Star</option>
              <option value={2}>2 Stars</option>
              <option value={3}>3 Stars</option>
              <option value={4}>4 Stars</option>
              <option value={5}>5 Stars</option>
            </select>
          </div>
        </div>

        {/* Answering Framework */}
        <div className='flex flex-col gap-1.5'>
          <label className='text-xs font-bold text-ink-secondary uppercase tracking-wider'>
            Answering Framework
          </label>
          <select
            value={frameworkType}
            onChange={(e) => setFrameworkType(e.target.value)}
            className='w-full px-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-955 text-ink-primary text-sm focus:outline-none focus:border-zinc-400'
          >
            <option value='STAR'>
              STAR Framework (Situation, Task, Action, Result)
            </option>
            <option value='STARE'>
              STARE Framework (Situation, Task, Action, Result, Evaluation)
            </option>
            <option value='PAR'>PAR Framework (Problem, Action, Result)</option>
            <option value='CAR'>CAR Framework (Context, Action, Result)</option>
            <option value='SOAR'>SOAR Framework (Situation, Obstacle, Action, Result)</option>
            <option value='5W2H'>5W2H Framework</option>
            <option value='XYZ'>XYZ Framework (Accomplished X, measured by Y, by Z)</option>
            <option value='custom'>Custom Framework</option>
          </select>
          {frameworkType === 'custom' && (
            <textarea
              placeholder='Define your custom answering framework details here...'
              value={customFramework}
              onChange={(e) => setCustomFramework(e.target.value)}
              className='w-full px-4 py-2.5 h-20 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-955 resize-none text-ink-primary text-sm focus:outline-none focus:border-zinc-400'
            />
          )}
        </div>

        {/* Your Answer */}
        <div className='flex flex-col gap-1.5'>
          <label className='text-xs font-bold text-ink-secondary uppercase tracking-wider'>
            Your Answer
          </label>
          <textarea
            placeholder='Write your answer here...'
            value={answerObjective}
            onChange={(e) => setAnswerObjective(e.target.value)}
            className='w-full px-4 py-2.5 h-44 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-955 resize-none text-ink-primary text-sm focus:outline-none focus:border-zinc-400 leading-relaxed'
          />
        </div>
      </div>

      {/* Footer */}
      <div className='p-5 border-t border-zinc-100 dark:border-zinc-800/60 flex justify-end gap-2 shrink-0 bg-zinc-50/20 dark:bg-zinc-900/10'>
        <button
          type='button'
          onClick={onCancel}
          className='px-4 py-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 text-sm font-semibold transition-colors text-ink-secondary'
        >
          Cancel
        </button>
        <button
          type='submit'
          disabled={isSubmitting || !title.trim()}
          className='px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50'
        >
          {isSubmitting ? 'Saving...' : 'Save Question'}
        </button>
      </div>
    </form>
  );
}
