/** @format */

'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  ExternalLink,
  FileSpreadsheet,
  Search,
  Sparkles,
  X,
} from 'lucide-react';
import { Avatar, Button, WaterfallLayout, motion } from '@jobby/ui';
import { api } from '@/lib/api';
import type { JobRecommendation } from '@/lib/types';
import { useGlobalModalStore } from '@/lib/store/global-modal-store';
import { RecommendationDiscoveryModal } from './_components/recommendation-discovery-modal';
import { RecommendationImportModal } from './_components/recommendation-import-modal';

export default function RecommendationsPage() {
  const [recommendations, setRecommendations] = useState<JobRecommendation[]>(
    [],
  );
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  const openModal = useGlobalModalStore((state) => state.actions.openModal);
  const closeModal = useGlobalModalStore((state) => state.actions.closeModal);

  const loadRecommendations = async () => {
    setIsLoading(true);
    try {
      setRecommendations(await api.recommendations());
    } catch (error) {
      console.error('Failed to load recommendations', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadRecommendations();
  }, []);

  const updateStatus = async (
    recommendation: JobRecommendation,
    status: 'dismissed' | 'started',
  ) => {
    try {
      await api.updateRecommendation(recommendation.id, { status });
      setRecommendations((items) =>
        items.filter((item) => item.id !== recommendation.id),
      );
      if (status === 'started' && recommendation.job_link) {
        window.open(recommendation.job_link, '_blank', 'noopener,noreferrer');
      }
    } catch (error) {
      console.error('Failed to update recommendation', error);
    }
  };

  const openDiscovery = () => {
    openModal({
      layoutId: 'ai-job-discovery-modal',
      className: 'w-[92vw] max-w-3xl max-h-[92vh] overflow-hidden',
      content: (
        <RecommendationDiscoveryModal
          onClose={closeModal}
          onOpenImport={openImport}
        />
      ),
      onClose: closeModal,
    });
  };

  const openImport = () => {
    openModal({
      layoutId: 'ai-recommendation-import-modal',
      className: 'w-[94vw] max-w-6xl max-h-[88vh] overflow-hidden',
      content: (
        <RecommendationImportModal
          onClose={closeModal}
          onImported={loadRecommendations}
        />
      ),
      onClose: closeModal,
    });
  };

  const filteredRecommendations = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return recommendations;
    return recommendations.filter((item) => {
      return (
        item.title?.toLowerCase().includes(query) ||
        item.company?.toLowerCase().includes(query) ||
        item.work_location?.toLowerCase().includes(query) ||
        item.platform?.toLowerCase().includes(query) ||
        item.recommendation_reason?.toLowerCase().includes(query)
      );
    });
  }, [recommendations, searchQuery]);

  return (
    <div className='w-full space-y-5 pb-12'>
      {/* Header */}
      <div>
        <h2 className='title-page bg-primary-gradient bg-clip-text text-transparent'>
          Job Recommendations
        </h2>
        <p className='mt-1 text-xs text-ink-secondary'>
          Discover targeted opportunities with AI or create custom application plans.
        </p>
      </div>

      {/* Two Large Action Cards with Shared layoutId */}
      <div className='grid grid-cols-1 gap-4 md:grid-cols-2'>
        <motion.div
          layout
          layoutId='ai-job-discovery-modal'
          transition={{ type: 'spring', duration: 0.7, bounce: 0.2 }}
          onClick={openDiscovery}
          role='button'
          tabIndex={0}
          style={{ transition: 'none' }}
          onKeyDown={(e) => e.key === 'Enter' && openDiscovery()}
          className='group relative flex cursor-pointer flex-col justify-between rounded-2xl border border-primary/20 bg-panel/75 p-5 hover:border-primary/50'
        >
          <div className='flex items-start gap-3.5'>
            <div className='flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary-gradient text-white shadow-xs'>
              <Sparkles className='size-5' />
            </div>
            <div className='min-w-0 flex-1'>
              <div className='flex items-center justify-between gap-2'>
                <h3 className='text-sm font-bold text-ink-primary group-hover:text-primary'>
                  Discover with AI
                </h3>
                <ArrowRight className='size-4 text-ink-secondary group-hover:text-primary' />
              </div>
              <p className='mt-1 text-xs leading-relaxed text-ink-secondary'>
                Generate tailored job search prompts matched against your master resume and preferred platforms.
              </p>
            </div>
          </div>
          <div className='mt-4 flex items-center justify-end border-t border-border/20 pt-3'>
            <span className='inline-flex items-center gap-1 text-xs font-semibold text-primary'>
              <span>Discover Jobs</span>
              <ArrowRight className='size-3.5' />
            </span>
          </div>
        </motion.div>

        <motion.div
          layout
          layoutId='ai-recommendation-import-modal'
          transition={{ type: 'spring', duration: 0.7, bounce: 0.2 }}
          onClick={openImport}
          role='button'
          tabIndex={0}
          style={{ transition: 'none' }}
          onKeyDown={(e) => e.key === 'Enter' && openImport()}
          className='group relative flex cursor-pointer flex-col justify-between rounded-2xl border border-primary/20 bg-panel/75 p-5 hover:border-primary/50'
        >
          <div className='flex items-start gap-3.5'>
            <div className='flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary shadow-xs'>
              <FileSpreadsheet className='size-5' />
            </div>
            <div className='min-w-0 flex-1'>
              <div className='flex items-center justify-between gap-2'>
                <h3 className='text-sm font-bold text-ink-primary group-hover:text-primary'>
                  Create Application Plan
                </h3>
                <ArrowRight className='size-4 text-ink-secondary group-hover:text-primary' />
              </div>
              <p className='mt-1 text-xs leading-relaxed text-ink-secondary'>
                Import job opportunities via TSV format to build and organize your active application pipeline.
              </p>
            </div>
          </div>
          <div className='mt-4 flex items-center justify-end border-t border-border/20 pt-3'>
            <span className='inline-flex items-center gap-1 text-xs font-semibold text-primary'>
              <span>Import Plan</span>
              <ArrowRight className='size-3.5' />
            </span>
          </div>
        </motion.div>
      </div>

      {/* Single Search Input */}
      <div className='relative w-full'>
        <Search className='absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-ink-secondary/60' />
        <input
          type='text'
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder={`Search ${recommendations.length} recommendations by title, company, location...`}
          className='w-full rounded-xl border border-border/40 bg-panel/70 py-2.5 pl-10 pr-10 text-xs text-ink-primary placeholder:text-ink-secondary/50 outline-none focus:border-primary focus:ring-1 focus:ring-primary/20'
        />
        {searchQuery && (
          <button
            type='button'
            onClick={() => setSearchQuery('')}
            className='absolute right-3 top-1/2 -translate-y-1/2 cursor-pointer rounded-full p-1 text-ink-secondary hover:text-ink-primary'
          >
            <X className='size-3.5' />
          </button>
        )}
      </div>

      {/* Recommendations Cards Area */}
      {isLoading ? (
        <div className='flex h-48 flex-col items-center justify-center gap-2 text-xs text-ink-secondary'>
          <div className='size-6 animate-spin rounded-full border-2 border-primary border-t-transparent' />
          <span>Loading recommendations…</span>
        </div>
      ) : filteredRecommendations.length === 0 ? (
        <div className='flex min-h-[220px] flex-col items-center justify-center rounded-2xl border border-dashed border-border/60 bg-panel/30 p-6 text-center'>
          <p className='text-xs text-ink-secondary'>
            {searchQuery
              ? 'No recommendations match your search.'
              : 'No recommendations available yet.'}
          </p>
          {searchQuery ? (
            <Button
              size='sm'
              variant='ghost'
              className='mt-3 text-xs'
              onClick={() => setSearchQuery('')}
            >
              Clear Search
            </Button>
          ) : (
            <Button
              size='sm'
              className='mt-3 text-xs'
              onClick={openDiscovery}
            >
              Discover with AI
            </Button>
          )}
        </div>
      ) : (
        <WaterfallLayout minColumnWidth={340} gap={16}>
          {filteredRecommendations.map((recommendation) => (
            <RecommendationCard
              key={recommendation.id}
              recommendation={recommendation}
              onDismiss={() => updateStatus(recommendation, 'dismissed')}
              onStart={() => updateStatus(recommendation, 'started')}
            />
          ))}
        </WaterfallLayout>
      )}
    </div>
  );
}

function RecommendationCard({
  recommendation,
  onDismiss,
  onStart,
}: {
  recommendation: JobRecommendation;
  onDismiss: () => void;
  onStart: () => void;
}) {
  return (
    <article className='flex flex-col justify-between rounded-2xl border border-border/30 bg-panel/75 p-5 shadow-xs hover:border-primary/30'>
      <div>
        <div className='flex items-start justify-between gap-3'>
          <div className='flex min-w-0 items-center gap-2.5'>
            <Avatar
              size='md'
              name={recommendation.company || recommendation.title || 'Job'}
            />
            <div className='min-w-0'>
              <p className='truncate text-xs font-medium text-ink-secondary'>
                {recommendation.company || 'Unknown company'}
              </p>
              <h3 className='truncate text-sm font-bold text-ink-primary'>
                {recommendation.title || 'Untitled role'}
              </h3>
            </div>
          </div>
          <span className='rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-bold text-primary shrink-0'>
            {recommendation.match_score}%
          </span>
        </div>

        <div className='mt-3.5 rounded-xl bg-background-secondary/30 p-3 text-xs text-ink-secondary'>
          <div className='flex flex-wrap gap-x-3 gap-y-1 text-[11px]'>
            {recommendation.work_location && (
              <span>{recommendation.work_location}</span>
            )}
            {recommendation.work_style && (
              <span className='capitalize'>{recommendation.work_style}</span>
            )}
            {recommendation.platform && (
              <span className='capitalize'>{recommendation.platform}</span>
            )}
          </div>
          {recommendation.recommendation_reason && (
            <p className='mt-2 leading-relaxed text-ink-primary/80'>
              {recommendation.recommendation_reason}
            </p>
          )}
        </div>
      </div>

      <div className='mt-4 flex items-center justify-between gap-2 border-t border-border/20 pt-3'>
        <div className='flex items-center gap-1'>
          {recommendation.job_link && (
            <button
              type='button'
              aria-label='Open job'
              className='cursor-pointer rounded-lg p-2 text-ink-secondary hover:bg-background-secondary hover:text-primary'
              onClick={() =>
                window.open(
                  recommendation.job_link!,
                  '_blank',
                  'noopener,noreferrer',
                )
              }
            >
              <ExternalLink className='size-4' />
            </button>
          )}
          <button
            type='button'
            aria-label='Dismiss recommendation'
            className='cursor-pointer rounded-lg p-2 text-ink-secondary hover:bg-background-secondary hover:text-red-500'
            onClick={onDismiss}
          >
            <X className='size-4' />
          </button>
        </div>
        <Button type='button' size='sm' onClick={onStart}>
          Start application
        </Button>
      </div>
    </article>
  );
}
