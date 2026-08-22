/** @format */

import { Home, Pen, Settings, Sparkles } from 'lucide-react';
import { motion } from 'framer-motion';

export type TabType = 'home' | 'studio' | 'form' | 'tools';

interface BottomNavProps {
  activeTab: TabType;
  onChange: (tab: TabType) => void;
  visible?: boolean;
  hasNewDocuments?: boolean;
}

export function BottomNav({
  activeTab,
  onChange,
  visible = true,
  hasNewDocuments = false,
}: BottomNavProps) {
  const tabs: { id: TabType; label: string; icon: React.ReactNode }[] = [
    { id: 'home', label: 'Home', icon: <Home className='w-5 h-5' /> },
    { id: 'form', label: 'AutoFill', icon: <Pen className='w-5 h-5' /> },
    { id: 'studio', label: 'CV & CL', icon: <Sparkles className='w-5 h-5' /> },
    { id: 'tools', label: 'Tools', icon: <Settings className='w-5 h-5' /> },
  ];

  return (
    <div
      className={`bottom-nav-container ${
        visible ? 'translate-y-0 ' : 'translate-y-[150%] '
      }`}
    >
      <div className='bottom-nav-card'>
        {tabs.map((tab) => {
          const isSelected = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type='button'
              className={`bottom-nav-item ${isSelected ? 'active' : ''}`}
              onClick={() => onChange(tab.id)}
            >
              {isSelected && (
                <motion.div
                  layoutId='bottom-nav-active-pill'
                  className='absolute inset-0 rounded-[16px] bg-primary/15 shadow-xs'
                  transition={{ type: 'spring', bounce: 0.2, duration: 0.6 }}
                />
              )}
              <div className='bottom-nav-icon relative'>
                {tab.icon}
                {tab.id === 'studio' && hasNewDocuments && (
                  <span
                    className='absolute -right-3 -top-2 rounded-full bg-primary px-1 py-px text-[6px] font-black leading-none text-primary-foreground ring-2 ring-background'
                    aria-label='New documents available'
                    title='New documents available'
                  >
                    NEW
                  </span>
                )}
              </div>
              <span className='bottom-nav-label'>{tab.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
