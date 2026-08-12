/** @format */

'use client';
import React, { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Library,
  Dumbbell,
  Calendar,
  Search,
} from 'lucide-react';
import { api } from '@/lib/api';
import { Tooltip } from '@/components/UI/tooltip';
import { motion } from 'framer-motion';
import { GamificationStats } from './_components/GamificationStats';
import { useConsole } from '@/components/ConsoleContext';
import { GlobalSearchModal } from './library/_components/GlobalSearchModal';
import { useGlobalModalStore } from '@/lib/store/global-modal-store';
import { Button } from '@jobby/ui';
import {
  ModuleTopNav,
  type ModuleNavigationItem,
} from '@/components/layout/module-top-nav';

const baseTabs: ModuleNavigationItem[] = [
  {
    name: 'Dashboard',
    href: '/interview-prep',
    icon: LayoutDashboard,
    description: 'Overview of your stats, heatmap, and daily mission',
  },
  {
    name: 'Explore',
    href: '/interview-prep/explore',
    icon: Search,
    description: 'Discover questions and Question Sets',
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
    icon: Dumbbell,
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
  const openModal = useGlobalModalStore((state) => state.actions.openModal);
  const closeModal = useGlobalModalStore((state) => state.actions.closeModal);

  const contentFade =
    pathname === '/interview-prep' ||
    pathname === '/interview-prep/collections' ||
    pathname === '/interview-prep/guide';

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
  }, []);

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

  const tabs = [...dynamicTabs];

  const openGlobalSearch = () => {
    openModal({
      layoutId: 'global-search-modal',
      className: 'w-[92vw] max-w-4xl h-[80vh] rounded-[28px]',
      content: <GlobalSearchModal onClose={closeModal} />,
      onClose: closeModal,
    });
  };

  return (
    <ModuleTopNav
      tabs={tabs}
      activeLayoutId='interview-prep-active-tab'
      contentFade={contentFade}
      rightContent={
        <>
          <Tooltip content='Discover Community' side='bottom'>
            <Button
              type='button'
              layoutId='global-search-modal'
              variant='outline'
              onClick={openGlobalSearch}
              size='md'
              Icon={Search}
            >
              <span className='text-[13px] font-bold'>Global Search</span>
            </Button>
          </Tooltip>
          <GamificationStats />
        </>
      }
    >
      {children}
    </ModuleTopNav>
  );
}
