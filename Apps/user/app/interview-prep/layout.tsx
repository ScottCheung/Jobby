/** @format */

'use client';
import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
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
import { Button } from '@/components/UI/Button';

const baseTabs = [
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

  const getMaskStyle = () => {
    // Config: key is route prefix, value is whether it needs mask
    const maskConfig: Record<string, boolean> = {
      '/interview-prep/collections': true,
      '/interview-prep/explore': false,
      '/interview-prep/library': false,
      '/interview-prep/practice': false,
      '/interview-prep/schedule': false,
      '/interview-prep/guide': true,
      '/interview-prep': true,
    };

    const matchedKey = Object.keys(maskConfig)
      .sort((a, b) => b.length - a.length)
      .find(
        (key) => pathname === key || (pathname ?? '').startsWith(key + '/'),
      );

    const needsMask = matchedKey ? maskConfig[matchedKey] : false;

    if (!needsMask) {
      return { transform: 'none' };
    }

    const maskString =
      'linear-gradient(to bottom, transparent, black 24px, black calc(100% - 24px), transparent), linear-gradient(to left, black 0px, transparent 0px)';

    return {
      maskImage: maskString,
      WebkitMaskImage: maskString,
      maskSize: '100% 100%',
      WebkitMaskSize: '100% 100%',
      maskPosition: '0 0, 100% 0',
      WebkitMaskPosition: '0 0, 100% 0',
      maskRepeat: 'no-repeat, no-repeat',
      WebkitMaskRepeat: 'no-repeat, no-repeat',
      transform: 'none',
    };
  };

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
    <div className='flex flex-col h-[calc(100vh-18px)] min-h-[500px] px-page pt-3 pb-0!'>
      <div className='flex z-20 flex-row items-center justify-between shrink-0 w-full'>
        <div className='flex items-center pb-px px-2'>
          {tabs.map((tab) => {
            const isActive =
              tab.href === '/interview-prep' ?
                pathname === tab.href
              : (pathname ?? '').startsWith(tab.href);
            return (
              <Tooltip
                key={tab.name}
                content={
                  <p className='label-sm max-w-[200px] text-center leading-relaxed'>
                    {tab.description}
                  </p>
                }
                side='bottom'
              >
                <Link
                  href={tab.href}
                  className={cn(
                    'flex items-center group  gap-2 px-4 py-2 transition-colors relative top-px rounded-full hover:bg-panel',
                    isActive ?
                      'text-primary font-bold'
                    : 'border-transparent text-ink-secondary hover:text-ink-primary font-medium  ',
                  )}
                >
                  <tab.icon className='w-[18px] h-[18px]' />
                  <div className='relative'>
                    <span className='text-[13px] tracking-wide'>
                      {tab.name}
                    </span>
                  </div>
                  {isActive && (
                    <motion.div
                      layoutId='activeTab'
                      className='absolute   left-0 right-0 h-full w-full bg-primary/30 group-hover:bg-primary/50 rounded-full '
                    ></motion.div>
                  )}
                </Link>
              </Tooltip>
            );
          })}
        </div>
        <div className='flex items-center ml-auto pr-4 gap-2.5'>
          {/* <AnimationPresence></AnimationPresence> */}
          {/* Discover Community Search Button */}
          <Tooltip content='Discover Community' side='bottom'>
            <Button
              type='button'
              layoutId='global-search-modal'
              variant={'outline'}
              onClick={openGlobalSearch}
              size={'md'}
              Icon={Search}
            >
              <div className='flex text-[13px] font-bold '>Global Search</div>
            </Button>
          </Tooltip>

          <GamificationStats />
        </div>
      </div>
      <div className='flex-1 z-0 overflow-y-auto pt-6' style={getMaskStyle()}>
        <div className='flex-1 h-full'>{children}</div>
      </div>
    </div>
  );
}
