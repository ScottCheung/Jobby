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
    <section className='panel-lg'>
      <div className='flex items-center gap-2 text-ink-primary'>
        {icon}
        <h3 className='label'>{title}</h3>
      </div>
      <div className='mt-4 flex flex-wrap gap-2'>
        {items.length ?
          items.map((item, index) => (
            <span
              key={`${title}-${item}-${index}`}
              className='body-sm inline-flex items-center rounded-full border border-border/60 bg-background-secondary/50 dark:bg-panel/40 px-3 py-1.5 text-ink-secondary'
            >
              {item}
            </span>
          ))
        : <span className='body-md text-ink-secondary'>{emptyLabel}</span>}
      </div>
    </section>
  );
}
