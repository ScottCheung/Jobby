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
        'font-sans text-foreground select-text ',
        isSm ? 'space-y-3 text-[11px]' : 'space-y-4 text-[13px]',
        className,
      )}
    >
      {blocks.map((block, index) => {
        if (block.type === 'header') {
          return (
            <div
              key={index}
              className={cn(
                'flex items-center gap-2.5',
                isSm ? 'mt-3.5 mb-1.5 first:mt-0' : 'mt-6 mb-3 first:mt-0',
              )}
            >
              <span
                className={cn(
                  'rounded-full bg-primary shrink-0',
                  isSm ? 'w-1 h-3.5' : 'w-1 h-4',
                )}
              />
              <h4
                className={cn(
                  'font-bold text-foreground tracking-tight',
                  isSm ? 'text-[12px]' : 'text-[14.5px]',
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
                'pl-3 sm:pl-3.5',
                isSm ? 'space-y-1.5 my-1.5' : 'space-y-2.5 my-2.5',
              )}
            >
              {block.items.map((item, itemIdx) => (
                <li
                  key={itemIdx}
                  className={cn(
                    'flex items-start gap-2.5 leading-relaxed text-muted-foreground group/li',
                    isSm ? 'text-[11px]' : 'text-[13px]',
                  )}
                >
                  <span
                    className={cn(
                      'flex items-center justify-center shrink-0 select-none ',
                      isSm ? 'h-3.5 w-2' : 'h-4 w-2',
                    )}
                  >
                    <span
                      className={cn(
                        'rounded-full bg-primary/80 group-hover/li:bg-primary transition-all',
                        isSm ? 'h-1 w-1' : (
                          'h-1.25 w-1.25 group-hover/li:scale-125'
                        ),
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
              'pl-4 leading-relaxed text-muted-foreground whitespace-pre-wrap',
              isSm ? 'text-[11px] my-1.5' : 'text-[13px] my-2',
            )}
          >
            {block.text}
          </p>
        );
      })}
    </div>
  );
}
