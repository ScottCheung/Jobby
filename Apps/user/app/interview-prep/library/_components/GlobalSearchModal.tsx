'use client';

import React, { useEffect, useState } from 'react';
import { Search, Plus, Check, Loader2, X, Globe, User } from 'lucide-react';
import { api } from '@/lib/api';
import type { InterviewQuestion } from '@/lib/types';
import { Button } from '@/components/UI/Button';
import { EmptyState } from '@/components/UI/EmptyState';

interface GlobalSearchModalProps {
  onClose: () => void;
  onAdded?: () => void;
  existingQuestionIds?: string[];
}

export function GlobalSearchModal({
  onClose,
  onAdded,
  existingQuestionIds,
}: GlobalSearchModalProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<InterviewQuestion[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [addingIds, setAddingIds] = useState<Set<string>>(new Set());
  const [localExistingIds, setLocalExistingIds] = useState<string[]>(
    existingQuestionIds || [],
  );

  useEffect(() => {
    if (existingQuestionIds) {
      setLocalExistingIds(existingQuestionIds);
      return;
    }
    api
      .interviewQuestions()
      .then((qs) => setLocalExistingIds(qs.map((q) => q.id)))
      .catch(console.error);
  }, [existingQuestionIds]);

  useEffect(() => {
    const delayDebounceFn = window.setTimeout(() => {
      if (query.trim().length >= 2) {
        searchGlobal();
      } else {
        setResults([]);
      }
    }, 500);
    return () => window.clearTimeout(delayDebounceFn);
  }, [query]);

  const searchGlobal = async () => {
    setIsLoading(true);
    try {
      const data = await api.searchGlobalQuestions(query.trim());
      setResults(data);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAdd = async (q: InterviewQuestion) => {
    setAddingIds((prev) => new Set(prev).add(q.id));
    try {
      await api.createInterviewQuestion({
        title: q.title,
        answer_objective: q.answer_objective,
        category_id: q.category_id,
        tags: q.tags?.map((t) => t.id) as any,
      });
      onAdded?.();
      window.dispatchEvent(new Event('playbookLibraryUpdated'));
      setLocalExistingIds((prev) => [...prev, q.id]);
    } catch (err) {
      console.error(err);
    } finally {
      setAddingIds((prev) => {
        const next = new Set(prev);
        next.delete(q.id);
        return next;
      });
    }
  };

  return (
    <div className='flex h-full min-h-0 flex-col'>
      <div className='header'>
        <Globe className='h-5 w-5 text-primary' />
        <div className='relative flex-1'>
          <input
            autoFocus
            type='text'
            placeholder='Search global community questions...'
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className='w-full border-none bg-transparent text-lg text-ink-primary outline-none placeholder:text-ink-secondary'
          />
        </div>
        {isLoading && (
          <Loader2 className='h-5 w-5 animate-spin text-ink-secondary' />
        )}
        <button
          type='button'
          onClick={onClose}
          className='rounded-xl p-2 text-ink-secondary hover:bg-background'
        >
          <X className='h-5 w-5' />
        </button>
      </div>

      <div className='body custom-scrollbar-primary'>
        {query.trim().length < 2 && (
          <div className='py-12 text-center text-ink-secondary'>
            Type at least 2 characters to search the global community.
          </div>
        )}
        {query.trim().length >= 2 && results.length === 0 && !isLoading && (
          <EmptyState
            icon={Search}
            title='No results'
            description={`No global questions found matching "${query}".`}
          />
        )}
        {results.map((q) => {
          const isAdded = localExistingIds.includes(q.id);
          const isAdding = addingIds.has(q.id);
          return (
            <div key={q.id} className='panel-lg flex items-start gap-4'>
              <div className='w-full flex-1'>
                <h4 className='mb-1 flex font-semibold text-ink-primary'>
                  {q.title}
                </h4>
                <div className='flex items-center gap-3 text-xs text-ink-secondary'>
                  {q.category && (
                    <span className='rounded-full bg-background-secondary px-2 py-0.5'>
                      {q.category.name}
                    </span>
                  )}
                  <div className='flex items-center gap-1'>
                    <User className='h-3 w-3' />
                    Community Contribution
                  </div>
                </div>
              </div>
              <Button
                size='sm'
                variant={isAdded ? 'secondary' : 'default'}
                disabled={isAdded || isAdding}
                onClick={() => handleAdd(q)}
                Icon={isAdded ? Check : isAdding ? Loader2 : Plus}
              >
                {isAdded ? 'In Library' : isAdding ? 'Adding...' : 'Add to Library'}
              </Button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
