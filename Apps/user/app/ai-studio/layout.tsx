/** @format */

'use client';

import React from 'react';
import { ModuleTopNav, type ModuleNavigationItem } from '@jobby/ui';
import { Sparkles, History, FileText, Mail, Home } from 'lucide-react';
import { GamificationStats } from '@/app/interview-prep/_components/GamificationStats';

const studioTabs: ModuleNavigationItem[] = [
  {
    name: 'Tailor',
    href: '/ai-studio',
    exact: true,
    icon: Sparkles,
    description: 'Quick entry to tailor CV & Cover Letter with Job Description or link',
  },
  {
    name: 'Recent Tailor',
    href: '/ai-studio/resumes/tailor',
    icon: History,
    description: 'Browse, review, and switch previous tailored resumes and cover letters',
  },
  {
    name: 'Master CV',
    href: '/ai-studio/resumes/master',
    icon: FileText,
    description: 'Single source of truth career profile and master resume',
  },
  {
    name: 'Master CL',
    href: '/ai-studio/cover-letters/master',
    icon: Mail,
    description: 'Master cover letter template and career motivation profile',
  },
];

export default function AiStudioLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ModuleTopNav
      tabs={studioTabs}
      activeLayoutId='ai-studio-active-tab'
      rightContent={<GamificationStats />}
    >
      {children}
    </ModuleTopNav>
  );
}
