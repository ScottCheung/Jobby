/** @format */

'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion } from 'framer-motion';
import { Coins, PartyPopper, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

const adminTabs = [
  {
    name: 'Incentives',
    href: '/admin/incentives',
    icon: Coins,
    description: 'Manage XP, quests, badges, and rewards.',
  },
  {
    name: 'Celebration Styles',
    href: '/admin/celebrations',
    icon: PartyPopper,
    description: 'Tune the global confetti and celebration styles.',
  },
  {
    name: 'Celebration Events',
    href: '/admin/celebration-events',
    icon: Sparkles,
    description: 'Map product events to celebration styles and messages.',
  },
];

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div className='mx-auto flex w-full max-w-7xl flex-col gap-6 px-page py-6'>
      <div className='overflow-x-auto'>
        <div className='flex min-w-max items-center gap-2 rounded-[28px] border border-primary/60 bg-panel/70 p-2 backdrop-blur-xl'>
          {adminTabs.map((tab) => {
            const isActive = pathname === tab.href;
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={cn(
                  'relative flex items-center gap-2 rounded-full px-4 py-2.5 text-sm transition-colors',
                  isActive ?
                    'text-primary font-bold'
                  : 'text-ink-secondary hover:text-ink-primary',
                )}
              >
                <tab.icon className='h-4 w-4' />
                <span>{tab.name}</span>
                {isActive && (
                  <motion.div
                    layoutId='admin-active-tab'
                    className='absolute inset-0 -z-10 rounded-full bg-primary/15'
                    transition={{ type: 'spring', stiffness: 320, damping: 30 }}
                  />
                )}
              </Link>
            );
          })}
        </div>
      </div>

      <section className='rounded-[32px] border border-primary/60 bg-background/80 p-4 shadow-sm backdrop-blur-xl md:p-6'>
        {children}
      </section>
    </div>
  );
}
