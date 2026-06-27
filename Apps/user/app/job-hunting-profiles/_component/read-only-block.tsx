/** @format */

import React from 'react';

interface ReadOnlyBlockProps {
  title: string;
  icon: React.ReactNode;
  items: string[];
  emptyLabel: string;
}

export function ReadOnlyBlock({
  title,
  icon,
  items,
  emptyLabel,
}: ReadOnlyBlockProps) {
  return (
    <section className='display-panel'>
      <div className='flex items-center gap-2 text-ink-primary'>
        {icon}
        <h3 className='text-sm font-semibold'>{title}</h3>
      </div>
      <div className='mt-4 flex flex-wrap gap-2'>
        {items.length ?
          items.map((item, index) => (
            <span
              key={`${title}-${item}-${index}`}
              className='inline-flex items-center rounded-full border border-zinc-200/70 dark:border-zinc-800/80 bg-zinc-50/70 dark:bg-zinc-900/40 px-3 py-1.5 text-xs text-ink-secondary'
            >
              {item}
            </span>
          ))
        : <span className='text-sm text-ink-secondary'>{emptyLabel}</span>}
      </div>
    </section>
  );
}
