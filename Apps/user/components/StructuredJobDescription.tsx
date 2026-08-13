/** @format */

'use client';

import React from 'react';
import { parseDescriptionBlocks, cn } from '@/lib/utils';

interface StructuredJobDescriptionProps {
  content?: string | null;
  className?: string;
  maxBlocks?: number;
}

export function StructuredJobDescription({
  content,
  className,
  maxBlocks,
}: StructuredJobDescriptionProps) {
  if (!content) return null;

  let blocks = parseDescriptionBlocks(content);
  if (maxBlocks && blocks.length > maxBlocks) {
    blocks = blocks.slice(0, maxBlocks);
  }

  return (
    <div className={cn('space-y-3.5 text-ink-primary font-sans', className)}>
      {blocks.map((block, index) => {
        if (block.type === 'header') {
          return (
            <div
              key={index}
              className='pt-3 first:pt-0 pb-1 border-b border-border/40 flex items-center gap-2 mt-3.5 first:mt-0 mb-1.5'
            >
              <span className='w-1 h-3.5 rounded-full bg-primary inline-block shrink-0' />
              <h4 className='font-bold text-xs sm:text-sm capitalize text-ink-primary tracking-tight'>
                {block.text}
              </h4>
            </div>
          );
        }

        if (block.type === 'list') {
          return (
            <ul key={index} className='space-y-2 my-2 pl-3.5 sm:pl-4'>
              {block.items.map((item, itemIdx) => (
                <li
                  key={itemIdx}
                  className='flex items-start gap-2 text-[12px] sm:text-[13px] leading-relaxed text-ink-secondary group/li'
                >
                  <span className='flex h-4.5 items-center justify-center shrink-0 select-none'>
                    <span className='h-1.25 w-1.25 rounded-full bg-primary/70 group-hover/li:bg-primary group-hover/li:scale-125 transition-all' />
                  </span>
                  <span className='flex-1 min-w-0'>{item}</span>
                </li>
              ))}
            </ul>
          );
        }

        return (
          <p
            key={index}
            className='text-[12px] sm:text-[13px] leading-relaxed text-ink-secondary whitespace-pre-wrap my-2'
          >
            {block.text}
          </p>
        );
      })}
    </div>
  );
}
