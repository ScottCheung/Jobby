/** @format */

'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutGrid,
  User as UserIcon,
  Search,
  Settings2,
  Briefcase,
  FileText,
  ShieldCheck,
  MessagesSquare,
  LogOut,
  GraduationCap,
  Star,
  MessageSquareCode,
  UserCheck,
  Sparkles,
  LogIn,
  LayoutDashboard,
  Library,
  Dumbbell,
  Calendar,
  MessageSquare,
  Bookmark,
  Layers,
  Mail,
  Bell,
  ChevronRight,
} from '@jobby/ui/components/icons';
import * as PopoverPrimitive from '@radix-ui/react-popover';
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
} from '../UI/tooltip';
import { H4 } from '../UI/text/typography';
import { NotificationCenter } from '../notifications/NotificationCenter';
import { useLayoutStore } from '@/lib/store/layout-store';
import { useConsole } from '@/components/ConsoleContext';
import { createClient } from '@/lib/supabase/client';
import React, { useState, useRef } from 'react';

export type SubmenuItem = {
  name: string;
  href?: string;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
  exact?: boolean;
  isAction?: boolean;
  actionTab?: 'questions' | 'comments' | 'answers' | 'collections';
};

export type SidebarNavigationItem = {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  description?: string;
  isAction?: boolean;
  submenus?: SubmenuItem[];
};

const navigation: SidebarNavigationItem[] = [
  {
    name: 'Home',
    href: '/',
    icon: LayoutGrid,
    description: 'Dashboard overview & quick start',
    submenus: [
      {
        name: 'Dashboard Overview',
        href: '/',
        icon: LayoutGrid,
        description: 'Application trends, stats & quick jump',
        exact: true,
      },
    ],
  },
  {
    name: 'AI Studio',
    href: '/ai-studio',
    icon: Sparkles,
    description: 'AI tailoring, recommendations & networking',
    submenus: [
      {
        name: 'Tailor CV & CL',
        href: '/ai-studio',
        icon: Sparkles,
        description: 'Instant tailored resume & cover letter',
        exact: true,
      },
      {
        name: 'Job Recommendations',
        href: '/ai-studio/recommendations',
        icon: Sparkles,
        description: 'AI-matched job opportunities',
      },
      {
        name: 'AI Networking',
        href: '/ai-studio/prospects',
        icon: UserCheck,
        description: 'Discover key hiring contacts & outreach',
      },
    ],
  },
  {
    name: 'Applications',
    href: '/applications',
    icon: Briefcase,
    description: 'Application tracking, trends & analytics',
    submenus: [
      {
        name: 'Dashboard & Analytics',
        href: '/applications',
        icon: LayoutDashboard,
        description: 'Application trends, stats & distribution',
        exact: true,
      },
      {
        name: 'Application History',
        href: '/applications/history',
        icon: Briefcase,
        description: 'Submitted applications & status tracking',
      },
      {
        name: 'Job Recommendations',
        href: '/applications/recommendations',
        icon: Sparkles,
        description: 'AI-recommended job opportunities',
      },
    ],
  },
  {
    name: 'Interview Copilot',
    href: '/interview-prep',
    icon: GraduationCap,
    description: 'Master interview Q&A and AI mock simulator',
    submenus: [
      {
        name: 'Dashboard',
        href: '/interview-prep',
        icon: LayoutDashboard,
        description: 'Practice metrics, streak & daily mission',
        exact: true,
      },
      {
        name: 'Question Discovery',
        href: '/interview-prep/explore',
        icon: Search,
        description: 'Explore curated questions & question sets',
      },
      {
        name: 'Question Library',
        href: '/interview-prep/library',
        icon: Library,
        description: 'Manage, tag & organize your question bank',
      },
      {
        name: 'Practice Simulator',
        href: '/interview-prep/practice',
        icon: Dumbbell,
        description: 'Interactive AI practice simulator & feedback',
      },
      {
        name: 'Schedule Plan',
        href: '/interview-prep/schedule',
        icon: Calendar,
        description: 'Daily practice schedule & roadmap',
      },
    ],
  },
  {
    name: 'Favorite',
    href: '#favorites',
    icon: Star,
    isAction: true,
    description: 'Saved questions, answers, comments & packs',
    submenus: [
      {
        name: 'Favorited Questions',
        icon: Star,
        description: 'Starred interview questions',
        isAction: true,
        actionTab: 'questions',
      },
      {
        name: 'Saved Comments',
        icon: MessageSquare,
        description: 'Liked & personal discussion comments',
        isAction: true,
        actionTab: 'comments',
      },
      {
        name: 'Saved Answers',
        icon: Bookmark,
        description: 'Bookmarked reference & model answers',
        isAction: true,
        actionTab: 'answers',
      },
      {
        name: 'Saved Collections',
        icon: Layers,
        description: 'Unlocked & saved question sets',
        isAction: true,
        actionTab: 'collections',
      },
    ],
  },
  {
    name: 'Setting',
    href: '/settings',
    icon: Settings2,
    description: 'Profile, master resume, cover letter & AI memory',
    submenus: [
      {
        name: 'Profile',
        href: '/settings/profile',
        icon: UserIcon,
        description: 'Personal details and contact info for autofill',
      },
      {
        name: 'Resume Profile',
        href: '/settings/resumes',
        icon: FileText,
        description: 'Master resume, score & work experience',
      },
      {
        name: 'Cover Letter Profile',
        href: '/settings/cover-letter-profile',
        icon: Mail,
        description: 'Master cover letter and career motivation',
      },
      {
        name: 'AI Memory',
        href: '/settings/ai-memory',
        icon: MessageSquareCode,
        description: 'Reusable answers & autofill field mapping rules',
      },
      {
        name: 'Notifications',
        href: '/settings/notifications',
        icon: Bell,
        description: 'Manage email and system notifications',
      },
    ],
  },
];

const adminNavigation: SidebarNavigationItem[] = [
  {
    name: 'Incentive Admin',
    href: '/admin/incentives',
    icon: ShieldCheck,
    description: 'Manage XP, quests and rewards',
  },
  {
    name: 'Celebration Admin',
    href: '/admin/celebrations',
    icon: MessagesSquare,
    description: 'Tune celebration styles and animations',
  },
];

function NavItemFlyout({
  item,
  isCollapsed,
  isActive,
  onOpenFavoritesTab,
}: {
  item: SidebarNavigationItem;
  isCollapsed: boolean;
  isActive: boolean;
  onOpenFavoritesTab: (tab?: 'questions' | 'comments' | 'answers' | 'collections') => void;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const enterTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const leaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleMouseEnter = () => {
    if (leaveTimeoutRef.current) {
      clearTimeout(leaveTimeoutRef.current);
      leaveTimeoutRef.current = null;
    }
    enterTimeoutRef.current = setTimeout(() => {
      setIsOpen(true);
    }, 120);
  };

  const handleMouseLeave = () => {
    if (enterTimeoutRef.current) {
      clearTimeout(enterTimeoutRef.current);
      enterTimeoutRef.current = null;
    }
    leaveTimeoutRef.current = setTimeout(() => {
      setIsOpen(false);
    }, 180);
  };

  const handleItemClick = (e: React.MouseEvent) => {
    setIsOpen(false);
    if (item.isAction) {
      e.preventDefault();
      onOpenFavoritesTab();
    }
  };

  const handleSubmenuClick = (sub: SubmenuItem) => {
    setIsOpen(false);
    if (sub.isAction) {
      onOpenFavoritesTab(sub.actionTab);
    } else if (sub.href) {
      router.push(sub.href);
    }
  };

  const navItemContent = (
    <div
      className={cn(
        'app-no-drag group flex items-center gap-3 transition-all cursor-pointer select-none',
        isCollapsed ?
          'justify-center p-2.5 rounded-full'
        : 'px-4 py-3.5 rounded-full',
        isActive ?
          'text-primary-foreground bg-primary-gradient shadow-xs'
        : 'text-ink-secondary hover:bg-background-secondary hover:text-ink-primary',
      )}
    >
      <motion.div layout className='shrink-0'>
        <item.icon className={cn('size-5')} />
      </motion.div>
      <AnimatePresence mode='popLayout'>
        {!isCollapsed && (
          <motion.p
            initial={{ opacity: 0, x: -10, width: 0, display: 'none' }}
            animate={{
              opacity: 1,
              x: 0,
              width: 'auto',
              display: 'block',
              transition: { delay: 0.05, duration: 0.2 },
            }}
            exit={{ opacity: 0, x: -10, width: 0, transition: { duration: 0.1 } }}
            className={cn(
              'whitespace-nowrap overflow-hidden flex-1',
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
    <PopoverPrimitive.Root open={isOpen} onOpenChange={setIsOpen}>
      <div
        className='relative'
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        <PopoverPrimitive.Anchor asChild>
          {item.isAction ?
            <button
              type='button'
              onClick={handleItemClick}
              className='w-full text-left font-normal focus:outline-hidden'
            >
              {navItemContent}
            </button>
          : <Link href={item.href} onClick={handleItemClick}>
              {navItemContent}
            </Link>
          }
        </PopoverPrimitive.Anchor>

        <PopoverPrimitive.Portal>
          <PopoverPrimitive.Content
            side='right'
            align='start'
            sideOffset={14}
            collisionPadding={16}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
            className='z-50 w-72 rounded-2xl border border-primary/30 bg-panel/95 p-3 text-ink-primary shadow-2xl backdrop-blur-2xl outline-hidden animate-in fade-in-0 zoom-in-95 data-[side=right]:slide-in-from-left-2 data-[side=left]:slide-in-from-right-2 duration-150'
          >
            {/* Flyout Header */}
            <div className='flex items-center gap-2.5 pb-2.5 mb-2 border-b border-primary/15'>
              <div className='flex size-8 shrink-0 items-center justify-center rounded-xl bg-primary-gradient text-white shadow-xs'>
                <item.icon className='size-4' />
              </div>
              <div className='min-w-0 flex-1'>
                <h4 className='text-xs font-bold leading-tight text-ink-primary truncate'>
                  {item.name}
                </h4>
                {item.description && (
                  <p className='text-[10px] text-ink-secondary line-clamp-1 mt-0.5'>
                    {item.description}
                  </p>
                )}
              </div>
            </div>

            {/* Submenu List */}
            {item.submenus && item.submenus.length > 0 && (
              <div className='flex flex-col gap-1'>
                {item.submenus.map((sub) => {
                  const isSubActive =
                    !sub.isAction &&
                    Boolean(
                      sub.exact ?
                        pathname === sub.href
                      : sub.href && (pathname === sub.href || pathname?.startsWith(sub.href)),
                    );

                  const SubIcon = sub.icon;

                  return (
                    <button
                      key={sub.name}
                      type='button'
                      onClick={() => handleSubmenuClick(sub)}
                      className={cn(
                        'group/sub flex items-center gap-2.5 p-2 rounded-xl text-left transition-all cursor-pointer',
                        isSubActive ?
                          'bg-primary/15 text-primary font-bold'
                        : 'hover:bg-background-secondary/80 text-ink-secondary hover:text-ink-primary',
                      )}
                    >
                      <div
                        className={cn(
                          'flex size-7 shrink-0 items-center justify-center rounded-lg transition-colors',
                          isSubActive ?
                            'bg-primary text-white'
                          : 'bg-background-secondary group-hover/sub:bg-primary/10 group-hover/sub:text-primary text-ink-secondary',
                        )}
                      >
                        <SubIcon className='size-3.5' />
                      </div>
                      <div className='min-w-0 flex-1'>
                        <div className='flex items-center justify-between gap-1'>
                          <span
                            className={cn(
                              'text-xs font-bold leading-none truncate',
                              isSubActive ? 'text-primary' : 'text-ink-primary',
                            )}
                          >
                            {sub.name}
                          </span>
                          <ChevronRight className='size-3 opacity-0 -translate-x-1 group-hover/sub:opacity-100 group-hover/sub:translate-x-0 transition-all text-primary shrink-0' />
                        </div>
                        <p className='text-[10px] text-ink-secondary line-clamp-1 mt-0.5'>
                          {sub.description}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </PopoverPrimitive.Content>
        </PopoverPrimitive.Portal>
      </div>
    </PopoverPrimitive.Root>
  );
}

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();
  const { user, profile } = useConsole();
  const isCollapsed = useLayoutStore((state) => state.isSidebarCollapsed);
  const { toggleSidebar, openDrawer } = useLayoutStore(
    (state) => state.actions,
  );

  const handleOpenFavorites = (tab: 'questions' | 'comments' | 'answers' | 'collections' = 'questions') => {
    openDrawer({
      width: 440,
      content: <FavoritesDrawer initialTab={tab} />,
    });
  };

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
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

  const visibleNavigation =
    user?.role === 'admin' ?
      [...navigation, ...adminNavigation]
    : navigation;

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
                (item.href === '/interview-prep' &&
                  pathname?.startsWith('/interview-prep')) ||
                (item.href === '/ai-studio' &&
                  pathname?.startsWith('/ai-studio')) ||
                (item.href === '/applications' &&
                  (pathname?.startsWith('/applications') || pathname?.startsWith('/job-application'))) ||
                (item.href !== '/' &&
                  item.href !== '/settings' &&
                  item.href !== '/interview-prep' &&
                  item.href !== '/ai-studio' &&
                  item.href !== '/applications' &&
                  !item.href.startsWith('#') &&
                  Boolean(pathname?.startsWith(item.href))));

            return (
              <NavItemFlyout
                key={item.name}
                item={item}
                isCollapsed={isCollapsed}
                isActive={isActive}
                onOpenFavoritesTab={handleOpenFavorites}
              />
            );
          })}
        </nav>
      </div>

      {/* Footer Nav */}
      <div className='shrink-0 pt-4 border-t border-primary/40'>
        <AnimatePresence mode='popLayout'>
          {!isCollapsed ?
            <motion.div className='app-no-drag flex flex-col gap-4 border-primary/10 overflow-hidden'>
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
