/** @format */

'use client';

import { useEffect, useState } from 'react';
import {
  CheckCircle2,
  ExternalLink,
  FileText,
  Trash2,
  UploadCloud,
  X,
} from 'lucide-react';
import { api } from '@/lib/api';
import { showGlobalToast } from '@/lib/toast';
import type { MasterResume, ResumeAsset } from '@/lib/types';
import { Button } from '@jobby/ui';

export function ActiveResumeModal({
  currentUrl,
  onClose,
  onSelected,
  onUpload,
}: {
  currentUrl: string;
  onClose: () => void;
  onSelected: (resume: MasterResume) => Promise<void>;
  onUpload: () => void;
}) {
  const [assets, setAssets] = useState<ResumeAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectingId, setSelectingId] = useState('');
  const [deletingId, setDeletingId] = useState('');

  const loadAssets = async () => setAssets(await api.resumeAssets());

  useEffect(() => {
    void loadAssets()
      .catch((error) =>
        showGlobalToast(
          error instanceof Error ? error.message : 'Could not load resumes.',
        ),
      )
      .finally(() => setLoading(false));
  }, []);

  const selectAsset = async (asset: ResumeAsset) => {
    if (asset.url === currentUrl) return;
    setSelectingId(asset.profile_id);
    try {
      const nextResume = await api.selectResumeAsset(asset.profile_id);
      await onSelected(nextResume);
      showGlobalToast('Resume and job profile switched.');
      onClose();
    } catch (error) {
      showGlobalToast(
        error instanceof Error ? error.message : 'Could not switch profile.',
      );
    } finally {
      setSelectingId('');
    }
  };

  const deleteAsset = async (asset: ResumeAsset) => {
    if (
      !window.confirm(
        `Delete ${asset.filename}? The PDF will also be removed from storage.`,
      )
    )
      return;
    setDeletingId(asset.profile_id);
    try {
      await api.deleteResumeAsset(asset.profile_id);
      await loadAssets();
      showGlobalToast('Resume deleted and storage released.');
    } catch (error) {
      showGlobalToast(
        error instanceof Error ? error.message : 'Could not delete the resume.',
      );
    } finally {
      setDeletingId('');
    }
  };

  return (
    <div className='flex max-h-[82vh] min-h-[420px] flex-col'>
      <header className='flex items-start justify-between gap-5 px-6 py-5'>
        <div>
          <h2 className='title-section text-ink-primary'>Active Resume</h2>
          <p className='body-sm mt-1 max-w-xl text-ink-secondary'>
            Each resume has its own job targets and application settings.
            Switching resumes switches the complete profile used for
            applications.
          </p>
        </div>
        <button
          type='button'
          title='Close'
          aria-label='Close active resume'
          onClick={onClose}
          className='flex size-9 shrink-0 items-center justify-center rounded-md text-ink-secondary hover:bg-background-secondary hover:text-ink-primary'
        >
          <X className='size-4' />
        </button>
      </header>

      <div className='custom-scrollbar-primary flex-1 overflow-y-auto px-6 py-5'>
        {loading ?
          <p className='body-sm text-ink-secondary'>Loading resumes...</p>
        : assets.length ?
          <div className='space-y-3'>
            {assets.map((asset) => {
              const isCurrent = asset.url === currentUrl;
              return (
                <article
                  key={asset.profile_id}
                  className={`p-4 rounded-xl ${isCurrent ? 'bg-primary/10' : 'bg-background-secondary/60'}`}
                >
                  <div className='flex flex-wrap items-start justify-between gap-3'>
                    <div className='min-w-0'>
                      <div className='flex items-center gap-2'>
                        <FileText className='size-4 shrink-0 text-primary' />
                        <h3 className='truncate label text-ink-primary'>
                          {asset.filename}
                        </h3>
                      </div>
                      <p className='body-sm mt-1 text-ink-secondary'>
                        Updated{' '}
                        {new Date(asset.updated_at).toLocaleDateString()}
                      </p>
                    </div>
                    {isCurrent && (
                      <span className='rounded-md bg-emerald-500/10 px-2 py-1 text-xs font-semibold text-emerald-600'>
                        Active profile
                      </span>
                    )}
                  </div>
                  <div className='mt-4 flex flex-wrap gap-2'>
                    <Button
                      size='sm'
                      Icon={CheckCircle2}
                      variant={isCurrent ? 'secondary' : 'default'}
                      isLoading={selectingId === asset.profile_id}
                      disabled={isCurrent}
                      onClick={() => void selectAsset(asset)}
                    >
                      {isCurrent ? 'Current profile' : 'Switch profile'}
                    </Button>
                    <a href={asset.url} target='_blank' rel='noreferrer'>
                      <Button size='sm' variant='secondary' Icon={ExternalLink}>
                        View PDF
                      </Button>
                    </a>
                    {!isCurrent && (
                      <Button
                        size='sm'
                        variant='secondary'
                        Icon={Trash2}
                        isLoading={deletingId === asset.profile_id}
                        onClick={() => void deleteAsset(asset)}
                      >
                        Delete
                      </Button>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        : <p className='body-sm text-ink-secondary'>
            No saved resume versions.
          </p>
        }
      </div>

      <footer className='footer'>
        <Button variant='secondary' onClick={onClose}>
          Close
        </Button>
        <Button Icon={UploadCloud} onClick={onUpload}>
          Upload new resume
        </Button>
      </footer>
    </div>
  );
}
