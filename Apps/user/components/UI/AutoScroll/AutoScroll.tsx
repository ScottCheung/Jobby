/** @format */

'use client';
import { cn } from '@/lib/utils';
import {
  motion,
  useAnimationFrame,
  useInView,
  useMotionValue,
  useReducedMotion,
} from 'framer-motion';
import React, {
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  useId,
} from 'react';

export interface AutoScrollProps {
  /** The content to be scrolled */
  children: React.ReactNode;
  /** Additional class names */
  className?: string;
  /** Scroll speed in pixels per second */
  speed?: number;
  /** Whether to pause on hover */
  pauseOnHover?: boolean;
  /** Whether to show gradient edges */
  gradient?: boolean;
  /** Direction of scroll */
  direction?: 'left' | 'right';
  /** Gap between repeated content */
  gap?: number;
  /** Whether to start scrolling automatically */
  autoStart?: boolean;
  /** Delay before starting scroll in milliseconds */
  delay?: number;
}

export const AutoScroll = React.forwardRef<HTMLDivElement, AutoScrollProps>(
  (
    {
      children,
      className,
      speed = 10,
      pauseOnHover = true,
      gradient = true,
      direction = 'left',
      gap = 0,
      autoStart = true,
      delay = 0,
    },
    ref,
  ) => {
    const shouldReduceMotion = useReducedMotion();
    const marqueeRef = useRef<HTMLDivElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const uniqueId = useId();

    useImperativeHandle(ref, () => containerRef.current as HTMLDivElement);

    const isInView = useInView(containerRef, { once: false, margin: '200px' });
    const [isHovered, setIsHovered] = useState(false);
    const [isStarted, setIsStarted] = useState(false);

    useEffect(() => {
      const timer = setTimeout(() => setIsStarted(true), Math.max(0, delay));
      return () => clearTimeout(timer);
    }, [delay]);

    const x = useMotionValue(0);
    const pixelsPerSecond = speed * 10;

    useAnimationFrame((time, delta) => {
      const marqueeEl = marqueeRef.current;
      if (!marqueeEl) return;

      const shouldAnimate =
        isStarted && isInView && !isHovered && autoStart && !shouldReduceMotion;
      if (!shouldAnimate) return;

      const travelDistance = delta * (pixelsPerSecond / 1000);
      const moveBy = direction === 'left' ? -travelDistance : travelDistance;

      const halfWidth = marqueeEl.scrollWidth / 2;
      let newX = x.get() + moveBy;

      if (direction === 'left' && newX <= -halfWidth) {
        newX += halfWidth;
      }

      if (direction === 'right' && newX >= 0) {
        newX -= halfWidth;
      }

      x.set(newX);
    });

    useEffect(() => {
      if (direction === 'right' && marqueeRef.current) {
        x.set(-marqueeRef.current.scrollWidth / 2);
      } else {
        x.set(0);
      }
    }, [direction, children, x]);

    // Don't animate if user prefers reduced motion
    if (shouldReduceMotion) {
      return (
        <div ref={containerRef} className={cn('overflow-hidden', className)}>
          <div className='whitespace-nowrap'>{children}</div>
        </div>
      );
    }

    return (
      <div
        ref={containerRef}
        className={cn(
          'relative overflow-hidden max-w-screen',
          gradient && 'mask-gradient',
          className,
        )}
        onMouseEnter={() => pauseOnHover && setIsHovered(true)}
        onMouseLeave={() => pauseOnHover && setIsHovered(false)}
        style={
          gradient
            ? {
                WebkitMaskImage:
                  'linear-gradient(to right, transparent, white 5%, white 95%, transparent 100%)',
                maskImage:
                  'linear-gradient(to right, transparent, white 5%, white 95%, transparent 100%)',
              }
            : undefined
        }
      >
        <motion.div
          ref={marqueeRef}
          className='flex whitespace-nowrap '
          style={{ x }}
        >
          {Array.from({ length: 10 }).map((_, index) => (
            <div
              key={`${uniqueId}-${index}`}
              className='shrink-0'
              style={{ marginRight: `${gap}px` }}
            >
              {children}
            </div>
          ))}
        </motion.div>
      </div>
    );
  },
);

AutoScroll.displayName = 'AutoScroll';
