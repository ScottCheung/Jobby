/** @format */

'use client';

import React from 'react';
import { Field } from '@/components/forms';
import { PillGroup } from '../PillGroup';
import { ProfileSectionCard } from '../ProfileSectionCard';

const NOTICE_PERIOD_OPTIONS = [
  { value: '0', label: '0d (Immediate)' },
  { value: '7', label: '7d' },
  { value: '14', label: '14d (2w)' },
  { value: '28', label: '28d (4w)' },
  { value: '30', label: '30d (1m)' },
  { value: '60', label: '60d (2m)' },
  { value: '90', label: '90d (3m)' },
];

const OFFICE_ATTENDANCE_OPTIONS = [
  'On-site',
  'Hybrid',
  'Remote',
  'Flexible',
];

const RELOCATION_OPTIONS = [
  'Yes',
  'No',
  'Negotiable',
];

interface CareerPreferencesSectionProps {
  values: {
    recent_employer?: string | null;
    years_experience?: string | null;
    desired_base_salary?: string | null;
    current_salary?: string | null;
    notice_period?: string | null;
    office_attendance?: string | null;
    relocation?: string | null;
  };
  onChange: (key: string, value: string) => void;
}

export function CareerPreferencesSection({
  values,
  onChange,
}: CareerPreferencesSectionProps) {
  return (
    <ProfileSectionCard id='career' title='Career Preferences'>
      <div className='flex flex-col gap-4'>
        {/* Notice Period */}
        <PillGroup
          label='Notice period'
          options={NOTICE_PERIOD_OPTIONS}
          value={values.notice_period || '0'}
          onChange={(val) => onChange('notice_period', val)}
          allowCustom
          customPlaceholder='e.g. 45 days'
        />

        {/* Workplace & Relocation */}
        <div className='grid grid-cols-1 gap-4 sm:grid-cols-2'>
          <PillGroup
            label='Workplace preference'
            options={OFFICE_ATTENDANCE_OPTIONS}
            value={values.office_attendance || 'Hybrid'}
            onChange={(val) => onChange('office_attendance', val)}
          />

          <PillGroup
            label='Relocation willingness'
            options={RELOCATION_OPTIONS}
            value={values.relocation || 'No'}
            onChange={(val) => onChange('relocation', val)}
          />
        </div>

        {/* Experience & Compensation */}
        <div className='grid grid-cols-1 gap-3 sm:grid-cols-2 pt-1'>
          <Field
            label='Most recent employer'
            value={values.recent_employer || ''}
            placeholder='e.g. Google / Canva'
            onChange={(val) => onChange('recent_employer', val)}
          />

          <Field
            label='Years of experience'
            type='number'
            value={values.years_experience || ''}
            placeholder='e.g. 5'
            onChange={(val) => onChange('years_experience', val)}
          />

          <Field
            label='Desired salary (annual)'
            type='number'
            value={values.desired_base_salary || ''}
            placeholder='e.g. 150000'
            onChange={(val) => onChange('desired_base_salary', val)}
          />

          <Field
            label='Current salary'
            type='number'
            value={values.current_salary || ''}
            placeholder='Optional'
            onChange={(val) => onChange('current_salary', val)}
          />
        </div>
      </div>
    </ProfileSectionCard>
  );
}
