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
  BookOpen,
  Compass,
  Globe,
  Search,
} from 'lucide-react';
import { api } from '@/lib/api';
import { Tooltip } from '@/components/UI/tooltip';
import { motion } from 'framer-motion';
import { GamificationStats } from './_components/GamificationStats';
import { useConsole } from '@/components/ConsoleContext';
import { GlobalSearchModal } from './library/_components/GlobalSearchModal';
import { useGlobalModalStore } from '@/lib/store/global-modal-store';

const baseTabs = [
  {
    name: 'Dashboard',
    href: '/interview-prep',
    icon: LayoutDashboard,
    description: 'Overview of your stats, heatmap, and daily mission',
  },
  {
    name: 'Collections',
    href: '/interview-prep/collections',
    icon: Compass,
    description:
      'Browse official and community collections to grow your library',
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
  {
    name: 'History',
    href: '/interview-prep/history',
    icon: BookOpen,
    description: 'View your practice records and XP/Coin transactions',
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
      '/interview-prep/collections': false,
      '/interview-prep/library': false,
      '/interview-prep/practice': false,
      '/interview-prep/schedule': false,
      '/interview-prep/guide': true,
      '/interview-prep': true, // Dashboard or root
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
      'linear-gradient(to bottom, transparent, black 24px, black calc(100% - 24px), transparent), linear-gradient(to left, black 16px, transparent 16px)';

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

  const openGlobalSearch = () => {
    openModal({
      layoutId: 'global-search-modal',
      className: 'w-[92vw] max-w-4xl h-[80vh] rounded-[28px]',
      content: <GlobalSearchModal onClose={closeModal} />,
      onClose: closeModal,
    });
  };

  return (
    <div className='flex flex-col h-[calc(100vh-18px)] min-h-[500px] px-page pt-3'>
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
            <motion.button
              type='button'
              layoutId='global-search-modal'
              onClick={openGlobalSearch}
              className='flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/5 px-3 py-1.5 text-[13px] font-bold text-primary transition-none!  hover:bg-primary/10 active:scale-95'
            >
              <Search className='w-3.5 h-3.5' />
            </motion.button>
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
