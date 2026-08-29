/** @format */

'use client';

import React from 'react';
import { Clipboard, MessageSquare, FileText } from 'lucide-react';
import { cn } from '@/lib/utils';

type TabId = 'overview' | 'qa' | 'description';

interface TabsProps {
  activeTab: TabId;
  onChangeTab: (tab: TabId) => void;
}

export function Tabs({ activeTab, onChangeTab }: TabsProps) {
  const tabsList = [
    { id: 'overview' as const, label: 'Overview', icon: Clipboard },
    { id: 'qa' as const, label: 'Notes & Q&A', icon: MessageSquare },
    { id: 'description' as const, label: 'Job Description', icon: FileText },
  ];

  return (
    <div className='flex overflow-x-auto custom-scrollbar-primary'>
      {tabsList.map((tab) => {
        const Icon = tab.icon;
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            onClick={() => onChangeTab(tab.id)}
            className={cn(
              'label flex items-center gap-2 py-3 px-4 border-b-2 transition-all relative cursor-pointer whitespace-nowrap',
              isActive ?
                'border-primary text-primary font-bold'
              : 'border-transparent text-ink-secondary hover:text-ink-primary',
            )}
          >
            <Icon className='w-4 h-4' />
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
