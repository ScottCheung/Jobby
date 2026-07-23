/** @format */

'use client';

import React, { useEffect } from 'react';
import { X, Sparkles } from 'lucide-react';
import { showCelebrationEvent } from '@/lib/celebration';

interface Props {
  welcomeCoins: number;
  onClose: () => void;
}

export function FloatingWelcomeCard({ welcomeCoins, onClose }: Props) {
  useEffect(() => {
    showCelebrationEvent(
      'welcome_bonus',
      `Welcome Gift claimed: +${welcomeCoins} Coins!`,
    );
  }, [welcomeCoins]);

  return (
    <div className='fixed cursor-pointer bottom-1/2 right-1/2 translate-x-1/2 translate-y-1/2 z-50 max-w-2xl w-full animate-in slide-in-from-bottom-8 fade-in duration-500 shadow-2xl'>
      <div className='hero bg-linear-to-br from-green-800 via-emerald-900 to-zinc-950 relative overflow-hidden rounded-[28px] p-6 md:p-7 text-[#fff8e9] border border-emerald-700/30'>
        {/* Close Button */}
        <button
          onClick={onClose}
          className='absolute top-4 right-4 text-[#fff8e9]/60 hover:text-[#fff8e9]/100 transition-colors p-1 rounded-full hover:bg-white/10 z-20 cursor-pointer'
          title='Close'
        >
          <X className='w-5 h-5' />
        </button>

        <div className='relative z-10 flex flex-col gap-3.5 pr-2 text-left'>
          <div>
            <span className='inline-block text-[10px] font-extrabold uppercase tracking-wider text-emerald-300 mb-2 px-2 py-0.5 rounded bg-emerald-500/20'>
              Gift Card
            </span>
            <h1
              className='title-section text-white! mb-2'
              style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}
            >
              Welcome to Jobby! Mate
            </h1>
            <p className='body-sm text-[#fff8e9]/80 mt-24!'>
              Get ready to supercharge your Job Hunting. We've credited your
              account with a starter gift of{' '}
              <span className='font-black text-amber-300'>
                {welcomeCoins} coins
              </span>{' '}
              to help you quickly build your question library!
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
