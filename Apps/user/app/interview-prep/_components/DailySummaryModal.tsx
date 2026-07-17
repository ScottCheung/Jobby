import React from 'react';
import { Trophy, Flame, Star, Coins, X } from 'lucide-react';
import type { DailySummary } from '@/lib/types';

interface DailySummaryModalProps {
  isOpen: boolean;
  onClose: () => void;
  summary: DailySummary | null;
}

export function DailySummaryModal({ isOpen, onClose, summary }: DailySummaryModalProps) {
  if (!isOpen || !summary) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="relative bg-panel border border-zinc-200 dark:border-zinc-800 rounded-3xl p-8 max-w-sm w-full shadow-2xl flex flex-col items-center text-center animate-in zoom-in-95 duration-300">
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-ink-secondary hover:text-ink-primary hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-full transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mb-6 ring-8 ring-primary/5">
          <Trophy className="w-10 h-10 text-primary" />
        </div>
        
        <h2 className="text-2xl font-black text-ink-primary mb-2">
          Mission Accomplished!
        </h2>
        <p className="text-ink-secondary text-sm mb-8">
          You've completed all scheduled practice questions for today. Amazing consistency!
        </p>

        <div className="grid grid-cols-2 gap-4 w-full mb-8">
          <div className="flex flex-col items-center p-4 bg-amber-500/10 rounded-2xl border border-amber-500/20">
            <Flame className="w-6 h-6 text-amber-500 mb-2" />
            <span className="text-2xl font-bold text-amber-600 dark:text-amber-500">{summary.current_streak}</span>
            <span className="text-xs font-semibold text-amber-600/80 uppercase tracking-wider mt-1">Day Streak</span>
          </div>
          
          <div className="flex flex-col items-center p-4 bg-primary/10 rounded-2xl border border-primary/20">
            <Star className="w-6 h-6 text-primary mb-2" />
            <span className="text-2xl font-bold text-primary">+{summary.xp_gained_today}</span>
            <span className="text-xs font-semibold text-primary/80 uppercase tracking-wider mt-1">XP Gained</span>
          </div>

          <div className="flex flex-col items-center p-4 bg-yellow-500/10 rounded-2xl border border-yellow-500/20 col-span-2">
            <div className="flex items-center gap-2 mb-2">
              <Coins className="w-5 h-5 text-yellow-500" />
              <span className="text-lg font-bold text-yellow-600 dark:text-yellow-500">+{summary.coins_gained_today} Coins</span>
            </div>
            <span className="text-xs font-medium text-yellow-600/80">Keep it up to unlock more rewards!</span>
          </div>
        </div>

        <button 
          onClick={onClose}
          className="w-full py-4 rounded-xl bg-primary text-primary-foreground font-bold text-lg hover:opacity-90 transition-opacity shadow-lg shadow-primary/20"
        >
          Return to Dashboard
        </button>
      </div>
    </div>
  );
}
