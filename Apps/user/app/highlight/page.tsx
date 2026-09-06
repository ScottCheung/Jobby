'use client';

import { useState } from 'react';

type HighlightVariant = 'current' | 'aurora' | 'marker' | 'accent-bar';

export default function HighlightPlaygroundPage() {
  const [variant, setVariant] = useState<HighlightVariant>('aurora');
  const [activeKeyword, setActiveKeyword] = useState<string>('Technical Skills');
  const [pulseKey, setPulseKey] = useState<number>(0);

  const triggerAnimation = (keyword: string) => {
    setActiveKeyword(keyword);
    setPulseKey((prev) => prev + 1);
  };

  return (
    <div className='flex h-full flex-col gap-6 overflow-y-auto p-8 text-foreground'>
      <div className='flex flex-wrap items-center justify-between gap-4 border-b pb-4'>
        <div>
          <h1 className='text-xl font-bold'>高亮样式测试实验室</h1>
          <p className='text-sm text-muted-foreground'>
            在真实模拟的简历/JD 排版中测试不同的高亮效果
          </p>
        </div>

        <div className='flex items-center gap-2 rounded-lg bg-muted/50 p-1'>
          <button
            type='button'
            onClick={() => setVariant('current')}
            className={`rounded-md px-3 py-1.5 text-xs font-medium transition-all ${
              variant === 'current'
                ? 'bg-background shadow-sm text-foreground'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            当前线上 (全宽线框)
          </button>
          <button
            type='button'
            onClick={() => setVariant('aurora')}
            className={`rounded-md px-3 py-1.5 text-xs font-medium transition-all ${
              variant === 'aurora'
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            方案 1: 极光聚光微光 (推荐)
          </button>
          <button
            type='button'
            onClick={() => setVariant('marker')}
            className={`rounded-md px-3 py-1.5 text-xs font-medium transition-all ${
              variant === 'marker'
                ? 'bg-background shadow-sm text-foreground'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            方案 2: 现代通透马克底光
          </button>
          <button
            type='button'
            onClick={() => setVariant('accent-bar')}
            className={`rounded-md px-3 py-1.5 text-xs font-medium transition-all ${
              variant === 'accent-bar'
                ? 'bg-background shadow-sm text-foreground'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            方案 3: 侧边智能流光引线
          </button>
        </div>
      </div>

      {/* 控制与点击触发 */}
      <div className='flex items-center gap-2 text-xs'>
        <span className='text-muted-foreground'>点击词汇触发定位动效:</span>
        {['Technical Skills', 'Python', 'medical device regulations'].map((kw) => (
          <button
            key={kw}
            type='button'
            onClick={() => triggerAnimation(kw)}
            className={`rounded border px-2.5 py-1 transition-colors ${
              activeKeyword === kw
                ? 'border-primary bg-primary/10 text-primary font-semibold'
                : 'border-border bg-background hover:bg-muted'
            }`}
          >
            {kw}
          </button>
        ))}
      </div>

      {/* 模拟简历页面 */}
      <div className='flex justify-center'>
        <div className='w-full max-w-2xl rounded-xl border bg-card p-8 shadow-sm'>
          <p className='text-sm leading-relaxed text-muted-foreground'>
            Developed embedded firmware and automation scripts for medical equipment.
            Ensured all software in line with{' '}
            <HighlightedSpan
              text='medical device regulations'
              activeKeyword={activeKeyword}
              variant={variant}
              pulseKey={pulseKey}
            />
            .
          </p>

          <div className='mt-6'>
            {/* 这里的容器行 */}
            <div
              className={`transition-all duration-300 ${
                variant === 'current' && activeKeyword === 'Technical Skills'
                  ? 'rounded-lg border-2 border-[rgba(202,138,4,0.95)] bg-[rgba(250,204,21,0.15)] shadow-[0_0_0_3px_rgba(250,204,21,0.5)] p-1'
                  : variant === 'accent-bar' && activeKeyword === 'Technical Skills'
                  ? 'border-l-4 border-l-cyan-500 bg-gradient-to-r from-cyan-500/10 via-transparent to-transparent pl-2'
                  : ''
              }`}
            >
              <h3 className='font-bold text-base inline-block'>
                <HighlightedSpan
                  text='Technical Skills'
                  activeKeyword={activeKeyword}
                  variant={variant}
                  pulseKey={pulseKey}
                />
              </h3>
            </div>

            <ul className='mt-3 space-y-1.5 text-sm text-muted-foreground list-disc pl-5'>
              <li>
                Programming (intermediate level):{' '}
                <HighlightedSpan
                  text='Python'
                  activeKeyword={activeKeyword}
                  variant={variant}
                  pulseKey={pulseKey}
                />
                , C++, Javascript + html
              </li>
              <li>
                Platforms (intermediate level): Windows, Android app deployment, Docker & Linux WSL for Windows, AWS.
              </li>
              <li>
                UI/UX (intermediate level): Ability to design efficient, accessible interfaces.
              </li>
              <li>
                Networking: Comfortable with solving network connection issues
              </li>
            </ul>
          </div>
        </div>
      </div>

      <style jsx global>{`
        @keyframes auroraShimmer {
          0% {
            background-position: 0% 50%;
            box-shadow: 0 0 0 0 rgba(6, 182, 212, 0.4);
          }
          50% {
            box-shadow: 0 0 16px 2px rgba(139, 92, 246, 0.45);
          }
          100% {
            background-position: 200% 50%;
            box-shadow: 0 0 0 0 rgba(6, 182, 212, 0);
          }
        }
        @keyframes markerPulse {
          0% {
            transform: scale(0.98);
            opacity: 0.7;
          }
          50% {
            transform: scale(1.02);
            opacity: 1;
          }
          100% {
            transform: scale(1);
            opacity: 1;
          }
        }
      `}</style>
    </div>
  );
}

function HighlightedSpan({
  text,
  activeKeyword,
  variant,
  pulseKey,
}: {
  text: string;
  activeKeyword: string;
  variant: HighlightVariant;
  pulseKey: number;
}) {
  const isMatch = activeKeyword === text;

  if (!isMatch) {
    return <span>{text}</span>;
  }

  // 1. 当前线上 (硬黄色块)
  if (variant === 'current') {
    return (
      <mark className='bg-[#facc15] text-black px-0.5 rounded-none font-bold'>
        {text}
      </mark>
    );
  }

  // 2. 方案 1: 极光微光聚光灯 (精准贴合文字，带渐变流光边与光晕)
  if (variant === 'aurora') {
    return (
      <span
        key={pulseKey}
        className='relative inline-flex items-center px-1.5 py-0.5 rounded-md font-semibold text-foreground transition-all'
        style={{
          background: 'linear-gradient(90deg, rgba(6,182,212,0.18), rgba(139,92,246,0.18), rgba(245,158,11,0.18))',
          backgroundSize: '200% 100%',
          border: '1px solid rgba(6,182,212,0.45)',
          animation: 'auroraShimmer 2s ease-in-out',
        }}
      >
        {text}
      </span>
    );
  }

  // 3. 方案 2: 现代通透马克底光 (极简低调，琥珀薄雾 + 细亮底线)
  if (variant === 'marker') {
    return (
      <span
        key={pulseKey}
        className='inline-block px-1 rounded-sm bg-amber-500/15 text-amber-700 dark:text-amber-300 font-semibold border-b-2 border-amber-500/80'
        style={{
          animation: 'markerPulse 0.4s ease-out',
        }}
      >
        {text}
      </span>
    );
  }

  // 4. 方案 3: 侧边智能引线时，文字仅做微强调
  return (
    <span
      key={pulseKey}
      className='rounded bg-cyan-500/15 px-1 text-cyan-700 dark:text-cyan-300 font-semibold'
    >
      {text}
    </span>
  );
}
