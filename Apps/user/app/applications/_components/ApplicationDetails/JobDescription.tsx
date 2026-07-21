/** @format */

'use client';

import React from 'react';
import { Check, Edit3 } from 'lucide-react';
import { EmptyPlaceHolder } from '@/components/UI/EmptyPlaceHolder';
import { cn } from '@/lib/utils';
import { FormTextarea } from './FormControls';

interface JobDescriptionProps {
  description?: string | null;
  isEditing: boolean;
  setIsEditing: (val: boolean) => void;
  onChangeDescription: (val: string) => void;
}

export function JobDescription({
  description,
  isEditing,
  setIsEditing,
  onChangeDescription,
}: JobDescriptionProps) {
  return (
    <div className='space-y-4 animate-in fade-in duration-200'>
      <div className='flex items-center justify-between'>
        <h3 className='label-overline'>
          Job Description
        </h3>
        <button
          onClick={() => setIsEditing(!isEditing)}
          className={cn(
            'label-sm inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl transition-all border cursor-pointer',
            isEditing ?
              'text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10 border-emerald-500/20'
            : 'text-primary hover:bg-primary/10 border-primary/20',
          )}
        >
          {isEditing ?
            <>
              <Check className='w-3 h-3' />
              Done
            </>
          : <>
              <Edit3 className='w-3 h-3' />
              Edit
            </>
          }
        </button>
      </div>

      {isEditing ?
        <FormTextarea
          label=''
          value={description ?? ''}
          onChange={onChangeDescription}
          placeholder='Enter job description details here...'
          rows={15}
        />
      : description ?
        <div className='body-md whitespace-pre-wrap font-sans text-ink-secondary panel-lg'>
          {description}
        </div>
      : <EmptyPlaceHolder />}
    </div>
  );
}
