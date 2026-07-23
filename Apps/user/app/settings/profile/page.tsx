/** @format */

'use client';

import React, { useId, useState } from 'react';
import { ImagePlus, Trash2 } from 'lucide-react';
import { useConsole } from '@/components/ConsoleContext';
import { ProfileForm } from '@/components/forms';
import CardWithNorth from '@/components/UI/card/CardWithNorth';
import { Avatar } from '@/components/UI/Avatar/Avatar';
import { ImageCropper } from '@/components/UI/ImageCropper';

export default function ProfilePage() {
  const { profile, setProfile, saveProfile, user, saveAvatar, removeAvatar } =
    useConsole();
  const avatarInputId = useId();
  const [isSavingAvatar, setIsSavingAvatar] = useState(false);
  const [pendingAvatarFile, setPendingAvatarFile] = useState<File | null>(null);

  const uploadAvatar = async (file: File | undefined) => {
    if (!file) return;
    setIsSavingAvatar(true);
    try {
      await saveAvatar(file);
    } catch {
      // ConsoleContext exposes the upload failure through the shared error state.
    } finally {
      setIsSavingAvatar(false);
    }
  };

  const clearAvatar = async () => {
    setIsSavingAvatar(true);
    try {
      await removeAvatar();
    } catch {
      // ConsoleContext exposes the removal failure through the shared error state.
    } finally {
      setIsSavingAvatar(false);
    }
  };

  return (
    <div className='custom-scrollbar-primary grid grid-cols-1 gap-6'>
      <CardWithNorth title='Community Identity'>
        <div className='pb-6 pr-6'>
          {pendingAvatarFile ?
            <ImageCropper
              file={pendingAvatarFile}
              aspectRatio={1}
              maxOutputEdge={256}
              outputQuality={0.65}
              title='Crop profile photo'
              onConfirm={(croppedFile) => {
                setPendingAvatarFile(null);
                void uploadAvatar(croppedFile);
              }}
              onCancel={() => setPendingAvatarFile(null)}
            />
          : <div className='flex items-center gap-3 rounded-2xl border border-dashed border-border bg-background-secondary/50 p-3'>
              <Avatar
                src={user?.avatar_url || undefined}
                name={user?.display_name || user?.email || 'Member'}
                customSize='64px'
                className='shrink-0 text-lg'
              />
              <div className='min-w-0 flex-1'>
                <p className='text-sm font-semibold text-ink-primary'>
                  {user?.avatar_url ?
                    'Replace profile photo'
                  : 'Upload a profile photo'}
                </p>
                <p className='mt-1 text-xs text-ink-secondary'>
                  Square cropped and compressed to a compact 256px WebP. PNG,
                  JPEG, WebP, or GIF, up to 12 MB.
                </p>
              </div>
              <label
                htmlFor={avatarInputId}
                className='ml-auto inline-flex shrink-0 cursor-pointer items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-ink-primary transition-colors hover:bg-background-secondary'
              >
                <ImagePlus className='h-3.5 w-3.5' />
                {user?.avatar_url ? 'Change image' : 'Choose image'}
              </label>
              <input
                id={avatarInputId}
                type='file'
                accept='image/png,image/jpeg,image/webp,image/gif'
                className='sr-only'
                onChange={(event) =>
                  setPendingAvatarFile(event.target.files?.[0] || null)
                }
              />
              {user?.avatar_url && (
                <button
                  type='button'
                  onClick={() => void clearAvatar()}
                  disabled={isSavingAvatar}
                  aria-label='Remove profile photo'
                  className='shrink-0 rounded-lg p-2 text-ink-secondary transition-colors hover:bg-rose-500/10 hover:text-rose-600 disabled:cursor-not-allowed disabled:opacity-60'
                >
                  <Trash2 className='h-3.5 w-3.5' />
                </button>
              )}
              {isSavingAvatar && (
                <div className='h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-primary border-t-transparent' />
              )}
            </div>
          }
        </div>
      </CardWithNorth>
      <ProfileForm
        value={profile}
        onChange={setProfile}
        onSave={() => void saveProfile()}
      />
    </div>
  );
}
