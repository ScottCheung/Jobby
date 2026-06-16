/** @format */

'use client';

import React, { Fragment, useState, useEffect, useMemo } from 'react';
import { Briefcase, Search, RefreshCw } from 'lucide-react';
import { useConsole } from '@/components/ConsoleContext';
import { cn } from '@/lib/utils';
import { IconButton, formatDate, renderPagination } from '@/components/ConsoleUtils';
import { ApplicationDetails } from '@/components/ApplicationDetails';

export default function ApplicationsPage() {
  const {
    applications,
    statusFilter,
    setStatusFilter,
    searchText,
    setSearchText,
    batchSyncing,
    batchAsyncApplications,
    syncingApplicationId,
    asyncApplication,
    expandedApplicationId,
    setExpandedApplicationId,
    saveApplicationPatch,
    deleteApplication,
  } = useConsole();

  const [appPage, setAppPage] = useState(1);
  const appPerPage = 15;

  useEffect(() => {
    setAppPage(1);
  }, [searchText, statusFilter]);

  const filteredApplications = useMemo(() => {
    let result = applications;
    if (statusFilter) {
      result = result.filter(
        (item) => item.status.toLowerCase() === statusFilter.toLowerCase(),
      );
    }
    const query = searchText.trim().toLowerCase();
    if (!query) return result;
    return result.filter((item) =>
      [item.title, item.company, item.job_id, item.status].some((value) =>
        String(value ?? '')
          .toLowerCase()
          .includes(query),
      ),
    );
  }, [applications, statusFilter, searchText]);

  return (
    <div className='bg-panel rounded-2xl p-6 shadow-xs'>
      <h2 className='text-lg font-bold text-zinc-900 dark:text-zinc-55 mb-4 flex items-center gap-2'>
        <Briefcase className='w-5 h-5 text-emerald-500' />
        Application History
      </h2>

      {/* Toolbar */}
      <div className='flex flex-wrap gap-4 items-center justify-between bg-zinc-50 dark:bg-zinc-900/40 p-4 rounded-xl border border-zinc-100 dark:border-zinc-800/60 mb-6'>
        <div className='flex flex-wrap gap-3 flex-1'>
          <div className='relative flex-1 min-w-[200px] max-w-md'>
            <Search className='absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400' />
            <input
              placeholder='Search title, company, job id...'
              value={searchText}
              onChange={(event) => setSearchText(event.target.value)}
              className='pl-9 pr-4 py-2 w-full text-sm rounded-xl border border-zinc-200 bg-panel dark:bg-zinc-950 dark:border-zinc-800 focus:outline-none focus:border-zinc-400 dark:focus:border-zinc-750 focus:ring-1 focus:ring-zinc-400 dark:focus:ring-zinc-750 transition-all text-zinc-900 dark:text-zinc-100'
            />
          </div>
          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
            className='px-3 py-2 text-sm rounded-xl border border-zinc-200 bg-panel dark:bg-zinc-955 dark:border-zinc-800 focus:outline-none focus:border-zinc-400 dark:focus:border-zinc-750 transition-all text-zinc-900 dark:text-zinc-100 cursor-pointer'
          >
            <option value=''>All statuses</option>
            <option value='submitted'>Submitted</option>
            <option value='skipped'>Skipped</option>
            <option value='cancelled'>Cancelled</option>
          </select>
        </div>
        <button
          className='inline-flex items-center gap-2 rounded-xl border border-zinc-200 hover:bg-zinc-50 text-zinc-900 px-4 py-2 text-sm font-semibold dark:border-zinc-800 dark:text-zinc-100 dark:hover:bg-zinc-900 transition-all active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none cursor-pointer'
          onClick={() => void batchAsyncApplications()}
          disabled={batchSyncing}
        >
          <RefreshCw
            className={cn('w-4 h-4', batchSyncing && 'animate-spin')}
          />
          {batchSyncing ? 'Syncing...' : 'Sync Missing Details'}
        </button>
      </div>

      {filteredApplications.length === 0 ?
        <div className='p-8 text-center text-zinc-500 dark:text-zinc-400'>
          No applications match this view.
        </div>
      : <>
          <div className='overflow-x-auto'>
            <table className='w-full text-left border-collapse text-sm'>
              <thead>
                <tr className='border-b border-zinc-100 dark:border-zinc-800 text-[11px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider'>
                  <th className='pb-3 pr-4'>Role</th>
                  <th className='pb-3 px-4'>Company</th>
                  <th className='pb-3 px-4'>Status</th>
                  <th className='pb-3 px-4'>Applied</th>
                  <th className='pb-3 pl-4 text-right'>Actions</th>
                </tr>
              </thead>
              <tbody className='divide-y divide-zinc-100 dark:divide-zinc-800/50'>
                {filteredApplications
                  .slice(
                    (appPage - 1) * appPerPage,
                    appPage * appPerPage,
                  )
                  .map((item) => (
                    <Fragment key={item.id}>
                      <tr className='text-zinc-700 dark:text-zinc-300'>
                        <td className='py-4 pr-4'>
                          <strong className='text-zinc-900 dark:text-zinc-100 block'>
                            {item.title || 'Untitled role'}
                          </strong>
                          <div className='flex items-center gap-2 mt-1'>
                            <span className='text-[10px] px-1.5 py-0.5 rounded-md bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400 font-mono'>
                              ID: {item.job_id}
                            </span>
                            <span className='text-xs text-zinc-400 dark:text-zinc-500'>
                              {item.work_location || 'Location not recorded'}
                            </span>
                          </div>
                        </td>
                        <td className='py-4 px-4 font-semibold text-zinc-800 dark:text-zinc-200'>
                          {item.company || 'Unknown'}
                        </td>
                        <td className='py-4 px-4'>
                          <span
                            className={cn(
                              'inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider',
                              item.status === 'submitted' ?
                                'bg-green-500/5 text-green-600 dark:bg-green-900/20 dark:text-green-400'
                              : item.status === 'skipped' ?
                                'bg-amber-500/5 text-amber-600 dark:bg-amber-900/20 dark:text-amber-400'
                              : 'bg-zinc-500/5 text-zinc-650 dark:bg-zinc-800/20 dark:text-zinc-400',
                            )}
                          >
                            {item.status}
                          </span>
                          {item.skip_reason && (
                            <p
                              className='text-[10px] text-zinc-400 dark:text-zinc-500 mt-1 italic max-w-[180px] truncate'
                              title={item.skip_reason}
                            >
                              {item.skip_reason}
                            </p>
                          )}
                        </td>
                        <td className='py-4 px-4 text-xs text-zinc-400 dark:text-zinc-500 whitespace-nowrap'>
                          {formatDate(item.date_applied)}
                        </td>
                        <td className='py-4 pl-4 text-right'>
                          <div className='inline-flex gap-1.5'>
                            {item.job_link && (
                              <IconButton
                                label='Open link'
                                icon='open'
                                onClick={() =>
                                  window.open(
                                    item.job_link ?? '',
                                    '_blank',
                                    'noopener,noreferrer',
                                  )
                                }
                              />
                            )}
                            <IconButton
                              label='Async from link'
                              icon='async'
                              onClick={() => void asyncApplication(item.id)}
                              disabled={
                                !item.job_link ||
                                syncingApplicationId === item.id
                              }
                            />
                            <IconButton
                              label='Edit application'
                              icon='edit'
                              onClick={() =>
                                setExpandedApplicationId(
                                  expandedApplicationId === item.id ? '' : item.id
                                )
                              }
                            />
                            <IconButton
                              label='Delete application'
                              icon='delete'
                              onClick={() =>
                                void deleteApplication(item.id)
                              }
                              danger
                            />
                          </div>
                        </td>
                      </tr>
                      {expandedApplicationId === item.id && (
                        <tr className='bg-zinc-50/50 dark:bg-zinc-900/20'>
                          <td colSpan={5} className='p-0 border-t-0'>
                            <div className='p-6 border-t border-zinc-100 dark:border-zinc-800'>
                              <ApplicationDetails
                                application={item}
                                onSave={saveApplicationPatch}
                              />
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  ))}
              </tbody>
            </table>
          </div>
          {renderPagination(
            appPage,
            filteredApplications.length,
            appPerPage,
            setAppPage,
          )}
        </>
      }
    </div>
  );
}
