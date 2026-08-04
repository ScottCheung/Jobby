/** @format */

'use client';

import { usePathname } from 'next/navigation';
import {
  BriefcaseBusiness,
  LayoutDashboard,
  MessageSquareCode,
} from 'lucide-react';
import {
  ModuleTopNav,
  type ModuleNavigationItem,
} from '@/components/layout/module-top-nav';
import { GamificationStats } from '@/app/interview-prep/_components/GamificationStats';
import { DashboardStats } from '@/components/layout/dashboard-stats';

const tabs: ModuleNavigationItem[] = [
  {
    name: 'Dashboard',
    href: '/job-application',
    icon: LayoutDashboard,
    description: 'Overview of your application activity and automation',
    exact: true,
  },
  {
    name: 'Application History',
    href: '/job-application/history',
    icon: BriefcaseBusiness,
    description: 'Review submitted, skipped, and in-progress applications',
  },
  {
    name: 'AI Memory',
    href: '/settings/ai-memory',
    icon: MessageSquareCode,
    description: 'Manage reusable answers for application forms',
  },
];

export default function JobApplicationLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const isDashboard = pathname === '/job-application';

  return (
    <ModuleTopNav
      tabs={tabs}
      activeLayoutId='job-application-active-tab'
      rightContent={<GamificationStats />}
      contentFade={isDashboard}
    >
      {isDashboard ? (
        <div className='flex min-h-full flex-col gap-6 pb-6'>
          <DashboardStats className='shrink-0' />
          {children}
        </div>
      ) : (
        children
      )}
    </ModuleTopNav>
  );
}
