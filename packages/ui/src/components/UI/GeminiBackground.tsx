/** @format */

'use client';

import React from 'react';

export type GeminiThemeColor = 'green' | 'blue' | 'purple' | 'orange' | 'rose';

export interface GeminiBackgroundProps {
  themeColor?: GeminiThemeColor;
  className?: string;
}

export const GeminiBackground = React.memo(function GeminiBackground({
  themeColor,
  className = '',
}: GeminiBackgroundProps) {
  return (
    <div
      data-theme-color={themeColor}
      className={`gemini-bg-container fixed inset-0 z-0 overflow-hidden pointer-events-none select-none ${className}`}
      aria-hidden='true'
    >
      {/* Styles for GPU-accelerated slow fluid movement and dynamic theme palette */}
      <style>{`
        /* --- Color Definitions (CSS Custom Properties) --- */
        :root, .gemini-bg-container {
          --g-orb1: 16, 185, 129;  /* Emerald */
          --g-orb2: 20, 184, 166;  /* Teal */
          --g-orb3: 6, 182, 212;   /* Cyan */
          --g-op1: 0.16;
          --g-op2: 0.11;
          --g-op3: 0.07;
        }

        .dark, .dark .gemini-bg-container, .gemini-bg-container.dark {
          --g-op1: 0.20;
          --g-op2: 0.14;
          --g-op3: 0.09;
        }

        /* Blue Palette */
        [data-theme-color='blue'], [data-theme-color='blue'] .gemini-bg-container, .gemini-bg-container[data-theme-color='blue'] {
          --g-orb1: 59, 130, 246;  /* Blue */
          --g-orb2: 14, 165, 233;  /* Sky */
          --g-orb3: 99, 102, 241;  /* Indigo */
        }

        /* Purple Palette */
        [data-theme-color='purple'], [data-theme-color='purple'] .gemini-bg-container, .gemini-bg-container[data-theme-color='purple'] {
          --g-orb1: 168, 85, 247; /* Purple */
          --g-orb2: 217, 70, 239; /* Fuchsia */
          --g-orb3: 236, 72, 153; /* Pink */
        }

        /* Green Palette */
        [data-theme-color='green'], [data-theme-color='green'] .gemini-bg-container, .gemini-bg-container[data-theme-color='green'] {
          --g-orb1: 16, 185, 129;  /* Emerald */
          --g-orb2: 20, 184, 166;  /* Teal */
          --g-orb3: 6, 182, 212;   /* Cyan */
        }

        /* Orange Palette */
        [data-theme-color='orange'], [data-theme-color='orange'] .gemini-bg-container, .gemini-bg-container[data-theme-color='orange'] {
          --g-orb1: 249, 115, 22;  /* Orange */
          --g-orb2: 245, 158, 11;  /* Amber */
          --g-orb3: 234, 179, 8;   /* Yellow */
        }

        /* Rose Palette */
        [data-theme-color='rose'], [data-theme-color='rose'] .gemini-bg-container, .gemini-bg-container[data-theme-color='rose'] {
          --g-orb1: 244, 63, 94;   /* Rose */
          --g-orb2: 236, 72, 153;  /* Pink */
          --g-orb3: 168, 85, 247;  /* Purple */
        }

        /* --- GPU Layer Isolation & High Performance --- */
        .gemini-bg-container {
          contain: strict;
          isolation: isolate;
        }

        .gemini-orb {
          position: absolute;
          border-radius: 9999px;
          will-change: transform;
          backface-visibility: hidden;
          transform: translate3d(0, 0, 0);
          pointer-events: none;
        }

        .gemini-orb-1 {
          top: -12%;
          left: 8%;
          width: 48vw;
          height: 48vw;
          max-width: 620px;
          max-height: 620px;
          background: radial-gradient(
            circle at center,
            rgba(var(--g-orb1), var(--g-op1)) 0%,
            rgba(var(--g-orb1), calc(var(--g-op1) * 0.6)) 35%,
            rgba(var(--g-orb1), calc(var(--g-op1) * 0.15)) 60%,
            rgba(var(--g-orb1), 0) 75%
          );
          animation: gemini-float-1 28s ease-in-out infinite;
        }

        .gemini-orb-2 {
          bottom: -10%;
          right: 8%;
          width: 42vw;
          height: 42vw;
          max-width: 560px;
          max-height: 560px;
          background: radial-gradient(
            circle at center,
            rgba(var(--g-orb2), var(--g-op2)) 0%,
            rgba(var(--g-orb2), calc(var(--g-op2) * 0.55)) 35%,
            rgba(var(--g-orb2), calc(var(--g-op2) * 0.12)) 60%,
            rgba(var(--g-orb2), 0) 75%
          );
          animation: gemini-float-2 34s ease-in-out infinite;
        }

        .gemini-orb-3 {
          top: 28%;
          right: 14%;
          width: 38vw;
          height: 38vw;
          max-width: 500px;
          max-height: 500px;
          background: radial-gradient(
            circle at center,
            rgba(var(--g-orb3), var(--g-op3)) 0%,
            rgba(var(--g-orb3), calc(var(--g-op3) * 0.55)) 35%,
            rgba(var(--g-orb3), calc(var(--g-op3) * 0.12)) 60%,
            rgba(var(--g-orb3), 0) 75%
          );
          animation: gemini-float-3 24s ease-in-out infinite;
        }

        @keyframes gemini-float-1 {
          0% { transform: translate3d(0, 0, 0) scale(1); }
          33% { transform: translate3d(6vw, -8vh, 0) scale(1.1); }
          66% { transform: translate3d(-5vw, 6vh, 0) scale(0.92); }
          100% { transform: translate3d(0, 0, 0) scale(1); }
        }

        @keyframes gemini-float-2 {
          0% { transform: translate3d(0, 0, 0) scale(1.04); }
          50% { transform: translate3d(-8vw, 7vh, 0) scale(0.92); }
          100% { transform: translate3d(0, 0, 0) scale(1.04); }
        }

        @keyframes gemini-float-3 {
          0% { transform: translate3d(0, 0, 0) scale(0.95); }
          40% { transform: translate3d(8vw, 6vh, 0) scale(1.08); }
          80% { transform: translate3d(-6vw, -7vh, 0) scale(0.9); }
          100% { transform: translate3d(0, 0, 0) scale(0.95); }
        }

        @media (prefers-reduced-motion: reduce) {
          .gemini-orb-1, .gemini-orb-2, .gemini-orb-3 {
            animation: none !important;
          }
        }
      `}</style>

      {/* Glowing Orbs with built-in smooth radial gradient */}
      <div className='gemini-orb gemini-orb-1 blur-[30px] md:blur-[45px]' />
      <div className='gemini-orb gemini-orb-2 blur-[30px] md:blur-[45px]' />
      <div className='gemini-orb gemini-orb-3 blur-[30px] md:blur-[45px]' />
    </div>
  );
});

