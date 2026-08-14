/** @format */

'use client';
import { Avatar, Button, CardWithNorth, ImageCropper, Select, Tooltip, WaterfallLayout } from '@jobby/ui';
import React, { useId, useRef, useState } from 'react';
import { Check, ImagePlus, LogOut, Plus, Trash2, X } from 'lucide-react';
import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { useConsole } from '@/components/ConsoleContext';
import { DisplayField, Field } from '@/components/forms';
import { useGlobalModalStore } from '@/lib/store/global-modal-store';
import type { CoreProfileField, UserProfile } from '@/lib/types';
import {
  coreFieldCategories,
  coreFieldCategoryForKey,
  coreFieldLabel,
  coreFieldOptions,
} from '@/lib/core-field-categories';
import type { CoreFieldCategoryId } from '@/lib/core-field-categories';
import { createClient } from '@/lib/supabase/client';
import { useAuthStore } from '@/lib/store';
import { div } from 'framer-motion/client';

type EditableCoreProfileField = CoreProfileField & {
  editorCategory?: CoreFieldCategoryId;
};

function customCoreFieldKey(label: string): string {
  const slug = label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 100);
  return slug ? `custom.${slug}` : '';
}

function inputTypeForCoreField(key: string): string {
  if (key === 'identity.email') return 'email';
  if (key === 'identity.phone') return 'tel';
  if (key.endsWith('_url') || key === 'employment.website') return 'url';
  if (key === 'employment.visa_expiry') return 'date';
  if (key === 'experience.years' || key.startsWith('compensation.'))
    return 'number';
  return 'text';
}

const STATE_OPTIONS = [
  'Australian Capital Territory',
  'New South Wales',
  'Northern Territory',
  'Queensland',
  'South Australia',
  'Tasmania',
  'Victoria',
  'Western Australia',
  'Alabama',
  'Alaska',
  'Arizona',
  'California',
  'Colorado',
  'Florida',
  'Georgia',
  'Illinois',
  'Maryland',
  'Massachusetts',
  'Michigan',
  'New Jersey',
  'New York',
  'North Carolina',
  'Ohio',
  'Oregon',
  'Pennsylvania',
  'Texas',
  'Virginia',
  'Washington',
];

const SELECT_OPTIONS: Record<string, string[]> = {
  'identity.pronouns': ['He/Him', 'She/Her', 'They/Them', 'Prefer not to say'],
  'address.state': STATE_OPTIONS,
  'employment.work_authorization': ['Yes', 'No'],
  'employment.visa_sponsorship': ['Yes', 'No'],
  'employment.relocation': ['Yes', 'No'],
  'employment.office_attendance': ['On-site', 'Hybrid', 'Remote'],
  'employment.notice_period': ['0', '7', '14', '28', '30', '60', '90'],
};

function fieldsForCategory(
  value: UserProfile,
  categoryId: CoreFieldCategoryId,
): EditableCoreProfileField[] {
  const existing = (value.fields || []).filter(
    (field) => coreFieldCategoryForKey(field.core_field_key) === categoryId,
  );
  if (categoryId === 'other') return existing;
  const byKey = new Map(existing.map((field) => [field.core_field_key, field]));
  const standard = coreFieldOptions[categoryId].map(
    (option) =>
      byKey.get(option.key) || {
        core_field_key: option.key,
        label: option.label,
        value: '',
        value_type: 'text',
        is_sensitive: true,
      },
  );
  const extra = existing.filter(
    (field) =>
      !coreFieldOptions[categoryId].some(
        (option) => option.key === field.core_field_key,
      ),
  );
  return [...standard, ...extra];
}

function CoreProfileEditor({
  value,
  categoryId,
  onSave,
  onClose,
}: {
  value: UserProfile;
  categoryId: CoreFieldCategoryId;
  onSave: (value: UserProfile) => Promise<void>;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState<EditableCoreProfileField[]>(() => [
    ...(value.fields || []),
    ...fieldsForCategory(value, categoryId).filter(
      (field) =>
        !(value.fields || []).some(
          (saved) => saved.core_field_key === field.core_field_key,
        ),
    ),
  ]);
  const [removedKeys, setRemovedKeys] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const category =
    coreFieldCategories.find((item) => item.id === categoryId) ||
    coreFieldCategories[0];
  const categoryFields = draft
    .map((field, index) => ({ field, index }))
    .filter(
      ({ field }) =>
        field.editorCategory === categoryId ||
        coreFieldCategoryForKey(field.core_field_key) === categoryId,
    );

  const addField = () =>
    setDraft((current) => [
      ...current,
      {
        core_field_key: '',
        label: '',
        value: '',
        value_type: 'text',
        is_sensitive: true,
        editorCategory: categoryId,
      },
    ]);
  const updateField = (index: number, changes: Partial<CoreProfileField>) =>
    setDraft((current) =>
      current.map((field, fieldIndex) =>
        fieldIndex === index ? { ...field, ...changes } : field,
      ),
    );
  const removeField = (index: number) => {
    const field = draft[index];
    if (field?.id && field.core_field_key) {
      setRemovedKeys((current) => new Set(current).add(field.core_field_key));
    }
    setDraft((current) =>
      current.filter((_, fieldIndex) => fieldIndex !== index),
    );
  };
  const handleSave = async () => {
    const fields = draft
      .map((field) => {
        const { editorCategory: _editorCategory, ...persisted } = field;
        const coreFieldKey =
          field.core_field_key.trim() ||
          (categoryId === 'other' ? customCoreFieldKey(field.label || '') : '');
        return {
          ...persisted,
          core_field_key: coreFieldKey.toLowerCase(),
          value: field.value || null,
        };
      })
      .filter((field) => field.core_field_key);
    const removed = (value.fields || [])
      .filter((field) => removedKeys.has(field.core_field_key))
      .map((field) => ({ ...field, value: null }));
    setSaving(true);
    try {
      await onSave({ ...value, fields: [...fields, ...removed] });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className='flex max-h-[88vh] min-h-[420px] w-full flex-col'>
      <header className='header'>
        <div>
          <h2 className='title-section text-ink-primary'>
            {category.label} fields
          </h2>
        </div>
        <Button
          variant='toolbar'
          size='icon'
          Icon={X}
          onClick={onClose}
          aria-label='Close'
        />
      </header>
      <div className='body flex-1 min-h-0 overflow-y-auto py-6!'>
        <div className='grid grid-cols-1 gap-3 sm:grid-cols-2'>
          {categoryFields.map(({ field, index }) => (
            <div
              key={field.id || `new-${index}`}
              className='min-w-0 border-b border-border/60 pb-3'
            >
              {field.core_field_key ?
                SELECT_OPTIONS[field.core_field_key] ?
                  <Select
                    label={coreFieldLabel(field)}
                    value={field.value || ''}
                    onChange={(event) =>
                      updateField(index, {
                        value: event.target.value,
                        value_type: 'choice',
                      })
                    }
                    placeholder='Select...'
                  >
                    <option value=''>Select...</option>
                    {field.value &&
                      !SELECT_OPTIONS[field.core_field_key].includes(
                        field.value,
                      ) && <option value={field.value}>{field.value}</option>}
                    {SELECT_OPTIONS[field.core_field_key].map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </Select>
                : <Field
                    label={coreFieldLabel(field)}
                    value={field.value}
                    type={inputTypeForCoreField(field.core_field_key)}
                    onChange={(next) => updateField(index, { value: next })}
                  />

              : <div className='grid gap-3'>
                  <Field
                    label='Detail name'
                    value={field.label || ''}
                    placeholder='For example: Professional registration'
                    onChange={(next) => updateField(index, { label: next })}
                  />
                  <Field
                    label='Value'
                    value={field.value}
                    onChange={(next) => updateField(index, { value: next })}
                  />
                </div>
              }
              {field.core_field_key.startsWith('custom.') && (
                <div className='mt-2 flex justify-end'>
                  <Button
                    variant='toolbar'
                    size='icon'
                    Icon={Trash2}
                    onClick={() => removeField(index)}
                    aria-label='Remove custom detail'
                  />
                </div>
              )}
            </div>
          ))}
        </div>
        {categoryFields.length === 0 && (
          <p className='py-8 text-center text-sm text-ink-secondary'>
            No {category.label.toLowerCase()} values saved yet.
          </p>
        )}
        {categoryId === 'other' && (
          <Button
            variant='secondary'
            size='sm'
            Icon={Plus}
            onClick={addField}
            className='mt-5'
          >
            Add custom detail
          </Button>
        )}
      </div>
      <footer className='footer'>
        <Button variant='ghost' onClick={onClose} disabled={saving}>
          Cancel
        </Button>
        <Button
          Icon={Check}
          onClick={() => void handleSave()}
          isLoading={saving}
        >
          Save {category.label.toLowerCase()}
        </Button>
      </footer>
    </div>
  );
}

function CoreProfileCategoryCard({
  value,
  category,
  onClick,
}: {
  value: UserProfile;
  category: (typeof coreFieldCategories)[number];
  onClick: (categoryId: CoreFieldCategoryId) => void;
}) {
  const categoryFields = fieldsForCategory(value, category.id);
  return (
    <motion.div
      layoutId={`profile-card-core-${category.id}`}
      onClick={() => onClick(category.id)}
      className='cursor-pointer'
    >
      <CardWithNorth title={category.label} size='sm'>
        <div className='grid grid-cols-1 gap-3 sm:grid-cols-2'>
          {categoryFields.map((field) => (
            <DisplayField
              key={field.core_field_key}
              label={coreFieldLabel(field)}
              value={field.value}
            />
          ))}
          {categoryFields.length === 0 && (
            <p className='text-sm text-ink-secondary'>No details saved yet.</p>
          )}
        </div>
      </CardWithNorth>
    </motion.div>
  );
}

export default function ProfilePage() {
  const { profile, saveProfile, user, saveAvatar, removeAvatar } = useConsole();
  const router = useRouter();
  const supabase = createClient();
  const authLogout = useAuthStore((state) => state.logout);
  const avatarInputId = useId();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isSavingAvatar, setIsSavingAvatar] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [pendingAvatarFile, setPendingAvatarFile] = useState<File | null>(null);

  const openModal = useGlobalModalStore((state) => state.actions.openModal);
  const closeModal = useGlobalModalStore((state) => state.actions.closeModal);

  const editCoreProfile = (categoryId: CoreFieldCategoryId) =>
    openModal({
      layoutId: `profile-card-core-${categoryId}`,
      className: 'w-[94vw] max-w-3xl flex max-h-[88vh] rounded-lg',
      content: (
        <CoreProfileEditor
          value={profile}
          categoryId={categoryId}
          onSave={async (updated) => {
            await saveProfile(updated);
            closeModal();
          }}
          onClose={closeModal}
        />
      ),
      onClose: closeModal,
    });

  const uploadAvatar = async (file: File | undefined) => {
    if (!file) return;
    setIsSavingAvatar(true);
    try {
      await saveAvatar(file);
    } catch {
      // ConsoleContext exposes the upload failure through the shared error state.
    } finally {
      setIsSavingAvatar(false);
    }
  };

  const clearAvatar = async () => {
    setIsSavingAvatar(true);
    try {
      await removeAvatar();
    } catch {
      // ConsoleContext exposes the removal failure through the shared error state.
    } finally {
      setIsSavingAvatar(false);
    }
  };

  const signOut = async () => {
    setIsSigningOut(true);
    try {
      await supabase.auth.signOut();
      authLogout();
      router.push('/login');
    } catch (error) {
      console.error('Failed to sign out:', error);
    } finally {
      setIsSigningOut(false);
    }
  };

  return (
    <div className=' w-full flex flex-col h-full overflow-hidden'>
      {/* Header */}
      <div className='mb-6 shrink-0'>
        <h1 className='title-card text-ink-primary'>Profile</h1>
      </div>

      {/* Form Content Area */}
      <div className='flex-1 min-h-0 overflow-y-auto custom-scrollbar-primary pb-8 pr-2'>
        <WaterfallLayout minColumnWidth={460}>
          {/* Card 1: Community Identity / Avatar */}
          <CardWithNorth
            size='sm'
            title='Account'
            className='cursor-pointer p-0! '
            contentClassName='rounded-bl-[5rem]! '
          >
            <div className=''>
              {pendingAvatarFile ?
                <ImageCropper
                  file={pendingAvatarFile}
                  aspectRatio={1}
                  maxOutputEdge={256}
                  outputQuality={0.65}
                  title='Crop profile photo'
                  onConfirm={(croppedFile) => {
                    setPendingAvatarFile(null);
                    void uploadAvatar(croppedFile);
                  }}
                  onCancel={() => setPendingAvatarFile(null)}
                />
              : <div className='flex items-end gap-3 '>
                  <Avatar
                    src={user?.avatar_url || undefined}
                    name={user?.display_name || user?.email || 'Member'}
                    customSize='128px'
                    className='shrink-0 text-base font-semibold shadow-xs'
                  />
                  <div className='flex w-full flex-wrap gap-4'>
                    <div className='flex-col flex-1'>
                      <div className='flex flex-wrap items-start justify-between gap-4'>
                        <p className='text-lg font-medium text-ink-primary'>
                          {user?.email || 'Account email unavailable'}
                        </p>
                      </div>

                      <div className='flex flex-col items-start  gap-4'>
                        <div className='w-full flex-1'>
                          <p className='text-xs font-semibold text-ink-primary'>
                            {user?.avatar_url ?
                              'Replace profile photo'
                            : 'Upload profile photo'}
                          </p>
                          <p className='mt-0.5 text-[8px] text-ink-secondary leading-tight'>
                            PNG, JPEG, WebP, or GIF, up to 12 MB.
                          </p>
                        </div>
                        <div className='flex  items-center gap-1.5 shrink-0'>
                          <Button
                            type='button'
                            // variant={ 'icon' }
                            size={'md'}
                            Icon={ImagePlus}
                            onClick={() => fileInputRef.current?.click()}
                            disabled={isSavingAvatar}
                            aria-label='Upload profile photo'
                          >
                            {user?.avatar_url ? 'Change' : 'Choose'}
                          </Button>

                          <input
                            ref={fileInputRef}
                            id={avatarInputId}
                            type='file'
                            accept='image/png,image/jpeg,image/webp,image/gif'
                            className='sr-only'
                            onChange={(event) =>
                              setPendingAvatarFile(
                                event.target.files?.[0] || null,
                              )
                            }
                          />
                          {user?.avatar_url && (
                            <Tooltip content='Remove profile photo' side='top'>
                              <Button
                                type='button'
                                variant='icon'
                                size='icon'
                                onClick={() => void clearAvatar()}
                                disabled={isSavingAvatar}
                                Icon={Trash2}
                                aria-label='Remove profile photo'
                              />
                            </Tooltip>
                          )}
                          {isSavingAvatar && (
                            <div className='h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-primary border-t-transparent' />
                          )}
                        </div>
                      </div>
                    </div>
                    <Button
                      type='button'
                      variant='secondary'
                      size='sm'
                      Icon={LogOut}
                      onClick={() => void signOut()}
                      isLoading={isSigningOut}
                      disabled={isSigningOut}
                    >
                      Sign out
                    </Button>
                  </div>
                </div>
              }
            </div>
          </CardWithNorth>

          {coreFieldCategories.map((category) => (
            <CoreProfileCategoryCard
              key={category.id}
              value={profile}
              category={category}
              onClick={editCoreProfile}
            />
          ))}
        </WaterfallLayout>
      </div>
    </div>
  );
}
