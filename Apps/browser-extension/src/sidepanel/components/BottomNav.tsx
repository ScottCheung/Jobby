import { FileText, Home, Settings } from 'lucide-react';
import { useEffect, useState } from 'react';

export type TabType = 'home' | 'form' | 'tools';

interface BottomNavProps {
  activeTab: TabType;
  onChange: (tab: TabType) => void;
}

export function BottomNav({ activeTab, onChange }: BottomNavProps) {
  const [isVisible, setIsVisible] = useState(true);
  const [lastScrollY, setLastScrollY] = useState(0);

  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      
      // If we scroll down more than 10px, hide the nav
      if (currentScrollY > lastScrollY + 10) {
        setIsVisible(false);
        setLastScrollY(currentScrollY);
      } 
      // If we scroll up more than 10px, show the nav
      else if (currentScrollY < lastScrollY - 10) {
        setIsVisible(true);
        setLastScrollY(currentScrollY);
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [lastScrollY]);

  const tabs: { id: TabType; label: string; icon: React.ReactNode }[] = [
    { id: 'home', label: 'Home', icon: <Home className='w-5 h-5' /> },
    { id: 'form', label: 'AutoFill', icon: <FileText className='w-5 h-5' /> },
    { id: 'tools', label: 'Tools', icon: <Settings className='w-5 h-5' /> },
  ];

  return (
    <div
      className={`bottom-nav-container ${
        isVisible ? 'translate-y-0' : 'translate-y-full'
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
