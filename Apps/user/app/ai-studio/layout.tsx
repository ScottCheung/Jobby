/** @format */

'use client';

import React from 'react';
import { ModuleTopNav, type ModuleNavigationItem } from '@jobby/ui';
import { Sparkles, UserCheck } from 'lucide-react';
import { GamificationStats } from '@/app/interview-prep/_components/GamificationStats';

const studioTabs: ModuleNavigationItem[] = [
  {
    name: 'Tailor CV & CL',
    href: '/ai-studio',
    icon: Sparkles,
    description: 'Quick entry to tailor CV & Cover Letter with Job Description or link',
  },
  {
    name: 'Job Recommendations',
    href: '/ai-studio/recommendations',
    icon: Sparkles,
    description: 'Review AI-selected job opportunities and search recommendations',
  },
  {
    name: 'AI Networking',
    href: '/ai-studio/prospects',
    icon: UserCheck,
    description: 'Discover and manage key contacts to accelerate your job search',
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
