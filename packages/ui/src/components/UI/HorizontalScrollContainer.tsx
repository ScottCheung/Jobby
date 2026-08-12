/** @format */
'use client';

import { cn } from '@/lib/utils';
import { ReactNode, useRef, useState, UIEvent } from 'react';

interface HorizontalScrollContainerProps {
  children: ReactNode;
  className?: string;
  showShadows?: boolean;
}

export function HorizontalScrollContainer({
  children,
  className,
  showShadows = true,
}: HorizontalScrollContainerProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [scrollProgress, setScrollProgress] = useState(0);
  const [isAtStart, setIsAtStart] = useState(true);
  const [isAtEnd, setIsAtEnd] = useState(false);

  const handleScroll = (event: UIEvent<HTMLDivElement>) => {
    const { scrollLeft, scrollWidth, clientWidth } = event.currentTarget;
    const maxScrollLeft = scrollWidth - clientWidth;

    if (maxScrollLeft <= 0) {
      setScrollProgress(0);
      setIsAtStart(true);
      setIsAtEnd(true);
      return;
    }

    const progress = (scrollLeft / maxScrollLeft) * 100;
    setScrollProgress(progress);
    setIsAtStart(scrollLeft < 5);
    setIsAtEnd(scrollLeft > maxScrollLeft - 5);
  };

  return (
    <div className={cn('relative w-full', className)}>
      {showShadows && !isAtStart && (
        <div className='absolute left-0 top-0 bottom-4 w-6 bg-gradient-to-r from-background to-transparent z-10 pointer-events-none' />
      )}
      {showShadows && !isAtEnd && (
        <div className='absolute right-0 top-0 bottom-4 w-6 bg-gradient-to-l from-background to-transparent z-10 pointer-events-none' />
      )}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        data-progress={scrollProgress}
        className='flex overflow-x-auto scrollbar-hide gap-4 pb-4'
      >
        {children}
      </div>
    </div>
  );
}
