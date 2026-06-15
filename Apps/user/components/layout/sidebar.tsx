/** @format */

'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutGrid,
  LayoutDashboard,
  Users,
  Calendar,
  Settings,
  Settings2,
  CircleHelp,
  LogOut,
  Building,
  Sun,
  Scroll,
  List,
  Settings2Icon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { ListGridToggle } from '@/components/list-grid-toggle';
import { ModeToggle } from '@/components/mode-toggle';
import { ColorPicker } from '@/components/color-picker';
import { motion, AnimatePresence } from 'framer-motion';

const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Accounts', href: '/accounts', icon: Building },
  // { name: "Company", href: "/company", icon: Building },
  // { name: "Employees", href: "/employees", icon: Users },
  { name: 'Employment Types', href: '/employment-types', icon: Users },
  { name: 'Leave Types', href: '/leaves', icon: Sun },
  { name: 'Leave Rules', href: '/leave-rules', icon: Scroll },
  { name: 'Help & Support', href: '/help-center', icon: CircleHelp },
  { name: 'UI TEST', href: '/ui', icon: Settings2Icon },
];

import { useAuthStore } from '@/lib/store';
import { useLayoutStore } from '@/lib/store/layout-store';
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
  const { user, fetchMe, logout } = useAuthStore();
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
      initial={{ width: 288 }}
      animate={{ width: isCollapsed ? 80 : 288 }}
      transition={springTransition}
      className={cn(
        'sticky top-0 z-10 hidden h-screen flex-col justify-between bg-panel lg:flex overflow-hidden',
        isCollapsed ? 'p-4' : 'p-sidebar',
      )}
    >
      <div className='flex flex-col gap-10'>
        {/* Brand */}
        <div
          className={cn(
            'flex items-center gap-4',
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
              className='flex size-10 shrink-0 cursor-pointer items-center justify-center rounded-xl bg-primary-gradient text-white transition-transform hover:scale-105'
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
                <H4>Admin Portal</H4>
                <p className='mt-1 text-xs font-medium text-ink-secondary'>
                  Employment Types System
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Navigation */}

        <nav className='flex flex-col gap-1'>
          <Stagger
            className='flex flex-col gap-1'

          > {navigation.map((item) => {
            const isActive = pathname === item.href;
            return (
              <StaggerItem key={item.name}
                xOffset={20}
              >
                <Tooltip
                  content={isCollapsed ? item.name : null}
                  side='right'

                >
                  <Link
                    href={item.href}
                    className={cn(
                      'group flex items-center gap-3 rounded-full transition-all',
                      isCollapsed ? 'justify-center p-2.5' : 'px-4 py-3.5',
                      isActive
                        ? 'text-primary bg-primary/5'
                        : 'text-ink-secondary hover:bg-background',
                    )}
                  >
                    <motion.div layout className='shrink-0'>
                      <item.icon className='size-5' />
                    </motion.div>
                    <AnimatePresence mode='popLayout'>
                      {!isCollapsed && (
                        <motion.p
                          variants={textVariants}
                          initial='hidden'
                          animate='visible'
                          exit='exit'
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
              </StaggerItem>
            );
          })}
          </Stagger>
        </nav>

      </div>

      {/* Footer Nav */}
      <div>
        <AnimatePresence mode='popLayout'>
          {!isCollapsed && (
            <motion.div
              variants={{
                hidden: {
                  opacity: 0,
                  height: 0,
                  marginBottom: 0,
                  paddingTop: 0,
                  borderTopWidth: 0,
                },
                visible: {
                  opacity: 1,
                  height: 'auto',
                  marginBottom: 24,
                  paddingTop: 24,
                  borderTopWidth: 1,
                },
                exit: {
                  opacity: 0,
                  height: 0,
                  marginBottom: 0,
                  paddingTop: 0,
                  borderTopWidth: 0,
                },
              }}
              initial='hidden'
              animate='visible'
              exit='exit'
              className='flex flex-col gap-4 border-primary/10 overflow-hidden'
            >
              <div className='flex items-center justify-between'>
                <p className='text-xs font-medium text-ink-secondary dark:text-gray-400'>
                  View
                </p>
                <ListGridToggle />
              </div>
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
                <ColorPicker />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className={cn('flex gap-3', isCollapsed ? 'justify-center' : '')}>
          <motion.div
            layout
            className='size-12 shrink-0 overflow-hidden rounded-full border-2 border-white transition-transform hover:scale-105 dark:border-zinc-800'
          >
            <img
              src='https://media.licdn.com/dms/image/v2/C4E0BAQG0sUKoTGt7gQ/company-logo_100_100/company-logo_100_100/0/1630605791837?e=1766016000&v=beta&t=7ZQBJ5PvGvzlQbGQEA-LTmVi0OMHRL1gafacOfZa35E'
              alt='Avatar'
              className='h-full w-full object-cover'
            />
          </motion.div>
          <AnimatePresence mode='popLayout'>
            {!isCollapsed && (
              <motion.div
                variants={textVariants}
                initial='hidden'
                animate='visible'
                exit='exit'
                className='flex flex-col flex-1 min-w-0 overflow-hidden'
              >
                <p className='text-sm font-bold text-gradient truncate'>
                  {user?.username || 'Loading...'}
                </p>
                <button
                  onClick={logout}
                  className='flex items-center gap-2 text-xs text-ink-secondary hover:text-red-600 dark:text-gray-400 dark:hover:text-red-400 transition-colors whitespace-nowrap'
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
