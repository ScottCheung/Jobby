/** @format */

'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { User, Search, Settings2, Bell, FileText } from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';

const ChromeIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg
    xmlns='http://www.w3.org/2000/svg'
    width='24'
    height='24'
    viewBox='0 0 24 24'
    fill='none'
    stroke='currentColor'
    strokeWidth='2'
    strokeLinecap='round'
    strokeLinejoin='round'
    {...props}
  >
    <circle cx='12' cy='12' r='10' />
    <circle cx='12' cy='12' r='4' />
    <line x1='21.17' x2='12' y1='8' y2='8' />
    <line x1='3.95' x2='8.54' y1='6.06' y2='14' />
    <line x1='10.88' x2='15.46' y1='21.94' y2='14' />
  </svg>
);

const settingsNavigation = [
  { name: 'Personal Info', href: '/settings/profile', icon: User },
  { name: 'Resume', href: '/settings/resume', icon: FileText },
  { name: 'Job Search', href: '/settings/job-profiles', icon: Search },
  { name: 'Agent Settings', href: '/settings/agent', icon: Settings2 },
  {
    name: 'Browser Session',
    href: '/settings/browser-session',
    icon: ChromeIcon,
  },
  { name: 'Notifications', href: '/settings/notifications', icon: Bell },
];

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div className='flex gap-6 h-full w-full relative overflow-hidden p-page'>
      {/* Secondary Sidebar Panel */}
      <div className='w-64 shrink-0 panel-xl p-lg! flex flex-col overflow-hidden relative'>
        <div className='mb-6 px-2 shrink-0'>
          <h2 className='title-card text-ink-primary'>Settings</h2>
          <p className='body-sm text-ink-secondary mt-1'>
            Manage your account preferences
          </p>
        </div>
        <nav className='flex flex-col gap-1 flex-1 min-h-0 overflow-y-auto no-scrollbar'>
          {settingsNavigation.map((item) => {
            const isActive = (pathname || '').startsWith(item.href);
            return (
              <Link
                key={item.name}
                href={item.href}
                className={cn(
                  'group flex items-center gap-3 rounded-xl px-3 py-2.5 transition-all label',
                  isActive ?
                    'bg-primary-gradient text-white font-medium shadow-md'
                  : 'text-ink-secondary hover:bg-background-secondary hover:text-ink-primary',
                )}
              >
                <item.icon className='h-5 w-5 shrink-0' />
                <span className='text-sm'>{item.name}</span>
                {isActive && <motion.div layoutId='settings-active-nav' />}
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Main Content Area Panel */}
      <div className='w-full'>{children}</div>
    </div>
  );
}
