/** @format */

'use client';

import React, { useState } from 'react';
import { cn } from '@/lib/utils';
import {
  Sparkles,
  ShieldCheck,
  CheckCircle2,
  Bookmark,
  ChevronRight,
  Sliders,
  Layers,
  ArrowDown,
  Info,
  Building2,
  MapPin,
  Clock,
  Briefcase,
  Zap,
  Minimize2,
  FileText,
  User,
  GraduationCap,
  Award,
} from 'lucide-react';

interface JobCardItem {
  id: string;
  title: string;
  company: string;
  location: string;
  salary: string;
  tags: string[];
  status: 'applied' | 'interviewing' | 'reviewing' | 'saved';
  time: string;
}

const MOCK_ITEMS: JobCardItem[] = [
  {
    id: '1',
    title: 'Senior Full Stack Engineer (AI Products)',
    company: 'TechCorp AI',
    location: 'Sydney, NSW (Hybrid)',
    salary: '$160,000 - $190,000',
    tags: ['React', 'Next.js', 'Node.js', 'PostgreSQL'],
    status: 'interviewing',
    time: '2 hours ago',
  },
  {
    id: '2',
    title: 'Lead Frontend Developer',
    company: 'Nexus Software',
    location: 'Melbourne, VIC (Remote)',
    salary: '$150,000 - $175,000',
    tags: ['TypeScript', 'Tailwind CSS', 'GraphQL'],
    status: 'applied',
    time: '5 hours ago',
  },
  {
    id: '3',
    title: 'Staff Software Architect',
    company: 'CloudScale Systems',
    location: 'Brisbane, QLD (Onsite)',
    salary: '$180,000 - $210,000',
    tags: ['Distributed Systems', 'Go', 'AWS'],
    status: 'reviewing',
    time: '1 day ago',
  },
  {
    id: '4',
    title: 'UI/UX Frontend Engineer',
    company: 'DesignFirst Studio',
    location: 'Sydney, NSW (Remote)',
    salary: '$135,000 - $155,000',
    tags: ['Framer Motion', 'Design Systems', 'React'],
    status: 'saved',
    time: '2 days ago',
  },
  {
    id: '5',
    title: 'Autonomous Agent Platform Engineer',
    company: 'Jobby Automation Inc.',
    location: 'Sydney, NSW (Hybrid)',
    salary: '$170,000 - $195,000',
    tags: ['Next.js', 'Python', 'FastAPI', 'Playwright'],
    status: 'interviewing',
    time: '3 days ago',
  },
];

export default function StickyCardTestPage() {
  const [fixCorners, setFixCorners] = useState(true);
  const [blurEffect, setBlurEffect] = useState(true);
  const [activeTab, setActiveTab] = useState<'shrink_page' | 'internal'>(
    'shrink_page',
  );

  return (
    <div className='max-w-5xl mx-auto space-y-8 pb-32'>
      {/* Page Header */}
      <div className='flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-primary/40 pb-6'>
        <div>
          <div className='flex items-center gap-2 text-primary text-xs font-bold uppercase tracking-wider mb-1'>
            <Sparkles className='w-4 h-4' /> Long Page Sticky Card Demo
          </div>
          <h1 className='title-page text-ink-primary'>
            整页滚动吸顶卡片（容器动态高度收缩 + 圆角无缝保留）
          </h1>
          <p className='body-md text-ink-secondary mt-1'>
            解决外部非固定高度、超长卡片在页面滑动时标题 Sticky
            吸顶，且容器随着向上滑动呈现高度收缩与圆角全流程保持的极致效果。
          </p>
        </div>

        {/* Interactive Controls Bar */}
        <div className='flex flex-wrap items-center gap-3 bg-panel p-2 rounded-2xl border border-primary/60 shadow-sm'>
          <button
            onClick={() => setFixCorners(!fixCorners)}
            className={cn(
              'label-sm px-3 py-1.5 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer',
              fixCorners ?
                'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
              : 'bg-red-500/15 text-red-600 dark:text-red-400 border border-red-500/30',
            )}
          >
            <ShieldCheck className='w-4 h-4' />
            {fixCorners ? '圆角保护: 开启 (ACTIVE)' : '圆角保护: 关闭 (BROKEN)'}
          </button>

          <button
            onClick={() => setBlurEffect(!blurEffect)}
            className={cn(
              'label-sm px-3 py-1.5 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer',
              blurEffect ?
                'bg-primary/15 text-primary border border-primary/30'
              : 'bg-background-secondary text-ink-secondary border border-primary/40',
            )}
          >
            <Sliders className='w-4 h-4' />
            {blurEffect ? '毛玻璃 (Blur): 开启' : '毛玻璃: 关闭'}
          </button>
        </div>
      </div>

      {/* Explanation Banner */}
      <div className='bg-primary/5 border border-primary/20 rounded-2xl p-5 flex items-start gap-4'>
        <Info className='w-6 h-6 text-primary shrink-0 mt-0.5' />
        <div className='space-y-1.5 body-sm text-ink-secondary'>
          <p className='font-semibold text-ink-primary text-sm'>
            🎯 为什么能呈现“卡片高度随着滑动变低、顶底圆角全程保留”的视觉效果？
          </p>
          <ul className='list-disc pl-5 space-y-1 text-xs'>
            <li>
              <strong>卡片外框</strong>：
              <code className='bg-background px-1.5 py-0.5 rounded text-primary font-mono'>
                rounded-3xl bg-panel overflow-hidden isolate relative
              </code>
              。
            </li>
            <li>
              <strong>Sticky Header 顶部保持圆角</strong>：标题栏使用{' '}
              <code className='bg-background px-1.5 py-0.5 rounded text-primary font-mono'>
                sticky top-0 z-10 rounded-t-3xl bg-panel/90 backdrop-blur-md
                border-b border-primary/40
              </code>
              。当整页滚动时，标题栏顶入屏幕最上方，其自身带有{' '}
              <code className='bg-background px-1.5 py-0.5 rounded text-primary font-mono'>
                rounded-t-3xl
              </code>
              ，因此顶部圆角永远不会消失。
            </li>
            <li>
              <strong>高度收缩视觉感 (Visual Shrink Effect)</strong>
              ：由于标题吸附在顶部{' '}
              <code className='bg-background px-1.5 py-0.5 rounded text-primary font-mono'>
                top-0
              </code>
              ，而卡片的底边（带底部圆角）随着整页向上滑动不断逼近顶部标题栏，视觉上就会产生
              <strong>“卡片容器高度正在随着滑动逐渐变低/收缩”</strong>
              的超流畅体验！
            </li>
          </ul>
        </div>
      </div>

      {/* Navigation Mode Switcher */}
      <div className='flex items-center gap-2 border-b border-primary/40 pb-2'>
        <button
          onClick={() => setActiveTab('shrink_page')}
          className={cn(
            'label-sm px-4 py-2 rounded-xl transition-all cursor-pointer flex items-center gap-2',
            activeTab === 'shrink_page' ?
              'bg-primary text-primary-foreground shadow-md'
            : 'text-ink-secondary hover:text-ink-primary hover:bg-background-secondary',
          )}
        >
          <Minimize2 className='w-4 h-4' />
          推荐模式：超长页面与多卡片吸顶收缩 (Page Scroll Collapsible Cards)
        </button>
        <button
          onClick={() => setActiveTab('internal')}
          className={cn(
            'label-sm px-4 py-2 rounded-xl transition-all cursor-pointer flex items-center gap-2',
            activeTab === 'internal' ?
              'bg-primary text-primary-foreground shadow-md'
            : 'text-ink-secondary hover:text-ink-primary hover:bg-background-secondary',
          )}
        >
          <Layers className='w-4 h-4' />
          对比模式：卡片内部独立滚动 (Card Internal Scroll)
        </button>
      </div>

      {/* MODE 1: LONG PAGE SCROLL CARDS WITH SHRINKING CONTAINER EFFECT */}
      {activeTab === 'shrink_page' && (
        <div className='space-y-12'>
          <div className='p-4 rounded-2xl bg-panel border border-primary/60 flex items-center justify-between text-sm text-ink-primary shadow-sm'>
            <div className='flex items-center gap-2'>
              <ArrowDown className='w-4 h-4 text-primary animate-bounce' />
              <span>
                <strong>滑动试一试：</strong>{' '}
                向下滑动页面，观察下方多个超长卡片标题吸顶后，卡片底部向上靠近、容器高度逐渐“收缩变低”的过程：
              </span>
            </div>
          </div>

          {/* CARD 1: Work Experience / Job Profile */}
          <section
            className={cn(
              'bg-panel group rounded-3xl relative transition-all shadow-lg',
            )}
          >
            {/* Sticky Title Bar */}
            <div
              className={cn(
                'sticky top-0 z-20 flex items-center justify-between gap-3 px-6 py-4 border-b border-primary/40 transition-all',
                blurEffect ?
                  'backdrop-blur-md bg-panel/90 dark:bg-panel/85'
                : 'bg-panel',
                fixCorners ? 'rounded-t-3xl' : 'rounded-none',
              )}
            >
              <div className='flex items-center gap-3'>
                <div className='h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center text-primary font-bold'>
                  <User className='w-5 h-5' />
                </div>
                <div>
                  <h2 className='title-card text-ink-primary flex items-center gap-2'>
                    1. 个人履历与工作经历 (Work Experience)
                  </h2>
                  <p className='text-meta text-ink-secondary'>
                    Sticky header pins at top-0 with rounded top corners while
                    outer page scrolls
                  </p>
                </div>
              </div>

              <span
                className={cn(
                  'text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider border',
                  fixCorners ?
                    'bg-emerald-500/10 text-emerald-600 border-emerald-500/20'
                  : 'bg-red-500/10 text-red-600 border-red-500/20',
                )}
              >
                {fixCorners ? 'Top Corners Preserved' : 'Corners Masked'}
              </span>
            </div>

            {/* Long Card Body Content */}
            <div className='p-8 space-y-6'>
              <div className='p-4 rounded-2xl bg-background-secondary/40 border border-primary/40 text-xs text-ink-secondary'>
                继续向下滑动，这个卡片底部向上靠近标题时，容器看起来就像在自动收缩变矮！
              </div>

              {MOCK_ITEMS.map((item, idx) => (
                <div
                  key={`card1-${item.id}`}
                  className='p-5 rounded-2xl border border-primary/40 bg-background-secondary/20 hover:bg-background-secondary/50 transition-all space-y-3'
                >
                  <div className='flex items-start justify-between'>
                    <div>
                      <h4 className='font-semibold text-ink-primary'>
                        Role #{idx + 1}: {item.title}
                      </h4>
                      <p className='text-xs text-ink-secondary mt-1 flex items-center gap-2'>
                        <Building2 className='w-3.5 h-3.5' /> {item.company} •{' '}
                        {item.location}
                      </p>
                    </div>
                    <span className='text-xs font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-full'>
                      {item.salary}
                    </span>
                  </div>
                  <p className='body-sm text-ink-secondary'>
                    Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed
                    do eiusmod tempor incididunt ut labore et dolore magna
                    aliqua. Ut enim ad minim veniam.
                  </p>
                </div>
              ))}
            </div>
          </section>

          {/* CARD 2: Education & Skills */}
          <section
            className={cn(
              'bg-panel group rounded-3xl relative transition-all shadow-lg',
            )}
          >
            {/* Sticky Title Bar */}
            <div
              className={cn(
                'sticky top-0 z-20 flex items-center justify-between gap-3 px-6 py-4 border-b border-primary/40 transition-all',
                blurEffect ?
                  'backdrop-blur-md bg-panel/90 dark:bg-panel/85'
                : 'bg-panel',
                fixCorners ? 'rounded-t-3xl' : 'rounded-none',
              )}
            >
              <div className='flex items-center gap-3'>
                <div className='h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center text-primary font-bold'>
                  <GraduationCap className='w-5 h-5' />
                </div>
                <div>
                  <h2 className='title-card text-ink-primary flex items-center gap-2'>
                    2. 教育背景与技能评估 (Education & Core Skills)
                  </h2>
                  <p className='text-meta text-ink-secondary'>
                    Second card sticky header smoothly replaces the previous one
                    during scroll
                  </p>
                </div>
              </div>

              <span className='text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider border bg-primary/10 text-primary border-primary/20'>
                Section Card #2
              </span>
            </div>

            {/* Long Card Body Content */}
            <div className='p-8 space-y-6'>
              {MOCK_ITEMS.concat(MOCK_ITEMS).map((item, idx) => (
                <div
                  key={`card2-${item.id}-${idx}`}
                  className='p-5 rounded-2xl border border-primary/40 bg-background-secondary/20 hover:bg-background-secondary/50 transition-all space-y-3'
                >
                  <div className='flex items-start justify-between'>
                    <div>
                      <h4 className='font-semibold text-ink-primary'>
                        Skill Module #{idx + 1}: {item.tags.join(' / ')}
                      </h4>
                      <p className='text-xs text-ink-secondary mt-1'>
                        Advanced Competency Level • Verified Assessment
                      </p>
                    </div>
                  </div>
                  <p className='body-sm text-ink-secondary'>
                    Detailing technical proficiencies, frameworks, and
                    architecture capabilities applied across software products.
                  </p>
                </div>
              ))}
            </div>
          </section>

          {/* CARD 3: Certifications & Projects */}
          <section
            className={cn(
              'bg-panel group rounded-3xl relative transition-all shadow-lg',
            )}
          >
            {/* Sticky Title Bar */}
            <div
              className={cn(
                'sticky top-0 z-20 flex items-center justify-between gap-3 px-6 py-4 border-b border-primary/40 transition-all',
                blurEffect ?
                  'backdrop-blur-md bg-panel/90 dark:bg-panel/85'
                : 'bg-panel',
                fixCorners ? 'rounded-t-3xl' : 'rounded-none',
              )}
            >
              <div className='flex items-center gap-3'>
                <div className='h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center text-primary font-bold'>
                  <Award className='w-5 h-5' />
                </div>
                <div>
                  <h2 className='title-card text-ink-primary flex items-center gap-2'>
                    3. 项目经验与荣誉认证 (Projects & Certifications)
                  </h2>
                  <p className='text-meta text-ink-secondary'>
                    Third section card sticky header maintaining rounded edges
                  </p>
                </div>
              </div>

              <span className='text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider border bg-emerald-500/10 text-emerald-600 border-emerald-500/20'>
                Section Card #3
              </span>
            </div>

            {/* Long Card Body Content */}
            <div className='p-8 space-y-6'>
              {MOCK_ITEMS.map((item, idx) => (
                <div
                  key={`card3-${item.id}-${idx}`}
                  className='p-5 rounded-2xl border border-primary/40 bg-background-secondary/20 hover:bg-background-secondary/50 transition-all space-y-3'
                >
                  <h4 className='font-semibold text-ink-primary'>
                    Project #{idx + 1}: {item.title}
                  </h4>
                  <p className='body-sm text-ink-secondary'>
                    Demonstrates autonomous application flows, clean UI design
                    systems, and fast client-side performance.
                  </p>
                </div>
              ))}
            </div>
          </section>
        </div>
      )}

      {/* MODE 2: INTERNAL SCROLL CONTAINER */}
      {activeTab === 'internal' && (
        <div className='grid grid-cols-1 lg:grid-cols-12 gap-8 items-start'>
          <div className='lg:col-span-8 space-y-4'>
            <div
              className={cn(
                'relative w-full h-[520px] bg-panel border border-primary/60 shadow-xl transition-all flex flex-col',
                'rounded-3xl overflow-hidden isolate',
              )}
            >
              <div
                className={cn(
                  'sticky top-0 z-20 px-6 py-4 border-b border-primary/40 transition-all flex items-center justify-between',
                  blurEffect ?
                    'backdrop-blur-md bg-panel/85 dark:bg-panel/80'
                  : 'bg-panel',
                  fixCorners ? 'rounded-t-3xl' : 'rounded-none',
                )}
              >
                <div className='flex items-center gap-3'>
                  <div className='h-10 w-10 rounded-2xl bg-primary/10 flex items-center justify-center text-primary font-bold shadow-inner'>
                    <Briefcase className='w-5 h-5' />
                  </div>
                  <div>
                    <h3 className='title-sub text-ink-primary flex items-center gap-2'>
                      Card Internal Scroll Mode
                    </h3>
                  </div>
                </div>
              </div>

              <div className='flex-1 overflow-y-auto custom-scrollbar-primary p-6 space-y-4'>
                {MOCK_ITEMS.map((item) => (
                  <div
                    key={item.id}
                    className='p-5 rounded-2xl border border-primary/50 bg-background-secondary/20 space-y-2'
                  >
                    <h4 className='font-semibold text-ink-primary'>
                      {item.title}
                    </h4>
                    <p className='body-sm text-ink-secondary'>
                      {item.company} • {item.salary}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
