/** @format */

'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutGrid,
  User as UserIcon,
  Search,
  Settings2,
  Briefcase,
  FileText,
  Target,
  ShieldCheck,
  MessagesSquare,
  LogOut,
  Sun,
  GraduationCap,
  Palette,
  Star,
  MessageSquareCode,
  UserCheck,
  Sparkles,
  LogIn,
} from 'lucide-react';
import { openGlobalAuthModal } from '@/lib/store/auth-modal-store';
import { cn } from '@/lib/utils';
import { ModeToggle } from '@/components/mode-toggle';
import { ColorPicker } from '@/components/color-picker';
import { ThemeToggle } from '@/components/theme-toggle';
import { ThemeColorToggle } from '@/components/theme-color-toggle';
import { motion, AnimatePresence } from 'framer-motion';
import { FavoritesDrawer } from './FavoritesDrawer';
import {
  Tooltip,
  TooltipRoot,
  TooltipTrigger,
  TooltipContent,
  TooltipProvider,
} from '../UI/tooltip';
import { H4 } from '../UI/text/typography';
import { NotificationCenter } from '../notifications/NotificationCenter';
import { Stagger, StaggerItem } from '../animation';

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
  { name: 'Home', href: '/', icon: LayoutGrid },
  { name: 'AI Networking Assistant', href: '/ai-studio/prospects', icon: UserCheck },
  { name: 'AI Studio', href: '/ai-studio', icon: Sparkles },
  { name: 'Applications', href: '/applications', icon: Briefcase },
  { name: 'Interview Prep', href: '/interview-prep', icon: GraduationCap },
  {
    name: 'Favorites & Bookmarks',
    href: '#favorites',
    icon: Star,
    isAction: true,
  },
  { name: 'Settings & Profile', href: '/settings', icon: Settings2 },
];

const adminNavigation = [
  { name: 'Incentive Admin', href: '/admin/incentives', icon: ShieldCheck },
  {
    name: 'Celebration Admin',
    href: '/admin/celebrations',
    icon: MessagesSquare,
  },
];

import { useAuthStore } from '@/lib/store';
import { useLayoutStore } from '@/lib/store/layout-store';
import { useConsole } from '@/components/ConsoleContext';
import { useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();
  const { fetchMe, logout: authLogout } = useAuthStore();
  const { user, profile, isDesktopApp } = useConsole();
  const isCollapsed = useLayoutStore((state) => state.isSidebarCollapsed);
  const { toggleSidebar, openDrawer } = useLayoutStore(
    (state) => state.actions,
  );

  const handleOpenFavorites = () => {
    openDrawer({
      width: 440,
      content: <FavoritesDrawer />,
    });
  };

  useEffect(() => {
    if (!user) {
      fetchMe();
    }
  }, [user, fetchMe]);

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
      authLogout();
      router.push('/login');
    } catch (err) {
      console.error('Failed to log out:', err);
    }
  };

  const displayName = (() => {
    if (!user) {
      return 'Guest Mode';
    }
    if (user?.display_name && !user.display_name.includes('@')) {
      return user.display_name;
    }
    if (profile?.first_name || profile?.last_name) {
      return `${profile.first_name || ''} ${profile.last_name || ''}`.trim();
    }
    return user?.email || 'User';
  })();

  const initials = (() => {
    if (!user) return 'G';
    if (displayName.includes('@')) {
      return displayName.slice(0, 2).toUpperCase();
    }
    const parts = displayName.split(' ').filter(Boolean);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return displayName.slice(0, 2).toUpperCase();
  })();

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

  const desktopNavigation = [
    { name: 'Home', href: '/', icon: LayoutGrid },
    { name: 'AI Networking Assistant', href: '/ai-studio/prospects', icon: UserCheck },
    { name: 'AI Studio', href: '/ai-studio', icon: Sparkles },
    { name: 'Applications', href: '/applications', icon: Briefcase },
    { name: 'Interview Prep', href: '/interview-prep', icon: GraduationCap },
    {
      name: 'Favorites & Bookmarks',
      href: '#favorites',
      icon: Star,
      isAction: true,
    },
    { name: 'Settings & Profile', href: '/settings', icon: Settings2 },
  ];

  const activeNavigation = isDesktopApp ? desktopNavigation : navigation;
  const visibleNavigation =
    user?.role === 'admin' ?
      [...activeNavigation, ...adminNavigation]
    : activeNavigation;

  return (
    <motion.aside
      layout
      initial={{ width: 80 }}
      animate={{ width: isCollapsed ? 80 : 288 }}
      transition={springTransition}
      className={cn(
        'app-drag h-screen shrink-0 z-20 backdrop-blur-2xl flex-col justify-between bg-panel flex overflow-hidden',
        isCollapsed ? 'p-4' : 'p-sidebar',
      )}
    >
      <div className='flex flex-col gap-6 pt-[48px] flex-1 min-h-0 overflow-hidden'>
        {/* Brand */}
        <div
          className={cn(
            'app-no-drag flex items-center gap-4 shrink-0',
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
                <p className='label-sm mt-1'>Auto Job Apply</p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Navigation */}

        <nav className='app-no-drag overflow-y-auto no-scrollbar flex-1 flex flex-col gap-1 min-h-0'>
          {visibleNavigation.map((item) => {
            const isAction = 'isAction' in item && item.isAction;
            const isActive =
              !isAction &&
              (pathname === item.href ||
                (item.href === '/settings' &&
                  pathname?.startsWith('/settings')) ||
                (item.href !== '/' &&
                  item.href !== '/settings' &&
                  !item.href.startsWith('#') &&
                  Boolean(pathname?.startsWith(item.href)) &&
                  !visibleNavigation.some(
                    (other) =>
                      other.href !== item.href &&
                      other.href !== '/' &&
                      !('isAction' in other && other.isAction) &&
                      !other.href.startsWith('#') &&
                      Boolean(pathname?.startsWith(other.href)) &&
                      other.href.length > item.href.length,
                  )));

            const navItemContent = (
              <div
                className={cn(
                  'app-no-drag group flex items-center gap-3 transition-all cursor-pointer',
                  isCollapsed ?
                    'justify-center p-2.5 rounded-full '
                  : 'px-4 py-3.5 rounded-full',
                  isActive ?
                    'text-primary-foreground bg-primary-gradient '
                  : 'text-ink-secondary hover:bg-background-secondary hover:text-ink-primary',
                )}
              >
                <motion.div layout className='shrink-0'>
                  <item.icon className={cn('size-5')} />
                </motion.div>
                <AnimatePresence mode='popLayout'>
                  {!isCollapsed && (
                    <motion.p
                      className={cn(
                        'whitespace-nowrap overflow-hidden',
                        isActive ? 'font-bold' : 'font-medium',
                      )}
                    >
                      {item.name}
                    </motion.p>
                  )}
                </AnimatePresence>
              </div>
            );

            return (
              <Tooltip
                key={item.name}
                content={isCollapsed ? item.name : null}
                side='right'
              >
                {isAction ?
                  <button
                    onClick={handleOpenFavorites}
                    className='w-full text-left font-normal focus:outline-hidden'
                  >
                    {navItemContent}
                  </button>
                : <Link href={item.href}>{navItemContent}</Link>}
              </Tooltip>
            );
          })}
        </nav>
      </div>

      {/* Footer Nav */}
      <div className='shrink-0 pt-4 border-t border-primary/40'>
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
                <p className='label-sm dark:text-gray-400'>Theme</p>
                <ModeToggle />
              </div>
              <div className='flex items-center justify-between'>
                <p className='label-sm dark:text-gray-400'>Color</p>
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
              <NotificationCenter />
            </motion.div>
          }
        </AnimatePresence>

        <div
          className={cn(
            'app-no-drag flex items-center gap-3 mt-6',
            isCollapsed ? 'justify-center' : 'px-2',
          )}
        >
          {user ?
            <>
              <Link
                href='/settings/profile'
                aria-label='Open profile settings'
                className='relative shrink-0'
              >
                <Tooltip
                  content={
                    isCollapsed ?
                      `${displayName} (Open profile settings)`
                    : null
                  }
                  side='right'
                >
                  <motion.div
                    layout
                    className='size-10 shrink-0 overflow-hidden rounded-full border border-emerald-500/20 shadow-xs transition-transform hover:scale-105'
                  >
                    <div className='label w-full h-full bg-emerald-600/10 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400 flex items-center justify-center'>
                      {initials}
                    </div>
                  </motion.div>
                </Tooltip>
                <span className='absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 border-2 border-white dark:border-[#181C26] rounded-full'></span>
              </Link>
              <AnimatePresence mode='popLayout'>
                {!isCollapsed && (
                  <motion.div
                    variants={textVariants}
                    initial='hidden'
                    animate='visible'
                    exit='exit'
                    className='flex flex-col flex-1 min-w-0 overflow-hidden'
                  >
                    <p
                      className='label truncate leading-tight'
                      title={displayName}
                    >
                      {displayName}
                    </p>
                    <button
                      onClick={handleLogout}
                      className='app-no-drag flex items-center gap-1.5 mt-0.5 text-[11px] text-ink-secondary hover:text-red-650 dark:text-gray-400 dark:hover:text-red-400 transition-colors whitespace-nowrap'
                    >
                      <LogOut className='size-3' />
                      Log Out
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </>
          : <>
              <Tooltip
                content={isCollapsed ? 'Guest Mode (Click to Sign In)' : null}
                side='right'
              >
                <button
                  type='button'
                  onClick={() =>
                    openGlobalAuthModal({
                      reason: 'Sign in to access personal features',
                    })
                  }
                  className='relative shrink-0 flex items-center justify-center size-10 rounded-full border border-primary/80 bg-surface-secondary text-ink-secondary hover:text-primary hover:border-primary/40 transition-all cursor-pointer'
                >
                  <LogIn className='size-4' />
                </button>
              </Tooltip>
              <AnimatePresence mode='popLayout'>
                {!isCollapsed && (
                  <motion.div
                    variants={textVariants}
                    initial='hidden'
                    animate='visible'
                    exit='exit'
                    className='flex flex-col flex-1 min-w-0 overflow-hidden'
                  >
                    <p className='label truncate leading-tight text-ink-secondary'>
                      Guest Mode
                    </p>
                    <button
                      type='button'
                      onClick={() =>
                        openGlobalAuthModal({
                          reason: 'Sign in to access personal features',
                        })
                      }
                      className='app-no-drag flex items-center gap-1.5 mt-0.5 text-[11px] font-semibold text-primary hover:underline transition-colors whitespace-nowrap cursor-pointer'
                    >
                      Sign In / Register
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </>
          }
        </div>
      </div>
    </motion.aside>
  );
}
