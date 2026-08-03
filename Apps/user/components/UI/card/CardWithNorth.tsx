/** @format */
'use client';

import React, { useRef } from 'react';
import { cn } from '@/lib/utils';

// Define the props for our new component
interface CardWithNorthProps {
  title?: string | null;
  action?: React.ReactNode;
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg';
  // ClassNames for easy customization with Tailwind CSS
  className?: string;
  tabClassName?: string;
  contentClassName?: string;
}

/**
 * Generates the SVG path string for the tab background.
 * @param {number} width The width of the tab.
 * @returns {string} The 'd' attribute for the SVG path.
 */

const CardWithNorth: React.FC<CardWithNorthProps> = ({
  title,
  action,
  size = 'md',
  children,
  className = '',
  tabClassName = '',
  contentClassName = '',
}) => {
  const titleRef = useRef<HTMLHeadingElement>(null);

  return (
    <div className={cn(className, 'group flex flex-col h-full')}>
      {/* Tab Section */}
      {(title || action) && (
        <div className='relative flex items-center justify-between'>
          <div className='flex items-start'>
            {title && (
              <>
                <h3
                  ref={titleRef}
                  className={`relative h-[30px] items-end flex z-10 pl-6 bg-panel heading-fourth rounded-tl-3xl ${tabClassName}`}
                >
                  <div className='-mb-2 font-bold text-ink-secondary '>
                    {title}
                  </div>
                </h3>
                <svg
                  width='60'
                  height='30'
                  viewBox='0 0 60 42'
                  xmlns='http://www.w3.org/2000/svg'
                  preserveAspectRatio='none'
                  className='block shrink-0'
                  shapeRendering='crispEdges'
                >
                  <path
                    d='M0 0H7.0783C14.772 0 21.7836 4.4132 25.111 11.3501L33.8889 29.6498C37.2164 36.5868 44.228 41 51.9217 41H60V42H0V0Z'
                    fill='var(--color-panel)'
                    className=' opacity-100'
                  />
                </svg>
              </>
            )}
          </div>
          {action && (
            <div className='pr-4 z-10 flex items-center gap-2'>{action}</div>
          )}
        </div>
      )}

      {/* Content Section */}
      <div
        className={cn(
          `bg-panel     h-full   overflow-visible ${contentClassName}`,
          title ? 'rounded-b-4xl rounded-tr-4xl ' : 'rounded-card',
          size === 'sm' && 'rounded-b-2xl rounded-tr-2xl p-4',
          size === 'md' && 'rounded-b-4xl rounded-tr-4xl p-6',
          size === 'lg' && 'rounded-b-6xl rounded-tr-6xl p-8',
        )}
      >
        {children}
      </div>
    </div>
  );
};

export default CardWithNorth;
