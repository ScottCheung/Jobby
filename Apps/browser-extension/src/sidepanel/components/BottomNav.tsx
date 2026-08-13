/** @format */

import { FileText, Home, Settings } from 'lucide-react';

export type TabType = 'home' | 'form' | 'tools';

interface BottomNavProps {
  activeTab: TabType;
  onChange: (tab: TabType) => void;
  visible?: boolean;
}

export function BottomNav({
  activeTab,
  onChange,
  visible = true,
}: BottomNavProps) {
  const tabs: { id: TabType; label: string; icon: React.ReactNode }[] = [
    { id: 'home', label: 'Home', icon: <Home className='w-5 h-5' /> },
    { id: 'form', label: 'AutoFill', icon: <FileText className='w-5 h-5' /> },
    { id: 'tools', label: 'Tools', icon: <Settings className='w-5 h-5' /> },
  ];

  return (
    <div
      className={`bottom-nav-container ${
        visible ? 'translate-y-0 ' : 'translate-y-[150%] '
      }`}
    >
      <div className='bottom-nav-card'>
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type='button'
            className={`bottom-nav-item ${
              activeTab === tab.id ? 'active' : ''
            }`}
            onClick={() => onChange(tab.id)}
          >
            <div className='bottom-nav-icon'>{tab.icon}</div>
            <span className='bottom-nav-label'>{tab.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
