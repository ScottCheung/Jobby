/** @format */

'use client';

import { parseDescriptionBlocks } from '../../lib/job-description';
import { cn } from '../../lib/utils';

export interface StructuredJobDescriptionProps {
  content?: string | null;
  className?: string;
  maxBlocks?: number;
  size?: 'sm' | 'base';
}

export function StructuredJobDescription({
  content,
  className,
  maxBlocks,
  size = 'base',
}: StructuredJobDescriptionProps) {
  if (!content) return null;

  let blocks = parseDescriptionBlocks(content);
  if (maxBlocks && blocks.length > maxBlocks) {
    blocks = blocks.slice(0, maxBlocks);
  }

  const isSm = size === 'sm';

  return (
    <div
      className={cn(
        'font-sans text-foreground select-text',
        isSm ? 'space-y-2.5 text-[11px]' : 'space-y-3.5 text-[13px]',
        className,
      )}
    >
      {blocks.map((block, index) => {
        if (block.type === 'header') {
          return (
            <div
              key={index}
              className={cn(
                'border-b border-primary/25',
                isSm ? 'pt-2 pb-1 mt-2 first:mt-0 first:pt-0' : 'pt-3 pb-1.5 mt-3.5 first:mt-0 first:pt-0',
              )}
            >
              <h4
                className={cn(
                  'font-semibold text-foreground tracking-tight capitalize',
                  isSm ? 'text-[11px]' : 'text-[13px]',
                )}
              >
                {block.text}
              </h4>
            </div>
          );
        }

        if (block.type === 'list') {
          return (
            <ul
              key={index}
              className={cn(
                'pl-2.5 sm:pl-3',
                isSm ? 'space-y-1.5 my-1.5' : 'space-y-2 my-2',
              )}
            >
              {block.items.map((item, itemIdx) => (
                <li
                  key={itemIdx}
                  className={cn(
                    'flex items-start gap-2 leading-relaxed text-muted-foreground group/li',
                    isSm ? 'text-[11px]' : 'text-[12px] sm:text-[13px]',
                  )}
                >
                  <span
                    className={cn(
                      'flex items-center justify-center shrink-0 select-none',
                      isSm ? 'h-4 w-2' : 'h-4.5 w-2.5',
                    )}
                  >
                    <span
                      className={cn(
                        'rounded-full bg-primary/70 group-hover/li:bg-primary transition-all',
                        isSm ? 'h-1 w-1' : 'h-1.25 w-1.25 group-hover/li:scale-125',
                      )}
                    />
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
            className={cn(
              'leading-relaxed text-muted-foreground whitespace-pre-wrap',
              isSm ? 'text-[11px] my-1.5' : 'text-[12px] sm:text-[13px] my-2',
            )}
          >
            {block.text}
          </p>
        );
      })}
    </div>
  );
}
