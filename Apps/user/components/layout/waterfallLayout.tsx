/** @format */

'use client';

import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';
import React, {
  ReactNode,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

type ResponsiveValue = { sm?: number; md?: number; lg?: number; xl?: number };

export interface WaterfallLayoutProps {
  children: ReactNode[];
  gap?: number | ResponsiveValue;
  className?: string;
  itemClassName?: string;
  minColumnWidth?: number | ResponsiveValue;
  padding?: boolean;
  itemScale?: number;
  /** Render only the viewport and its buffer after the initial height measurement. */
  virtualize?: boolean;
  /** The scrollable ancestor that defines the virtual viewport. */
  scrollContainerRef?: React.RefObject<HTMLElement | null>;
  overscanPx?: number;
  estimatedItemHeight?: number;
}

interface LayoutItem {
  height: number;
  width: number;
  x: number;
  y: number;
}

const DEFAULT_ESTIMATED_HEIGHT = 280;

export const WaterfallLayout: React.FC<WaterfallLayoutProps> = ({
  children,
  gap = { sm: 12, md: 16, lg: 20, xl: 24 },
  className = '',
  itemClassName = '',
  minColumnWidth = { sm: 250, md: 250, lg: 280, xl: 300 },
  padding = false,
  itemScale = 1,
  virtualize = false,
  scrollContainerRef,
  overscanPx = 800,
  estimatedItemHeight = DEFAULT_ESTIMATED_HEIGHT,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLDivElement | null)[]>([]);
  const lastColumnWidthRef = useRef<number | null>(null);
  const childArray = useMemo(() => React.Children.toArray(children), [children]);
  const [containerWidth, setContainerWidth] = useState(0);
  const [itemHeights, setItemHeights] = useState<Array<number | undefined>>([]);
  const [viewport, setViewport] = useState({ height: 0, top: 0 });

  const getColumnConfig = useCallback(
    (width: number) => {
      const numericGap =
        typeof gap === 'number' ? gap
        : width >= 1280 ? gap.xl || 24
        : width >= 1024 ? gap.lg || 20
        : width >= 768 ? gap.md || 16
        : gap.sm || 12;
      const numericMinWidth =
        typeof minColumnWidth === 'number' ? minColumnWidth
        : width >= 1280 ? minColumnWidth.xl || 300
        : width >= 1024 ? minColumnWidth.lg || 280
        : width >= 768 ? minColumnWidth.md || 250
        : minColumnWidth.sm || 200;
      const availableWidth = padding ? Math.max(0, width - 2 * numericGap) : width;
      const columnCount = Math.max(
        1,
        Math.floor((availableWidth + numericGap) / (numericMinWidth + numericGap)),
      );
      const columnWidth =
        (availableWidth - (columnCount - 1) * numericGap) / columnCount;

      return { columnCount, columnWidth, numericGap };
    },
    [gap, minColumnWidth, padding],
  );

  const columnConfig = useMemo(
    () => getColumnConfig(containerWidth),
    [containerWidth, getColumnConfig],
  );

  const { items: layoutItems, containerHeight } = useMemo(() => {
    if (!containerWidth || childArray.length === 0) {
      return { containerHeight: 0, items: [] as LayoutItem[] };
    }

    const columnHeights = new Array(columnConfig.columnCount).fill(0);
    const items = childArray.map((_, index) => {
      const minHeight = Math.min(...columnHeights);
      const columnIndex = columnHeights.indexOf(minHeight);
      const x =
        (padding ? columnConfig.numericGap : 0) +
        columnIndex * (columnConfig.columnWidth + columnConfig.numericGap);
      const y =
        minHeight +
        (minHeight > 0 ? columnConfig.numericGap : padding ? columnConfig.numericGap : 0);
      const height = (itemHeights[index] ?? estimatedItemHeight) * itemScale;

      columnHeights[columnIndex] = y + height;
      return { height, width: columnConfig.columnWidth, x, y };
    });

    return {
      items,
      containerHeight:
        Math.max(...columnHeights, 0) + (padding ? columnConfig.numericGap : 0),
    };
  }, [
    childArray,
    columnConfig,
    containerWidth,
    estimatedItemHeight,
    itemHeights,
    itemScale,
    padding,
  ]);

  const hasMeasuredInitialLayout =
    itemHeights.length > 0 &&
    itemHeights
      .slice(0, Math.min(itemHeights.length, childArray.length))
      .every(Boolean);
  const isVirtualizing = virtualize && hasMeasuredInitialLayout;

  const visibleIndexes = useMemo(() => {
    if (!isVirtualizing) return new Set(childArray.map((_, index) => index));

    const start = Math.max(0, viewport.top - overscanPx);
    const end = viewport.top + viewport.height + overscanPx;
    return new Set(
      layoutItems.flatMap((item, index) =>
        item.y + item.height >= start && item.y <= end ? [index] : [],
      ),
    );
  }, [childArray, isVirtualizing, layoutItems, overscanPx, viewport]);

  const measureItems = useCallback(() => {
    setItemHeights((previous) => {
      let changed = previous.length !== childArray.length;
      const next = childArray.map((_, index) => {
        const measuredHeight = itemRefs.current[index]?.offsetHeight;
        const height = measuredHeight && measuredHeight > 0 ? measuredHeight : previous[index];
        if (height !== previous[index]) changed = true;
        return height;
      });
      return changed ? next : previous;
    });
  }, [childArray]);

  useLayoutEffect(() => {
    measureItems();
  }, [measureItems, visibleIndexes]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const updateContainerWidth = () => setContainerWidth(el.clientWidth);
    updateContainerWidth();
    const observer = new ResizeObserver(updateContainerWidth);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const columnWidthChanged =
      lastColumnWidthRef.current !== null &&
      lastColumnWidthRef.current !== columnConfig.columnWidth;
    lastColumnWidthRef.current = columnConfig.columnWidth;

    setItemHeights((previous) => {
      if (columnWidthChanged) {
        return new Array(childArray.length).fill(undefined);
      }
      if (previous.length === childArray.length) return previous;
      return childArray.map((_, index) => previous[index]);
    });
  }, [childArray.length, columnConfig.columnWidth]);

  useEffect(() => {
    const scrollContainer = scrollContainerRef?.current;
    if (!scrollContainer) return;

    const updateViewport = () => {
      setViewport({
        height: scrollContainer.clientHeight,
        top: Math.max(
          0,
          scrollContainer.scrollTop - getOffsetTopWithin(containerRef.current, scrollContainer),
        ),
      });
    };

    updateViewport();
    scrollContainer.addEventListener('scroll', updateViewport, { passive: true });
    const observer = new ResizeObserver(updateViewport);
    observer.observe(scrollContainer);

    return () => {
      scrollContainer.removeEventListener('scroll', updateViewport);
      observer.disconnect();
    };
  }, [scrollContainerRef, scrollContainerRef?.current]);

  useEffect(() => {
    const visibleElements = itemRefs.current.filter(Boolean) as HTMLDivElement[];
    if (!visibleElements.length) return;

    const observer = new ResizeObserver(measureItems);
    visibleElements.forEach((element) => observer.observe(element));
    return () => observer.disconnect();
  }, [measureItems, visibleIndexes]);

  return (
    <div
      ref={containerRef}
      className={cn('relative w-full', className)}
      style={{ height: containerHeight }}
    >
      {childArray.map((child, index) => {
        if (!visibleIndexes.has(index)) return null;

        const item = layoutItems[index];
        if (!item) return null;
        const isSkeleton = React.isValidElement(child) && String(child.key).includes('skeleton');

        return (
          <div
            key={(React.isValidElement(child) && child.key) || index}
            ref={(el) => {
              itemRefs.current[index] = el;
            }}
            className={cn('absolute left-0 top-0', itemClassName)}
            style={{
              transform: `translate3d(${item.x}px, ${item.y}px, 0) scale(${itemScale})`,
              transformOrigin: '0 0',
              width: `${item.width / itemScale}px`,
            }}
          >
            <motion.div
              initial={isVirtualizing ? false : { opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{
                duration: isSkeleton ? 0.3 : 0.5,
                delay: isSkeleton || isVirtualizing ? 0 : 0.04 * (index % 30),
                ease: [0.22, 1.1, 0.36, 1],
              }}
            >
              {child}
            </motion.div>
          </div>
        );
      })}
    </div>
  );
};

function getOffsetTopWithin(
  element: HTMLElement | null,
  ancestor: HTMLElement,
) {
  let offset = 0;
  let current = element;

  while (current && current !== ancestor) {
    offset += current.offsetTop;
    current = current.offsetParent as HTMLElement | null;
  }

  return offset;
}
