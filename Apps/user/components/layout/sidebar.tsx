/** @format */

'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutGrid,
  LayoutDashboard,
  User as UserIcon,
  Search,
  Settings2,
  MessageSquareCode,
  Briefcase,
  LogOut,
  Sun,
  GraduationCap,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { ModeToggle } from '@/components/mode-toggle';
import { ColorPicker } from '@/components/color-picker';
import { ThemeToggle } from '@/components/theme-toggle';
import { ThemeColorToggle } from '@/components/theme-color-toggle';
import { motion, AnimatePresence } from 'framer-motion';

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

const navigation = [
  { name: 'Overview', href: '/', icon: LayoutDashboard },
  { name: 'Profile', href: '/profile', icon: UserIcon },
  { name: 'Job Hunting Profiles', href: '/job-hunting-profiles', icon: Search },
  { name: 'Interview Prep', href: '/interview-prep', icon: GraduationCap },
  { name: 'Browser Session', href: '/browser-session', icon: ChromeIcon },
  { name: 'Agent Settings', href: '/agent-settings', icon: Settings2 },
  { name: 'Question Cache', href: '/questions', icon: MessageSquareCode },
  { name: 'Applications History', href: '/applications', icon: Briefcase },
];

import { useAuthStore } from '@/lib/store';
import { useLayoutStore } from '@/lib/store/layout-store';
import { useConsole } from '@/components/ConsoleContext';
import { useEffect } from 'react';

import {
  Tooltip,
  TooltipRoot,
  TooltipTrigger,
  TooltipContent,
  TooltipProvider,
} from '@/components/UI/tooltip';
import { H4 } from '@/components/UI/text/typography';
import { div } from 'framer-motion/client';
import { Stagger, StaggerItem } from '../animation';

export function Sidebar() {
  const pathname = usePathname();
  const { fetchMe, logout } = useAuthStore();
  const { user } = useConsole();
  const isCollapsed = useLayoutStore((state) => state.isSidebarCollapsed);
  const { toggleSidebar } = useLayoutStore((state) => state.actions);

  useEffect(() => {
    if (!user) {
      fetchMe();
    }
  }, [user, fetchMe]);

  const springTransition = {
    type: 'spring',
    stiffness: 400,
    damping: 40,
  } as const;

  const textVariants = {
    hidden: { opacity: 0, x: -10, width: 0, display: 'none' },
    visible: {
      opacity: 1,
      x: 0,
      width: 'auto',
      display: 'block',
      transition: { delay: 0.05, duration: 0.2 },
    },
    exit: { opacity: 0, x: -10, width: 0, transition: { duration: 0.1 } },
  };

  return (
    <motion.aside
      layout
      initial={{ width: 80 }}
      animate={{ width: isCollapsed ? 80 : 288 }}
      transition={springTransition}
      className={cn(
        'app-drag sticky top-0 z-10 h-screen flex-col justify-between bg-panel flex',
        isCollapsed ? 'p-4' : 'p-sidebar',
      )}
    >
      <div className='flex flex-col gap-10 pt-[48px]'>
        {/* Brand */}
        <div
          className={cn(
            'app-no-drag flex items-center gap-4',
            isCollapsed ? 'justify-center px-0' : 'px-2',
          )}
        >
          <Tooltip
            content={isCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
            side='right'
          >
            <motion.div
              layout
              onClick={toggleSidebar}
              className='app-no-drag flex size-10 shrink-0 cursor-pointer items-center justify-center rounded-xl bg-primary-gradient text-white transition-transform hover:scale-105'
            >
              <LayoutGrid className='size-6' />
            </motion.div>
          </Tooltip>
          <AnimatePresence mode='popLayout'>
            {!isCollapsed && (
              <motion.div
                variants={textVariants}
                initial='hidden'
                animate='visible'
                exit='exit'
                className='flex flex-col whitespace-nowrap overflow-hidden'
              >
                <H4>User Console</H4>
                <p className='mt-1 text-xs font-medium text-ink-secondary'>
                  Auto Job Apply
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Navigation */}

        <nav className='app-no-drag flex flex-col gap-1'>
          {/* <Stagger className='flex flex-col gap-1'> */}{' '}
          {navigation.map((item) => {
            const isActive = pathname === item.href;
            return (
              // <StaggerItem key={item.name} xOffset={5}>
              <Tooltip
                key={item.name}
                content={isCollapsed ? item.name : null}
                side='right'
              >
                <Link
                  href={item.href}
                  className={cn(
                    'app-no-drag group flex items-center gap-3  transition-all',
                    isCollapsed ?
                      'justify-center p-2.5 rounded-full '
                    : 'px-4 py-3.5 rounded-full',
                    isActive ?
                      'text-primary-foreground  bg-primary-gradient'
                    : 'text-ink-secondary hover:bg-background-secondary',
                  )}
                >
                  <motion.div layout className='shrink-0'>
                    <item.icon className='size-5' />
                  </motion.div>
                  <AnimatePresence mode='popLayout'>
                    {!isCollapsed && (
                      <motion.p
                        // variants={textVariants}
                        // initial='hidden'
                        // animate='visible'
                        // exit='exit'
                        className={cn(
                          'text-sm whitespace-nowrap overflow-hidden',
                          isActive ? 'font-bold' : 'font-medium',
                        )}
                      >
                        {item.name}
                      </motion.p>
                    )}
                  </AnimatePresence>
                </Link>
              </Tooltip>
              // </StaggerItem>
            );
          })}
          {/* </Stagger> */}
        </nav>
      </div>

      {/* Footer Nav */}
      <div>
        <AnimatePresence mode='popLayout'>
          {!isCollapsed ?
            <motion.div
              // key='expanded-footer'
              // variants={{
              //   hidden: {
              //     opacity: 0,
              //     height: 0,
              //     marginBottom: 0,
              //     paddingTop: 0,
              //     borderTopWidth: 0,
              //   },
              //   visible: {
              //     opacity: 1,
              //     height: 'auto',
              //     marginBottom: 24,
              //     paddingTop: 24,
              //     borderTopWidth: 1,
              //   },
              //   exit: {
              //     opacity: 0,
              //     height: 0,
              //     marginBottom: 0,
              //     paddingTop: 0,
              //     borderTopWidth: 0,
              //   },
              // }}
              // initial='hidden'
              // animate='visible'
              // exit='exit'
              className='app-no-drag flex flex-col gap-4 border-primary/10 overflow-hidden'
            >
              <div className='flex items-center justify-between'>
                <p className='text-xs font-medium text-ink-secondary dark:text-gray-400'>
                  Theme
                </p>
                <ModeToggle />
              </div>
              <div className='flex items-center justify-between'>
                <p className='text-xs font-medium text-ink-secondary dark:text-gray-400'>
                  Color
                </p>
                <div className='flex items-center gap-2'>
                  <ColorPicker />
                  <ThemeColorToggle />
                </div>
              </div>
            </motion.div>
          : <motion.div
              key='collapsed-footer'
              // variants={{
              //   hidden: {
              //     opacity: 0,
              //     height: 0,
              //     marginBottom: 0,
              //     paddingTop: 0,
              //     borderTopWidth: 0,
              //   },
              //   visible: {
              //     opacity: 1,
              //     height: 'auto',
              //     marginBottom: 24,
              //     paddingTop: 24,
              //     borderTopWidth: 1,
              //   },
              //   exit: {
              //     opacity: 0,
              //     height: 0,
              //     marginBottom: 0,
              //     paddingTop: 0,
              //     borderTopWidth: 0,
              //   },
              // }}
              // initial='hidden'
              // animate='visible'
              // exit='exit'
              className='app-no-drag flex flex-col items-center gap-2 border-primary/10 overflow-hidden'
            >
              <ThemeToggle />
              <ThemeColorToggle />
            </motion.div>
          }
        </AnimatePresence>

        <div
          className={cn(
            'app-no-drag flex items-center gap-3 mt-6',
            isCollapsed ? 'justify-center' : 'px-2',
          )}
        >
          <div className='relative shrink-0'>
            <motion.div
              layout
              className='size-10 shrink-0 overflow-hidden rounded-full border border-emerald-500/20 shadow-xs transition-transform hover:scale-105'
            >
              <div className='w-full h-full bg-emerald-600/10 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400 font-bold flex items-center justify-center text-sm'>
                {user?.display_name ?
                  user.display_name.slice(0, 2).toUpperCase()
                : 'LU'}
              </div>
            </motion.div>
            <span className='absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 border-2 border-white dark:border-[#181C26] rounded-full'></span>
          </div>
          <AnimatePresence mode='popLayout'>
            {!isCollapsed && (
              <motion.div
                variants={textVariants}
                initial='hidden'
                animate='visible'
                exit='exit'
                className='flex flex-col flex-1 min-w-0 overflow-hidden'
              >
                <p className='text-sm font-semibold text-zinc-800 dark:text-zinc-200 truncate leading-tight'>
                  {user?.display_name ?? 'Local Admin'}
                </p>
                <button
                  onClick={logout}
                  className='app-no-drag flex items-center gap-1.5 mt-0.5 text-[11px] text-ink-secondary hover:text-red-650 dark:text-gray-400 dark:hover:text-red-400 transition-colors whitespace-nowrap'
                >
                  <LogOut className='size-3' />
                  Log Out
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </motion.aside>
  );
}
