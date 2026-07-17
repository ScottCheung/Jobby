/** @format */

'use client';
import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  Library,
  PlayCircle,
  Calendar,
  BookOpen,
} from 'lucide-react';
import { api } from '@/lib/api';
import { Tooltip } from '@/components/UI/tooltip';
import { div } from 'framer-motion/client';
import { motion } from 'framer-motion';

const baseTabs = [
  {
    name: 'Dashboard',
    href: '/interview-prep',
    icon: LayoutDashboard,
    description: 'Overview of your stats, heatmap, and daily mission',
  },
  {
    name: 'Library',
    href: '/interview-prep/library',
    icon: Library,
    description: 'Manage, tag, and organize all your interview questions',
  },
  {
    name: 'Practice',
    href: '/interview-prep/practice',
    icon: PlayCircle,
    description: 'Enter the practice simulator and earn XP',
  },
];

export default function InterviewPlaybookLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [hasActivePlan, setHasActivePlan] = useState(false);

  useEffect(() => {
    const checkActivePlan = async () => {
      try {
        const plans = await api.practicePlans();
        setHasActivePlan(plans && plans.length > 0);
      } catch (err) {
        console.error('Failed to check active plan in layout:', err);
      }
    };

    void checkActivePlan();

    window.addEventListener('playbookPlanChanged', checkActivePlan);
    return () => {
      window.removeEventListener('playbookPlanChanged', checkActivePlan);
    };
  }, [pathname]);

  const dynamicTabs =
    hasActivePlan ?
      [
        ...baseTabs,
        {
          name: 'Schedule',
          href: '/interview-prep/schedule',
          icon: Calendar,
          description:
            'View your daily practice plan and adjust your prep pace',
        },
      ]
    : baseTabs;

  const tabs = [
    ...dynamicTabs,
    {
      name: 'Guide',
      href: '/interview-prep/guide',
      icon: BookOpen,
      description:
        'Learn how to use the Playbook and understand gamification rules',
    },
  ];

  return (
    <div className='flex flex-col h-[calc(100vh-36px)] min-h-[500px] mt-[-36px] '>
      <div className='flex flex-col  mb-[18px] shrink-0'>
        <div className='flex items-center  pb-px px-2'>
          {tabs.map((tab) => {
            const isActive =
              tab.href === '/interview-prep' ?
                pathname === tab.href
              : (pathname ?? '').startsWith(tab.href);
            return (
              <Tooltip key={tab.name} content={tab.description} side='bottom'>
                <Link
                  href={tab.href}
                  className={cn(
                    'flex items-center gap-2 px-4 py-2 transition-colors relative top-px rounded-b-xl',
                    isActive ?
                      'border-primary text-primary font-bold'
                    : 'border-transparent text-ink-secondary hover:text-ink-primary font-medium hover:bg-panel ',
                  )}
                >
                  <tab.icon className='w-[18px] h-[18px]' />
                  <span className='text-[13px] tracking-wide'>{tab.name}</span>
                  {isActive && (
                    <motion.div
                      layoutId='activeTab'
                      className='absolute top-0 left-0 right-0 h-9 bg-primary/10 rounded-b-xl '
                    ></motion.div>
                  )}
                </Link>
              </Tooltip>
            );
          })}
        </div>
      </div>
      <div className='flex-1 overflow-y-auto'>{children}</div>
    </div>
  );
}
