/** @format */

import React from 'react';

interface DetailGridProps {
  title: string;
  icon: React.ReactNode;
  items: Array<{ label: string; value: string }>;
}

export function DetailGrid({ title, icon, items }: DetailGridProps) {
  return (
    <section className='panel-xl'>
      <div className='flex items-center gap-2 text-ink-primary'>
        {icon}
        <h3 className='text-sm font-semibold'>{title}</h3>
      </div>
      <div className='mt-4 grid gap-3 md:grid-cols-2'>
        {items.map((item) => (
          <div
            key={item.label}
            className='rounded-xl border border-border/60 bg-background-secondary/40 dark:bg-panel/30 px-4 py-3'
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
