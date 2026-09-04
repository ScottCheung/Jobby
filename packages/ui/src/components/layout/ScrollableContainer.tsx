/** @format */

'use client';

import React, { useRef, useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight } from '@jobby/ui/components/icons';
import { cn } from '@/lib/utils';
import { Stagger, StaggerItem } from '../animation/container/stagger';

export interface ScrollableContainerProps {
  children: React.ReactNode;
  className?: string;
  itemClassName?: string;
  showButtons?: boolean;
  staggerDelay?: number;
  staggerDelayChildren?: number;
}

export function ScrollableContainer({
  children,
  className,
  itemClassName,
  showButtons = true,
  staggerDelay = 0.18,
  staggerDelayChildren = 0.1,
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

    container.scrollBy({
      left: -Math.max(container.clientWidth * 0.8, 280),
      behavior: 'smooth',
    });
  };

  const handleScrollRight = () => {
    const container = containerRef.current;
    if (!container) return;

    container.scrollBy({
      left: Math.max(container.clientWidth * 0.8, 280),
      behavior: 'smooth',
    });
  };

  const buttonStyle = `group border border-primary/40 bg-panel/85 text-ink-primary hover:text-primary hover:bg-primary/10 hover:border-primary/20 backdrop-blur-md w-9 h-9 flex rounded-full justify-center items-center transition-all duration-300 shadow-xs active:scale-95 cursor-pointer`;
  const edgeMask =
    isAtStart && isAtEnd ? undefined
    : isAtStart ?
      'linear-gradient(to right, black 0, black calc(100% - 36px), transparent 100%)'
    : isAtEnd ?
      'linear-gradient(to right, transparent 0, black 36px, black 100%)'
    : 'linear-gradient(to right, transparent 0, black 36px, black calc(100% - 36px), transparent 100%)';
  const animationKey = React.Children.toArray(children)
    .map((child, index) =>
      React.isValidElement(child) && child.key ? child.key : index,
    )
    .join('|');

  return (
    <div className='flex min-w-0 max-w-full flex-col gap-2'>
      {/* Scroll controls */}
      {showButtons && (
        <div className='flex w-full items-center justify-end gap-2 pr-1'>
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

      <div
        ref={containerRef}
        style={
          edgeMask ?
            {
              maskImage: edgeMask,
              WebkitMaskImage: edgeMask,
            }
          : undefined
        }
        className={cn(
          'min-w-0 max-w-full overflow-x-auto overscroll-x-contain scroll-smooth no-scrollbar',
          className,
        )}
      >
        <Stagger
          key={animationKey}
          animateOnMount
          staggerDelay={staggerDelay}
          delayChildren={staggerDelayChildren}
          className='flex w-max min-w-full gap-4 py-2 lg:py-1'
        >
          {React.Children.map(children, (child, idx) => {
            if (!child) return null;
            const key =
              React.isValidElement(child) && child.key ? child.key : idx;
            return (
              <StaggerItem
                key={key}
                yOffset={12}
                className={cn(
                  'w-[280px] shrink-0 sm:w-[320px] lg:w-[380px]',
                  itemClassName,
                )}
              >
                {child}
              </StaggerItem>
            );
          })}
        </Stagger>
      </div>
    </div>
  );
}
