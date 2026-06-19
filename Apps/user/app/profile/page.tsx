/** @format */

'use client';

import React from 'react';
import { useConsole } from '@/components/ConsoleContext';
import { ProfileForm } from '@/components/forms';

export default function ProfilePage() {
  const {
    profile,
    setProfile,
    saveProfile,
  } = useConsole();

  return (
    <div className='grid grid-cols-1 gap-6'>
      <ProfileForm
        value={profile}
        onChange={setProfile}
        onSave={saveProfile}
      />
    </div>
  );
}
