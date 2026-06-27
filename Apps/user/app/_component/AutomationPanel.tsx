/** @format */

'use client';

import React, { useEffect, useState } from 'react';
import { motion, useDragControls, useMotionValue, AnimatePresence } from 'framer-motion';
import { useConsole } from '@/components/ConsoleContext';
import { cn } from '@/lib/utils';
import { Bot, Play, Square, RefreshCw } from 'lucide-react';
import type { DesktopBotPlatform } from '@/lib/types';

// Premium SVG Logos
const LinkedInIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 34 34" fill="currentColor">
    <path
      className="fill-[#0a66c2]"
      d="M34 2.5v29a2.5 2.5 0 0 1-2.5 2.5h-29A2.5 2.5 0 0 1 0 31.5v-29A2.5 2.5 0 0 1 2.5 0h29A2.5 2.5 0 0 1 34 2.5M10 13H5v16h5zm.45-5.5a2.88 2.88 0 0 0-2.86-2.9H7.5a2.9 2.9 0 0 0 0 5.8 2.88 2.88 0 0 0 2.95-2.81zM29 19.28c0-4.81-3.06-6.68-6.1-6.68a5.7 5.7 0 0 0-5.06 2.58h-.14V13H13v16h5v-8.51a3.32 3.32 0 0 1 3-3.58h.19c1.59 0 2.77 1 2.77 3.52V29h5z"
    />
  </svg>
);

const SeekIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 68 68" fill="currentColor">
    <path
      className="fill-[#0d3880]"
      d="M34.015,1.51c-17.952,0-32.506,14.552-32.506,32.507c0,17.952,14.554,32.505,32.506,32.505 c17.958,0,32.508-14.553,32.508-32.505C66.523,16.062,51.972,1.51,34.015,1.51z M8.262,41.733c-0.281,0-0.511-0.226-0.511-0.504 c0-0.281,0.229-0.511,0.511-0.511c0.278,0,0.504,0.229,0.504,0.511C8.766,41.508,8.541,41.733,8.262,41.733z M8.262,34.907 c-0.281,0-0.511-0.229-0.511-0.51s0.229-0.509,0.511-0.509c0.278,0,0.504,0.228,0.504,0.509S8.541,34.907,8.262,34.907z M8.262,28.077c-0.281,0-0.511-0.229-0.511-0.509c0-0.281,0.229-0.507,0.511-0.507c0.278,0,0.504,0.226,0.504,0.507 C8.766,27.849,8.541,28.077,8.262,28.077z M11.764,41.991c-0.422,0-0.762-0.342-0.762-0.762c0-0.422,0.34-0.765,0.762-0.765 c0.421,0,0.762,0.343,0.762,0.765C12.526,41.649,12.186,41.991,11.764,41.991z M11.764,35.158c-0.422,0-0.762-0.339-0.762-0.761 c0-0.42,0.34-0.761,0.762-0.761c0.421,0,0.762,0.341,0.762,0.761C12.526,34.819,12.186,35.158,11.764,35.158z M11.764,28.33 c-0.422,0-0.762-0.341-0.762-0.762c0-0.422,0.34-0.763,0.762-0.763c0.421,0,0.762,0.341,0.762,0.763 C12.526,27.989,12.186,28.33,11.764,28.33z M15.867,42.246c-0.562,0-1.019-0.455-1.019-1.017c0-0.561,0.457-1.018,1.019-1.018 c0.558,0,1.016,0.457,1.016,1.018C16.882,41.791,16.424,42.246,15.867,42.246z M15.867,35.412c-0.562,0-1.019-0.453-1.019-1.015 c0-0.562,0.457-1.016,1.019-1.016c0.558,0,1.016,0.453,1.016,1.016C16.882,34.959,16.424,35.412,15.867,35.412z M15.867,28.583 c-0.562,0-1.019-0.451-1.019-1.015c0-0.562,0.457-1.016,1.019-1.016c0.558,0,1.016,0.453,1.016,1.016 C16.882,28.132,16.424,28.583,15.867,28.583z M20.18,42.497c-0.702,0-1.27-0.567-1.27-1.268c0-0.705,0.568-1.27,1.27-1.27 c0.704,0,1.27,0.564,1.27,1.27C21.45,41.93,20.884,42.497,20.18,42.497z M20.18,35.669c-0.702,0-1.27-0.568-1.27-1.271 s0.568-1.269,1.27-1.269c0.704,0,1.27,0.565,1.27,1.269S20.884,35.669,20.18,35.669z M20.18,28.84c-0.702,0-1.27-0.568-1.27-1.271 s0.568-1.271,1.27-1.271c0.704,0,1.27,0.567,1.27,1.271S20.884,28.84,20.18,28.84z M25.234,42.752c-0.842,0-1.523-0.681-1.523-1.522 c0-0.845,0.682-1.523,1.523-1.523c0.84,0,1.522,0.679,1.522,1.523C26.756,42.071,26.074,42.752,25.234,42.752z M25.234,35.922 c-0.842,0-1.523-0.684-1.523-1.524c0-0.842,0.682-1.523,1.523-1.523c0.84,0,1.522,0.682,1.522,1.523 C26.756,35.238,26.074,35.922,25.234,35.922z M25.234,29.093c-0.842,0-1.523-0.683-1.523-1.524s0.682-1.525,1.523-1.525 c0.84,0,1.522,0.684,1.522,1.525S26.074,29.093,25.234,29.093z M30.523,43.005c-0.983,0-1.778-0.792-1.778-1.775 c0-0.982,0.795-1.78,1.778-1.78c0.985,0,1.779,0.798,1.779,1.78C32.302,42.213,31.508,43.005,30.523,43.005z M30.523,36.176 c-0.983,0-1.778-0.796-1.778-1.778s0.795-1.776,1.778-1.776c0.985,0,1.779,0.794,1.779,1.776S31.508,36.176,30.523,36.176z M30.523,29.346c-0.983,0-1.778-0.796-1.778-1.777s0.795-1.776,1.778-1.776c0.985,0,1.779,0.795,1.779,1.776 S31.508,29.346,30.523,29.346z M36.812,56.922c-1.121,0-2.027-0.911-2.027-2.034c0-1.119,0.906-2.027,2.027-2.027 c1.125,0,2.035,0.908,2.035,2.027C38.847,56.011,37.938,56.922,36.812,56.922z M36.812,50.091c-1.121,0-2.027-0.91-2.027-2.03 c0-1.122,0.906-2.036,2.027-2.036c1.125,0,2.035,0.914,2.035,2.036C38.847,49.181,37.938,50.091,36.812,50.091z M36.812,43.26 c-1.121,0-2.027-0.909-2.027-2.030c0-1.123,0.906-2.033,2.027-2.033c1.125,0,2.035,0.91,2.035,2.033 C38.847,42.351,37.938,43.26,36.812,43.26z M36.812,36.43c-1.121,0-2.027-0.91-2.027-2.032c0-1.124,0.906-2.03,2.027-2.03 c1.125,0,2.035,0.906,2.035,2.03C38.847,35.52,37.938,36.43,36.812,36.43z M36.812,29.6c-1.121,0-2.027-0.908-2.027-2.031 c0-1.122,0.906-2.031,2.027-2.031c1.125,0,2.035,0.909,2.035,2.031C38.847,28.691,37.938,29.6,36.812,29.6z M36.812,22.77 c-1.121,0-2.027-0.912-2.027-2.032c0-1.123,0.906-2.03,2.027-2.03c1.125,0,2.035,0.907,2.035,2.03 C38.847,21.857,37.938,22.77,36.812,22.77z M36.812,15.938c-1.121,0-2.027-0.91-2.027-2.029c0-1.123,0.906-2.033,2.027-2.033 c1.125,0,2.035,0.91,2.035,2.033C38.847,15.027,37.938,15.938,36.812,15.938z M43.342,50.3c-1.233,0-2.238-1.002-2.238-2.239 c0-1.239,1.004-2.242,2.238-2.242c1.24,0,2.243,1.003,2.243,2.242C45.585,49.298,44.582,50.3,43.342,50.3z M43.342,43.469 c-1.233,0-2.238-1.003-2.238-2.239c0-1.239,1.004-2.242,2.238-2.242c1.24,0,2.243,1.003,2.243,2.242 C45.585,42.466,44.582,43.469,43.342,43.469z M43.342,36.64c-1.233,0-2.238-1.004-2.238-2.242c0-1.237,1.004-2.238,2.238-2.238 c1.24,0,2.243,1.001,2.243,2.238C45.585,35.636,44.582,36.64,43.342,36.64z M43.342,29.807c-1.233,0-2.238-1.002-2.238-2.238 c0-1.238,1.004-2.24,2.238-2.24c1.24,0,2.243,1.002,2.243,2.24C45.585,28.805,44.582,29.807,43.342,29.807z M43.342,22.977 c-1.233,0-2.238-1.003-2.238-2.239c0-1.239,1.004-2.242,2.238-2.242c1.24,0,2.243,1.003,2.243,2.242 C45.585,21.974,44.582,22.977,43.342,22.977z M50.351,43.765c-1.393,0-2.517-1.126-2.517-2.517c0-1.389,1.124-2.516,2.517-2.516 c1.391,0,2.513,1.127,2.513,2.516C52.863,42.639,51.742,43.765,50.351,43.765z M50.351,36.933c-1.393,0-2.517-1.123-2.517-2.515 c0-1.386,1.124-2.517,2.517-2.517c1.391,0,2.513,1.131,2.513,2.517C52.863,35.81,51.742,36.933,50.351,36.933z M50.351,30.104 c-1.393,0-2.517-1.125-2.517-2.515c0-1.393,1.124-2.517,2.517-2.517c1.391,0,2.513,1.124,2.513,2.517 C52.863,28.979,51.742,30.104,50.351,30.104z M57.49,37.219c-1.519,0-2.756-1.234-2.756-2.754c0-1.523,1.238-2.757,2.756-2.757 c1.521,0,2.754,1.233,2.754,2.757C60.244,35.984,59.012,37.219,57.49,37.219z"
    />
  </svg>
);

export default function AutomationPanel() {
  const {
    user,
    isDesktopApp,
    botStates,
    startBot,
    stopBot,
  } = useConsole();

  const [isOpen, setIsOpen] = useState(false);
  const [corner, setCorner] = useState<'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'>('bottom-right');
  const [mounted, setMounted] = useState(false);

  const dragX = useMotionValue(0);
  const dragY = useMotionValue(0);
  const dragControls = useDragControls();

  useEffect(() => {
    setMounted(true);
    const saved = localStorage.getItem('automation-panel-corner');
    if (
      saved === 'top-left' ||
      saved === 'top-right' ||
      saved === 'bottom-left' ||
      saved === 'bottom-right'
    ) {
      setCorner(saved);
    }
  }, []);

  if (!isDesktopApp) return null;

  const handleDragEnd = (event: any, info: any) => {
    const x = info.point.x;
    const y = info.point.y;
    const W = window.innerWidth;
    const H = window.innerHeight;

    let newCorner: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' =
      'bottom-right';

    if (x < W / 2) {
      if (y < H / 2) {
        newCorner = 'top-left';
      } else {
        newCorner = 'bottom-left';
      }
    } else {
      if (y < H / 2) {
        newCorner = 'top-right';
      } else {
        newCorner = 'bottom-right';
      }
    }

    setCorner(newCorner);
    localStorage.setItem('automation-panel-corner', newCorner);

    // Reset offsets back to zero so layout animation takes over positioning
    dragX.set(0);
    dragY.set(0);
  };

  const isTop = corner.startsWith('top');

  // Prevent rendering positioning logic on server to avoid hydration mismatch
  if (!mounted) return null;

  const handlePlatformClick = async (platform: DesktopBotPlatform, e: React.MouseEvent) => {
    e.stopPropagation();
    const state = botStates?.[platform];
    const status = state?.status || 'idle';
    const isRunning = status === 'running';

    if (status === 'starting' || status === 'stopping') return;

    if (isRunning) {
      await stopBot(platform);
    } else {
      if (!user?.can_use_auto_apply) return;
      await startBot(platform);
    }
  };

  // Determine if any bot is active to trigger glowing state on floating icon
  const isAnyBotActive = Object.values(botStates || {}).some((s: any) =>
    ['starting', 'running', 'stopping'].includes(s?.status),
  );

  const PLATFORMS: Array<{
    key: 'linkedin' | 'seek';
    name: string;
    description: string;
    icon: React.ReactNode;
    brandHoverClass: string;
    brandShadowClass: string;
  }> = [
    {
      key: 'linkedin',
      name: 'LinkedIn',
      description: 'Easy Apply bot',
      icon: <LinkedInIcon className="w-7 h-7" />,
      brandHoverClass: 'hover:border-[#0a66c2]/45 dark:hover:border-[#0a66c2]/60 hover:bg-[#0a66c2]/5 dark:hover:bg-[#0a66c2]/10',
      brandShadowClass: 'shadow-[#0a66c2]/5 hover:shadow-[#0a66c2]/10',
    },
    {
      key: 'seek',
      name: 'Seek',
      description: 'Quick Apply bot',
      icon: <SeekIcon className="w-7 h-7" />,
      brandHoverClass: 'hover:border-[#0d3880]/45 dark:hover:border-[#0d3880]/60 hover:bg-[#0d3880]/5 dark:hover:bg-[#0d3880]/10',
      brandShadowClass: 'shadow-[#0d3880]/5 hover:shadow-[#0d3880]/10',
    },
  ];

  return (
    <motion.div
      drag
      dragControls={dragControls}
      dragListener={false}
      dragMomentum={false}
      dragElastic={0.08}
      style={{ x: dragX, y: dragY }}
      onDragEnd={handleDragEnd}
      layout
      onMouseEnter={() => setIsOpen(true)}
      onMouseLeave={() => setIsOpen(false)}
      transition={{ type: 'spring', stiffness: 220, damping: 28 }}
      className={cn(
        'fixed z-50 flex group gap-4 pointer-events-auto touch-none select-none',
        corner === 'top-left' && 'top-6 left-6 flex-col items-start',
        corner === 'top-right' && 'top-6 right-6 flex-col items-end',
        corner === 'bottom-left' &&
          'bottom-6 left-6 flex-col-reverse items-start',
        corner === 'bottom-right' &&
          'bottom-6 right-6 flex-col-reverse items-end',
      )}
    >
      {/* Floating Action Button (FAB) / Drag Handle */}
      <button
        onPointerDown={(e) => dragControls.start(e)}
        onClick={() => setIsOpen((prev) => !prev)}
        className={cn(
          'w-14 h-14 rounded-full flex items-center justify-center shadow-lg border text-white transition-all duration-300 hover:scale-[1.05] active:scale-[0.95] cursor-grab active:cursor-grabbing z-45 relative',
          isAnyBotActive ?
            'bg-gradient-to-tr from-emerald-600 to-green-700 border-green-500/20 shadow-green-500/20'
          : 'bg-gradient-to-tr from-zinc-700 to-zinc-800 border-zinc-600/20 shadow-zinc-800/20',
        )}
      >
        {isAnyBotActive && (
          <span className="absolute -top-1 -right-1 flex h-4 w-4 pointer-events-none">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-4 w-4 bg-green-500 border-2 border-white dark:border-zinc-900"></span>
          </span>
        )}
        <Bot
          className={cn(
            'w-6 h-6 transition-transform duration-300 pointer-events-none',
            isOpen && 'rotate-180',
          )}
        />
      </button>

      {/* Pop-up Platform buttons */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: isTop ? -15 : 15 }}
            animate={{
              opacity: 1,
              scale: 1,
              y: 0,
              transition: {
                type: 'spring',
                stiffness: 280,
                damping: 24,
                staggerChildren: 0.06,
              },
            }}
            exit={{
              opacity: 0,
              scale: 0.9,
              y: isTop ? -10 : 10,
              transition: { duration: 0.15, ease: 'easeIn' },
            }}
            className={cn(
              'flex gap-3 z-30',
              isTop ? 'flex-col' : 'flex-col-reverse',
            )}
          >
            {PLATFORMS.map((platform) => {
              const state = botStates?.[platform.key] || {
                status: 'idle',
                stats: { submitted: 0, skipped: 0, failed: 0 },
              };
              const status = state.status || 'idle';
              const isRunning = status === 'running';
              const isStarting = status === 'starting';
              const isStopping = status === 'stopping';
              const isActive = isRunning || isStarting || isStopping;
              const stats = state.stats || { submitted: 0, skipped: 0, failed: 0 };
              const isLocked = !isActive && !user?.can_use_auto_apply;

              return (
                <motion.div
                  key={platform.key}
                  variants={{
                    hidden: { opacity: 0, y: isTop ? -10 : 10, scale: 0.95 },
                    visible: { opacity: 1, y: 0, scale: 1 },
                  }}
                  className={cn(
                    'group/btn w-72 h-20 rounded-2xl flex items-center justify-between p-3.5 border transition-all duration-300 relative overflow-hidden backdrop-blur-xl shadow-xl',
                    isLocked ?
                      'bg-zinc-100/70 dark:bg-zinc-900/50 border-zinc-200/40 dark:border-zinc-800/40 opacity-70 cursor-not-allowed'
                    : isRunning ?
                      'bg-emerald-500/5 dark:bg-emerald-500/10 border-emerald-500/30 dark:border-emerald-500/20 shadow-emerald-500/5 cursor-pointer hover:border-emerald-500/50 hover:bg-emerald-500/10'
                    : isStarting || isStopping ?
                      'bg-sky-500/5 dark:bg-sky-500/10 border-sky-500/30 dark:border-sky-500/20 shadow-sky-500/5 cursor-wait'
                    : cn(
                        'bg-white/90 dark:bg-[#0f1219]/90 border-zinc-200/75 dark:border-zinc-800/80 cursor-pointer',
                        platform.brandHoverClass,
                        platform.brandShadowClass,
                      ),
                  )}
                  onClick={(e) => {
                    if (isLocked) return;
                    handlePlatformClick(platform.key, e);
                  }}
                >
                  {/* Left Side: Logo */}
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-11 h-11 rounded-xl bg-white border border-zinc-150/85 dark:border-zinc-800/50 flex items-center justify-center shadow-sm shrink-0">
                      {platform.icon}
                    </div>

                    {/* Middle: Name & Action status */}
                    <div className="flex flex-col min-w-0 select-none">
                      <span className="font-extrabold text-sm text-zinc-950 dark:text-zinc-50 tracking-tight leading-normal">
                        {platform.name} Apply
                      </span>

                      {/* Status row */}
                      <div className="flex items-center gap-1.5 min-h-[16px] mt-0.5">
                        {isStarting && (
                          <span className="text-[11px] font-bold text-sky-500 flex items-center gap-1">
                            <RefreshCw className="w-3 h-3 animate-spin" /> Starting...
                          </span>
                        )}
                        {isStopping && (
                          <span className="text-[11px] font-bold text-amber-500 flex items-center gap-1">
                            <RefreshCw className="w-3 h-3 animate-spin" /> Stopping...
                          </span>
                        )}
                        {isLocked && (
                          <span className="text-[11px] font-bold text-red-500 dark:text-red-400 flex items-center gap-1">
                            <svg className="w-3.5 h-3.5 fill-current shrink-0" viewBox="0 0 24 24">
                              <path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z" />
                            </svg>
                            Upgrade Required
                          </span>
                        )}
                        {!isActive && !isLocked && (
                          <>
                            <span className="text-[11px] font-bold text-zinc-400 dark:text-zinc-500 group-hover/btn:hidden flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-zinc-300 dark:bg-zinc-700" /> Inactive
                            </span>
                            <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 hidden group-hover/btn:flex items-center gap-1 animate-pulse">
                              <Play className="w-3 h-3 fill-current" /> Start Bot
                            </span>
                          </>
                        )}
                        {isRunning && (
                          <>
                            <span className="text-[11px] font-bold text-green-500 group-hover/btn:hidden flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" /> Running
                            </span>
                            <span className="text-[11px] font-bold text-red-500 hidden group-hover/btn:flex items-center gap-1">
                              <Square className="w-3 h-3 fill-current" /> Stop Bot
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Right Side: Stats Panel */}
                  <div className="flex flex-col items-end text-[10px] font-bold font-mono bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-150/40 dark:border-zinc-800/40 rounded-xl px-2 py-1 select-none leading-tight shrink-0 gap-0.5 min-w-[52px]">
                    <span className="text-emerald-600 dark:text-emerald-400 flex items-center justify-end gap-1">
                      {stats.submitted} <span className="text-[8px] font-sans">✔</span>
                    </span>
                    <span className="text-amber-500 flex items-center justify-end gap-1">
                      {stats.skipped} <span className="text-[8px] font-sans">➔</span>
                    </span>
                    <span className="text-red-500 flex items-center justify-end gap-1">
                      {stats.failed} <span className="text-[8px] font-sans">✖</span>
                    </span>
                  </div>
                </motion.div>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
