/** @format */

'use client';

import React from 'react';
import { Layers, Plus, Trash2 } from 'lucide-react';
import { Button } from '@jobby/ui';
import { Field } from '@/components/forms';
import { ProfileSectionCard } from '../ProfileSectionCard';
import type { CoreProfileField } from '@/lib/types';

interface CustomFieldsSectionProps {
  customFields: CoreProfileField[];
  onAddField: () => void;
  onUpdateField: (index: number, changes: Partial<CoreProfileField>) => void;
  onRemoveField: (index: number) => void;
}

export function CustomFieldsSection({
  customFields,
  onAddField,
  onUpdateField,
  onRemoveField,
}: CustomFieldsSectionProps) {
  return (
    <ProfileSectionCard id='custom' title='Custom Fields'>
      <div className='flex flex-col gap-3'>
        {customFields.length === 0 ?
          <div className='flex flex-col items-center justify-center p-6 rounded-xl bg-background-secondary/20 text-center'>
            <Layers className='h-6 w-6 text-ink-secondary/40 mb-1.5' />
            <p className='text-xs font-semibold text-ink-primary'>
              No custom fields added
            </p>
            <p className='text-[11px] text-ink-secondary/70 mt-0.5 max-w-sm'>
              Add registration IDs or custom answers for specialized questionnaires.
            </p>
            <Button
              type='button'
              size='sm'
              Icon={Plus}
              onClick={onAddField}
              className='mt-3'
            >
              Add custom field
            </Button>
          </div>
        : <div className='flex flex-col gap-2.5'>
            {customFields.map((field, index) => (
              <div
                key={field.id || `custom-${index}`}
                className='flex flex-col sm:flex-row items-start sm:items-end gap-2.5 p-2.5 rounded-xl bg-background-secondary/30'
              >
                <div className='flex-1 w-full'>
                  <Field
                    label='Field name'
                    value={field.label || ''}
                    placeholder='e.g. CPA Registration'
                    onChange={(val) => onUpdateField(index, { label: val })}
                  />
                </div>

                <div className='flex-1 w-full'>
                  <Field
                    label='Value'
                    value={field.value || ''}
                    placeholder='e.g. AU-1234567'
                    onChange={(val) => onUpdateField(index, { value: val })}
                  />
                </div>

                <Button
                  type='button'
                  variant='ghost'
                  size='icon'
                  Icon={Trash2}
                  onClick={() => onRemoveField(index)}
                  className='shrink-0 text-ink-secondary hover:text-rose-500 mb-0.5'
                  aria-label='Remove custom field'
                />
              </div>
            ))}

            <div className='flex justify-start pt-1'>
              <Button
                type='button'
                variant='secondary'
                size='sm'
                Icon={Plus}
                onClick={onAddField}
              >
                Add another field
              </Button>
            </div>
          </div>
        }
      </div>
    </ProfileSectionCard>
  );
}
