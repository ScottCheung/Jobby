/** @format */

import React from 'react';
import {
  BookOpen,
  Flame,
  Star,
  Coins,
  Calendar,
  CheckCircle2,
  LayoutDashboard,
  Library,
  PlayCircle,
  Mic,
  Target,
  Zap,
  Info,
} from 'lucide-react';

export default function PlaybookGuidePage() {
  return (
    <div className='max-w-5xl mx-auto py-12 px-6 flex flex-col gap-16'>
      {/* Hero Header */}
      <div className='flex flex-col items-center text-center gap-6'>
        <div className='w-20 h-20 bg-primary/10 rounded-[2rem] flex items-center justify-center text-primary mb-2 ring-8 ring-primary/5'>
          <BookOpen className='w-10 h-10' />
        </div>
        <h1 className='title-page text-ink-primary'>
          The Ultimate Guide to Your Interview Playbook
        </h1>
        <p className='title-card text-ink-secondary max-w-3xl'>
          Welcome to your personal interview training system. This guide will
          walk you step-by-step through every feature, from organizing your
          questions to practicing like a pro and earning rewards.
        </p>
      </div>

      {/* 1. Dashboard Overview */}
      <section className='flex flex-col gap-6 relative'>
        <div className='absolute -left-10 top-0 bottom-0 w-1 bg-zinc-200 dark:bg-zinc-800 rounded-full hidden md:block' />

        <div className='flex items-center gap-4'>
          <div className='w-12 h-12 bg-blue-500/10 rounded-2xl flex items-center justify-center text-blue-600 dark:text-blue-500 shrink-0 md:absolute md:-left-[4.2rem] z-10'>
            <LayoutDashboard className='w-6 h-6' />
          </div>
          <h2 className='title-page text-ink-primary'>
            1. Dashboard (The Command Center)
          </h2>
        </div>

        <div className='text-ink-secondary leading-relaxed space-y-6'>
          <p>
            The Dashboard is your daily starting point. It gives you a birds-eye
            view of your progress, consistency, and what you need to achieve
            today.
          </p>
          <div className='grid grid-cols-1 md:grid-cols-2 gap-6'>
            <div className='space-y-2 panel-xl'>
              <h4 className='font-bold text-ink-primary flex items-center gap-2'>
                <Target className='w-4 h-4 text-primary' /> Today's Mission
              </h4>
              <p className='body-md'>
                If you have an active Practice Roadmap (plan), your daily
                scheduled questions will appear here. It tells you exactly how
                many questions to do and estimates the time required. Clicking
                "START MISSION" drops you directly into{' '}
                <strong>Practice Mode</strong> focused only on today's tasks.
              </p>
            </div>
            <div className='space-y-2 panel-xl'>
              <h4 className='font-bold text-ink-primary flex items-center gap-2'>
                <Calendar className='w-4 h-4 text-green-500' /> Activity Heatmap
              </h4>
              <p className='body-md'>
                Just like GitHub, this tracks your practice consistency over the
                last 20 weeks. Every day you submit a practice attempt, a square
                lights up. The more questions you practice in a single day, the
                darker green the square becomes.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 2. Question Library */}
      <section className='flex flex-col gap-6 relative'>
        <div className='absolute -left-10 top-0 bottom-0 w-1 bg-zinc-200 dark:bg-zinc-800 rounded-full hidden md:block' />

        <div className='flex items-center gap-4'>
          <div className='w-12 h-12 bg-indigo-500/10 rounded-2xl flex items-center justify-center text-indigo-600 dark:text-indigo-500 shrink-0 md:absolute md:-left-[4.2rem] z-10'>
            <Library className='w-6 h-6' />
          </div>
          <h2 className='title-page text-ink-primary'>
            2. Question Library (Your Brain)
          </h2>
        </div>

        <div className='text-ink-secondary leading-relaxed space-y-6'>
          <p>
            This is where you store and organize every interview question you
            might encounter. You can't practice effectively without a solid
            foundation of questions!
          </p>
          <ul className='space-y-4 list-none p-0'>
            <li className='flex gap-3'>
              <div className='w-6 h-6 rounded-full bg-indigo-500/10 text-indigo-600 flex items-center justify-center shrink-0 mt-0.5'>
                <span className='label-sm'>1</span>
              </div>
              <div>
                <strong className='text-ink-primary'>Adding Questions:</strong>{' '}
                You can add questions manually or use bulk import. Write down
                the core question and define the objective (what the interviewer
                actually wants to hear).
              </div>
            </li>
            <li className='flex gap-3'>
              <div className='w-6 h-6 rounded-full bg-indigo-500/10 text-indigo-600 flex items-center justify-center shrink-0 mt-0.5'>
                <span className='label-sm'>2</span>
              </div>
              <div>
                <strong className='text-ink-primary'>
                  Smart Auto-Tagging:
                </strong>{' '}
                When you create a question, the system automatically analyzes
                keywords in your title and objective. If it sees words like{' '}
                <em>React, API, Behavioral, or Leadership</em>, it automatically
                assigns beautiful colored tags so you don't have to manually
                categorize everything.
              </div>
            </li>
            <li className='flex gap-3'>
              <div className='w-6 h-6 rounded-full bg-indigo-500/10 text-indigo-600 flex items-center justify-center shrink-0 mt-0.5'>
                <span className='label-sm'>3</span>
              </div>
              <div>
                <strong className='text-ink-primary'>
                  Standard Answers & Frameworks:
                </strong>{' '}
                You can draft your "perfect answer" here and assign answering
                frameworks (like STAR: Situation, Task, Action, Result) to give
                your thoughts structure.
              </div>
            </li>
          </ul>
        </div>
      </section>

      {/* 3. Practice Mode */}
      <section className='flex flex-col gap-6 relative'>
        <div className='absolute -left-10 top-0 bottom-0 w-1 bg-zinc-200 dark:bg-zinc-800 rounded-full hidden md:block' />

        <div className='flex items-center gap-4'>
          <div className='w-12 h-12 bg-red-500/10 rounded-2xl flex items-center justify-center text-red-600 dark:text-red-500 shrink-0 md:absolute md:-left-[4.2rem] z-10'>
            <PlayCircle className='w-6 h-6' />
          </div>
          <h2 className='title-page text-ink-primary'>
            3. Practice Mode (The Gym)
          </h2>
        </div>

        <div className='text-ink-secondary leading-relaxed space-y-6'>
          <p>
            The Practice Mode is where the magic happens. This is the only place
            where you earn XP, Coins, and build your Streak. It simulates a real
            interview environment.
          </p>

          <div className='grid grid-cols-1 md:grid-cols-2 gap-6'>
            <div className='panel-xl'>
              <h3 className='title-card mb-3 flex items-center gap-2'>
                <Zap className='w-5 h-5 text-red-500' /> Two Modes
              </h3>
              <ul className='body-md space-y-3'>
                <li>
                  <strong>Free Mode:</strong> Pick specific tags, random
                  questions, or manually choose what to practice right now. No
                  pressure.
                </li>
                <li>
                  <strong>Plan Mode:</strong> Tied to your Practice Roadmap. It
                  strictly serves you the exact questions scheduled for today.
                  When you finish them, you get the "Mission Accomplished"
                  summary!
                </li>
              </ul>
            </div>

            <div className='panel-xl'>
              <h3 className='title-card mb-3 flex items-center gap-2'>
                <Mic className='w-5 h-5 text-zinc-500' /> The Workspace
              </h3>
              <p className='body-md mb-2'>
                On the right side of the practice screen, you have your
                workspace:
              </p>
              <ul className='body-md space-y-2 list-disc pl-5'>
                <li>
                  <strong>Record Audio:</strong> Speak your answer out loud. The
                  system will transcribe it via speech-to-text.
                </li>
                <li>
                  <strong>Take Notes:</strong> Jot down bullet points or script
                  your answer.
                </li>
                <li>
                  <strong>Submit:</strong> Click "Submit Attempt".{' '}
                  <strong className='text-primary'>This is the trigger!</strong>{' '}
                  Submitting saves your attempt to history and instantly awards
                  you XP and Coins via a pop-up toast.
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* 4. Practice Roadmap */}
      <section className='flex flex-col gap-6 relative'>
        <div className='absolute -left-10 top-0 bottom-0 w-1 bg-zinc-200 dark:bg-zinc-800 rounded-full hidden md:block' />

        <div className='flex items-center gap-4'>
          <div className='w-12 h-12 bg-purple-500/10 rounded-2xl flex items-center justify-center text-purple-600 dark:text-purple-500 shrink-0 md:absolute md:-left-[4.2rem] z-10'>
            <Calendar className='w-6 h-6' />
          </div>
          <h2 className='title-page text-ink-primary'>
            4. Practice Roadmap (The Schedule)
          </h2>
        </div>

        <div className='text-ink-secondary leading-relaxed space-y-6'>
          <p>
            The Roadmap takes the anxiety out of deciding "what should I study
            today?". You create a Plan (e.g., "30 Days to Google"), tell the
            system how many questions you want to do per day, and it
            automatically slices your Question Library into daily chunks.
          </p>

          <div className='panel-xl'>
            <h3 className='font-bold text-purple-700 dark:text-purple-400 mb-3 flex items-center gap-2'>
              <Info className='w-5 h-5' />
              Important: Checking off vs. Practicing
            </h3>
            <p className='body-md text-purple-900/80 dark:text-purple-200/80 mb-4'>
              In the Roadmap view, you might notice checkboxes next to tasks.
              Checking these boxes is purely for{' '}
              <strong>visual organization</strong>—it tells the system "I'm done
              studying this".
            </p>
            <p className='label text-purple-900/80 dark:text-purple-200/80'>
              However, clicking checkboxes in the Roadmap does NOT give you XP,
              does NOT increase your Streak, and does NOT light up your Activity
              Heatmap.
            </p>
            <p className='body-md text-purple-900/80 dark:text-purple-200/80 mt-2'>
              To earn rewards, you must click "Practice Today's Tasks" which
              takes you to <strong>Practice Mode</strong>. You only earn rewards
              by actually submitting recorded attempts or notes.
            </p>
          </div>
        </div>
      </section>

      {/* Gamification Rules Details */}
      <section className='flex flex-col gap-6 relative'>
        <div className='flex items-center gap-4'>
          <div className='w-12 h-12 bg-amber-500/10 rounded-2xl flex items-center justify-center text-amber-600 dark:text-amber-500 shrink-0 md:absolute md:-left-[4.2rem] z-10'>
            <Star className='w-6 h-6' />
          </div>
          <h2 className='title-page text-ink-primary'>
            Gamification Exact Rules
          </h2>
        </div>

        <div className='grid grid-cols-1 sm:grid-cols-3 gap-6'>
          <div className='bg-panel border border-zinc-100 dark:border-zinc-800/60 rounded-3xl p-6 shadow-sm flex flex-col items-center text-center'>
            <div className='w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mb-4'>
              <Star className='w-6 h-6 text-primary' />
            </div>
            <h4 className='font-bold text-ink-primary mb-2'>XP (Experience)</h4>
            <p className='body-md text-ink-secondary'>
              +10 XP per submitted practice attempt. +500 XP bonus for
              maintaining a 7-day streak.
            </p>
          </div>

          <div className='bg-panel border border-zinc-100 dark:border-zinc-800/60 rounded-3xl p-6 shadow-sm flex flex-col items-center text-center'>
            <div className='w-12 h-12 bg-yellow-500/10 rounded-full flex items-center justify-center mb-4'>
              <Coins className='w-6 h-6 text-yellow-500' />
            </div>
            <h4 className='font-bold text-ink-primary mb-2'>Coins</h4>
            <p className='body-md text-ink-secondary'>
              +2 Coins per submitted practice attempt. Save these for future
              system unlocks!
            </p>
          </div>

          <div className='bg-panel border border-zinc-100 dark:border-zinc-800/60 rounded-3xl p-6 shadow-sm flex flex-col items-center text-center'>
            <div className='w-12 h-12 bg-amber-500/10 rounded-full flex items-center justify-center mb-4'>
              <Flame className='w-6 h-6 text-amber-500' />
            </div>
            <h4 className='font-bold text-ink-primary mb-2'>Streaks</h4>
            <p className='body-md text-ink-secondary'>
              Grows by 1 if you practice exactly the day after your last
              practice. Resets to 1 if you skip a day.
            </p>
          </div>
        </div>
      </section>

      {/* Footer Encouragement */}
      <div className='text-center py-8 mt-8 border-t border-zinc-100 dark:border-zinc-800/60'>
        <p className='title-card text-ink-secondary'>
          Ready to level up your career? Go to the Dashboard and click{' '}
          <strong className='text-primary'>Start Mission</strong>.
        </p>
      </div>
    </div>
  );
}
