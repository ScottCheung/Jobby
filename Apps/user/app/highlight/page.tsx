'use client';

import { useState } from 'react';

type SettleStyle = 'ambient-rest' | 'breath-rest' | 'left-bar-rest';

export default function HighlightPlaygroundPage() {
  const [themeMode, setThemeMode] = useState<'dark' | 'light'>('dark');
  const [speed, setSpeed] = useState<'fast' | 'dynamic' | 'lightning'>('fast');
  const [settleStyle, setSettleStyle] = useState<SettleStyle>('ambient-rest');
  const [activeKeyword, setActiveKeyword] = useState<string>(
    'medical device regulations',
  );
  const [replayKey, setReplayKey] = useState<number>(0);

  const trigger = (keyword: string) => {
    setActiveKeyword(keyword);
    setReplayKey((k) => k + 1);
  };

  const durationMap = {
    fast: '2s',
    dynamic: '1.4s',
    lightning: '0.9s',
  };

  return (
    <div
      className={`flex h-full flex-col gap-8 overflow-y-auto p-8 md:p-14 font-sans transition-colors duration-200 ${
        themeMode === 'dark'
          ? 'bg-[#0e1013] text-[#e3e3e3]'
          : 'bg-[#f8f9fa] text-[#1f1f1f]'
      }`}
    >
      {/* 顶部控制栏 */}
      <div
        className={`flex flex-wrap items-center justify-between gap-6 border-b pb-6 ${
          themeMode === 'dark' ? 'border-white/[0.08]' : 'border-black/[0.08]'
        }`}
      >
        <div className='space-y-1'>
          <div className='flex items-center gap-2.5'>
            <GeminiSparkle
              className={`h-5 w-5 ${
                themeMode === 'dark' ? 'text-[#8ab4f8]' : 'text-[#1a73e8]'
              }`}
            />
            <h1 className='text-xl font-bold tracking-tight'>
              方案 2 升级版 · 光波掠影 + 优雅常驻沉淀
            </h1>
          </div>
          <p
            className={`text-xs ${
              themeMode === 'dark' ? 'text-neutral-400' : 'text-neutral-500'
            }`}
          >
            左至右流光扫掠引导视线 ➔ 扫光结束后平滑沉淀为温润底色（不再凭空消失）
          </p>
        </div>

        <div className='flex flex-wrap items-center gap-3'>
          {/* 明暗模式 */}
          <div
            className={`flex items-center rounded-full p-1 border text-xs font-medium ${
              themeMode === 'dark'
                ? 'bg-white/[0.06] border-white/10'
                : 'bg-black/[0.04] border-black/10'
            }`}
          >
            <button
              type='button'
              onClick={() => setThemeMode('light')}
              className={`rounded-full px-3 py-1 transition-all ${
                themeMode === 'light'
                  ? 'bg-white text-black font-bold shadow-sm'
                  : 'text-neutral-500 hover:text-black dark:hover:text-white'
              }`}
            >
              ☀️ 纯白亮色
            </button>
            <button
              type='button'
              onClick={() => setThemeMode('dark')}
              className={`rounded-full px-3 py-1 transition-all ${
                themeMode === 'dark'
                  ? 'bg-[#282a2d] text-white font-bold shadow-sm'
                  : 'text-neutral-500 hover:text-black dark:hover:text-white'
              }`}
            >
              🌙 暗黑夜视
            </button>
          </div>

          {/* 速度切换 */}
          <div
            className={`flex items-center rounded-full p-1 border text-xs font-medium ${
              themeMode === 'dark'
                ? 'bg-white/[0.06] border-white/10'
                : 'bg-black/[0.04] border-black/10'
            }`}
          >
            <span className='px-2.5 text-neutral-400 text-[11px]'>词汇流速:</span>
            {(
              [
                { id: 'fast', label: '快 (2.0s)' },
                { id: 'dynamic', label: '更快 (1.4s)' },
                { id: 'lightning', label: '极速 (0.9s)' },
              ] as const
            ).map((item) => (
              <button
                key={item.id}
                type='button'
                onClick={() => setSpeed(item.id)}
                className={`rounded-full px-2.5 py-1 transition-all ${
                  speed === item.id
                    ? 'bg-[#1a73e8] text-white font-bold shadow-sm'
                    : 'text-neutral-500 hover:text-black dark:hover:text-white'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>

          <button
            type='button'
            onClick={() => setReplayKey((k) => k + 1)}
            className='inline-flex items-center gap-1.5 rounded-full bg-[#1a73e8] hover:bg-[#1557b0] px-4 py-2 text-xs font-semibold text-white shadow-sm active:scale-95 transition-all'
          >
            <GeminiSparkle className='h-3.5 w-3.5' />
            <span>重新扫掠触发</span>
          </button>
        </div>
      </div>

      {/* 沉淀留存方式切换 */}
      <div className='flex flex-col gap-3'>
        <span className='text-xs font-bold uppercase tracking-wider text-neutral-400'>
          扫光结束后，整段沉淀留存形态:
        </span>
        <div className='grid grid-cols-1 gap-3 sm:grid-cols-3'>
          {[
            {
              id: 'ambient-rest',
              name: 'A. 温润晨曦柔光留存 (推荐 🌟)',
              badge: '最舒适耐看',
              desc: '扫光掠过后，整段平滑留下一层极薄、清透的晨曦柔光，清晰标记但绝不刺眼',
            },
            {
              id: 'breath-rest',
              name: 'B. 慢速微光呼吸留存',
              badge: '灵动感强',
              desc: '扫光结束后，整段背景持续保持极缓慢、柔和的极光呼吸，充满生命力',
            },
            {
              id: 'left-bar-rest',
              name: 'C. 柔光 + 左侧精致引线',
              badge: '层级最分明',
              desc: '扫光掠过后，段落左侧沉淀出一条 2.5px 的 Gemini 渐变流光细线，视线一目了然',
            },
          ].map((item) => {
            const isSelected = settleStyle === item.id;
            return (
              <button
                key={item.id}
                type='button'
                onClick={() => {
                  setSettleStyle(item.id as SettleStyle);
                  setReplayKey((k) => k + 1);
                }}
                className={`flex flex-col text-left rounded-2xl p-4 border transition-all ${
                  isSelected
                    ? 'bg-white dark:bg-[#1e1f20] border-[#1a73e8] shadow-md shadow-blue-500/10 ring-1 ring-[#1a73e8]'
                    : 'bg-white/60 dark:bg-[#1e1f20]/50 border-black/[0.06] dark:border-white/[0.08] hover:bg-white dark:hover:bg-[#1e1f20]'
                }`}
              >
                <div className='flex items-center justify-between gap-1'>
                  <span className='font-bold text-sm text-neutral-900 dark:text-neutral-100'>
                    {item.name}
                  </span>
                  <span
                    className={`text-[10px] px-2 py-0.5 rounded-full font-mono ${
                      isSelected
                        ? 'bg-[#e8f0fe] text-[#1a73e8] dark:bg-[#1a73e8]/20 dark:text-[#8ab4f8]'
                        : 'bg-black/5 dark:bg-white/10 text-neutral-500'
                    }`}
                  >
                    {item.badge}
                  </span>
                </div>
                <p className='mt-2 text-xs text-neutral-500 dark:text-neutral-400 leading-relaxed'>
                  {item.desc}
                </p>
              </button>
            );
          })}
        </div>
      </div>

      {/* 词汇测试切换 */}
      <div className='flex items-center gap-3 text-xs'>
        <span
          className={
            themeMode === 'dark' ? 'text-neutral-400' : 'text-neutral-500'
          }
        >
          点击测试词汇触发扫光:
        </span>
        {['medical device regulations', 'Technical Skills', 'Python, C++'].map(
          (kw) => (
            <button
              key={kw}
              type='button'
              onClick={() => trigger(kw)}
              className={`rounded-full px-4 py-1.5 font-medium transition-all ${
                activeKeyword === kw
                  ? 'bg-[#1a73e8] text-white font-semibold shadow-sm'
                  : themeMode === 'dark'
                  ? 'bg-[#1e1f20] border border-white/10 text-neutral-300 hover:bg-[#282a2d]'
                  : 'bg-white border border-black/10 text-neutral-700 hover:bg-neutral-100 shadow-xs'
              }`}
            >
              {kw}
            </button>
          ),
        )}
      </div>

      {/* 真实文档视图 */}
      <div className='flex justify-center pt-2 pb-16'>
        <div
          className={`relative w-full max-w-2xl rounded-3xl border p-10 md:p-14 shadow-2xl transition-all duration-200 ${
            themeMode === 'dark'
              ? 'bg-[#181a1d] border-white/[0.08] shadow-black/60'
              : 'bg-white border-black/[0.06] shadow-neutral-200/50'
          }`}
        >
          {/* 
            第一段：扫掠入场 ➔ 沉淀留存
          */}
          <div
            key={`p1-${replayKey}-${settleStyle}`}
            className={`relative rounded-xl p-2.5 -m-2.5 transition-all overflow-hidden ${
              activeKeyword === 'medical device regulations'
                ? settleStyle === 'ambient-rest'
                  ? 'sweep-settle-ambient'
                  : settleStyle === 'breath-rest'
                  ? 'sweep-settle-breath'
                  : 'sweep-settle-leftbar'
                : ''
            }`}
          >
            <p
              className={`text-[16px] leading-[1.7] font-normal relative z-10 ${
                themeMode === 'dark' ? 'text-neutral-300' : 'text-neutral-700'
              }`}
            >
              Developed embedded firmware and automation scripts for medical diagnostic
              systems. Ensured all software was designed in strict line with{' '}
              <GeminiFastHighlight
                text='medical device regulations'
                activeKeyword={activeKeyword}
                replayKey={replayKey}
                themeMode={themeMode}
                duration={durationMap[speed]}
              />
              {' '}and clinical healthcare compliance standards.
            </p>
          </div>

          <div className='mt-8'>
            <div
              key={`h3-${replayKey}-${settleStyle}`}
              className={`relative rounded-xl p-2.5 -m-2.5 mb-3 inline-block transition-all overflow-hidden ${
                activeKeyword === 'Technical Skills'
                  ? settleStyle === 'ambient-rest'
                    ? 'sweep-settle-ambient'
                    : settleStyle === 'breath-rest'
                    ? 'sweep-settle-breath'
                    : 'sweep-settle-leftbar'
                  : ''
              }`}
            >
              <h3
                className={`text-[18px] font-bold relative z-10 ${
                  themeMode === 'dark' ? 'text-white' : 'text-neutral-900'
                }`}
              >
                <GeminiFastHighlight
                  text='Technical Skills'
                  activeKeyword={activeKeyword}
                  replayKey={replayKey}
                  themeMode={themeMode}
                  duration={durationMap[speed]}
                />
              </h3>
            </div>

            <ul
              className={`space-y-2 text-[15px] leading-[1.65] list-disc pl-5 ${
                themeMode === 'dark' ? 'text-neutral-300' : 'text-neutral-700'
              }`}
            >
              <li
                key={`li1-${replayKey}-${settleStyle}`}
                className={`relative rounded-xl p-1.5 -m-1.5 transition-all overflow-hidden ${
                  activeKeyword === 'Python, C++'
                    ? settleStyle === 'ambient-rest'
                      ? 'sweep-settle-ambient'
                      : settleStyle === 'breath-rest'
                      ? 'sweep-settle-breath'
                      : 'sweep-settle-leftbar'
                    : ''
                }`}
              >
                <span className='relative z-10'>
                  Programming (intermediate level):{' '}
                  <GeminiFastHighlight
                    text='Python, C++'
                    activeKeyword={activeKeyword}
                    replayKey={replayKey}
                    themeMode={themeMode}
                    duration={durationMap[speed]}
                  />
                  , Javascript + html
                </span>
              </li>
              <li>
                Platforms (intermediate level): Windows, Android app deployment,
                Docker & Linux WSL for Windows, AWS.
              </li>
              <li>
                UI/UX (intermediate level): Ability to design efficient, accessible
                interfaces.
              </li>
              <li>
                Networking: Comfortable with solving network connection issues
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* 动效关键帧 */}
      <style jsx global>{`
        @keyframes geminiQuickFlow {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }

        @keyframes inlineStarIn {
          0% { transform: scale(0) rotate(-45deg); opacity: 0; }
          60% { transform: scale(1.25) rotate(15deg); opacity: 1; }
          100% { transform: scale(1) rotate(0deg); opacity: 1; }
        }

        @keyframes inlineStarPulse {
          0%, 100% { transform: scale(1); opacity: 0.9; }
          50% { transform: scale(1.2); opacity: 1; }
        }

        @keyframes radialSoftIn {
          0% { opacity: 0; transform: scale(0.94); }
          100% { opacity: 1; transform: scale(1); }
        }

        /* ------------------------------------------------------------- */
        /* 核心动效：扫掠入场 ➔ 平滑留存（不再消失）                      */
        /* ------------------------------------------------------------- */

        /* 1. 方案 A：扫光掠过后，平滑沉淀为温润晨曦底色 (常驻留存) */
        @keyframes sweepAndSettleKeyframe {
          0% {
            background-position: -200% 0;
            background-color: transparent;
          }
          40% {
            background-position: 0% 0;
          }
          100% {
            background-position: 150% 0;
            background-color: ${
              themeMode === 'dark'
                ? 'rgba(56, 189, 248, 0.07)'
                : 'rgba(26, 115, 232, 0.05)'
            };
          }
        }
        .sweep-settle-ambient {
          background-image: linear-gradient(
            90deg,
            transparent 0%,
            rgba(66, 133, 244, 0.12) 30%,
            rgba(155, 114, 207, 0.22) 50%,
            rgba(217, 101, 112, 0.14) 70%,
            transparent 100%
          );
          background-size: 200% 100%;
          animation: sweepAndSettleKeyframe 1.4s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }

        /* 2. 方案 B：扫光掠过后，保留底色并开启轻微呼吸 */
        @keyframes sweepThenBreathKeyframe {
          0% {
            background-position: -200% 0;
          }
          45% {
            background-position: 0% 0;
          }
          100% {
            background-position: 150% 0;
          }
        }
        @keyframes gentleBreathLoop {
          0%, 100% {
            background-color: ${
              themeMode === 'dark'
                ? 'rgba(56, 189, 248, 0.05)'
                : 'rgba(26, 115, 232, 0.04)'
            };
          }
          50% {
            background-color: ${
              themeMode === 'dark'
                ? 'rgba(168, 85, 247, 0.09)'
                : 'rgba(147, 51, 234, 0.07)'
            };
          }
        }
        .sweep-settle-breath {
          background-image: linear-gradient(
            90deg,
            transparent 0%,
            rgba(66, 133, 244, 0.12) 30%,
            rgba(155, 114, 207, 0.22) 50%,
            rgba(217, 101, 112, 0.14) 70%,
            transparent 100%
          );
          background-size: 200% 100%;
          animation: sweepThenBreathKeyframe 1.4s cubic-bezier(0.16, 1, 0.3, 1) forwards,
                     gentleBreathLoop 3s ease-in-out 1.4s infinite;
        }

        /* 3. 方案 C：扫光掠过后，左侧沉淀出精致流光引线 */
        @keyframes leftBarAppear {
          0% {
            border-left-color: transparent;
          }
          100% {
            border-left-color: ${
              themeMode === 'dark' ? '#38bdf8' : '#1a73e8'
            };
          }
        }
        .sweep-settle-leftbar {
          border-left: 3px solid transparent;
          background-image: linear-gradient(
            90deg,
            transparent 0%,
            rgba(66, 133, 244, 0.12) 30%,
            rgba(155, 114, 207, 0.22) 50%,
            rgba(217, 101, 112, 0.14) 70%,
            transparent 100%
          );
          background-size: 200% 100%;
          animation: sweepAndSettleKeyframe 1.4s cubic-bezier(0.16, 1, 0.3, 1) forwards,
                     leftBarAppear 0.5s ease-out 0.8s forwards;
        }
      `}</style>
    </div>
  );
}

// ========================================================
// 无界 · 行内星芒 · 快速变色高亮组件
// ========================================================
function GeminiFastHighlight({
  text,
  activeKeyword,
  replayKey,
  themeMode,
  duration,
}: {
  text: string;
  activeKeyword: string;
  replayKey: number;
  themeMode: 'dark' | 'light';
  duration: string;
}) {
  const isMatch = activeKeyword === text;

  if (!isMatch) {
    return <span>{text}</span>;
  }

  const isDark = themeMode === 'dark';

  return (
    <span
      key={replayKey}
      className='relative inline-flex items-center align-baseline font-bold mx-0.5 px-1 py-0'
    >
      {/* 径向渐变自然羽化背景 */}
      <span
        className='pointer-events-none absolute -inset-x-3 -inset-y-1 select-none'
        style={{
          background: isDark
            ? 'radial-gradient(ellipse 65% 55% at 50% 50%, rgba(56, 189, 248, 0.24) 0%, rgba(168, 85, 247, 0.14) 45%, transparent 80%)'
            : 'radial-gradient(ellipse 65% 55% at 50% 50%, rgba(26, 115, 232, 0.16) 0%, rgba(147, 51, 234, 0.10) 45%, transparent 80%)',
          animation: 'radialSoftIn 0.35s cubic-bezier(0.16, 1, 0.3, 1) forwards',
        }}
      />

      {/* 行内垂直居中星星 */}
      <span
        className={`inline-flex items-center mr-1 pointer-events-none select-none align-middle ${
          isDark
            ? 'text-[#38bdf8] drop-shadow-[0_0_5px_rgba(56,189,248,0.7)]'
            : 'text-[#1a73e8] drop-shadow-[0_0_3px_rgba(26,115,232,0.5)]'
        }`}
        style={{
          animation:
            'inlineStarIn 0.35s cubic-bezier(0.16, 1, 0.3, 1) forwards, inlineStarPulse 1.8s ease-in-out 0.35s infinite',
        }}
      >
        <GeminiSparkle className='h-[13px] w-[13px]' />
      </span>

      {/* 快速流动渐变文字 */}
      <span
        className='relative z-10 text-transparent bg-clip-text'
        style={{
          backgroundImage: isDark
            ? 'linear-gradient(75deg, #38bdf8 0%, #818cf8 25%, #c084fc 50%, #f43f5e 75%, #38bdf8 100%)'
            : 'linear-gradient(75deg, #0b57d0 0%, #1a73e8 25%, #7c3aed 50%, #be185d 75%, #0b57d0 100%)',
          backgroundSize: '200% 100%',
          animation: `geminiQuickFlow ${duration} ease-in-out infinite`,
          textShadow: isDark
            ? '0 0 12px rgba(56, 189, 248, 0.3)'
            : '0 0 8px rgba(26, 115, 232, 0.15)',
        }}
      >
        {text}
      </span>
    </span>
  );
}

// ========================================================
// 真正的 Google Gemini 官方 4-Point Star 矢量
// ========================================================
function GeminiSparkle({ className }: { className?: string }) {
  return (
    <svg
      viewBox='0 0 24 24'
      fill='currentColor'
      className={className}
      xmlns='http://www.w3.org/2000/svg'
    >
      <path d='M12 0C12 6.627 6.627 12 0 12C6.627 12 12 17.373 12 24C12 17.373 17.373 12 24 12C17.373 12 12 6.627 12 0Z' />
    </svg>
  );
}
