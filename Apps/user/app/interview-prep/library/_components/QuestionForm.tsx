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
  const [difficulty, setDifficulty] = useState(question?.difficulty || 'Medium');
  const [estimatedDuration, setEstimatedDuration] = useState<number>(
    question?.estimated_duration_seconds ?
      Math.round(question.estimated_duration_seconds / 60)
    : 2,
  );
  const [frequency, setFrequency] = useState(question?.frequency || '');
  const [importanceScore, setImportanceScore] = useState<number | ''>(
    question?.importance_score ?? '',
  );
  const [answerObjective, setAnswerObjective] = useState(
    question?.answer_objective || '',
  );

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
    if (!categoryId) {
      setErrorMsg('Category is required');
      return;
    }
    setErrorMsg('');
    setIsSubmitting(true);
    try {
      const payload: Partial<InterviewQuestion> = {
        title: title.trim(),
        difficulty: difficulty || 'Medium',
        estimated_duration_seconds: (estimatedDuration || 2) * 60,
        frequency: frequency || null,
        importance_score: importanceScore !== '' ? Number(importanceScore) : null,
        category_id: categoryId || null,
        tags: selectedTags as any,
        answer_objective: answerObjective.trim() || null,
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
      className='flex flex-col h-full bg-panel p-page text-ink-primary'
    >
      {/* Header */}
      <div className='header'>
        <h3 className='title-sub'>Edit Question</h3>
        <button
          type='button'
          onClick={onCancel}
          className='text-ink-secondary hover:text-ink-primary p-1 rounded-lg hover:bg-background-secondary  transition-colors'
        >
          <X className='w-5 h-5' />
        </button>
      </div>

      {/* Scrollable Content */}
      <div className='body '>
        {errorMsg && (
          <div className='body-md p-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-lg flex items-center gap-2'>
            <AlertCircle className='w-4 h-4 shrink-0' />
            {errorMsg}
          </div>
        )}

        {/* Title */}
        <div className='flex flex-col gap-1.5'>
          <label className='label-overline'>
            Title <span className='text-red-500'>*</span>
          </label>
          <input
            type='text'
            required
            placeholder='Question title'
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className='body-md w-full px-4 py-2.5 rounded-xl border border-border dark:border-border bg-panel text-ink-primary focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20'
          />
        </div>

        {/* Category */}
        <div className='flex flex-col gap-1.5'>
          <label className='label-overline'>
            Category <span className='text-red-500'>*</span>
          </label>
          <select
            required
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            className='body-md w-full px-4 py-2.5 rounded-xl border border-border dark:border-border bg-panel text-ink-primary focus:outline-none focus:border-primary/50'
          >
            <option value=''>Select Category</option>
            {categories.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cleanName(cat.name)}
              </option>
            ))}
          </select>
        </div>

        {/* Tags */}
        <div className='flex flex-col gap-2'>
          <label className='label-overline'>Assign Tags</label>
          {/* Inline Tag Creator */}
          <div className='flex gap-2'>
            <input
              type='text'
              placeholder='New tag name'
              value={newTagName}
              onChange={(e) => setNewTagName(e.target.value)}
              className='body-sm flex-1 px-3 py-1.5 rounded-lg border border-border dark:border-border bg-panel text-ink-primary focus:outline-none focus:border-primary/50'
            />
            <button
              type='button'
              onClick={handleCreateTag}
              className='label-sm px-3 py-1.5 bg-background-secondary hover:bg-background-secondary dark:bg-panel dark:hover:bg-panel text-ink-primary rounded-lg border border-border dark:border-border'
            >
              Create Tag
            </button>
          </div>

          <div className='flex flex-wrap gap-1.5 max-h-28 overflow-y-auto p-1.5 border border-border/40/80 rounded-lg'>
            {tags.length === 0 ?
              <span className='body-sm text-ink-secondary italic p-1'>
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
                      'body-sm px-2.5 py-1 rounded-lg transition-colors border',
                      active ?
                        'bg-primary border-primary text-primary-foreground font-semibold'
                      : 'bg-background-secondary/50 border-border hover:bg-background-secondary text-ink-secondary dark:bg-panel dark:border-border dark:hover:bg-background-secondary',
                    )}
                  >
                    {cleanName(tag.name)}
                  </button>
                );
              })
            }
          </div>
        </div>

        {/* Difficulty & Estimated Duration */}
        <div className='flex gap-4'>
          <div className='flex-1 flex flex-col gap-1.5'>
            <label className='label-overline'>Difficulty</label>
            <select
              value={difficulty}
              onChange={(e) => setDifficulty(e.target.value)}
              className='body-md w-full px-4 py-2.5 rounded-xl border border-border dark:border-border bg-panel text-ink-primary focus:outline-none focus:border-primary/50'
            >
              <option value='Easy'>Easy</option>
              <option value='Medium'>Medium</option>
              <option value='Hard'>Hard</option>
            </select>
          </div>
          <div className='flex-1 flex flex-col gap-1.5'>
            <label className='label-overline'>Estimated Answer Time</label>
            <select
              value={estimatedDuration}
              onChange={(e) => setEstimatedDuration(Number(e.target.value))}
              className='body-md w-full px-4 py-2.5 rounded-xl border border-border dark:border-border bg-panel text-ink-primary focus:outline-none focus:border-primary/50'
            >
              <option value={1}>1 min (60s)</option>
              <option value={2}>2 mins (120s)</option>
              <option value={3}>3 mins (180s)</option>
              <option value={5}>5 mins (300s)</option>
              <option value={10}>10 mins (600s)</option>
            </select>
          </div>
        </div>

        {/* Frequency & Importance */}
        <div className='flex gap-4'>
          <div className='flex-1 flex flex-col gap-1.5'>
            <label className='label-overline'>Frequency (Optional)</label>
            <select
              value={frequency}
              onChange={(e) => setFrequency(e.target.value)}
              className='body-md w-full px-4 py-2.5 rounded-xl border border-border dark:border-border bg-panel text-ink-primary focus:outline-none focus:border-primary/50'
            >
              <option value=''>Unspecified (Optional)</option>
              <option value='Low'>Low Frequency</option>
              <option value='Medium'>Medium Frequency</option>
              <option value='High'>High Frequency</option>
            </select>
          </div>
          <div className='flex-1 flex flex-col gap-1.5'>
            <label className='label-overline'>Importance (Optional)</label>
            <select
              value={importanceScore}
              onChange={(e) => setImportanceScore(e.target.value ? Number(e.target.value) : '')}
              className='body-md w-full px-4 py-2.5 rounded-xl border border-border dark:border-border bg-panel text-ink-primary focus:outline-none focus:border-primary/50'
            >
              <option value=''>Unspecified (Optional)</option>
              <option value={1}>1 Star</option>
              <option value={2}>2 Stars</option>
              <option value={3}>3 Stars</option>
              <option value={4}>4 Stars</option>
              <option value={5}>5 Stars</option>
            </select>
          </div>
        </div>

        {/* Author's Answer */}
        <div className='flex flex-col gap-1.5'>
          <label className='label-overline'>Author's Answer</label>
          <textarea
            placeholder="Write author's reference answer here..."
            value={answerObjective}
            onChange={(e) => setAnswerObjective(e.target.value)}
            className='body-md w-full px-4 py-2.5 h-44 rounded-xl border border-border dark:border-border bg-panel resize-none focus:outline-none focus:border-primary/50'
          />
        </div>
      </div>

      {/* Footer */}
      <div className='footer'>
        <button
          type='button'
          onClick={onCancel}
          className='label px-4 py-2 rounded-lg hover:bg-background-secondary hover:bg-background-secondary transition-colors text-ink-secondary'
        >
          Cancel
        </button>
        <button
          type='submit'
          disabled={isSubmitting || !title.trim()}
          className='label px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:opacity-90 transition-opacity disabled:opacity-50'
        >
          {isSubmitting ? 'Saving...' : 'Save Question'}
        </button>
      </div>
    </form>
  );
}
