/** @format */

'use client';

import React from 'react';
import { useConsole } from '@/components/ConsoleContext';
import { ProfileForm, PreferencesForm } from '@/components/forms';

export default function ProfilePage() {
  const {
    profile,
    setProfile,
    saveProfile,
    preferences,
    setPreferences,
    savePreferences,
  } = useConsole();

  return (
    <div className='grid grid-cols-1 gap-6'>
      <ProfileForm
        value={profile}
        onChange={setProfile}
        onSave={saveProfile}
      />
      <PreferencesForm
        value={preferences}
        onChange={setPreferences}
        onSave={savePreferences}
      />
    </div>
  );
}
