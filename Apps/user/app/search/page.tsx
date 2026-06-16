/** @format */

'use client';

import React from 'react';
import { useConsole } from '@/components/ConsoleContext';
import { SearchForm, RuntimeForm } from '@/components/forms';

export default function SearchPage() {
  const {
    searchProfile,
    setSearchProfile,
    saveSearch,
    runtimeSettings,
    setRuntimeSettings,
    saveRuntime,
  } = useConsole();

  return (
    <div className='grid grid-cols-1 gap-6'>
      <SearchForm
        value={searchProfile}
        onChange={setSearchProfile}
        onSave={saveSearch}
      />
      <RuntimeForm
        value={runtimeSettings}
        onChange={setRuntimeSettings}
        onSave={saveRuntime}
      />
    </div>
  );
}
