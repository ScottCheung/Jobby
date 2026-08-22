/** @format */

'use client';

import { useEffect, useState } from 'react';
import {
  Bookmark,
  BriefcaseBusiness,
  Building2,
  Compass,
  Flame,
  Gem,
  MessageCircle,
  Sparkles,
  UserRound,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const trendNavigation = [
  { id: 'new', label: 'New for you', Icon: Sparkles },
  { id: 'today-picks', label: "Today's Picks", Icon: Sparkles },
  { id: 'comprehensive-trend', label: 'Comprehensive Trend', Icon: Sparkles },
  { id: 'season-trend', label: 'Season Trend', Icon: Sparkles },
  { id: 'month-trend', label: 'Month Trend', Icon: Sparkles },
  { id: 'week-trend', label: 'Week Trend', Icon: Sparkles },
];
const sectionIds = ['new', 'sets', ...trendNavigation.map((item) => item.id)];

const themes = [
  { label: 'Behaviour', Icon: MessageCircle },
  { label: 'About You', Icon: UserRound },
  { label: 'Project', Icon: BriefcaseBusiness },
  { label: 'Role-specific', Icon: Gem },
  { label: 'Company', Icon: Building2 },
];

export default function ExploreLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [activeSection, setActiveSection] = useState('new');

  useEffect(() => {
    const handleSectionChange = (event: Event) => {
      const sectionId = (event as CustomEvent<{ sectionId?: string }>).detail
        ?.sectionId;
      if (sectionId && sectionIds.includes(sectionId)) {
        setActiveSection(sectionId);
      }
    };

    window.addEventListener('explore:section-change', handleSectionChange);
    return () =>
      window.removeEventListener('explore:section-change', handleSectionChange);
  }, []);

  const navigateTo = (sectionId: string) => {
    setActiveSection(sectionId);
    window.dispatchEvent(
      new CustomEvent('explore:navigate', { detail: { sectionId } }),
    );
  };

  const selectTheme = (theme: string) => {
    setActiveSection('sets');
    window.dispatchEvent(
      new CustomEvent('explore:set-theme', { detail: { theme } }),
    );
  };

  return (
    <div className='flex h-full w-full gap-6 overflow-hidden'>
      <aside className='flex w-56 shrink-0 flex-col overflow-hidden panel-xl px-3! py-6!'>
        <nav
          aria-label='Explore sections'
          className='flex min-h-0 flex-1 flex-col gap-1'
        >
          <div className='mt-4'>
            <div className='flex items-center gap-3 px-3 py-2 text-sm font-semibold text-ink-primary'>
              <Compass className='h-4 w-4 text-primary' />
              Question discovery
            </div>
            <div className='mt-1 grid gap-0.5'>
              {trendNavigation.map(({ id, label, Icon }) => (
                <button
                  key={id}
                  type='button'
                  onClick={() => navigateTo(id)}
                  className={cn(
                    'flex items-center gap-2 rounded-lg py-1.5 pl-9 pr-3 text-left text-[11px] font-semibold transition-colors',
                    activeSection === id ?
                      'bg-primary/10 text-primary'
                    : 'text-ink-secondary hover:bg-background-secondary hover:text-ink-primary',
                  )}
                >
                  <Icon className='h-3.5 w-3.5 shrink-0' />
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className='mt-4 border-t border-primary/50 pt-4'>
            <button
              type='button'
              onClick={() => navigateTo('sets')}
              className={cn(
                'flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-semibold transition-colors',
                activeSection === 'sets' ?
                  'bg-primary-gradient text-white shadow-md'
                : 'text-ink-secondary hover:bg-background-secondary hover:text-ink-primary',
              )}
            >
              <Bookmark className='h-4 w-4 shrink-0' />
              Question Sets
            </button>
            <div className='mt-1 grid gap-0.5'>
              {themes.map(({ label, Icon }) => (
                <button
                  key={label}
                  type='button'
                  onClick={() => selectTheme(label)}
                  className='flex items-center gap-2 rounded-lg py-1.5 pl-9 pr-3 text-left text-[11px] font-semibold text-ink-secondary transition-colors hover:bg-background-secondary hover:text-ink-primary'
                >
                  <Icon className='h-3.5 w-3.5 shrink-0' />
                  {label}
                </button>
              ))}
            </div>
          </div>
        </nav>
      </aside>
      <div className='min-w-0 flex-1'>{children}</div>
    </div>
  );
}
