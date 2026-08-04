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
    id: 'work',
    label: 'Work & eligibility',
    description: 'Work rights and employment details',
  },
  {
    id: 'other',
    label: 'Other',
    description: 'Custom core values',
  },
] as const;

export type CoreFieldCategoryId = (typeof coreFieldCategories)[number]['id'];

export function coreFieldCategoryForKey(coreFieldKey: string): CoreFieldCategoryId {
  const key = coreFieldKey.trim().toLowerCase();

  if (key === 'identity.email' || key === 'identity.phone') return 'contact';
  if (key.startsWith('identity.') || key.startsWith('demographic.')) return 'identity';
  if (key.startsWith('address.') || key === 'employment.current_location') return 'location';
  if (
    key.startsWith('employment.') ||
    key.startsWith('experience.') ||
    key.startsWith('compensation.')
  ) {
    return 'work';
  }
  return 'other';
}

export function coreFieldLabel(field: Pick<CoreProfileField, 'core_field_key' | 'label'>): string {
  return (
    field.label ||
    field.core_field_key
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
