'use client';
import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { LayoutDashboard, Library, PlayCircle, Calendar } from 'lucide-react';

const tabs = [
  { name: 'Dashboard', href: '/interview-playbook', icon: LayoutDashboard },
  { name: 'Question Library', href: '/interview-playbook/questions', icon: Library },
  { name: 'Practice Mode', href: '/interview-playbook/practice', icon: PlayCircle },
  { name: 'Practice Plans', href: '/interview-playbook/plans', icon: Calendar },
];

export default function InterviewPlaybookLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div className="flex flex-col h-[calc(100vh-66px)] min-h-[500px]">
      <div className="flex flex-col gap-4 mb-6 shrink-0">
        <h1 className="text-2xl font-bold bg-primary-gradient bg-clip-text text-transparent">
          Interview Playbook
        </h1>
        <div className="flex items-center gap-2 border-b border-zinc-100 dark:border-zinc-800/60 pb-px">
          {tabs.map((tab) => {
            const isActive = pathname === tab.href;
            return (
              <Link
                key={tab.name}
                href={tab.href}
                className={cn(
                  'flex items-center gap-2 px-4 py-2 border-b-2 transition-colors',
                  isActive
                    ? 'border-primary text-primary font-medium'
                    : 'border-transparent text-ink-secondary hover:text-ink-primary'
                )}
              >
                <tab.icon className="w-4 h-4" />
                <span className="text-sm">{tab.name}</span>
              </Link>
            );
          })}
        </div>
      </div>
      <div className="flex-1 overflow-y-auto">
        {children}
      </div>
    </div>
  );
}
