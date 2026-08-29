/** @format */

'use client';

import { BriefcaseBusiness, Sparkles } from 'lucide-react';
import { ModuleTopNav, type ModuleNavigationItem } from '@jobby/ui';
import { GamificationStats } from '@/app/interview-prep/_components/GamificationStats';

const tabs: ModuleNavigationItem[] = [
  {
    name: 'Application History',
    href: '/applications',
    icon: BriefcaseBusiness,
    description: 'Review submitted applications',
    exact: true,
  },
  {
    name: 'Recommendations',
    href: '/applications/recommendations',
    icon: Sparkles,
    description: 'Review AI-selected job opportunities',
  },
];

export default function ApplicationsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ModuleTopNav
      tabs={tabs}
      activeLayoutId='applications-active-tab'
      rightContent={<GamificationStats />}
    >
      {children}
    </ModuleTopNav>
  );
}
