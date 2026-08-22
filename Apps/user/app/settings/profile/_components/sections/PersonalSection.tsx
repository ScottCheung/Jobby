/** @format */

'use client';

import React from 'react';
import { Field } from '@/components/forms';
import { PillGroup } from '../PillGroup';
import { ProfileSectionCard } from '../ProfileSectionCard';

const SALUTATION_OPTIONS = [
  'Mr',
  'Mrs',
  'Ms',
  'Miss',
  'Mx',
  'Dr',
  'Prof',
];

interface PersonalSectionProps {
  values: {
    title?: string | null;
    first_name?: string | null;
    middle_name?: string | null;
    last_name?: string | null;
    preferred_name?: string | null;
    preferred_middle_name?: string | null;
    preferred_last_name?: string | null;
    legal_full_name?: string | null;
  };
  onChange: (key: string, value: string) => void;
}

export function PersonalSection({ values, onChange }: PersonalSectionProps) {
  return (
    <ProfileSectionCard id='personal' title='Personal Details'>
      <div className='flex flex-col gap-4'>
        {/* Salutation / Title */}
        <PillGroup
          label='Salutation'
          options={SALUTATION_OPTIONS}
          value={values.title}
          onChange={(val) => onChange('title', val)}
          allowClear
          clearLabel='Not set'
        />

        {/* Primary Legal Names Grid */}
        <div className='grid grid-cols-1 gap-3 sm:grid-cols-3'>
          <Field
            label='First name'
            value={values.first_name || ''}
            placeholder='e.g. Scott'
            onChange={(val) => onChange('first_name', val)}
          />

          <Field
            label='Middle name'
            value={values.middle_name || ''}
            placeholder='Optional'
            onChange={(val) => onChange('middle_name', val)}
          />

          <Field
            label='Last name'
            value={values.last_name || ''}
            placeholder='e.g. Zhang'
            onChange={(val) => onChange('last_name', val)}
          />
        </div>

        {/* Preferred Names Grid */}
        <div className='grid grid-cols-1 gap-3 sm:grid-cols-3'>
          <Field
            label='Preferred first name'
            value={values.preferred_name || ''}
            placeholder='If different from legal name'
            onChange={(val) => onChange('preferred_name', val)}
          />

          <Field
            label='Preferred middle name'
            value={values.preferred_middle_name || ''}
            placeholder='Optional'
            onChange={(val) => onChange('preferred_middle_name', val)}
          />

          <Field
            label='Preferred last name'
            value={values.preferred_last_name || ''}
            placeholder='Optional'
            onChange={(val) => onChange('preferred_last_name', val)}
          />
        </div>

        {/* Legal Full Name */}
        <div className='pt-1'>
          <Field
            label='Legal full name'
            value={values.legal_full_name || ''}
            placeholder='e.g. Scott Xianzhe Zhang'
            onChange={(val) => onChange('legal_full_name', val)}
          />
        </div>
      </div>
    </ProfileSectionCard>
  );
}
