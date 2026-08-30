/** @format */

'use client';

import React from 'react';
import { Field } from '@/components/forms';
import { ProfileSectionCard } from '../ProfileSectionCard';

interface ApplicationCredentialsSectionProps {
  email: string;
  password: string;
  onEmailChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
}

export function ApplicationCredentialsSection({
  email,
  password,
  onEmailChange,
  onPasswordChange,
}: ApplicationCredentialsSectionProps) {
  return (
    <ProfileSectionCard
      id='application-credentials'
      title='Application Credentials'
    >
      <p className='text-sm text-ink-secondary pb-4'>
        Use this only when employer websites (such as Workday) require auto-filling forms to create or sign in to a job applicant account. This email is also contact email. All personal data is stored in encrypted database and cannot be viewed by anyone; please feel free to enter your information with confidence.
      </p>
      <div className='grid grid-cols-1 gap-4 md:grid-cols-2'>
        <Field
          label='Email Address'
          type='email'
          value={email}
          onChange={onEmailChange}
          hint='This is also your Contact Email.'
        />
        <Field
          label='Password'
          type='password'
          value={password}
          onChange={onPasswordChange}
          hint='Used to autofill password and password-confirmation fields on application sites.'
        />
      </div>
    </ProfileSectionCard>
  );
}
