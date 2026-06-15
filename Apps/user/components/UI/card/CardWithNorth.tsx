/** @format */
'use client';

import React, { useRef } from 'react';
import { cn } from '@/lib/utils';

// Define the props for our new component
interface CardWithNorthProps {
  title?: string | null;
  children: React.ReactNode;
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
  children,
  className = '',
  tabClassName = '',
  contentClassName = '',
}) => {
  const titleRef = useRef<HTMLHeadingElement>(null);

  return (
    <div className={cn(className, 'group')}>
      {/* Tab Section */}
      {title && (
        <div className='relative flex items-start '>
          {/* The h3 element is now used for measuring and displaying the title */}
          <h3
            ref={titleRef}
            className={`relative h-[30px] items-end flex z-10 pl-6  bg-panel group-hover:bg-primary/20 heading-fourth rounded-tl-3xl ${tabClassName}`}
          >
            <div className='-mb-2 font-bold text-primary '>{title}</div>
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
              className='group-hover:fill-primary/20'
            />
          </svg>
        </div>
      )}

      {/* Content Section */}
      <div
        className={cn(
          `bg-panel group-hover:bg-primary/20  p-card  min-h-[100px] h-full   overflow-visible ${contentClassName}`,
          title ? 'rounded-b-3xl rounded-tr-3xl !pt-6 !pl-6' : 'rounded-card',
        )}
      >
        {children}
      </div>
    </div>
  );
};

export default CardWithNorth;
