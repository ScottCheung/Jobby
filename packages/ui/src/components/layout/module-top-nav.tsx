/** @format */

'use client';

import type { LucideIcon } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { Tooltip } from '@/components/UI/tooltip';

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

  return (
    <div className='flex h-[calc(100vh-18px)] min-h-[500px] flex-col px-page pt-3 pb-0!'>
      <header className='z-20 flex w-full shrink-0 items-center justify-between'>
        <nav className='flex items-center px-2 pb-px' aria-label='Module navigation'>
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
                    'group relative top-px flex items-center gap-2 rounded-full px-4 py-2 transition-colors hover:bg-panel',
                    isActive ?
                      'font-bold text-primary'
                    : 'font-medium text-ink-secondary hover:text-ink-primary',
                  )}
                >
                  <tab.icon className='h-[18px] w-[18px]' />
                  <span className='text-[13px] tracking-wide'>{tab.name}</span>
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
          <div className='ml-auto flex items-center gap-2.5 pr-4'>
            {rightContent}
          </div>
        )}
      </header>

      <div
        className={cn(
          'z-0 flex-1 overflow-y-auto pt-6',
          contentClassName,
        )}
        style={contentFade ? contentFadeStyle : undefined}
      >
        <div className='h-full'>{children}</div>
      </div>
    </div>
  );
}
