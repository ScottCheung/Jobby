/** @format */

'use client';

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Button } from '@jobby/ui';
import { Check, Loader2, RotateCcw, Save } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useConsole } from '@/components/ConsoleContext';
import { showGlobalToast } from '@/lib/toast';
import type { CoreProfileField, UserProfile } from '@/lib/types';
import { PROFILE_SECTIONS, ProfileSidebar } from './_components/ProfileSidebar';
import { AccountSection } from './_components/sections/AccountSection';
import { PersonalSection } from './_components/sections/PersonalSection';
import { ContactLocationSection } from './_components/sections/ContactLocationSection';
import { WorkEligibilitySection } from './_components/sections/WorkEligibilitySection';
import { CareerPreferencesSection } from './_components/sections/CareerPreferencesSection';
import { LinksSection } from './_components/sections/LinksSection';
import { DemographicsSection } from './_components/sections/DemographicsSection';
import { CustomFieldsSection } from './_components/sections/CustomFieldsSection';

interface ProfileDraftState {
  // Personal
  title: string;
  first_name: string;
  middle_name: string;
  last_name: string;
  preferred_name: string;
  preferred_middle_name: string;
  preferred_last_name: string;
  pronouns: string;
  legal_full_name: string;

  // Contact & Location
  email: string;
  phone_type: string;
  phone_country_code: string;
  phone_number: string;
  street: string;
  suburb: string;
  city: string;
  state: string;
  postal_code: string;
  country: string;
  current_location: string;

  // Work Eligibility
  citizenship: string;
  work_authorization: string;
  visa_status: string;
  visa_type: string;
  visa_expiry: string;
  visa_sponsorship: string;
  work_restrictions: string;
  security_clearance: string;
  police_check_consent: string;
  wwcc_status: string;
  drivers_license: string;

  // Career
  recent_employer: string;
  years_experience: string;
  desired_base_salary: string;
  current_salary: string;
  notice_period: string;
  office_attendance: string;
  relocation: string;

  // Links
  linkedin_url: string;
  github_url: string;
  portfolio_url: string;
  website: string;

  // Demographics
  gender: string;
  gender_identity: string;
  ethnicity: string;
  disability_status: string;
  veteran_status: string;
}

function extractCoreFieldValue(
  fields: CoreProfileField[] | undefined,
  key: string,
  fallback?: string | null,
): string {
  const match = fields?.find(
    (f) => f.core_field_key.toLowerCase() === key.toLowerCase(),
  );
  if (match && match.value !== null && match.value !== undefined) {
    return String(match.value);
  }
  return fallback ? String(fallback) : '';
}

function initDraftFromProfile(profile: UserProfile): ProfileDraftState {
  const fields = profile.fields || [];

  return {
    title: extractCoreFieldValue(fields, 'identity.title', profile.title),
    first_name: extractCoreFieldValue(
      fields,
      'identity.first_name',
      profile.first_name,
    ),
    middle_name: extractCoreFieldValue(
      fields,
      'identity.middle_name',
      profile.middle_name,
    ),
    last_name: extractCoreFieldValue(
      fields,
      'identity.last_name',
      profile.last_name,
    ),
    preferred_name: extractCoreFieldValue(
      fields,
      'identity.preferred_name',
      profile.preferred_name,
    ),
    preferred_middle_name: extractCoreFieldValue(
      fields,
      'identity.preferred_middle_name',
      null,
    ),
    preferred_last_name: extractCoreFieldValue(
      fields,
      'identity.preferred_last_name',
      null,
    ),
    pronouns: extractCoreFieldValue(fields, 'identity.pronouns', null),
    legal_full_name: extractCoreFieldValue(
      fields,
      'identity.legal_full_name',
      null,
    ),

    email: extractCoreFieldValue(fields, 'identity.email', profile.email),
    phone_type: extractCoreFieldValue(fields, 'identity.phone_type', 'Mobile'),
    phone_country_code: extractCoreFieldValue(
      fields,
      'identity.phone_country_code',
      '+61',
    ),
    phone_number: extractCoreFieldValue(
      fields,
      'identity.phone',
      profile.phone_number,
    ),
    street: extractCoreFieldValue(fields, 'address.street', profile.street),
    suburb: extractCoreFieldValue(fields, 'address.suburb', null),
    city: extractCoreFieldValue(fields, 'address.city', profile.current_city),
    state: extractCoreFieldValue(fields, 'address.state', profile.state),
    postal_code: extractCoreFieldValue(
      fields,
      'address.postal_code',
      profile.zipcode,
    ),
    country: extractCoreFieldValue(
      fields,
      'address.country',
      profile.country || 'Australia',
    ),
    current_location: extractCoreFieldValue(
      fields,
      'employment.current_location',
      null,
    ),

    citizenship: extractCoreFieldValue(fields, 'employment.citizenship', null),
    work_authorization: extractCoreFieldValue(
      fields,
      'employment.work_authorization',
      'Yes',
    ),
    visa_status: extractCoreFieldValue(fields, 'employment.visa_status', null),
    visa_type: extractCoreFieldValue(fields, 'employment.visa_type', null),
    visa_expiry: extractCoreFieldValue(fields, 'employment.visa_expiry', null),
    visa_sponsorship: extractCoreFieldValue(
      fields,
      'employment.visa_sponsorship',
      'No',
    ),
    work_restrictions: extractCoreFieldValue(
      fields,
      'employment.work_restrictions',
      'None (Full-time)',
    ),
    security_clearance: extractCoreFieldValue(
      fields,
      'employment.security_clearance',
      'None',
    ),
    police_check_consent: extractCoreFieldValue(
      fields,
      'employment.police_check_consent',
      'Yes',
    ),
    wwcc_status: extractCoreFieldValue(
      fields,
      'employment.wwcc_status',
      'Not Applicable',
    ),
    drivers_license: extractCoreFieldValue(
      fields,
      'employment.drivers_license',
      'Full / Unrestricted',
    ),

    recent_employer: extractCoreFieldValue(
      fields,
      'employment.recent_employer',
      null,
    ),
    years_experience: extractCoreFieldValue(fields, 'experience.years', null),
    desired_base_salary: extractCoreFieldValue(
      fields,
      'compensation.desired_base_salary',
      null,
    ),
    current_salary: extractCoreFieldValue(
      fields,
      'compensation.current_salary',
      null,
    ),
    notice_period: extractCoreFieldValue(
      fields,
      'employment.notice_period',
      '0',
    ),
    office_attendance: extractCoreFieldValue(
      fields,
      'employment.office_attendance',
      'Hybrid',
    ),
    relocation: extractCoreFieldValue(fields, 'employment.relocation', 'No'),

    linkedin_url: extractCoreFieldValue(
      fields,
      'employment.linkedin_url',
      null,
    ),
    github_url: extractCoreFieldValue(fields, 'employment.github_url', null),
    portfolio_url: extractCoreFieldValue(
      fields,
      'employment.portfolio_url',
      null,
    ),
    website: extractCoreFieldValue(fields, 'employment.website', null),

    gender: extractCoreFieldValue(fields, 'demographic.gender', profile.gender),
    gender_identity: extractCoreFieldValue(
      fields,
      'demographic.gender_identity',
      profile.gender_identity,
    ),
    ethnicity: extractCoreFieldValue(
      fields,
      'demographic.ethnicity',
      profile.ethnicity,
    ),
    disability_status: extractCoreFieldValue(
      fields,
      'demographic.disability_status',
      profile.disability_status,
    ),
    veteran_status: extractCoreFieldValue(
      fields,
      'demographic.veteran_status',
      profile.veteran_status,
    ),
  };
}

function extractCustomFields(profile: UserProfile): CoreProfileField[] {
  return (profile.fields || []).filter(
    (field) =>
      field.core_field_key.startsWith('custom.') || !field.core_field_key,
  );
}

function slugifyKey(label: string): string {
  const slug = label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 100);
  return slug ? `custom.${slug}` : '';
}

export default function ProfilePage() {
  const { profile, saveProfile, user, saveAvatar, removeAvatar } = useConsole();
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const [draft, setDraft] = useState<ProfileDraftState>(() =>
    initDraftFromProfile(profile),
  );
  const [customFields, setCustomFields] = useState<CoreProfileField[]>(() =>
    extractCustomFields(profile),
  );
  const [activeSection, setActiveSection] = useState('account');
  const [isSaving, setIsSaving] = useState(false);
  const [savedBaseline, setSavedBaseline] = useState<string>(() =>
    JSON.stringify({
      draft: initDraftFromProfile(profile),
      custom: extractCustomFields(profile),
    }),
  );

  // Sync draft when server profile updates and user has no unsaved changes
  useEffect(() => {
    const currentJson = JSON.stringify({ draft, custom: customFields });
    if (currentJson === savedBaseline) {
      const nextDraft = initDraftFromProfile(profile);
      const nextCustom = extractCustomFields(profile);
      setDraft(nextDraft);
      setCustomFields(nextCustom);
      setSavedBaseline(
        JSON.stringify({ draft: nextDraft, custom: nextCustom }),
      );
    }
  }, [profile]);

  const isDirty = useMemo(() => {
    const currentJson = JSON.stringify({ draft, custom: customFields });
    return currentJson !== savedBaseline;
  }, [draft, customFields, savedBaseline]);

  const updateDraftField = useCallback((key: string, value: string) => {
    setDraft((prev) => ({ ...prev, [key]: value }));
  }, []);

  const handleAddCustomField = () => {
    setCustomFields((prev) => [
      ...prev,
      {
        core_field_key: '',
        label: '',
        value: '',
        value_type: 'text',
        is_sensitive: true,
      },
    ]);
  };

  const handleUpdateCustomField = (
    index: number,
    changes: Partial<CoreProfileField>,
  ) => {
    setCustomFields((prev) =>
      prev.map((field, i) => (i === index ? { ...field, ...changes } : field)),
    );
  };

  const handleRemoveCustomField = (index: number) => {
    setCustomFields((prev) => prev.filter((_, i) => i !== index));
  };

  const handleResetChanges = () => {
    try {
      const parsed = JSON.parse(savedBaseline);
      setDraft(parsed.draft);
      setCustomFields(parsed.custom);
      showGlobalToast('Changes reverted');
    } catch {
      setDraft(initDraftFromProfile(profile));
      setCustomFields(extractCustomFields(profile));
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      // Build structured core fields array
      const coreFieldsList: CoreProfileField[] = [
        // Identity
        {
          core_field_key: 'identity.title',
          value: draft.title || null,
          value_type: 'text',
          is_sensitive: true,
        },
        {
          core_field_key: 'identity.first_name',
          value: draft.first_name || null,
          value_type: 'text',
          is_sensitive: true,
        },
        {
          core_field_key: 'identity.middle_name',
          value: draft.middle_name || null,
          value_type: 'text',
          is_sensitive: true,
        },
        {
          core_field_key: 'identity.last_name',
          value: draft.last_name || null,
          value_type: 'text',
          is_sensitive: true,
        },
        {
          core_field_key: 'identity.preferred_name',
          value: draft.preferred_name || null,
          value_type: 'text',
          is_sensitive: true,
        },
        {
          core_field_key: 'identity.preferred_middle_name',
          value: draft.preferred_middle_name || null,
          value_type: 'text',
          is_sensitive: true,
        },
        {
          core_field_key: 'identity.preferred_last_name',
          value: draft.preferred_last_name || null,
          value_type: 'text',
          is_sensitive: true,
        },
        {
          core_field_key: 'identity.pronouns',
          value: draft.pronouns || null,
          value_type: 'text',
          is_sensitive: true,
        },
        {
          core_field_key: 'identity.legal_full_name',
          value: draft.legal_full_name || null,
          value_type: 'text',
          is_sensitive: true,
        },

        // Contact
        {
          core_field_key: 'identity.email',
          value: draft.email || null,
          value_type: 'text',
          is_sensitive: true,
        },
        {
          core_field_key: 'identity.phone',
          value: draft.phone_number || null,
          value_type: 'text',
          is_sensitive: true,
        },
        {
          core_field_key: 'identity.phone_type',
          value: draft.phone_type || null,
          value_type: 'text',
          is_sensitive: true,
        },
        {
          core_field_key: 'identity.phone_country_code',
          value: draft.phone_country_code || null,
          value_type: 'text',
          is_sensitive: true,
        },

        // Location
        {
          core_field_key: 'address.street',
          value: draft.street || null,
          value_type: 'text',
          is_sensitive: true,
        },
        {
          core_field_key: 'address.suburb',
          value: draft.suburb || null,
          value_type: 'text',
          is_sensitive: true,
        },
        {
          core_field_key: 'address.city',
          value: draft.city || null,
          value_type: 'text',
          is_sensitive: true,
        },
        {
          core_field_key: 'address.state',
          value: draft.state || null,
          value_type: 'text',
          is_sensitive: true,
        },
        {
          core_field_key: 'address.postal_code',
          value: draft.postal_code || null,
          value_type: 'text',
          is_sensitive: true,
        },
        {
          core_field_key: 'address.country',
          value: draft.country || null,
          value_type: 'text',
          is_sensitive: true,
        },
        {
          core_field_key: 'employment.current_location',
          value: draft.current_location || null,
          value_type: 'text',
          is_sensitive: true,
        },

        // Work eligibility
        {
          core_field_key: 'employment.citizenship',
          value: draft.citizenship || null,
          value_type: 'text',
          is_sensitive: true,
        },
        {
          core_field_key: 'employment.work_authorization',
          value: draft.work_authorization || null,
          value_type: 'text',
          is_sensitive: true,
        },
        {
          core_field_key: 'employment.visa_status',
          value: draft.visa_status || null,
          value_type: 'text',
          is_sensitive: true,
        },
        {
          core_field_key: 'employment.visa_type',
          value: draft.visa_type || null,
          value_type: 'text',
          is_sensitive: true,
        },
        {
          core_field_key: 'employment.visa_expiry',
          value: draft.visa_expiry || null,
          value_type: 'date',
          is_sensitive: true,
        },
        {
          core_field_key: 'employment.visa_sponsorship',
          value: draft.visa_sponsorship || null,
          value_type: 'text',
          is_sensitive: true,
        },
        {
          core_field_key: 'employment.work_restrictions',
          value: draft.work_restrictions || null,
          value_type: 'text',
          is_sensitive: true,
        },
        {
          core_field_key: 'employment.security_clearance',
          value: draft.security_clearance || null,
          value_type: 'text',
          is_sensitive: true,
        },
        {
          core_field_key: 'employment.police_check_consent',
          value: draft.police_check_consent || null,
          value_type: 'text',
          is_sensitive: true,
        },
        {
          core_field_key: 'employment.wwcc_status',
          value: draft.wwcc_status || null,
          value_type: 'text',
          is_sensitive: true,
        },
        {
          core_field_key: 'employment.drivers_license',
          value: draft.drivers_license || null,
          value_type: 'text',
          is_sensitive: true,
        },

        // Career
        {
          core_field_key: 'employment.recent_employer',
          value: draft.recent_employer || null,
          value_type: 'text',
          is_sensitive: true,
        },
        {
          core_field_key: 'experience.years',
          value: draft.years_experience || null,
          value_type: 'number',
          is_sensitive: true,
        },
        {
          core_field_key: 'compensation.desired_base_salary',
          value: draft.desired_base_salary || null,
          value_type: 'number',
          is_sensitive: true,
        },
        {
          core_field_key: 'compensation.current_salary',
          value: draft.current_salary || null,
          value_type: 'number',
          is_sensitive: true,
        },
        {
          core_field_key: 'employment.notice_period',
          value: draft.notice_period || null,
          value_type: 'text',
          is_sensitive: true,
        },
        {
          core_field_key: 'employment.office_attendance',
          value: draft.office_attendance || null,
          value_type: 'text',
          is_sensitive: true,
        },
        {
          core_field_key: 'employment.relocation',
          value: draft.relocation || null,
          value_type: 'text',
          is_sensitive: true,
        },

        // Links
        {
          core_field_key: 'employment.linkedin_url',
          value: draft.linkedin_url || null,
          value_type: 'url',
          is_sensitive: true,
        },
        {
          core_field_key: 'employment.github_url',
          value: draft.github_url || null,
          value_type: 'url',
          is_sensitive: true,
        },
        {
          core_field_key: 'employment.portfolio_url',
          value: draft.portfolio_url || null,
          value_type: 'url',
          is_sensitive: true,
        },
        {
          core_field_key: 'employment.website',
          value: draft.website || null,
          value_type: 'url',
          is_sensitive: true,
        },

        // Demographics
        {
          core_field_key: 'demographic.gender',
          value: draft.gender || null,
          value_type: 'text',
          is_sensitive: true,
        },
        {
          core_field_key: 'demographic.gender_identity',
          value: draft.gender_identity || null,
          value_type: 'text',
          is_sensitive: true,
        },
        {
          core_field_key: 'demographic.ethnicity',
          value: draft.ethnicity || null,
          value_type: 'text',
          is_sensitive: true,
        },
        {
          core_field_key: 'demographic.disability_status',
          value: draft.disability_status || null,
          value_type: 'text',
          is_sensitive: true,
        },
        {
          core_field_key: 'demographic.veteran_status',
          value: draft.veteran_status || null,
          value_type: 'text',
          is_sensitive: true,
        },

        // Custom fields
        ...customFields
          .map((f) => {
            const key = f.core_field_key.trim() || slugifyKey(f.label || '');
            return {
              ...f,
              core_field_key: key,
              value: f.value || null,
            };
          })
          .filter((f) => Boolean(f.core_field_key)),
      ];

      // Construct synchronized UserProfile payload
      const updatedProfile: UserProfile = {
        ...profile,
        title: draft.title || null,
        first_name: draft.first_name || null,
        middle_name: draft.middle_name || null,
        last_name: draft.last_name || null,
        preferred_name: draft.preferred_name || null,
        email: draft.email || null,
        phone_number: draft.phone_number || null,
        street: draft.street || null,
        current_city: draft.city || null,
        state: draft.state || null,
        zipcode: draft.postal_code || null,
        country: draft.country || null,
        gender: draft.gender || null,
        gender_identity: draft.gender_identity || null,
        ethnicity: draft.ethnicity || null,
        disability_status: draft.disability_status || null,
        veteran_status: draft.veteran_status || null,
        fields: coreFieldsList,
      };

      await saveProfile(updatedProfile);
      setSavedBaseline(JSON.stringify({ draft, custom: customFields }));
      showGlobalToast('Autofill profile saved successfully');
    } catch (err) {
      showGlobalToast(
        err instanceof Error ? err.message : 'Failed to save profile',
      );
    } finally {
      setIsSaving(false);
    }
  };

  // Keyboard shortcut: Cmd+S / Ctrl+S to save
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        if (isDirty && !isSaving) {
          void handleSave();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isDirty, isSaving, handleSave]);

  //  // Active Section Spy with IntersectionObserver + Scroll listener (mirroring /interview-prep/explore)
  useEffect(() => {
    const root = scrollContainerRef.current;
    if (!root || typeof IntersectionObserver === 'undefined') return;

    const sectionIds = PROFILE_SECTIONS.map((s) => s.id);

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (visible && visible.target.id) {
          setActiveSection(visible.target.id);
        }
      },
      {
        root,
        rootMargin: '-8% 0px -60% 0px',
        threshold: [0.05, 0.4],
      },
    );

    sectionIds.forEach((id) => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });

    const handleScrollEnd = () => {
      const atBottom =
        root.scrollHeight - root.scrollTop - root.clientHeight < 10;
      if (atBottom) {
        setActiveSection(sectionIds[sectionIds.length - 1]);
      }
    };

    root.addEventListener('scroll', handleScrollEnd, { passive: true });

    return () => {
      observer.disconnect();
      root.removeEventListener('scroll', handleScrollEnd);
    };
  }, []);

  const handleNavigateToSection = (sectionId: string) => {
    setActiveSection(sectionId);
    const root = scrollContainerRef.current;
    const el = document.getElementById(sectionId);
    if (el && root) {
      const rootRect = root.getBoundingClientRect();
      const elRect = el.getBoundingClientRect();
      const targetScroll = root.scrollTop + (elRect.top - rootRect.top) - 8;
      root.scrollTo({
        top: Math.max(0, targetScroll),
        behavior: 'smooth',
      });
    }
  };

  return (
    <div className='flex h-full w-full gap-5 overflow-hidden'>
      {/* Left Navigation Indicator (matching /interview-prep/explore) */}
      <ProfileSidebar
        activeSection={activeSection}
        onNavigate={handleNavigateToSection}
      />

      {/* Main Profile Form Content Area */}
      <div className='relative flex-1 min-w-0 h-full flex flex-col overflow-hidden '>
        {/* Scrollable Section Cards Container */}
        <div
          ref={scrollContainerRef}
          className='min-h-0 flex-1 body overflow-y-auto overscroll-y-contain w-full custom-scrollbar-primary pr-2 pb-28 space-y-4'
        >
          <AccountSection
            user={user}
            onSaveAvatar={saveAvatar}
            onRemoveAvatar={removeAvatar}
          />

          <PersonalSection values={draft} onChange={updateDraftField} />

          <ContactLocationSection values={draft} onChange={updateDraftField} />

          <WorkEligibilitySection values={draft} onChange={updateDraftField} />

          <CareerPreferencesSection
            values={draft}
            onChange={updateDraftField}
          />

          <LinksSection values={draft} onChange={updateDraftField} />

          <DemographicsSection values={draft} onChange={updateDraftField} />

          <CustomFieldsSection
            customFields={customFields}
            onAddField={handleAddCustomField}
            onUpdateField={handleUpdateCustomField}
            onRemoveField={handleRemoveCustomField}
          />
        </div>

        {/* Floating Sticky Save Status Bar */}
        <AnimatePresence>
          {isDirty && (
            <motion.div
              initial={{ opacity: 0, y: 100 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 100 }}
              transition={{ duration: 1, type: 'spring' }}
              className='absolute bottom-6 left-24 right-24 z-30 flex items-center justify-between gap-4 p-3 pl-6! rounded-full bg-panel backdrop-blur-xl shadow-xl  shadow-brand'
            >
              <div className='flex items-center gap-6 min-w-0'>
                <div className='h-4 w-4 rounded-full bg-amber-500 animate-pulse shrink-0' />
                <span className='text-lg font-medium text-ink-primary truncate'>
                  Unsaved changes
                </span>
                <span className='hidden md:inline text-[11px] text-ink-secondary/70'>
                  (Press{' '}
                  <kbd className='px-1 py-0.5 rounded bg-background-secondary text-[10px] font-mono'>
                    ⌘
                  </kbd>
                  {' + '}
                  <kbd className='px-1 py-0.5 rounded bg-background-secondary text-[10px] font-mono'>
                    S
                  </kbd>{' '}
                  to save)
                </span>
              </div>

              <div className='flex items-center gap-2 shrink-0'>
                <Button
                  variant='ghost'
                  size='md'
                  Icon={RotateCcw}
                  onClick={handleResetChanges}
                  disabled={isSaving}
                >
                  Discard
                </Button>
                <Button
                  size='md'
                  Icon={isSaving ? Loader2 : Save}
                  onClick={() => void handleSave()}
                  isLoading={isSaving}
                  className='shadow-md'
                >
                  Save
                  <div className='flex items-center gap-1 text-xs text-ink-secondary'>
                    <kbd className='px-1 py-0.5 rounded bg-background-secondary text-[10px] font-mono'>
                      ⌘
                    </kbd>
                    <kbd className='px-1 py-0.5 rounded bg-background-secondary text-[10px] font-mono'>
                      S
                    </kbd>
                  </div>
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
