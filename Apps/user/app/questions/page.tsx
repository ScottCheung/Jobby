/** @format */

'use client';

import React, { useState, useEffect } from 'react';
import { MessageSquareCode } from 'lucide-react';
import { useConsole } from '@/components/ConsoleContext';
import { renderPagination } from '@/components/ConsoleUtils';

export default function QuestionsPage() {
  const {
    questions,
    saveQuestion,
    deleteQuestion,
  } = useConsole();

  const [questPage, setQuestPage] = useState(1);
  const questPerPage = 15;

  useEffect(() => {
    setQuestPage(1);
  }, [questions.length]);

  return (
    <div className='bg-panel rounded-2xl p-6 shadow-xs'>
      <h2 className='text-lg font-bold text-zinc-900 dark:text-zinc-50 mb-4 flex items-center gap-2'>
        <MessageSquareCode className='w-5 h-5 text-emerald-500' />
        Question Cache
      </h2>
      {questions.length === 0 ?
        <div className='p-8 text-center text-zinc-500 dark:text-zinc-400'>
          No saved answers yet.
        </div>
      : <>
          <div className='overflow-x-auto'>
            <table className='w-full text-left border-collapse text-sm'>
              <thead>
                <tr className='border-b border-zinc-100 dark:border-zinc-800 text-[11px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider'>
                  <th className='pb-3 pr-4'>Question</th>
                  <th className='pb-3 px-4'>Type</th>
                  <th className='pb-3 px-4'>Answer</th>
                  <th className='pb-3 px-4'>Used</th>
                  <th className='pb-3 pl-4'></th>
                </tr>
              </thead>
              <tbody className='divide-y divide-zinc-100 dark:divide-zinc-800/50'>
                {questions
                  .slice(
                    (questPage - 1) * questPerPage,
                    questPage * questPerPage,
                  )
                  .map((entry) => (
                    <tr
                      key={entry.id}
                      className='text-zinc-700 dark:text-zinc-300'
                    >
                      <td className='py-4 pr-4'>
                        <strong className='text-zinc-900 dark:text-zinc-100 block'>
                          {entry.original_label}
                        </strong>
                        <p className='text-xs text-zinc-400 dark:text-zinc-500 mt-0.5'>
                          {entry.companies?.slice(0, 3).join(', ')}
                        </p>
                      </td>
                      <td className='py-4 px-4 whitespace-nowrap text-xs text-zinc-500 font-mono'>
                        {entry.field_type}
                      </td>
                      <td className='py-4 px-4 min-w-[200px]'>
                        <input
                          defaultValue={entry.answer ?? ''}
                          className='w-full text-sm rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-1.5 focus:bg-panel focus:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-900/60 dark:focus:bg-zinc-900 dark:focus:border-zinc-700 focus:outline-none transition-all'
                          onBlur={(event) => {
                            if (
                              event.target.value !== (entry.answer ?? '')
                            ) {
                              void saveQuestion(
                                entry,
                                event.target.value,
                              );
                            }
                          }}
                        />
                      </td>
                      <td className='py-4 px-4 whitespace-nowrap text-zinc-500'>
                        {entry.times_used}
                      </td>
                      <td className='py-4 pl-4 text-right'>
                        <button
                          className='px-2.5 py-1.5 rounded-lg text-xs font-semibold text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-955/20 transition-all cursor-pointer'
                          onClick={() => void deleteQuestion(entry.id)}
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
          {renderPagination(
            questPage,
            questions.length,
            questPerPage,
            setQuestPage,
          )}
        </>
      }
    </div>
  );
}
