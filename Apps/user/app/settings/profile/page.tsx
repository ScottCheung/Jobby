/** @format */

'use client';

import React, { useId, useRef, useState } from 'react';
import { BriefcaseBusiness, Check, ContactRound, Database, ImagePlus, LockKeyhole, MapPin, Plus, Trash2, UserRound, X } from 'lucide-react';
import { motion } from 'framer-motion';
import { useConsole } from '@/components/ConsoleContext';
import { DisplayField, Field } from '@/components/forms';
import CardWithNorth from '@/components/UI/card/CardWithNorth';
import { Avatar } from '@/components/UI/Avatar/Avatar';
import { ImageCropper } from '@/components/UI/ImageCropper';
import { Button } from '@/components/UI/Button';
import { WaterfallLayout } from '@/components/layout/waterfallLayout';
import { useGlobalModalStore } from '@/lib/store/global-modal-store';
import { Checkbox } from '@/components/UI/checkbox';
import type { CoreProfileField, JobHuntingProfile, UserProfile } from '@/lib/types';
import { coreFieldCategories, coreFieldCategoryForKey, coreFieldLabel } from '@/lib/core-field-categories';
import type { CoreFieldCategoryId } from '@/lib/core-field-categories';

type EditableCoreProfileField = CoreProfileField & { editorCategory?: CoreFieldCategoryId };

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
  const [draft, setDraft] = useState<EditableCoreProfileField[]>(value.fields || []);
  const [removedKeys, setRemovedKeys] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const category = coreFieldCategories.find((item) => item.id === categoryId) || coreFieldCategories[0];
  const categoryFields = draft
    .map((field, index) => ({ field, index }))
    .filter(({ field }) => field.editorCategory === categoryId || coreFieldCategoryForKey(field.core_field_key) === categoryId);

  const addField = () => setDraft((current) => [
    ...current,
    { core_field_key: '', value: '', value_type: 'text', is_sensitive: true, editorCategory: categoryId },
  ]);
  const updateField = (index: number, changes: Partial<CoreProfileField>) =>
    setDraft((current) => current.map((field, fieldIndex) => fieldIndex === index ? { ...field, ...changes } : field));
  const removeField = (index: number) => {
    const field = draft[index];
    if (field?.id && field.core_field_key) {
      setRemovedKeys((current) => new Set(current).add(field.core_field_key));
    }
    setDraft((current) => current.filter((_, fieldIndex) => fieldIndex !== index));
  };
  const handleSave = async () => {
    const fields = draft
      .filter((field) => field.core_field_key.trim())
      .map((field) => {
        const { editorCategory: _editorCategory, ...persisted } = field;
        return {
          ...persisted,
          core_field_key: field.core_field_key.trim().toLowerCase(),
          value: field.value || null,
        };
      });
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
          <h2 className='title-section text-ink-primary'>{category.label} fields</h2>
          <p className='mt-1 text-sm text-ink-secondary'>{category.description}. One canonical value per field key.</p>
        </div>
        <Button variant='toolbar' size='icon' Icon={X} onClick={onClose} aria-label='Close' />
      </header>
      <div className='body flex-1 min-h-0 overflow-y-auto py-6!'>
        <div className='grid grid-cols-1 gap-5 sm:grid-cols-2'>
          {categoryFields.map(({ field, index }) => (
            <div key={field.id || `new-${index}`} className='min-w-0 border-b border-border/60 pb-4'>
              {field.id ?
                <Field
                  label={coreFieldLabel(field)}
                  value={field.value}
                  hint={`Core key: ${field.core_field_key}`}
                  onChange={(next) => updateField(index, { value: next })}
                />
              : <div className='grid gap-3'>
                  <Field
                    label='Core field key'
                    value={field.core_field_key}
                    hint='Use a stable key such as identity.first_name.'
                    onChange={(next) => updateField(index, { core_field_key: next })}
                  />
                  <Field
                    label='Value'
                    value={field.value}
                    onChange={(next) => updateField(index, { value: next })}
                  />
                </div>}
              <div className='mt-3 flex items-center justify-between gap-3'>
                <label className='flex items-center gap-2 text-xs text-ink-secondary'>
                  <Checkbox checked={field.is_sensitive} onCheckedChange={(checked) => updateField(index, { is_sensitive: checked === true })} />
                  Sensitive
                </label>
                <Button variant='toolbar' size='icon' Icon={Trash2} onClick={() => removeField(index)} aria-label='Remove core field' />
              </div>
            </div>
          ))}
        </div>
        {categoryFields.length === 0 && <p className='py-8 text-center text-sm text-ink-secondary'>No {category.label.toLowerCase()} values saved yet.</p>}
        <Button variant='secondary' size='sm' Icon={Plus} onClick={addField} className='mt-5'>Add {category.label.toLowerCase()} field</Button>
      </div>
      <footer className='footer'>
        <Button variant='ghost' onClick={onClose} disabled={saving}>Cancel</Button>
        <Button Icon={Check} onClick={() => void handleSave()} isLoading={saving}>Save {category.label.toLowerCase()}</Button>
      </footer>
    </div>
  );
}

const coreCategoryIcons = {
  identity: UserRound,
  contact: ContactRound,
  location: MapPin,
  work: BriefcaseBusiness,
  other: Database,
};

function CoreProfileCategoryCard({
  value,
  category,
  onClick,
}: {
  value: UserProfile;
  category: (typeof coreFieldCategories)[number];
  onClick: (categoryId: CoreFieldCategoryId) => void;
}) {
  const categoryFields = (value.fields || []).filter((field) => coreFieldCategoryForKey(field.core_field_key) === category.id);
  const Icon = coreCategoryIcons[category.id];
  return (
    <motion.div layoutId={`profile-card-core-${category.id}`} onClick={() => onClick(category.id)} className='cursor-pointer'>
      <CardWithNorth title={category.label} size='sm'>
        <div className='mb-3 flex items-center gap-2 text-xs text-ink-secondary'>
          <Icon className='h-4 w-4' />
          <span>{category.description}</span>
          <LockKeyhole className='ml-auto h-4 w-4' />
          <span>{categoryFields.length}</span>
        </div>
        <div className='grid grid-cols-1 gap-3 sm:grid-cols-2'>
          {categoryFields.slice(0, 6).map((field) => (
            <DisplayField key={field.core_field_key} label={coreFieldLabel(field)} value={field.value} />
          ))}
          {categoryFields.length > 6 && <p className='text-xs text-ink-secondary'>+{categoryFields.length - 6} more in Edit</p>}
          {categoryFields.length === 0 && <p className='text-sm text-ink-secondary'>No values saved yet.</p>}
        </div>
      </CardWithNorth>
    </motion.div>
  );
}

function ApplicationPreferencesEditor({
  value,
  onSave,
  onClose,
}: {
  value: JobHuntingProfile;
  onSave: (value: JobHuntingProfile) => Promise<void>;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState(value);
  const [saving, setSaving] = useState(false);

  const setField = (key: keyof JobHuntingProfile, val: any) => {
    setDraft((prev) => ({ ...prev, [key]: val }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(draft);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className='flex max-h-[88vh] min-h-[320px] max-w-5xl w-full flex-col'>
      {/* Header */}
      <header className='header'>
        <div>
          <h2 className='title-section text-ink-primary'>
            Application Preferences
          </h2>
          <p className='mt-1 text-sm text-ink-secondary'>
            Used as the authoritative source for job application forms.
          </p>
        </div>
        <button
          type='button'
          onClick={onClose}
          className='flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-ink-secondary hover:bg-background-secondary hover:text-ink-primary'
        >
          <X className='h-4 w-4' />
        </button>
      </header>

      {/* Fields */}
      <div className='body py-6! flex-1 overflow-y-auto min-h-0 overflow-x-hidden'>
        <div className='grid grid-cols-1 sm:grid-cols-2 gap-4'>
          <Field
            label='Current / target location'
            value={draft.search_location}
            onChange={(val) => setField('search_location', val)}
          />
          <Field
            label='Desired annual base salary'
            type='number'
            value={draft.desired_salary}
            onChange={(val) => setField('desired_salary', val)}
          />
          <Field
            label='Current annual compensation'
            type='number'
            value={draft.current_ctc}
            onChange={(val) => setField('current_ctc', val)}
          />
          <Field
            label='Years of experience'
            value={draft.years_of_experience}
            onChange={(val) => setField('years_of_experience', val)}
          />
          <Field
            label='Citizenship / work rights'
            value={draft.citizenship}
            onChange={(val) => setField('citizenship', val)}
          />
          <Field
            label='Visa sponsorship requirement'
            value={draft.require_visa}
            onChange={(val) => setField('require_visa', val)}
          />
          <Field
            label='Notice period (days)'
            type='number'
            value={draft.notice_period}
            onChange={(val) => setField('notice_period', val ? Number(val) : null)}
          />
          <Field
            label='Most recent employer'
            value={draft.recent_employer}
            onChange={(val) => setField('recent_employer', val)}
          />
        </div>
      </div>

      {/* Footer */}
      <footer className='footer'>
        <Button variant='ghost' onClick={onClose} disabled={saving}>
          Cancel
        </Button>
        <Button
          onClick={() => void handleSave()}
          disabled={saving}
          Icon={Check}
        >
          {saving ? 'Saving...' : 'Save preferences'}
        </Button>
      </footer>
    </div>
  );
}

function AutofillPreferencesCard({
  value,
  onClick,
}: {
  value: JobHuntingProfile;
  onClick?: () => void;
}) {
  return (
    <motion.div
      layoutId='profile-card-application-preferences'
      transition={{ type: 'spring', duration: 0.7, bounce: 0.2 }}
      onClick={onClick}
      className='cursor-pointer group/card relative'
    >
      <CardWithNorth title='Application Preferences' size='sm'>
        <div className='grid grid-cols-1 sm:grid-cols-2 gap-3'>
          <DisplayField
            label='Current / target location'
            value={value.search_location}
          />
          <DisplayField
            label='Desired annual base salary'
            value={value.desired_salary ? `$${value.desired_salary}` : null}
          />
          <DisplayField
            label='Current annual compensation'
            value={value.current_ctc ? `$${value.current_ctc}` : null}
          />
          <DisplayField
            label='Years of experience'
            value={value.years_of_experience}
          />
          <DisplayField
            label='Citizenship / work rights'
            value={value.citizenship}
          />
          <DisplayField
            label='Visa sponsorship requirement'
            value={value.require_visa}
          />
          <DisplayField
            label='Notice period (days)'
            value={value.notice_period !== undefined && value.notice_period !== null ? String(value.notice_period) : null}
          />
          <DisplayField
            label='Most recent employer'
            value={value.recent_employer}
          />
        </div>
      </CardWithNorth>
    </motion.div>
  );
}

export default function ProfilePage() {
  const { profile, saveProfile, user, saveAvatar, removeAvatar, jobHuntingProfile, saveJobHuntingProfile } =
    useConsole();
  const avatarInputId = useId();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isSavingAvatar, setIsSavingAvatar] = useState(false);
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

  return (
    <div className=' w-full flex flex-col h-full overflow-hidden'>
      {/* Header */}
      <div className='mb-6 shrink-0'>
        <h1 className='title-card text-ink-primary'>
          Profile
        </h1>
        <p className='body-sm text-ink-secondary mt-1'>
          Manage the personal data and preferences used for autofill.
        </p>
      </div>

      {/* Form Content Area */}
      <div className='flex-1 min-h-0 overflow-y-auto custom-scrollbar-primary pb-8 pr-2'>
        <WaterfallLayout minColumnWidth={460}>
          {/* Card 1: Community Identity / Avatar */}
          <CardWithNorth
            size='sm'
            title='Community Identity'
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
              : <div className='flex items-center gap-3 p-4 rounded-xl rounded-l-full  bg-linear-to-r from-primary/20 via-background-secondary/40 to-transparent '>
                  <Avatar
                    src={user?.avatar_url || undefined}
                    name={user?.display_name || user?.email || 'Member'}
                    customSize='96px'
                    className='shrink-0 text-base font-semibold shadow-xs'
                  />
                  <div className='min-w-0 flex-1'>
                    <p className='text-xs font-semibold text-ink-primary'>
                      {user?.avatar_url ?
                        'Replace profile photo'
                      : 'Upload profile photo'}
                    </p>
                    <p className='mt-0.5 text-[11px] text-ink-secondary leading-tight'>
                      PNG, JPEG, WebP, or GIF, up to 12 MB.
                    </p>
                  </div>
                  <div className='flex items-center gap-1.5 shrink-0'>
                    <Button
                      type='button'
                      // variant={ 'icon' }
                      // size={'icon'}
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
                        setPendingAvatarFile(event.target.files?.[0] || null)
                      }
                    />
                    {user?.avatar_url && (
                      <Button
                        type='button'
                        variant={'destructive'}
                        onClick={() => void clearAvatar()}
                        disabled={isSavingAvatar}
                        Icon={Trash2}
                        aria-label='Remove profile photo'
                      >
                        Remove
                      </Button>
                    )}
                  </div>
                  {isSavingAvatar && (
                    <div className='h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-primary border-t-transparent' />
                  )}
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

          <AutofillPreferencesCard
            value={jobHuntingProfile}
            onClick={() => openModal({
              layoutId: 'profile-card-application-preferences',
              className: 'w-[94vw] max-w-3xl flex max-h-[88vh] rounded-lg',
              content: <ApplicationPreferencesEditor value={jobHuntingProfile} onSave={saveJobHuntingProfile} onClose={closeModal} />,
              onClose: closeModal,
            })}
          />

        </WaterfallLayout>
      </div>
    </div>
  );
}
