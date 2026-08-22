/** @format */

'use client';

import React from 'react';
import { Field } from '@/components/forms';
import { ProfileSectionCard } from '../ProfileSectionCard';

interface LinksSectionProps {
  values: {
    linkedin_url?: string | null;
    github_url?: string | null;
    portfolio_url?: string | null;
    website?: string | null;
  };
  onChange: (key: string, value: string) => void;
}

export function LinksSection({ values, onChange }: LinksSectionProps) {
  return (
    <ProfileSectionCard id='links' title='Links & Portals'>
      <div className='grid grid-cols-1 gap-3 sm:grid-cols-2'>
        <Field
          label='LinkedIn URL'
          type='url'
          value={values.linkedin_url || ''}
          placeholder='https://www.linkedin.com/in/username'
          onChange={(val) => onChange('linkedin_url', val)}
        />

        <Field
          label='GitHub URL'
          type='url'
          value={values.github_url || ''}
          placeholder='https://github.com/username'
          onChange={(val) => onChange('github_url', val)}
        />

        <Field
          label='Portfolio URL'
          type='url'
          value={values.portfolio_url || ''}
          placeholder='https://portfolio.example.com'
          onChange={(val) => onChange('portfolio_url', val)}
        />

        <Field
          label='Website URL'
          type='url'
          value={values.website || ''}
          placeholder='https://example.com'
          onChange={(val) => onChange('website', val)}
        />
      </div>
    </ProfileSectionCard>
  );
}
