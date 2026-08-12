/** @format */

'use client';

import React, {
  createContext,
  useContext,
  useRef,
  useState,
  useEffect,
  useCallback,
} from 'react';
import {
  motion,
  useScroll,
  useTransform,
  MotionValue,
  useMotionValue,
} from 'framer-motion';

const ScrollLayoutContext = createContext<{
  progress: MotionValue<number>;
  topToLeftRef: React.RefObject<HTMLDivElement | null>;
  scrollContainerRef?: React.RefObject<HTMLElement | null>;
} | null>(null);

type ScrollLayoutProps = {
  children: React.ReactNode;
  progressRange?: [number, number];
  scrollContainerRef?: React.RefObject<HTMLElement | null>;
  heightRange?: [number, number];
};

const ScrollLayoutRoot: React.FC<ScrollLayoutProps> = ({
  children,
  progressRange = [0, 200],
  scrollContainerRef,
  heightRange,
}) => {
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const hasContainer =
    isMounted && scrollContainerRef && scrollContainerRef.current;
  const { scrollY } = useScroll({
    container:
      hasContainer ?
        (scrollContainerRef as React.RefObject<HTMLElement>)
      : undefined,
  });
  const topToLeftRef = useRef<HTMLDivElement>(null);

  const progress = useTransform(scrollY, progressRange, [0, 1], {
    clamp: true,
  });
  const y = useTransform(progress, [0, 1], [-40, 0]);
  const height = useTransform(progress, [0, 1], heightRange || [110, 110]);

  return (
    <ScrollLayoutContext.Provider
      value={{ progress, topToLeftRef, scrollContainerRef }}
    >
      <motion.div
        className='flex items-center gap-4  w-full relative'
        style={heightRange ? { y, height } : { y }}
      >
        {children}
      </motion.div>
    </ScrollLayoutContext.Provider>
  );
};

const TopToLeft: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { progress, topToLeftRef } = useContext(ScrollLayoutContext)!;

  const y = useTransform(progress, [0, 1], [30, 0]);
  const scale = useTransform(progress, [0, 1], [1, 0.9]);

  return (
    <motion.div ref={topToLeftRef} className='shrink-0'>
      <motion.div className=' ' style={{ y, scale }}>
        {children}
      </motion.div>
    </motion.div>
  );
};

const BtmToRight: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { progress, topToLeftRef, scrollContainerRef } =
    useContext(ScrollLayoutContext)!;
  const [dimensions, setDimensions] = useState({
    startWidth: 0,
    endWidth: 0,
    startX: 0,
    startY: 0,
  });

  // Create motion values that can be updated dynamically
  const width = useMotionValue(dimensions.startWidth);
  const x = useMotionValue(dimensions.startX);
  const y = useMotionValue(dimensions.startY);

  const updateDimensions = useCallback(() => {
    if (!topToLeftRef.current || !scrollContainerRef?.current) {
      return;
    }

    const topToLeftRect = topToLeftRef.current.getBoundingClientRect();
    const scrollContainerRect =
      scrollContainerRef.current.getBoundingClientRect();

    const startWidth = scrollContainerRect.width;
    const endWidth = Math.max(0, startWidth - topToLeftRect.width - 16);
    const startX = -(topToLeftRect.width + 16);
    const startY = topToLeftRect.height + 40;

    setDimensions((previous) => {
      if (
        previous.startWidth === startWidth &&
        previous.endWidth === endWidth &&
        previous.startX === startX &&
        previous.startY === startY
      ) {
        return previous;
      }

      return {
        startWidth,
        endWidth,
        startX,
        startY,
      };
    });
  }, [scrollContainerRef, topToLeftRef]);

  useEffect(() => {
    if (!topToLeftRef.current || !scrollContainerRef?.current) {
      return;
    }

    let frameId = 0;
    const scheduleUpdate = () => {
      cancelAnimationFrame(frameId);
      frameId = window.requestAnimationFrame(updateDimensions);
    };

    scheduleUpdate();

    const topToLeftResizeObserver = new ResizeObserver(scheduleUpdate);
    topToLeftResizeObserver.observe(topToLeftRef.current);

    const scrollContainerResizeObserver = new ResizeObserver(scheduleUpdate);
    scrollContainerResizeObserver.observe(scrollContainerRef.current);

    window.addEventListener('resize', scheduleUpdate);

    return () => {
      cancelAnimationFrame(frameId);
      window.removeEventListener('resize', scheduleUpdate);
      topToLeftResizeObserver.disconnect();
      scrollContainerResizeObserver.disconnect();
    };
  }, [scrollContainerRef, topToLeftRef, updateDimensions]);

  // Update motion values when progress or dimensions change
  useEffect(() => {
    const unsubscribe = progress.on('change', (latest) => {
      // Interpolate width
      const interpolatedWidth =
        dimensions.startWidth +
        (dimensions.endWidth - dimensions.startWidth) * latest;
      width.set(interpolatedWidth);

      // Interpolate x
      const interpolatedX =
        dimensions.startX + (0 - dimensions.startX) * latest;
      x.set(interpolatedX);

      // Interpolate y
      const interpolatedY =
        dimensions.startY + (0 - dimensions.startY) * latest;
      y.set(interpolatedY);
    });

    // Set initial values
    const currentProgress = progress.get();
    width.set(
      dimensions.startWidth +
        (dimensions.endWidth - dimensions.startWidth) * currentProgress,
    );
    x.set(dimensions.startX + (0 - dimensions.startX) * currentProgress);
    y.set(dimensions.startY + (0 - dimensions.startY) * currentProgress);

    return () => unsubscribe();
  }, [progress, dimensions, width, x, y]);

  return (
    <motion.div style={{ x, y, width }} className='flex'>
      {children}
    </motion.div>
  );
};

export const Static: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  return <div className=''>{children}</div>;
};

// Compound component construction with proper typing
export const ScrollLayout = Object.assign(ScrollLayoutRoot, {
  BtmToRight,
  TopToLeft,
});
