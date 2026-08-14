/** @format */

'use client';
import { Button, EmptyState } from '@jobby/ui';

import React, { useEffect, useState } from 'react';
import {
  Search,
  Plus,
  Check,
  Loader2,
  X,
  BookOpen,
  Layers3,
  User,
} from 'lucide-react';
import { api } from '@/lib/api';
import type { InterviewCollection, InterviewQuestion } from '@/lib/types';

import Link from 'next/link';

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
  const [questionResults, setQuestionResults] = useState<InterviewQuestion[]>(
    [],
  );
  const [collectionResults, setCollectionResults] = useState<
    InterviewCollection[]
  >([]);
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
      .then((qs) => setLocalExistingIds((qs.items || []).map((q) => q.id)))
      .catch(console.error);
  }, [existingQuestionIds]);

  useEffect(() => {
    const delayDebounceFn = window.setTimeout(() => {
      if (query.trim().length >= 2) {
        searchGlobal();
      } else {
        setQuestionResults([]);
        setCollectionResults([]);
      }
    }, 700);
    return () => window.clearTimeout(delayDebounceFn);
  }, [query]);

  const searchGlobal = async () => {
    setIsLoading(true);
    try {
      const searchTerm = query.trim();
      const [questions, collections] = await Promise.all([
        api.searchGlobalQuestions(searchTerm),
        api.interviewCollections(),
      ]);
      const normalizedQuery = searchTerm.toLowerCase();
      setQuestionResults(questions);
      setCollectionResults(
        collections.filter((collection) =>
          [
            collection.title,
            collection.description || '',
            collection.theme || '',
            collection.creator_name || '',
          ].some((value) => value.toLowerCase().includes(normalizedQuery)),
        ),
      );
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAdd = async (q: InterviewQuestion) => {
    setAddingIds((prev) => new Set(prev).add(q.id));
    try {
      await api.saveInterviewQuestion(q.id);
      onAdded?.();
      window.dispatchEvent(new Event('playbookLibraryUpdated'));
      setLocalExistingIds((prev) => [...new Set([...prev, q.id])]);
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
        <Search className='h-5 w-5 text-primary mr-4' />
        <div className='relative flex-1'>
          <input
            autoFocus
            type='text'
            placeholder='Search questions and Question Sets...'
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
          <EmptyState
            // icon={Search}
            title='No results'
            description={`Type at least 2 characters to search questions and Question Sets.`}
          />
        )}
        {query.trim().length >= 2 &&
          questionResults.length === 0 &&
          collectionResults.length === 0 &&
          !isLoading && (
            <EmptyState
              icon={Search}
              title='No results'
              description={`No questions or Question Sets found matching "${query}".`}
            />
          )}
        {questionResults.length > 0 && (
          <section className='grid gap-3'>
            <div className='flex items-center gap-2 px-1 pt-1 text-xs font-bold uppercase tracking-wide text-ink-secondary'>
              <Search className='h-3.5 w-3.5 text-primary' />
              Matching Questions
            </div>
            <div className='grid gap-3 md:grid-cols-2'>
              {questionResults.map((question) => {
                const isAdded = localExistingIds.includes(question.id);
                const isAdding = addingIds.has(question.id);
                return (
                  <article
                    key={question.id}
                    className='panel-lg flex min-h-[158px] flex-col justify-between gap-4 transition-colors hover:border-primary/40'
                  >
                    <Link
                      href={`/interview-prep/practice/${question.display_number || question.id}`}
                      onClick={onClose}
                      className='min-w-0'
                    >
                      <h4 className='font-semibold leading-snug text-ink-primary line-clamp-3'>
                        {question.title}
                      </h4>
                      <div className='mt-3 flex flex-wrap items-center gap-2 text-xs text-ink-secondary'>
                        {question.category && (
                          <span className='rounded-full bg-background-secondary px-2 py-0.5'>
                            {question.category.name}
                          </span>
                        )}
                        <span className='flex items-center gap-1'>
                          <User className='h-3 w-3' />
                          Community Question
                        </span>
                      </div>
                    </Link>
                    <div className='flex justify-end'>
                      <Button
                        size='sm'
                        variant={isAdded ? 'secondary' : 'default'}
                        disabled={isAdded || isAdding}
                        onClick={() => handleAdd(question)}
                        Icon={
                          isAdded ? Check
                          : isAdding ?
                            Loader2
                          : Plus
                        }
                      >
                        {isAdded ?
                          'In Library'
                        : isAdding ?
                          'Adding...'
                        : 'Add to Library'}
                      </Button>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        )}

        {collectionResults.length > 0 && (
          <section className='mt-6 grid gap-3'>
            <div className='flex items-center gap-2 px-1 pt-1 text-xs font-bold uppercase tracking-wide text-ink-secondary'>
              <Layers3 className='h-3.5 w-3.5 text-primary' />
              Matching Question Sets
            </div>
            <div className='grid gap-3 md:grid-cols-2'>
              {collectionResults.map((collection) => (
                <Link
                  key={collection.id}
                  href={`/interview-prep/collections?search=${encodeURIComponent(collection.title)}`}
                  onClick={onClose}
                  className='panel-lg flex min-h-[158px] flex-col justify-between gap-4 transition-colors hover:border-primary/40'
                >
                  <span className='flex items-start gap-3'>
                    <span className='flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary'>
                      <BookOpen className='h-4 w-4' />
                    </span>
                    <span className='min-w-0'>
                      <span className='block font-semibold text-ink-primary line-clamp-2'>
                        {collection.title}
                      </span>
                      <span className='mt-1 block line-clamp-2 text-xs text-ink-secondary'>
                        {collection.description ||
                          'A curated Question Set for focused interview practice.'}
                      </span>
                    </span>
                  </span>
                  <span className='flex flex-wrap items-center gap-2 text-[11px] text-ink-secondary'>
                    <span>{collection.question_count} questions</span>
                    {collection.theme && <span>{collection.theme}</span>}
                    <span>
                      {collection.collection_type === 'official' ?
                        'Official'
                      : 'Community'}
                    </span>
                  </span>
                </Link>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
