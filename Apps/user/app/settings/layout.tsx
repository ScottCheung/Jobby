/** @format */

'use client';

import { Bell, FileText, MessageSquareCode, Monitor, Settings2, User } from 'lucide-react';
import {
  ModuleTopNav,
  type ModuleNavigationItem,
} from '@/components/layout/module-top-nav';

const settingsNavigation: ModuleNavigationItem[] = [
  {
    name: 'Profile',
    href: '/settings/profile',
    icon: User,
    description: 'Manage the personal data and preferences used for autofill.',
  },
  {
    name: 'Resume Profile',
    href: '/settings/resumes',
    icon: FileText,
    description: 'Manage master resume profile, score history, work experience, and resume tailoring.',
  },
  {
    name: 'Apply Settings',
    href: '/settings/apply-settings',
    icon: Settings2,
    description: 'Configure job search keywords, filters, blacklist, and automation behavior.',
  },
  {
    name: 'AI Memory',
    href: '/settings/ai-memory',
    icon: MessageSquareCode,
    description: 'Manage reusable answers and field mapping rules.',
  },
  {
    name: 'Browser Session',
    href: '/settings/browser-session',
    icon: Monitor,
    description: 'Manage the connected browser session.',
  },
  {
    name: 'Notifications',
    href: '/settings/notifications',
    icon: Bell,
    description: 'Choose which updates Jobby sends you.',
  },
];

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ModuleTopNav
      tabs={settingsNavigation}
      activeLayoutId='settings-active-tab'
      contentClassName='pt-5'
    >
      {children}
    </ModuleTopNav>
  );
}
