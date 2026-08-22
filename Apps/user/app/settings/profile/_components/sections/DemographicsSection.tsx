/** @format */

'use client';

import React from 'react';
import { Field } from '@/components/forms';
import { PillGroup } from '../PillGroup';
import { ProfileSectionCard } from '../ProfileSectionCard';

const PRONOUN_OPTIONS = [
  'He/Him',
  'She/Her',
  'They/Them',
  'Prefer not to say',
];

const GENDER_OPTIONS = [
  'Male',
  'Female',
  'Non-binary',
  'Prefer not to say',
];

const ETHNICITY_OPTIONS = [
  'Asian',
  'White / Caucasian',
  'Hispanic / Latino',
  'Black / African American',
  'Indigenous / Native',
  'Two or more races',
  'Prefer not to say',
];

const DISABILITY_OPTIONS = [
  'No',
  'Yes',
  'Prefer not to say',
];

const VETERAN_OPTIONS = [
  'No',
  'Yes',
  'Prefer not to say',
];

interface DemographicsSectionProps {
  values: {
    pronouns?: string | null;
    gender?: string | null;
    gender_identity?: string | null;
    ethnicity?: string | null;
    disability_status?: string | null;
    veteran_status?: string | null;
  };
  onChange: (key: string, value: string) => void;
}

export function DemographicsSection({
  values,
  onChange,
}: DemographicsSectionProps) {
  return (
    <ProfileSectionCard id='demographics' title='Equal Opportunity & Diversity'>
      <div className='flex flex-col gap-4'>
        {/* Gender & Pronouns */}
        <div className='grid grid-cols-1 gap-4 sm:grid-cols-2'>
          <PillGroup
            label='Pronouns'
            options={PRONOUN_OPTIONS}
            value={values.pronouns}
            onChange={(val) => onChange('pronouns', val)}
            allowCustom
            allowClear
            clearLabel='Not set'
          />

          <PillGroup
            label='Gender'
            options={GENDER_OPTIONS}
            value={values.gender}
            onChange={(val) => onChange('gender', val)}
            allowCustom
            allowClear
            clearLabel='Not set'
          />
        </div>

        {/* Gender Identity & Ethnicity */}
        <div className='grid grid-cols-1 gap-4 sm:grid-cols-2 pt-1'>
          <Field
            label='Gender identity'
            value={values.gender_identity || ''}
            placeholder='e.g. Cisgender / Transgender (Optional)'
            onChange={(val) => onChange('gender_identity', val)}
          />

          <PillGroup
            label='Race & Ethnicity'
            options={ETHNICITY_OPTIONS}
            value={values.ethnicity}
            onChange={(val) => onChange('ethnicity', val)}
            allowCustom
            allowClear
            clearLabel='Not set'
          />
        </div>

        {/* Disability & Veteran Status */}
        <div className='grid grid-cols-1 gap-4 sm:grid-cols-2 pt-1'>
          <PillGroup
            label='Disability status'
            options={DISABILITY_OPTIONS}
            value={values.disability_status}
            onChange={(val) => onChange('disability_status', val)}
            allowClear
            clearLabel='Not set'
          />

          <PillGroup
            label='Veteran / Military status'
            options={VETERAN_OPTIONS}
            value={values.veteran_status}
            onChange={(val) => onChange('veteran_status', val)}
            allowClear
            clearLabel='Not set'
          />
        </div>
      </div>
    </ProfileSectionCard>
  );
}
