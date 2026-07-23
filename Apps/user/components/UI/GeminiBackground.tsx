/** @format */

'use client';

import React from 'react';
import { useTheme } from '@/components/theme-provider';

export const GeminiBackground = React.memo(function GeminiBackground() {
  const { themeColor } = useTheme();

  // Define harmonious color palettes for each theme option
  const colorMap = {
    green: {
      orb1: 'bg-emerald-500/20 dark:bg-emerald-500/20',
      orb2: 'bg-teal-500/10 dark:bg-teal-500/10',
      orb3: 'bg-cyan-500/5 dark:bg-cyan-500/5',
    },
    blue: {
      orb1: 'bg-blue-500/20 dark:bg-blue-500/20',
      orb2: 'bg-sky-500/10 dark:bg-sky-500/10',
      orb3: 'bg-indigo-500/5 dark:bg-indigo-500/5',
    },
    purple: {
      orb1: 'bg-purple-500/20 dark:bg-purple-500/20',
      orb2: 'bg-fuchsia-500/10 dark:bg-fuchsia-500/10',
      orb3: 'bg-pink-500/5 dark:bg-pink-500/5',
    },
    orange: {
      orb1: 'bg-orange-500/20 dark:bg-orange-500/20',
      orb2: 'bg-amber-500/10 dark:bg-amber-500/10',
      orb3: 'bg-yellow-500/5 dark:bg-yellow-500/5',
    },
    rose: {
      orb1: 'bg-rose-500/20 dark:bg-rose-500/20',
      orb2: 'bg-pink-500/10 dark:bg-pink-500/10',
      orb3: 'bg-purple-500/5 dark:bg-purple-500/5',
    },
  };

  const palette = colorMap[themeColor] || colorMap.green;

  return (
    <div className='fixed inset-0 z-0 overflow-hidden pointer-events-none select-none '>
      {/* Styles for GPU-accelerated slow fluid movement */}
      <style>{`
        @keyframes gemini-orb-1 {
          0% { transform: translate3d(0, 0, 0) scale(1); }
          33% { transform: translate3d(8vw, -12vh, 0) scale(1.15); }
          66% { transform: translate3d(-6vw, 8vh, 0) scale(0.9); }
          100% { transform: translate3d(0, 0, 0) scale(1); }
        }
        @keyframes gemini-orb-2 {
          0% { transform: translate3d(0, 0, 0) scale(1.05); }
          50% { transform: translate3d(-10vw, 10vh, 0) scale(0.95); }
          100% { transform: translate3d(0, 0, 0) scale(1.05); }
        }
        @keyframes gemini-orb-3 {
          0% { transform: translate3d(0, 0, 0) scale(0.95); }
          40% { transform: translate3d(12vw, 8vh, 0) scale(1.1); }
          80% { transform: translate3d(-8vw, -10vh, 0) scale(0.9); }
          100% { transform: translate3d(0, 0, 0) scale(0.95); }
        }
        .animate-gemini-1 { animation: gemini-orb-1 28s ease-in-out infinite; }
        .animate-gemini-2 { animation: gemini-orb-2 34s ease-in-out infinite; }
        .animate-gemini-3 { animation: gemini-orb-3 24s ease-in-out infinite; }
      `}</style>

      {/* Glowing Orbs */}
      <div
        className={`absolute top-[-10%] left-[10%] w-[45vw] h-[45vw] max-w-[600px] max-h-[600px] rounded-full blur-[100px] md:blur-[140px] transition-colors duration-1000 animate-gemini-1 ${palette.orb1}`}
      />
      <div
        className={`absolute bottom-[-10%] right-[10%] w-[40vw] h-[40vw] max-w-[550px] max-h-[550px] rounded-full blur-[100px] md:blur-[140px] transition-colors duration-1000 animate-gemini-2 ${palette.orb2}`}
      />
      <div
        className={`absolute top-[30%] right-[15%] w-[35vw] h-[35vw] max-w-[480px] max-h-[480px] rounded-full blur-[100px] md:blur-[140px] transition-colors duration-2000 animate-gemini-3 ${palette.orb3}`}
      />
    </div>
  );
});
