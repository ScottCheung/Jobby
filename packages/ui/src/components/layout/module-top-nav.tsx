/** @format */

'use client';

import type { LucideIcon } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { Tooltip } from '../UI/tooltip';
import { useRef, useState, useCallback, useEffect } from 'react';

export type ModuleNavigationItem = {
  name: string;
  href: string;
  icon: LucideIcon;
  description: string;
  exact?: boolean;
};

type ModuleTopNavProps = {
  tabs: ModuleNavigationItem[];
  activeLayoutId: string;
  rightContent?: React.ReactNode;
  children: React.ReactNode;
  contentClassName?: string;
  contentFade?: boolean;
};

const contentFadeStyle = {
  maskImage:
    'linear-gradient(to bottom, transparent, black 24px, black calc(100% - 24px), transparent)',
  WebkitMaskImage:
    'linear-gradient(to bottom, transparent, black 24px, black calc(100% - 24px), transparent)',
};

export function ModuleTopNav({
  tabs,
  activeLayoutId,
  rightContent,
  children,
  contentClassName,
  contentFade = false,
}: ModuleTopNavProps) {
  const pathname = usePathname();
  const [navVisible, setNavVisible] = useState(true);
  const lastScrollY = useRef(0);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const handleScroll = useCallback(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const currentY = el.scrollTop;
    const diff = currentY - lastScrollY.current;

    if (diff > 4) {
      // 向下滑超过阈值 → 隐藏
      setNavVisible(false);
    } else if (diff < -4) {
      // 向上滑超过阈值 → 显示
      setNavVisible(true);
    }

    lastScrollY.current = currentY;
  }, []);

  useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    el.addEventListener('scroll', handleScroll, { passive: true });
    return () => el.removeEventListener('scroll', handleScroll);
  }, [handleScroll]);

  return (
    <div className='flex h-[calc(100vh-18px)] min-h-[500px] w-full max-w-full min-w-0 flex-col overflow-x-hidden px-page pt-3 pb-0!'>
      <AnimatePresence initial={false}>
        {navVisible && (
          <motion.header
            key='module-nav-header'
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.22, ease: 'easeInOut' }}
            className='z-20 flex w-full min-w-0 max-w-full shrink-0 items-center justify-between'
          >
            <nav
              className='flex items-center px-2 pb-px min-w-0'
              aria-label='Module navigation'
            >
              {tabs.map((tab) => {
                const isActive =
                  tab.exact || tab.href === tabs[0]?.href ?
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
                        'group relative top-px flex items-center gap-2 rounded-full px-4 py-2 transition-colors hover:bg-panel shrink-0',
                        isActive ?
                          'font-bold text-primary'
                        : 'font-medium text-ink-secondary hover:text-ink-primary',
                      )}
                    >
                      <tab.icon className='h-[18px] w-[18px]' />
                      <span className='text-[13px] tracking-wide'>
                        {tab.name}
                      </span>
                      {isActive && (
                        <motion.span
                          layoutId={activeLayoutId}
                          className='absolute inset-0 h-full w-full rounded-full bg-primary/30 group-hover:bg-primary/50'
                        />
                      )}
                    </Link>
                  </Tooltip>
                );
              })}
            </nav>

            {rightContent && (
              <div className='ml-auto flex items-center gap-2.5 pr-4 shrink-0'>
                {rightContent}
              </div>
            )}
          </motion.header>
        )}
      </AnimatePresence>

      <div
        ref={scrollContainerRef}
        className={cn(
          'z-0 flex-1 w-full max-w-full min-w-0 overflow-y-auto overflow-x-hidden pt-3',
          contentClassName,
        )}
        style={contentFade ? contentFadeStyle : undefined}
      >
        <div className='h-full w-full max-w-full min-w-0'>{children}</div>
      </div>
    </div>
  );
}
