/** @format */

'use client';

import React from 'react';
import {
  Briefcase,
  Globe,
  HeartHandshake,
  KeyRound,
  Layers,
  MapPin,
  ShieldCheck,
  User,
  UserCheck,
  UserRound,
} from 'lucide-react';
import { cn } from '@/lib/utils';

export interface SectionMeta {
  id: string;
  label: string;
  Icon: React.ElementType;
}

export const PROFILE_SECTIONS: SectionMeta[] = [
  {
    id: 'account',
    label: 'Account',
    Icon: UserCheck,
  },
  {
    id: 'personal',
    label: 'Personal Details',
    Icon: UserRound,
  },
  {
    id: 'contact',
    label: 'Contact & Address',
    Icon: MapPin,
  },
  {
    id: 'application-credentials',
    label: 'Application Credentials',
    Icon: KeyRound,
  },
  {
    id: 'eligibility',
    label: 'Work Eligibility',
    Icon: ShieldCheck,
  },
  {
    id: 'career',
    label: 'Career Preferences',
    Icon: Briefcase,
  },
  {
    id: 'links',
    label: 'Links & Portals',
    Icon: Globe,
  },
  {
    id: 'demographics',
    label: 'Diversity & Demographics',
    Icon: HeartHandshake,
  },
  {
    id: 'custom',
    label: 'Custom Fields',
    Icon: Layers,
  },
];

interface ProfileSidebarProps {
  activeSection: string;
  onNavigate: (sectionId: string) => void;
}

export function ProfileSidebar({
  activeSection,
  onNavigate,
}: ProfileSidebarProps) {
  return (
    <aside className='flex w-56 shrink-0 flex-col overflow-hidden panel-xl px-3! py-5! h-full'>
      <div className='flex items-center gap-2.5 px-3 py-2 text-sm font-semibold text-ink-primary'>
        <User className='h-4 w-4 text-primary' />
        Profile sections
      </div>

      <nav
        aria-label='Profile sections'
        className='mt-1 flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto custom-scrollbar-primary'
      >
        <div className='grid gap-0.5'>
          {PROFILE_SECTIONS.map(({ id, label, Icon }) => {
            const isActive = activeSection === id;

            return (
              <button
                key={id}
                type='button'
                onClick={() => onNavigate(id)}
                className={cn(
                  'flex items-center gap-2 rounded-lg py-2 px-3 text-left text-[11px] font-semibold transition-colors cursor-pointer select-none',
                  isActive ?
                    'bg-primary/10 text-primary'
                  : 'text-ink-secondary hover:bg-background-secondary hover:text-ink-primary',
                )}
              >
                <Icon className='h-3.5 w-3.5 shrink-0' />
                <span className='truncate'>{label}</span>
              </button>
            );
          })}
        </div>
      </nav>
    </aside>
  );
}
