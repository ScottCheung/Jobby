/** @format */

import React from 'react';

interface DetailGridProps {
  title: string;
  icon: React.ReactNode;
  items: Array<{ label: string; value: string }>;
}

export function DetailGrid({ title, icon, items }: DetailGridProps) {
  return (
    <section className='card'>
      <div className='flex items-center gap-2 text-ink-primary'>
        {icon}
        <h3 className='text-sm font-semibold'>{title}</h3>
      </div>
      <div className='mt-4 grid gap-3 md:grid-cols-2'>
        {items.map((item) => (
          <div
            key={item.label}
            className='rounded-xl border border-zinc-200/70 dark:border-zinc-800/80 bg-zinc-50/60 dark:bg-zinc-900/30 px-4 py-3'
          >
            <div className='text-[11px] uppercase tracking-wider text-ink-secondary/70'>
              {item.label}
            </div>
            <div className='mt-1 whitespace-pre-wrap break-words text-sm text-ink-primary'>
              {item.value}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
