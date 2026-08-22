import type { CoreProfileField } from '@/lib/types';

export const coreFieldCategories = [
  {
    id: 'identity',
    label: 'Identity',
    description: 'Names and identity details',
  },
  {
    id: 'contact',
    label: 'Contact',
    description: 'Email and phone details',
  },
  {
    id: 'location',
    label: 'Location',
    description: 'Address and current location',
  },
  {
    id: 'eligibility',
    label: 'Work eligibility',
    description: 'Visa and work authorizations',
  },
  {
    id: 'career',
    label: 'Career preferences',
    description: 'Notice period, salary and preferences',
  },
  {
    id: 'links',
    label: 'Links',
    description: 'Online portfolio and social links',
  },
  {
    id: 'demographics',
    label: 'Demographics',
    description: 'Equal opportunity details',
  },
  {
    id: 'other',
    label: 'Other details',
    description: 'Custom user-defined fields',
  },
] as const;

export type CoreFieldCategoryId = (typeof coreFieldCategories)[number]['id'];

export const coreFieldOptions: Record<Exclude<CoreFieldCategoryId, 'other'>, Array<{ key: string; label: string }>> = {
  identity: [
    { key: 'identity.preferred_name', label: 'Preferred name' },
    { key: 'identity.first_name', label: 'First name' },
    { key: 'identity.middle_name', label: 'Middle name' },
    { key: 'identity.last_name', label: 'Last name' },
    { key: 'identity.title', label: 'Title / Salutation' },
    { key: 'identity.pronouns', label: 'Pronouns' },
    { key: 'identity.legal_full_name', label: 'Legal full name' },
  ],
  contact: [
    { key: 'identity.email', label: 'Email' },
    { key: 'identity.phone', label: 'Phone number' },
    { key: 'identity.phone_type', label: 'Phone type' },
    { key: 'identity.phone_country_code', label: 'Country code' },
  ],
  location: [
    { key: 'address.street', label: 'Address Line 1' },
    { key: 'address.suburb', label: 'Suburb / County' },
    { key: 'address.city', label: 'City' },
    { key: 'address.state', label: 'State / province' },
    { key: 'address.postal_code', label: 'Postcode' },
    { key: 'address.country', label: 'Country' },
    { key: 'employment.current_location', label: 'Current location' },
  ],
  eligibility: [
    { key: 'employment.citizenship', label: 'Citizenship' },
    { key: 'employment.work_authorization', label: 'Work authorization' },
    { key: 'employment.visa_status', label: 'Visa status' },
    { key: 'employment.visa_type', label: 'Visa type' },
    { key: 'employment.visa_expiry', label: 'Visa expiry date' },
    { key: 'employment.visa_sponsorship', label: 'Visa sponsorship required' },
    { key: 'employment.work_restrictions', label: 'Work hour restrictions' },
    { key: 'employment.security_clearance', label: 'Security clearance' },
    { key: 'employment.police_check_consent', label: 'Police check consent' },
    { key: 'employment.wwcc_status', label: 'Working with children check (WWCC)' },
    { key: 'employment.drivers_license', label: 'Driver license status' },
  ],
  career: [
    { key: 'employment.relocation', label: 'Willing to relocate' },
    { key: 'employment.office_attendance', label: 'Office attendance' },
    { key: 'employment.notice_period', label: 'Notice period (days)' },
    { key: 'employment.recent_employer', label: 'Most recent employer' },
    { key: 'experience.years', label: 'Years of experience' },
    { key: 'compensation.desired_base_salary', label: 'Desired base salary' },
    { key: 'compensation.current_salary', label: 'Current salary' },
  ],
  links: [
    { key: 'employment.linkedin_url', label: 'LinkedIn URL' },
    { key: 'employment.website', label: 'Personal website' },
    { key: 'employment.portfolio_url', label: 'Portfolio URL' },
    { key: 'employment.github_url', label: 'GitHub URL' },
  ],
  demographics: [
    { key: 'demographic.gender', label: 'Gender' },
    { key: 'demographic.gender_identity', label: 'Gender identity' },
    { key: 'demographic.ethnicity', label: 'Ethnicity' },
    { key: 'demographic.disability_status', label: 'Disability status' },
    { key: 'demographic.veteran_status', label: 'Veteran status' },
  ],
};

export function coreFieldCategoryForKey(coreFieldKey: string): CoreFieldCategoryId {
  const key = coreFieldKey.trim().toLowerCase();

  if (
    key === 'identity.email' ||
    key === 'identity.phone' ||
    key === 'identity.phone_type' ||
    key === 'identity.phone_country_code'
  ) {
    return 'contact';
  }
  if (key.startsWith('demographic.')) return 'demographics';
  if (key.startsWith('identity.')) return 'identity';
  if (key.startsWith('address.') || key === 'employment.current_location') return 'location';
  if (['employment.linkedin_url', 'employment.website', 'employment.portfolio_url', 'employment.github_url'].includes(key)) return 'links';
  if ([
    'employment.citizenship',
    'employment.work_authorization',
    'employment.visa_status',
    'employment.visa_type',
    'employment.visa_expiry',
    'employment.visa_sponsorship',
    'employment.work_restrictions',
    'employment.security_clearance',
    'employment.police_check_consent',
    'employment.wwcc_status',
    'employment.drivers_license',
  ].includes(key)) return 'eligibility';
  if (
    key.startsWith('employment.') ||
    key.startsWith('experience.') ||
    key.startsWith('compensation.')
  ) {
    return 'career';
  }
  return 'other';
}

export function coreFieldLabel(field: Pick<CoreProfileField, 'core_field_key' | 'label'>): string {
  const customKey = field.core_field_key.trim().replace(/^custom\./i, '');
  return (
    field.label ||
    customKey
      .replace(/[._]/g, ' ')
      .replace(/\b\w/g, (letter) => letter.toUpperCase()) ||
    'Custom core field'
  );
}

export function groupCoreFields(fields: CoreProfileField[]): Record<CoreFieldCategoryId, CoreProfileField[]> {
  const grouped = Object.fromEntries(
    coreFieldCategories.map((category) => [category.id, [] as CoreProfileField[]]),
  ) as Record<CoreFieldCategoryId, CoreProfileField[]>;

  fields.forEach((field) => {
    grouped[coreFieldCategoryForKey(field.core_field_key)].push(field);
  });

  return grouped;
}

