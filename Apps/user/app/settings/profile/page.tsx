/** @format */

'use client';

import React, { useId, useRef, useState } from 'react';
import { ImagePlus, Trash2 } from 'lucide-react';
import { useConsole } from '@/components/ConsoleContext';
import { ProfileForm } from '@/components/forms';
import CardWithNorth from '@/components/UI/card/CardWithNorth';
import { Avatar } from '@/components/UI/Avatar/Avatar';
import { ImageCropper } from '@/components/UI/ImageCropper';
import { Button } from '@/components/UI/Button';

export default function ProfilePage() {
  const { profile, setProfile, saveProfile, user, saveAvatar, removeAvatar } =
    useConsole();
  const avatarInputId = useId();
  const fileInputRef = useRef<HTMLInputElement>(null);
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
    <div className='flex flex-col h-full overflow-hidden'>
      {/* Header */}
      <div className='mb-6 shrink-0'>
        <h1 className='title-card text-ink-primary'>Profile & Community Identity</h1>
        <p className='body-sm text-ink-secondary mt-1'>
          Update your public display avatar, contact information, and personal preferences
        </p>
      </div>

      {/* Form Content Area */}
      <div className='flex-1 min-h-0 overflow-y-auto custom-scrollbar-primary flex flex-col gap-6 pr-2'>
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
            : <div className='flex items-center gap-3 rounded-full border-border bg-linear-to-r from-primary/30 to-transparent p-3'>
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
                    Square cropped and Submit. PNG, JPEG, WebP, or GIF, up to 12
                    MB.
                  </p>
                </div>
                <Button
                  type='button'
                  variant={'icon'}
                  Icon={ImagePlus}
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isSavingAvatar}
                  aria-label='Upload profile photo'
                >
                  {user?.avatar_url ? 'Change image' : 'Choose image'}
                </Button>

                <input
                  ref={fileInputRef}
                  id={avatarInputId}
                  type='file'
                  accept='image/png,image/jpeg,image/webp,image/gif'
                  className='sr-only'
                  onChange={(event) =>
                    setPendingAvatarFile(event.target.files?.[0] || null)
                  }
                />
                {user?.avatar_url && (
                  <Button
                    type='button'
                    variant={'icon'}
                    onClick={() => void clearAvatar()}
                    disabled={isSavingAvatar}
                    aria-label='Remove profile photo'
                  >
                    <Trash2 className='h-3.5 w-3.5' />
                  </Button>
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
    </div>
  );
}
