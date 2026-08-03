/** @format */

'use client';

import React, { useId, useRef, useState } from 'react';
import { ImagePlus, Trash2 } from 'lucide-react';
import { useConsole } from '@/components/ConsoleContext';
import {
  IdentityContactCard,
  LocationAddressCard,
  EEOCard,
  ProfileEditor,
  type ProfileCardSection,
} from '@/components/forms';
import CardWithNorth from '@/components/UI/card/CardWithNorth';
import { Avatar } from '@/components/UI/Avatar/Avatar';
import { ImageCropper } from '@/components/UI/ImageCropper';
import { Button } from '@/components/UI/Button';
import { WaterfallLayout } from '@/components/layout/waterfallLayout';
import { useGlobalModalStore } from '@/lib/store/global-modal-store';

export default function ProfilePage() {
  const { profile, setProfile, saveProfile, user, saveAvatar, removeAvatar } =
    useConsole();
  const avatarInputId = useId();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isSavingAvatar, setIsSavingAvatar] = useState(false);
  const [pendingAvatarFile, setPendingAvatarFile] = useState<File | null>(null);

  const openModal = useGlobalModalStore((state) => state.actions.openModal);
  const closeModal = useGlobalModalStore((state) => state.actions.closeModal);

  const edit = (section: ProfileCardSection) =>
    openModal({
      layoutId: `profile-card-${section}`,
      className: 'w-[94vw] max-w-3xl flex max-h-[88vh] rounded-lg',
      content: (
        <ProfileEditor
          section={section}
          value={profile}
          onChange={setProfile}
          onSave={async (updated) => {
            await saveProfile(updated);
            closeModal();
          }}
          onClose={closeModal}
        />
      ),
      onClose: closeModal,
    });

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
    <div className=' w-full flex flex-col h-full overflow-hidden'>
      {/* Header */}
      <div className='mb-6 shrink-0'>
        <h1 className='title-card text-ink-primary'>
          Profile & Community Identity
        </h1>
        <p className='body-sm text-ink-secondary mt-1'>
          Update your public display avatar, contact information, and personal
          preferences
        </p>
      </div>

      {/* Form Content Area */}
      <div className='flex-1 min-h-0 overflow-y-auto custom-scrollbar-primary pb-8 pr-2'>
        <WaterfallLayout minColumnWidth={460}>
          {/* Card 1: Community Identity / Avatar */}
          <CardWithNorth
            size='sm'
            title='Community Identity'
            className='cursor-pointer p-0! '
            contentClassName='rounded-bl-[5rem]! '
          >
            <div className=''>
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
              : <div className='flex items-center gap-3 p-4 rounded-xl rounded-l-full  bg-linear-to-r from-primary/20 via-background-secondary/40 to-transparent '>
                  <Avatar
                    src={user?.avatar_url || undefined}
                    name={user?.display_name || user?.email || 'Member'}
                    customSize='96px'
                    className='shrink-0 text-base font-semibold shadow-xs'
                  />
                  <div className='min-w-0 flex-1'>
                    <p className='text-xs font-semibold text-ink-primary'>
                      {user?.avatar_url ?
                        'Replace profile photo'
                      : 'Upload profile photo'}
                    </p>
                    <p className='mt-0.5 text-[11px] text-ink-secondary leading-tight'>
                      PNG, JPEG, WebP, or GIF, up to 12 MB.
                    </p>
                  </div>
                  <div className='flex items-center gap-1.5 shrink-0'>
                    <Button
                      type='button'
                      // variant={ 'icon' }
                      // size={'icon'}
                      Icon={ImagePlus}
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isSavingAvatar}
                      aria-label='Upload profile photo'
                    >
                      {user?.avatar_url ? 'Change' : 'Choose'}
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
                        variant={'destructive'}
                        onClick={() => void clearAvatar()}
                        disabled={isSavingAvatar}
                        Icon={Trash2}
                        aria-label='Remove profile photo'
                      >
                        Remove
                      </Button>
                    )}
                  </div>
                  {isSavingAvatar && (
                    <div className='h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-primary border-t-transparent' />
                  )}
                </div>
              }
            </div>
          </CardWithNorth>

          {/* Card 2: Identity & Contact Information */}
          <IdentityContactCard
            value={profile}
            onClick={() => edit('identity')}
          />

          {/* Card 3: Location & Address */}
          <LocationAddressCard
            value={profile}
            onClick={() => edit('location')}
          />

          {/* Card 4: Background & Equal Opportunity */}
          <EEOCard value={profile} onClick={() => edit('eeo')} />
        </WaterfallLayout>
      </div>
    </div>
  );
}
