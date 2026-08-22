/** @format */

'use client';

import React, { useId, useRef, useState } from 'react';
import { Avatar, Button, ImageCropper, Tooltip } from '@jobby/ui';
import { ImagePlus, LogOut, Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useAuthStore } from '@/lib/store';
import type { User } from '@/lib/types';
import { ProfileSectionCard } from '../ProfileSectionCard';

interface AccountSectionProps {
  user: User | null;
  onSaveAvatar: (file: File) => Promise<void>;
  onRemoveAvatar: () => Promise<void>;
}

export function AccountSection({
  user,
  onSaveAvatar,
  onRemoveAvatar,
}: AccountSectionProps) {
  const router = useRouter();
  const supabase = createClient();
  const authLogout = useAuthStore((state) => state.logout);
  const avatarInputId = useId();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isSavingAvatar, setIsSavingAvatar] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [pendingAvatarFile, setPendingAvatarFile] = useState<File | null>(null);

  const uploadAvatar = async (file: File | undefined) => {
    if (!file) return;
    setIsSavingAvatar(true);
    try {
      await onSaveAvatar(file);
    } finally {
      setIsSavingAvatar(false);
    }
  };

  const clearAvatar = async () => {
    setIsSavingAvatar(true);
    try {
      await onRemoveAvatar();
    } finally {
      setIsSavingAvatar(false);
    }
  };

  const signOut = async () => {
    setIsSigningOut(true);
    try {
      await supabase.auth.signOut();
      authLogout();
      router.push('/login');
    } catch (error) {
      console.error('Failed to sign out:', error);
    } finally {
      setIsSigningOut(false);
    }
  };

  return (
    <ProfileSectionCard id='account' title='Account'>
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
      : <div className='flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-3 rounded-xl bg-background-secondary/30'>
          <div className='flex items-center gap-3.5 min-w-0'>
            <Avatar
              src={user?.avatar_url || undefined}
              name={user?.display_name || user?.email || 'Member'}
              customSize='64px'
              className='shrink-0 text-base font-bold shadow-xs'
            />

            <div className='flex flex-col min-w-0'>
              <p className='text-sm font-semibold text-ink-primary truncate'>
                {user?.display_name || 'Member'}
              </p>
              <p className='text-xs text-ink-secondary truncate'>
                {user?.email || 'Account email unavailable'}
              </p>
            </div>
          </div>

          <div className='flex items-center gap-2 flex-wrap shrink-0'>
            <Button
              type='button'
              size='sm'
              Icon={ImagePlus}
              onClick={() => fileInputRef.current?.click()}
              disabled={isSavingAvatar}
              aria-label='Upload profile photo'
            >
              {user?.avatar_url ? 'Change Photo' : 'Upload Photo'}
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
              <Tooltip content='Remove profile photo' side='top'>
                <Button
                  type='button'
                  variant='secondary'
                  size='sm'
                  onClick={() => void clearAvatar()}
                  disabled={isSavingAvatar}
                  Icon={Trash2}
                  aria-label='Remove profile photo'
                />
              </Tooltip>
            )}

            <Button
              type='button'
              variant='ghost'
              size='sm'
              Icon={LogOut}
              onClick={() => void signOut()}
              isLoading={isSigningOut}
              disabled={isSigningOut}
              className='text-ink-secondary hover:text-rose-500'
            >
              Sign out
            </Button>
          </div>
        </div>
      }
    </ProfileSectionCard>
  );
}
