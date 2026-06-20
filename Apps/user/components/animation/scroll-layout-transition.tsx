/** @format */

'use client';

import React, {
  createContext,
  useContext,
  useRef,
  useState,
  useEffect,
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
  const { scrollY } = useScroll({
    container: scrollContainerRef as React.RefObject<HTMLElement>,
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
  const scale = useTransform(progress, [0, 1], [1, 0.8]);

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
  const containerRef = useRef<HTMLDivElement>(null);
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
  const opacity = useTransform(progress, [0, 0.3], [0.8, 1]);

  useEffect(() => {
    const updateDimensions = () => {
      if (topToLeftRef.current && scrollContainerRef?.current) {
        const topToLeftRect = topToLeftRef.current.getBoundingClientRect();
        const scrollContainerRect =
          scrollContainerRef.current.getBoundingClientRect();

        // 整个父容器宽度 到 父容器宽度-TopToLeft宽度的差
        const startWidth = scrollContainerRect.width;
        const endWidth = scrollContainerRect.width - topToLeftRect.width - 16; // 16px for gap-4

        // TopToLeft 的左侧 到 0
        const startX = -(topToLeftRect.width + 16); // width + gap

        // TopToLeft 的高度+40px 到 0
        const startY = topToLeftRect.height + 40;

        console.log('📐 Updating dimensions:', {
          scrollContainerWidth: scrollContainerRect.width,
          topToLeftWidth: topToLeftRect.width,
          topToLeftHeight: topToLeftRect.height,
          startWidth,
          endWidth,
          startX,
          startY,
        });

        setDimensions({
          startWidth,
          endWidth,
          startX,
          startY,
        });
      }
    };

    // Initial update
    updateDimensions();

    // Listen for window resize
    window.addEventListener('resize', updateDimensions);

    // Use ResizeObserver to track topToLeft element size changes
    let topToLeftResizeObserver: ResizeObserver | null = null;
    if (topToLeftRef.current) {
      topToLeftResizeObserver = new ResizeObserver(updateDimensions);
      topToLeftResizeObserver.observe(topToLeftRef.current);
    }

    // Use ResizeObserver to track scroll container size changes
    let scrollContainerResizeObserver: ResizeObserver | null = null;
    if (scrollContainerRef?.current) {
      scrollContainerResizeObserver = new ResizeObserver(updateDimensions);
      scrollContainerResizeObserver.observe(scrollContainerRef.current);
    }

    // Check periodically if refs become available
    const checkForElement = () => {
      if (topToLeftRef.current && !topToLeftResizeObserver) {
        topToLeftResizeObserver = new ResizeObserver(updateDimensions);
        topToLeftResizeObserver.observe(topToLeftRef.current);
        updateDimensions();
      }
      if (scrollContainerRef?.current && !scrollContainerResizeObserver) {
        scrollContainerResizeObserver = new ResizeObserver(updateDimensions);
        scrollContainerResizeObserver.observe(scrollContainerRef.current);
        updateDimensions();
      }
    };

    const intervalId = setInterval(checkForElement, 100);

    return () => {
      window.removeEventListener('resize', updateDimensions);
      topToLeftResizeObserver?.disconnect();
      scrollContainerResizeObserver?.disconnect();
      clearInterval(intervalId);
    };
  }, []); // Empty dependency array - we handle all updates internally via listeners

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

      console.log('🎬 Animation update:', {
        progress: latest,
        width: interpolatedWidth,
        x: interpolatedX,
        y: interpolatedY,
        dimensions,
      });
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
    <motion.div ref={containerRef} style={{ x, y, width }} className='flex '>
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
