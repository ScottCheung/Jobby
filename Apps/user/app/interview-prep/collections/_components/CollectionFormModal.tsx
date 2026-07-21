/** @format */

'use client';

import React, { useEffect, useId, useState } from 'react';
import { Archive, Eye, ImagePlus, Loader2, LockKeyhole, X } from 'lucide-react';
import type { InterviewCollection } from '@/lib/types';
import { Button } from '@/components/UI/Button';
import {
  CardSelector,
  type CardSelectorOption,
} from '@/components/UI/CardSelector';
import { showGlobalToast } from '@/lib/toast';
import { useGlobalModalStore } from '@/lib/store/global-modal-store';
import { ImageCropper } from '@/components/UI/ImageCropper';

interface Props {
  collection?: InterviewCollection | null;
  defaultStatus?: string;
  onSave: (payload: {
    title: string;
    description?: string;
    price_coins?: number;
    status: string;
    question_ids: string[];
    cover_file?: File;
  }) => Promise<void>;
  onClose: () => void;
}

const VISIBILITY_OPTIONS: readonly CardSelectorOption<
  'draft' | 'published' | 'archived'
>[] = [
  {
    value: 'draft',
    title: 'Private draft',
    description:
      'Only you can view it. Add questions and publish when it is ready.',
    icon: LockKeyhole,
    accentColor: 'slate-500',
  },
  {
    value: 'published',
    title: 'Published',
    description:
      'Visible in Collections so other people can preview and add it.',
    icon: Eye,
    accentColor: 'success',
  },
  {
    value: 'archived',
    title: 'Stop maintaining',
    description:
      'Hide it from new users while current owners keep their access.',
    icon: Archive,
    accentColor: 'amber-500',
  },
];

export function CollectionFormModal(props: Props) {
  const openModal = useGlobalModalStore((state) => state.actions.openModal);
  const closeModal = useGlobalModalStore((state) => state.actions.closeModal);

  useEffect(() => {
    openModal({
      layoutId: 'collection-form-modal',
      content: <CollectionFormContent {...props} />,
      className: 'w-[92vw] max-w-3xl max-h-[90vh] rounded-[28px]',
      onClose: props.onClose,
    });
    return () => closeModal();
  }, [closeModal, openModal, props]);

  return null;
}

function CollectionFormContent({
  collection,
  defaultStatus,
  onSave,
  onClose,
}: Props) {
  const [title, setTitle] = useState(collection?.title || '');
  const [description, setDescription] = useState(collection?.description || '');
  const [priceCoins, setPriceCoins] = useState(collection?.price_coins || 0);
  const [status, setStatus] = useState<'draft' | 'published' | 'archived'>(
    (collection?.status || defaultStatus || 'draft') as
      | 'draft'
      | 'published'
      | 'archived',
  );
  const [isSaving, setIsSaving] = useState(false);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [pendingCoverFile, setPendingCoverFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(
    collection?.cover_url ?
      `${collection.cover_url}?t=${collection.last_updated_at ? new Date(collection.last_updated_at).getTime() : ''}`
    : null,
  );
  const coverInputId = useId();

  const handleCoverChange = (file: File | undefined) => {
    if (!file) return;
    setPendingCoverFile(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      showGlobalToast('Title is required');
      return;
    }
    setIsSaving(true);
    try {
      await onSave({
        title: title.trim(),
        description: description.trim() || undefined,
        price_coins: priceCoins,
        status: status,
        cover_file: coverFile || undefined,
        // Creation intentionally starts empty. Questions are managed from Library afterwards.
        question_ids: collection?.question_ids || [],
      });
    } catch (err) {
      console.error(err);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className='flex-1 flex flex-col overflow-hidden'
    >
      {/* Header */}
      <div className='header'>
        <div>
          <h2 className='title-card'>
            {collection ? 'Edit Collection' : 'Create A Collection'}
          </h2>
          <p className='body-sm text-ink-secondary mt-1'>
            Start with the details. Add questions from your Library whenever you
            are ready.
          </p>
        </div>
        <button
          onClick={onClose}
          type='button'
          className='rounded-xl p-1.5 text-ink-secondary hover:bg-background-secondary hover:text-ink-primary transition-colors'
        >
          <X className='h-5 w-5' />
        </button>
      </div>
      <div className='body'>
        {/* Title */}
        <div className='flex flex-col gap-1.5'>
          <label className='label-overline'>
            Title <span className='text-red-500'>*</span>
          </label>
          <input
            type='text'
            required
            placeholder='e.g., Senior React Interview Questions'
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className='body-md w-full px-4 py-2.5 rounded-xl border border-border bg-background/50 text-ink-primary focus:outline-none focus:border-primary/50'
          />
        </div>

        <div className='flex flex-col gap-2'>
          <label className='label-overline'>Cover image</label>
          {pendingCoverFile ?
            <ImageCropper
              file={pendingCoverFile}
              onConfirm={(croppedFile) => {
                setCoverFile(croppedFile);
                setCoverPreview(URL.createObjectURL(croppedFile));
                setPendingCoverFile(null);
              }}
              onCancel={() => setPendingCoverFile(null)}
            />
          : <div className='flex items-center gap-3 rounded-2xl border border-dashed border-border bg-background/35 p-3'>
              <div className='flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-gradient-to-br from-primary/15 to-emerald-500/15 text-primary'>
                {coverPreview ?
                  <img
                    src={coverPreview}
                    alt='Collection cover preview'
                    className='h-full w-full object-cover'
                  />
                : <ImagePlus className='h-5 w-5' />}
              </div>
              <div className='min-w-0'>
                <p className='text-sm font-semibold text-ink-primary'>
                  {coverFile ?
                    coverFile.name
                  : coverPreview ?
                    'Replace cover image'
                  : 'Upload a cover image'}
                </p>
                <p className='mt-1 text-xs text-ink-secondary'>
                  Cropped to 16:9 and compressed to WebP. PNG, JPEG, WebP, or
                  GIF, up to 12 MB.
                </p>
              </div>
              <label
                htmlFor={coverInputId}
                className='ml-auto shrink-0 cursor-pointer rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-ink-primary transition-colors hover:bg-background-secondary'
              >
                {coverPreview ? 'Change image' : 'Choose image'}
              </label>
              <input
                id={coverInputId}
                type='file'
                accept='image/png,image/jpeg,image/webp,image/gif'
                className='sr-only'
                onChange={(event) => handleCoverChange(event.target.files?.[0])}
              />
            </div>
          }
        </div>

        {/* Description */}
        <div className='flex flex-col gap-1.5'>
          <label className='label-overline'>Description</label>
          <textarea
            placeholder='Provide details about what concepts are covered in this collection...'
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className='body-md w-full h-24 px-4 py-2.5 rounded-xl border border-border bg-background/50 text-ink-primary resize-none focus:outline-none focus:border-primary/50'
          />
        </div>

        {/* Pricing */}
        <div className='flex flex-col gap-1.5'>
          <label className='label-overline'>Price (Coins)</label>
          <div className='flex items-center gap-3'>
            <input
              type='number'
              min={0}
              max={1000}
              value={priceCoins}
              onChange={(e) =>
                setPriceCoins(Math.max(0, parseInt(e.target.value) || 0))
              }
              className='body-md w-32 px-4 py-2 rounded-xl border border-border bg-background/50 text-ink-primary focus:outline-none focus:border-primary/50'
            />
            <span className='body-sm text-ink-secondary'>
              Setting this higher than 0 requires users to pay coins to unlock
              this collection.
            </span>
          </div>
        </div>

        <div className='flex flex-col gap-3'>
          <label className='label-overline'>Visibility</label>
          <CardSelector
            ariaLabel='Collection visibility'
            value={status}
            onChange={setStatus}
            options={VISIBILITY_OPTIONS}
          />
        </div>
      </div>

      {/* Footer Actions */}
      <div className='footer'>
        <Button
          type='button'
          variant='outline'
          onClick={onClose}
          disabled={isSaving}
          className='rounded-full'
        >
          Cancel
        </Button>
        <Button
          type='submit'
          disabled={isSaving || !title.trim()}
          className='rounded-full'
        >
          {isSaving ?
            <span className='flex items-center gap-2'>
              <Loader2 className='h-4 w-4 animate-spin' />
              Saving...
            </span>
          : collection ?
            'Save Changes'
          : 'Create Collection'}
        </Button>
      </div>
    </form>
  );
}
