/** @format */

'use client';

import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useConsole } from '@/components/ConsoleContext';
import {
  Sparkles,
  Briefcase,
  GraduationCap,
  FileText,
  UserCheck,
  Star,
  ChevronRight,
  ContactRound,
  Search,
  Check,
  Bot,
  BrainCircuit,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useLayoutStore } from '@/lib/store/layout-store';
import { AutoTooltip, Avatar, CardWithNorth, FavoritesDrawer, IPEmotion } from '@jobby/ui';

type QuickStartStep = {
  title: string;
  href: string;
  action: string;
  icon: React.ComponentType<{ className?: string }>;
  complete: boolean;
};

function ApplicationQuickStart() {
  const { hasLoadedInitialData, profile, jobHuntingProfile } = useConsole();

  if (!hasLoadedInitialData) return null;

  const hasPersonalDetails = Boolean(
    profile.first_name?.trim() &&
    profile.last_name?.trim() &&
    profile.phone_number?.trim(),
  );
  const hasSearchTarget = Boolean(jobHuntingProfile.search_terms?.length);
  const hasResume = Boolean(
    jobHuntingProfile.resume_path?.trim() ||
    String(jobHuntingProfile.extra_data?.default_resume_path ?? '').trim(),
  );

  const steps: QuickStartStep[] = [
    {
      title: 'Contact details',
      href: '/settings/profile',
      action: 'Set up',
      icon: ContactRound,
      complete: hasPersonalDetails,
    },
    {
      title: 'Target roles',
      href: '/settings/career-profiles',
      action: 'Add target',
      icon: Search,
      complete: hasSearchTarget,
    },
    {
      title: 'Master resume',
      href: '/settings/resumes',
      action: 'Upload PDF',
      icon: FileText,
      complete: hasResume,
    },
  ];

  if (steps.every((step) => step.complete)) return null;

  return (
    <div className='col-span-12'>
      <CardWithNorth
        title={
          <span className='flex items-center gap-1.5 text-xs font-bold text-primary'>
            <Sparkles className='size-3.5' />
            <span>2 Min Quick Start</span>
          </span>
        }
        size='sm'
        className='w-full'
        tabClassName='bg-panel'
        contentClassName='p-4! bg-panel'
      >
        <div className='grid gap-3 md:grid-cols-3'>
          {steps.map((step, index) => {
            const Icon = step.icon;
            return (
              <Link
                key={step.title}
                href={step.href}
                className={cn(
                  'group flex items-center justify-between rounded-2xl p-3.5 transition-all duration-200',
                  step.complete
                    ? 'bg-emerald-500/10 text-ink-secondary'
                    : 'bg-background-secondary/70 hover:bg-background-secondary',
                )}
              >
                <div className='flex items-center gap-3 min-w-0'>
                  <div
                    className={cn(
                      'flex size-7 items-center justify-center rounded-xl font-bold text-xs shrink-0',
                      step.complete
                        ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400'
                        : 'bg-primary/15 text-primary',
                    )}
                  >
                    {step.complete ? <Check className='size-3.5' /> : index + 1}
                  </div>
                  <div className='truncate'>
                    <span
                      className={cn(
                        'text-xs font-semibold block truncate',
                        step.complete ? 'line-through text-ink-secondary' : 'text-ink-primary group-hover:text-primary',
                      )}
                    >
                      {step.title}
                    </span>
                  </div>
                </div>

                <span className='text-[11px] font-bold text-primary flex items-center gap-0.5 shrink-0 ml-2 group-hover:underline'>
                  {step.complete ? 'Completed' : step.action}
                  <ChevronRight className='size-3 transition-transform group-hover:translate-x-0.5' />
                </span>
              </Link>
            );
          })}
        </div>
      </CardWithNorth>
    </div>
  );
}

function WelcomeHero() {
  const { user, profile } = useConsole();

  const greeting = (() => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  })();

  const displayName = (() => {
    if (!user) return 'Scott';
    if (user?.display_name && !user.display_name.includes('@')) {
      return user.display_name;
    }
    if (profile?.first_name) {
      return profile.first_name;
    }
    return user?.email?.split('@')[0] || 'Scott';
  })();

  return (
    <div className='col-span-12 relative overflow-hidden rounded-3xl bg-panel p-6 md:p-8 backdrop-blur-2xl'>
      {/* Background Decorative Glow */}
      <div className='pointer-events-none absolute -right-12 -top-12 size-72 rounded-full bg-primary/10 blur-3xl' />
      <div className='pointer-events-none absolute -bottom-12 left-1/4 size-56 rounded-full bg-teal-500/10 blur-3xl' />

      <div className='relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-5'>
        {/* Left Welcome Info with User Avatar */}
        <div className='flex items-center gap-4.5'>
          <Avatar
            src={user?.avatar_url || undefined}
            name={displayName}
            customSize='68px'
            rounded='rounded-2xl'
            className='shrink-0 text-base font-bold'
          />

          <div>
            <h1 className='text-xl md:text-2xl font-extrabold text-ink-primary tracking-tight'>
              {greeting}, <span className='bg-primary-gradient bg-clip-text text-transparent'>{displayName}</span>
            </h1>

            {/* Brand Slogan */}
            <p className='text-xs text-ink-secondary mt-1.5 font-medium'>
              Empowering every application · Your AI Career Copilot
            </p>
          </div>
        </div>

        {/* Quick Shortcut Action Buttons */}
        <div className='flex flex-wrap items-center gap-2 shrink-0'>
          <Link
            href='/ai-studio'
            className='flex items-center gap-1.5 rounded-2xl bg-primary-gradient px-4 py-2 text-xs font-bold text-white hover:opacity-90 transition-all'
          >
            <Sparkles className='size-3.5' />
            <span>Tailor CV & CL</span>
          </Link>
          <Link
            href='/interview-prep/practice'
            className='flex items-center gap-1.5 rounded-2xl bg-background-secondary/80 px-4 py-2 text-xs font-bold text-ink-primary hover:bg-background-secondary hover:text-primary transition-all'
          >
            <GraduationCap className='size-3.5 text-purple-500' />
            <span>Mock Simulator</span>
          </Link>
          <Link
            href='/applications'
            className='flex items-center gap-1.5 rounded-2xl bg-background-secondary/80 px-4 py-2 text-xs font-bold text-ink-primary hover:bg-background-secondary hover:text-primary transition-all'
          >
            <Briefcase className='size-3.5 text-blue-500' />
            <span>Applications</span>
          </Link>
        </div>
      </div>
    </div>
  );
}

type SubLink = {
  label: string;
  href?: string;
  onClick?: () => void;
};

type CardItem = {
  title: string;
  subtitle: string;
  href: string;
  emotionId: number;
  dropShadow: string;
  subLinks: SubLink[];
  isAction?: boolean;
};

function NavigationCards() {
  const router = useRouter();
  const openDrawer = useLayoutStore((state) => state.actions.openDrawer);

  const handleOpenFavoritesTab = (tab: 'questions' | 'answers' | 'collections') => {
    openDrawer({
      width: 440,
      content: <FavoritesDrawer initialTab={tab} />,
    });
  };

  const cards: CardItem[] = [
    {
      title: 'AI Studio',
      subtitle: 'Tailor resumes & cover letters for specific job postings with instant AI scoring.',
      href: '/ai-studio',
      emotionId: 2, 
      dropShadow: 'drop-shadow(0 14px 24px rgba(16, 185, 129, 0.45))',
      subLinks: [
        { label: 'Tailor CV/CL', href: '/ai-studio' },
        { label: 'Job Recommendations', href: '/ai-studio/recommendations' },
        { label: 'Networking', href: '/ai-studio/prospects' },
      ],
    },
    {
      title: 'Job Applications',
      subtitle: 'Track application pipelines, interview stages, and conversion analytics in real time.',
      href: '/applications',
      emotionId: 13, // Analytics 📊
      dropShadow: 'drop-shadow(0 14px 24px rgba(59, 130, 246, 0.45))',
      subLinks: [
        { label: 'Dashboard', href: '/applications' },
        { label: 'History', href: '/applications/history' },
        // { label: 'Recommendations', href: '/applications/recommendations' },
      ],
    },
    {
      title: 'Interview Copilot',
      subtitle: 'Practice interactive AI mock interviews with curated question banks and STAR feedback.',
      href: '/interview-prep',
      emotionId: 12, // Goal & Flag 🚩
      dropShadow: 'drop-shadow(0 14px 24px rgba(168, 85, 247, 0.45))',
      subLinks: [
        { label: 'Practice', href: '/interview-prep/practice' },
        { label: 'Library', href: '/interview-prep/Library' },
        { label: 'Explore Questions', href: '/interview-prep/explore' },
        { label: 'Question Sets', href: '/interview-prep/collections' },
      ],
    },
    {
      title: 'Resume Profile',
      subtitle: 'Manage master resume PDFs, structured career histories, and ATS evaluations.',
      href: '/settings/resumes',
      emotionId: 7, // Master Resume 📄
      dropShadow: 'drop-shadow(0 14px 24px rgba(245, 158, 11, 0.45))',
      subLinks: [
        { label: 'Master Resume', href: '/settings/resumes' },
        { label: 'Career Profiles', href: '/settings/career-profiles' },
        { label: 'Personal Info', href: '/settings/profile' },
      ],
    },
    {
      title: 'AI Networking',
      subtitle: 'Discover key recruiters and hiring managers with automated outreach message templates.',
      href: '/ai-studio/prospects',
      emotionId: 9, // Call & Networking 📞
      dropShadow: 'drop-shadow(0 14px 24px rgba(6, 182, 212, 0.45))',
      subLinks: [
        { label: 'Recruiter Leads', href: '/ai-studio/prospects' },
        { label: 'AI Memory', href: '/settings/ai-memory' },
        { label: 'Cover Letter Prefs', href: '/settings/cover-letter-profile' },
      ],
    },
    {
      title: 'Favorites & Bookmarks',
      subtitle: 'Saved high-frequency interview questions, reference answers, and custom collections.',
      href: '#favorites',
      isAction: true,
      emotionId: 3, // Favorites Heart ❤️
      dropShadow: 'drop-shadow(0 14px 24px rgba(244, 63, 94, 0.45))',
      subLinks: [
        { label: 'Saved Questions', onClick: () => handleOpenFavoritesTab('questions') },
        { label: 'Model Answers', onClick: () => handleOpenFavoritesTab('answers') },
        { label: 'Collections', onClick: () => handleOpenFavoritesTab('collections') },
      ],
    },
  ];

  return (
    <div className='col-span-12 grid gap-8 md:grid-cols-2 lg:grid-cols-3'>
      {cards.map((card) => {

        const handleCardClick = () => {
          if (card.isAction) {
            handleOpenFavoritesTab('questions');
          } else {
            router.push(card.href);
          }
        };

        return (
          <div
            key={card.title}
            onClick={handleCardClick}
            className='group relative block h-full cursor-pointer '
          >
            <CardWithNorth
              title={
                card.title
              }
              size='sm'
              className='w-full h-full'
              // tabClassName='bg-panel'
              // contentClassName='relative overflow-visible p-5 flex flex-col justify-start h-full bg-panel'
            >
              {/* Middle Section: Concise Prompt + Large Break-out IP Bear Mascot */}
              <div className='relative z-10 flex items-start justify-between gap-3'>
                <div className='flex-1 min-w-0 pr-1 pt-1'>
                  <AutoTooltip
                    className='line-clamp-2'
                    content={card.subtitle}
                  >
                    <p className='text-xs text-ink-secondary font-medium leading-relaxed group-hover:text-ink-primary transition-colors '>
                      {card.subtitle}
                    </p>
                  </AutoTooltip>
                </div>

                {/* Brand IP Bear Mascot: Bigger size, seamless background, theme drop-shadow */}
                <div
                  className='shrink-0 -mr-2 -mt-20 transition-transform duration-300 group-hover:scale-115  group-hover:-translate-y-1'
                  style={{ filter: card.dropShadow }}
                >
                  <IPEmotion emotionId={card.emotionId} className='size-40 pointer-events-none' />
                </div>
              </div>

              {/* Bottom Secondary Route Menu Buttons */}
              <div className='relative z-10  flex items-center gap-2 flex-wrap'>
                {card.subLinks.map((sub) => {
                  if (sub.onClick) {
                    return (
                      <button
                        key={sub.label}
                        type='button'
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          sub.onClick?.();
                        }}
                        className='inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold bg-background-secondary/70 hover:bg-background-secondary text-ink-secondary hover:text-ink-primary transition-all cursor-pointer'
                      >
                        <span>{sub.label}</span>
                        <ChevronRight className='size-3 opacity-60' />
                      </button>
                    );
                  }

                  return (
                    <button
                      key={sub.label}
                      type='button'
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        if (sub.href) router.push(sub.href);
                      }}
                      className='inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold bg-background-secondary/70 hover:bg-background-secondary text-ink-secondary hover:text-ink-primary transition-all cursor-pointer'
                    >
                      <span>{sub.label}</span>
                      <ChevronRight className='size-3 opacity-60' />
                    </button>
                  );
                })}
              </div>
            </CardWithNorth>
          </div>
        );
      })}
    </div>
  );
}

function WorkflowShortcuts() {
  const router = useRouter();

  return (
    <div className='col-span-12 grid gap-8 lg:grid-cols-2'>
      <div
        onClick={() => router.push('/settings/ai-memory')}
        className='group block h-full cursor-pointer transition-transform duration-200 hover:-translate-y-1'
      >
        <CardWithNorth
          title={'AI Memory & Custom Rules'}
          size='sm'
          className='w-full h-full'
          tabClassName='bg-panel'
          contentClassName='relative overflow-visible p-5 bg-panel'
        >
          <div className='relative z-10 flex items-center justify-between gap-3'>
            <p className='text-xs text-ink-secondary font-medium leading-relaxed flex-1'>
              Set custom guidelines and answers once. Autofill and tailoring will strictly match your voice.
            </p>
            <div
              className='shrink-0 -mr-2 -mt-4 transition-transform duration-300 group-hover:scale-115 group-hover:-rotate-3'
              style={{ filter: 'drop-shadow(0 12px 20px rgba(16, 185, 129, 0.45))' }}
            >
              <IPEmotion emotionId={15} className='size-18 pointer-events-none' />
            </div>
          </div>
        </CardWithNorth>
      </div>

      <div
        onClick={() => router.push('/interview-prep/practice')}
        className='group block h-full cursor-pointer transition-transform duration-200 hover:-translate-y-1'
      >
        <CardWithNorth
          title={
           'Interview Copilot Simulator'
          }
          size='sm'
          className='w-full h-full'
          tabClassName='bg-panel'
          contentClassName='relative overflow-visible p-5 bg-panel'
        >
          <div className='relative z-10 flex items-center justify-between gap-3'>
            <p className='text-xs text-ink-secondary font-medium leading-relaxed flex-1'>
              Real-time speech simulation and scoring to ace behavioral and technical interviews.
            </p>
            <div
              className='shrink-0 -mr-2 -mt-4 transition-transform duration-300 group-hover:scale-115 group-hover:-rotate-3'
              style={{ filter: 'drop-shadow(0 12px 20px rgba(245, 158, 11, 0.45))' }}
            >
              <IPEmotion emotionId={5} className='size-18 pointer-events-none' />
            </div>
          </div>
        </CardWithNorth>
      </div>
    </div>
  );
}

export default function HomePage() {
  return (
    <div className='grid grid-cols-12 gap-8  w-full'>
      <WelcomeHero />
      <ApplicationQuickStart />
      <NavigationCards />
      <WorkflowShortcuts />
    </div>
  );
}

