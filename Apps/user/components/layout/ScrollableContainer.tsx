/** @format */

'use client';

import React, { useRef, useState, useEffect } from 'react';
import { motion, Variants } from 'framer-motion';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface ScrollableContainerProps {
  children: React.ReactNode;
  className?: string;
  itemClassName?: string;
  showButtons?: boolean;
}

const staggerVariants = (
  staggerDelay: number = 0.05,
  delayChildren: number = 0,
): Variants => ({
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: staggerDelay,
      delayChildren: delayChildren,
    },
  },
});

const itemVariants = (y: number = 15, x: number = 0): Variants => ({
  hidden: {
    opacity: 0,
    y,
    x,
  },
  visible: {
    opacity: 1,
    y: 0,
    x: 0,
    transition: {
      opacity: { duration: 0.9, ease: 'easeInOut' },
      y: { duration: 0.7, ease: 'easeInOut' },
    },
  },
});

export function ScrollableContainer({
  children,
  className,
  itemClassName,
  showButtons = true,
}: ScrollableContainerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isAtStart, setIsAtStart] = useState(true);
  const [isAtEnd, setIsAtEnd] = useState(false);

  const handleScroll = () => {
    const container = containerRef.current;
    if (!container) return;

    const atStart = container.scrollLeft <= 5;
    const atEnd =
      container.scrollLeft + container.offsetWidth >= container.scrollWidth - 5;

    setIsAtStart(atStart);
    setIsAtEnd(atEnd);
  };

  useEffect(() => {
    const container = containerRef.current;
    if (container) {
      container.addEventListener('scroll', handleScroll);
      // Run once initially to set starting state
      handleScroll();

      // Also run when children update to check for new scroll bounds
      const resizeObserver = new ResizeObserver(() => {
        handleScroll();
      });
      resizeObserver.observe(container);

      return () => {
        container.removeEventListener('scroll', handleScroll);
        resizeObserver.disconnect();
      };
    }
  }, [children]);

  const handleScrollLeft = () => {
    const container = containerRef.current;
    if (!container) return;

    const child = container.firstElementChild as HTMLElement;
    const scrollAmount = child ? child.offsetWidth + 16 : 300; // default to 16px gap
    container.scrollBy({ left: -scrollAmount, behavior: 'smooth' });
  };

  const handleScrollRight = () => {
    const container = containerRef.current;
    if (!container) return;

    const child = container.firstElementChild as HTMLElement;
    const scrollAmount = child ? child.offsetWidth + 16 : 300; // default to 16px gap
    container.scrollBy({ left: scrollAmount, behavior: 'smooth' });
  };

  const buttonStyle = `group border border-border/40 bg-panel/85 text-ink-primary hover:text-primary hover:bg-primary/10 hover:border-primary/20 backdrop-blur-md w-9 h-9 flex rounded-full justify-center items-center transition-all duration-300 shadow-xs active:scale-95 cursor-pointer`;

  return (
    <div className='w-full flex flex-col gap-2'>
      {/* Scroll controls */}
      {showButtons && (
        <div className='hidden lg:flex items-center justify-end gap-2 w-full pr-1'>
          <button
            onClick={handleScrollLeft}
            disabled={isAtStart}
            className={buttonStyle}
            style={{
              opacity: isAtStart ? 0.35 : 1,
              cursor: isAtStart ? 'not-allowed' : 'pointer',
            }}
            aria-label='Scroll left'
          >
            <ChevronLeft className='h-4.5 w-4.5' />
          </button>
          <button
            onClick={handleScrollRight}
            disabled={isAtEnd}
            className={buttonStyle}
            style={{
              opacity: isAtEnd ? 0.35 : 1,
              cursor: isAtEnd ? 'not-allowed' : 'pointer',
            }}
            aria-label='Scroll right'
          >
            <ChevronRight className='h-4.5 w-4.5' />
          </button>
        </div>
      )}

      {/* Main List Container */}
      <motion.div
        ref={containerRef}
        initial={false}
        animate='visible'
        variants={staggerVariants()}
        className={cn(
          'w-full grid grid-cols-12 gap-4 py-2 z-10',
          'lg:flex lg:flex-row lg:overflow-x-auto lg:no-scrollbar lg:py-1',
          className,
        )}
      >
        {React.Children.map(children, (child, idx) => {
          if (!child) return null;
          const key = React.isValidElement(child) && child.key ? child.key : idx;
          return (
            <motion.div
              key={key}
              variants={itemVariants(15, 0)}
              className={cn(
                'col-span-12 sm:col-span-6 lg:w-[380px] lg:shrink-0 lg:h-full',
                itemClassName,
              )}
            >
              {child}
            </motion.div>
          );
        })}
      </motion.div>
    </div>
  );
}
