/** @format */

'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { ExternalLink, Search, X } from 'lucide-react';
import { Avatar, Button, WaterfallLayout } from '@jobby/ui';
import { api } from '@/lib/api';
import type { JobRecommendation, JobRecommendationImport } from '@/lib/types';
import { useGlobalModalStore } from '@/lib/store/global-modal-store';
import { RecommendationDiscoveryModal } from './_components/recommendation-discovery-modal';
import { RecommendationImportModal } from './_components/recommendation-import-modal';

const REQUIRED_COLUMNS = ['platform', 'title', 'match_score'] as const;

function parseTsv(input: string): JobRecommendationImport[] {
  const lines = input.trim().split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) return [];
  const headers = lines[0].split('\t').map((value) => value.trim());
  const headerIndex = new Map(headers.map((header, index) => [header, index]));
  if (REQUIRED_COLUMNS.some((column) => !headerIndex.has(column))) return [];

  return lines.slice(1).flatMap((line) => {
    const values = line.split('\t');
    const value = (column: string) =>
      values[headerIndex.get(column) ?? -1]?.trim();
    const title = value('title');
    if (!title) return [];
    const score = Number(value('match_score'));
    return [
      {
        job_id: value('job_id') || undefined,
        platform: value('platform') || 'generic',
        title,
        company: value('company') || undefined,
        work_location: value('work_location') || undefined,
        work_style: value('work_style') || undefined,
        job_link: value('job_link') || undefined,
        match_score:
          Number.isFinite(score) ? Math.max(0, Math.min(100, score)) : 0,
        recommendation_reason:
          value('recommend_reason') ||
          value('recommendation_reason') ||
          undefined,
      },
    ];
  });
}

export default function RecommendationsPage() {
  const [input, setInput] = useState('');
  const [recommendations, setRecommendations] = useState<JobRecommendation[]>(
    [],
  );
  const [isLoading, setIsLoading] = useState(true);
  const [isImporting, setIsImporting] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const openModal = useGlobalModalStore((state) => state.actions.openModal);
  const closeModal = useGlobalModalStore((state) => state.actions.closeModal);
  const preview = useMemo(() => parseTsv(input), [input]);

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

  const importRecommendations = async () => {
    if (!preview.length) return;
    setIsImporting(true);
    try {
      await api.importRecommendations(preview);
      setInput('');
      setShowImport(false);
      await loadRecommendations();
    } catch (error) {
      console.error('Failed to import recommendations', error);
    } finally {
      setIsImporting(false);
    }
  };

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
      className:
        'w-[92vw] max-w-3xl max-h-[92vh] overflow-hidden border-none bg-transparent p-0!',
      content: <RecommendationDiscoveryModal onClose={closeModal} />,
      onClose: closeModal,
    });
  };

  const openImport = () => openModal({ layoutId: 'ai-recommendation-import-modal', className: 'w-[94vw] max-w-6xl max-h-[88vh] overflow-hidden border-none bg-transparent p-0!', content: <RecommendationImportModal onClose={closeModal} onImported={loadRecommendations} />, onClose: closeModal });

  return (
    <div className='flex h-full min-h-[500px] flex-col overflow-hidden'>
      <div className=' pt-5 shrink-0'>
        <div className='flex items-center justify-between gap-4'>
          <div>
            <h2 className='title-page bg-primary-gradient bg-clip-text text-transparent'>
              AI Recommendations
            </h2>
          </div>
          <div className='flex items-center gap-2'>
            <Button
              type='button'
              size='sm'
              variant='ghost'
              layoutId='ai-job-discovery-modal'
              onClick={openDiscovery}
            >
              Discover with AI
            </Button>
            <Button type='button' size='sm' layoutId='ai-recommendation-import-modal' onClick={openImport}>Import TSV</Button>
          </div>
        </div>

        {showImport && (
          <div className='mt-4 rounded-2xl bg-panel p-4'>
            <textarea
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder='Paste TSV with platform, title, company, work_location, work_style, job_link, match_score, recommend_reason'
              className='min-h-32 w-full resize-y rounded-xl bg-background-secondary/60 p-3 text-sm text-ink-primary outline-none focus:ring-1 focus:ring-primary/30'
            />
            <div className='mt-3 flex items-center justify-between gap-3 text-xs text-ink-secondary'>
              <span>
                {preview.length ?
                  `${preview.length} jobs ready to import`
                : 'Paste a TSV header and at least one job.'}
              </span>
              <Button
                type='button'
                size='sm'
                disabled={!preview.length || isImporting}
                onClick={importRecommendations}
              >
                {isImporting ? 'Importing…' : 'Import'}
              </Button>
            </div>
          </div>
        )}

        <div className='mt-4 flex items-center gap-2 rounded-xl bg-background-secondary/30 px-3 py-2 text-xs text-ink-secondary'>
          <Search className='size-3.5' />
          <span>{recommendations.length} open recommendations</span>
        </div>
      </div>

      <div className='flex-1 overflow-y-auto custom-scrollbar-primary p-page pt-5'>
        {isLoading ?
          <div className='text-sm text-ink-secondary'>
            Loading recommendations…
          </div>
        : recommendations.length === 0 ?
          <div className='flex h-full items-center justify-center text-sm text-ink-secondary'>
            No recommendations yet.
          </div>
        : <WaterfallLayout minColumnWidth={340} gap={20}>
            {recommendations.map((recommendation) => (
              <RecommendationCard
                key={recommendation.id}
                recommendation={recommendation}
                onDismiss={() => updateStatus(recommendation, 'dismissed')}
                onStart={() => updateStatus(recommendation, 'started')}
              />
            ))}
          </WaterfallLayout>
        }
      </div>
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
    <article className='flex flex-col justify-between rounded-tl-3xl! rounded-2xl bg-panel/70 p-5 hover:shadow-md'>
      <div>
        <div className='flex items-start justify-between gap-3'>
          <div className='flex min-w-0 items-center gap-2'>
            <Avatar
              size='md'
              name={recommendation.company || recommendation.title || 'Job'}
            />
            <div className='min-w-0'>
              <p className='truncate text-xs font-medium text-ink-secondary'>
                {recommendation.company || 'Unknown company'}
              </p>
              <h3 className='truncate text-base font-bold text-ink-primary'>
                {recommendation.title || 'Untitled role'}
              </h3>
            </div>
          </div>
          <span className='rounded-full bg-primary/10 px-2.5 py-1 text-xs font-bold text-primary'>
            {recommendation.match_score}%
          </span>
        </div>
        <div className='mt-4 rounded-xl bg-background-secondary/30 p-3 text-xs text-ink-secondary'>
          <div className='flex flex-wrap gap-x-3 gap-y-1'>
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
            <p className='mt-3 leading-relaxed text-ink-primary/80'>
              {recommendation.recommendation_reason}
            </p>
          )}
        </div>
      </div>
      <div className='mt-4 flex items-center justify-between gap-2 border-t border-ink-primary/5 pt-3'>
        <div className='flex items-center gap-1'>
          {recommendation.job_link && (
            <button
              type='button'
              aria-label='Open job'
              className='rounded-lg p-2 text-ink-secondary hover:bg-background-secondary hover:text-primary'
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
            className='rounded-lg p-2 text-ink-secondary hover:bg-background-secondary hover:text-red-500'
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
