/** @format */

'use client';

import React from 'react';
import { Field } from '@/components/forms';
import { PillGroup } from '../PillGroup';
import { ProfileSectionCard } from '../ProfileSectionCard';

const YES_NO_OPTIONS = ['Yes', 'No'];
const SPONSORSHIP_OPTIONS = ['No', 'Yes'];

const VISA_STATUS_OPTIONS = [
  'Citizen',
  'Permanent Resident',
  'Work Visa',
  'Student Visa',
  'Working Holiday',
  'No Work Rights',
];

const WORK_RESTRICTION_OPTIONS = [
  'None (Full-time)',
  '48 hrs / fortnight',
  '20 hrs / week',
];

const SECURITY_CLEARANCE_OPTIONS = [
  'None',
  'Baseline',
  'NV1',
  'NV2',
  'PV',
];

const WWCC_OPTIONS = [
  'Yes / Current',
  'No',
  'Not Applicable',
];

const DRIVERS_LICENSE_OPTIONS = [
  'Full / Unrestricted',
  'Provisional (P1/P2)',
  'Learner',
  'None',
];

interface WorkEligibilitySectionProps {
  values: {
    citizenship?: string | null;
    work_authorization?: string | null;
    visa_status?: string | null;
    visa_type?: string | null;
    visa_expiry?: string | null;
    visa_sponsorship?: string | null;
    work_restrictions?: string | null;
    security_clearance?: string | null;
    police_check_consent?: string | null;
    wwcc_status?: string | null;
    drivers_license?: string | null;
  };
  onChange: (key: string, value: string) => void;
}

export function WorkEligibilitySection({
  values,
  onChange,
}: WorkEligibilitySectionProps) {
  return (
    <ProfileSectionCard id='eligibility' title='Work Eligibility'>
      <div className='flex flex-col gap-4'>
        {/* Core Eligibility */}
        <div className='grid grid-cols-1 gap-4 sm:grid-cols-2'>
          <PillGroup
            label='Legally authorized to work in target country'
            options={YES_NO_OPTIONS}
            value={values.work_authorization || 'Yes'}
            onChange={(val) => onChange('work_authorization', val)}
          />

          <PillGroup
            label='Will require visa sponsorship'
            options={SPONSORSHIP_OPTIONS}
            value={values.visa_sponsorship || 'No'}
            onChange={(val) => onChange('visa_sponsorship', val)}
          />
        </div>

        {/* Citizenship & Visa Details */}
        <div className='flex flex-col gap-3 pt-1'>
          <div className='grid grid-cols-1 gap-3 sm:grid-cols-2'>
            <Field
              label='Citizenship'
              value={values.citizenship || ''}
              placeholder='e.g. Australian Citizen / US Citizen'
              onChange={(val) => onChange('citizenship', val)}
            />

            <PillGroup
              label='Visa / residency status'
              options={VISA_STATUS_OPTIONS}
              value={values.visa_status}
              onChange={(val) => onChange('visa_status', val)}
              allowCustom
              allowClear
              clearLabel='Not specified'
            />
          </div>

          <div className='grid grid-cols-1 gap-3 sm:grid-cols-3'>
            <div>
              <Field
                label='Visa subclass / type'
                value={values.visa_type || ''}
                placeholder='e.g. Subclass 485 / H-1B'
                onChange={(val) => onChange('visa_type', val)}
              />
            </div>

            <div>
              <Field
                label='Visa expiry date'
                type='date'
                value={values.visa_expiry || ''}
                onChange={(val) => onChange('visa_expiry', val)}
              />
            </div>

            <div>
              <PillGroup
                label='Work hour restrictions'
                options={WORK_RESTRICTION_OPTIONS}
                value={values.work_restrictions || 'None (Full-time)'}
                onChange={(val) => onChange('work_restrictions', val)}
                allowCustom
              />
            </div>
          </div>
        </div>

        {/* Clearances, Police Check & Licenses */}
        <div className='grid grid-cols-1 gap-4 sm:grid-cols-2 pt-1'>
          <PillGroup
            label='Security clearance'
            options={SECURITY_CLEARANCE_OPTIONS}
            value={values.security_clearance || 'None'}
            onChange={(val) => onChange('security_clearance', val)}
            allowCustom
          />

          <PillGroup
            label='Consents to background / police check'
            options={YES_NO_OPTIONS}
            value={values.police_check_consent || 'Yes'}
            onChange={(val) => onChange('police_check_consent', val)}
          />

          <PillGroup
            label='Working with Children Check (WWCC)'
            options={WWCC_OPTIONS}
            value={values.wwcc_status || 'Not Applicable'}
            onChange={(val) => onChange('wwcc_status', val)}
            allowCustom
          />

          <PillGroup
            label='Driver license status'
            options={DRIVERS_LICENSE_OPTIONS}
            value={values.drivers_license || 'Full / Unrestricted'}
            onChange={(val) => onChange('drivers_license', val)}
            allowCustom
          />
        </div>
      </div>
    </ProfileSectionCard>
  );
}
