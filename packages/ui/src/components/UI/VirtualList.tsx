/**
 * VirtualList — Universal Virtual Window & Infinite Scroll Component
 *
 * Renders only the items currently visible in the container viewport (+ buffer),
 * preventing DOM bloat when displaying large dataset collections.
 * Supports flexible prop interfaces for outerRef, renderRow/renderItem, rowHeight/itemHeight, etc.
 *
 * @format
 */

'use client';

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Loader2 } from 'lucide-react';

export interface VirtualListProps<T> {
  items: T[];
  itemHeight?: number;
  rowHeight?: number | (() => number);
  buffer?: number;
  overscanCount?: number;
  renderItem?: (item: T, index: number) => React.ReactNode;
  renderRow?: (item: T, index: number, style: React.CSSProperties) => React.ReactNode;
  getItemKey?: (item: T, index: number) => string | number;
  onLoadMore?: () => void;
  onEndReached?: () => void;
  hasMore?: boolean;
  isLoadingMore?: boolean;
  className?: string;
  emptyState?: React.ReactNode;
  outerRef?: (el: HTMLDivElement | null) => void;
}

export function VirtualList<T>({
  items = [],
  itemHeight,
  rowHeight = 56,
  buffer,
  overscanCount = 5,
  renderItem,
  renderRow,
  getItemKey,
  onLoadMore,
  onEndReached,
  hasMore = false,
  isLoadingMore = false,
  className = '',
  emptyState,
  outerRef,
}: VirtualListProps<T>) {
  const internalRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const [scrollTop, setScrollTop] = useState(0);
  const [containerHeight, setContainerHeight] = useState(600);

  const effectiveItemHeight = useMemo(() => {
    if (typeof itemHeight === 'number') return itemHeight;
    if (typeof rowHeight === 'number') return rowHeight;
    if (typeof rowHeight === 'function') return rowHeight();
    return 56;
  }, [itemHeight, rowHeight]);

  const effectiveBuffer = buffer ?? overscanCount ?? 5;
  const triggerLoadMore = onLoadMore || onEndReached;

  // Measure container height & listen for resize
  useEffect(() => {
    const el = internalRef.current;
    if (!el) return;

    if (outerRef) {
      outerRef(el);
    }

    const updateHeight = () => {
      setContainerHeight(el.clientHeight || 600);
    };

    updateHeight();
    const observer = new ResizeObserver(updateHeight);
    observer.observe(el);

    return () => observer.disconnect();
  }, [outerRef]);

  // Listen to scroll events
  const handleScroll = useCallback(() => {
    if (internalRef.current) {
      setScrollTop(internalRef.current.scrollTop);
    }
  }, []);

  // IntersectionObserver for infinite loading触底检测
  useEffect(() => {
    if (!triggerLoadMore || (!hasMore && !onEndReached) || isLoadingMore) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry?.isIntersecting) {
          triggerLoadMore();
        }
      },
      {
        root: internalRef.current,
        rootMargin: '200px',
        threshold: 0.1,
      },
    );

    const sentinel = sentinelRef.current;
    if (sentinel) observer.observe(sentinel);

    return () => {
      if (sentinel) observer.unobserve(sentinel);
    };
  }, [triggerLoadMore, hasMore, onEndReached, isLoadingMore]);

  // Compute virtual window range
  const totalCount = items.length;

  const { startIndex, endIndex, topSpacerHeight, bottomSpacerHeight } =
    useMemo(() => {
    const start = Math.max(0, Math.floor(scrollTop / effectiveItemHeight) - effectiveBuffer);
    const end = Math.min(
      totalCount,
      Math.ceil((scrollTop + containerHeight) / effectiveItemHeight) + effectiveBuffer,
    );
    const topSpacer = start * effectiveItemHeight;
    const bottomSpacer = Math.max(0, (totalCount - end) * effectiveItemHeight);

    return {
      startIndex: start,
      endIndex: end,
      topSpacerHeight: topSpacer,
      bottomSpacerHeight: bottomSpacer,
    };
  }, [scrollTop, effectiveItemHeight, containerHeight, totalCount, effectiveBuffer]);

  const visibleItems = useMemo(
    () => items.slice(startIndex, endIndex),
    [items, startIndex, endIndex],
  );

  const drawRow = (item: T, index: number, style?: React.CSSProperties) => {
    if (renderRow) return renderRow(item, index, style ?? { height: effectiveItemHeight });
    if (renderItem) return renderItem(item, index);
    return null;
  };

  const keyExtractor = (item: T, index: number) => {
    if (getItemKey) return getItemKey(item, index);
    if (item && typeof item === 'object' && 'id' in item) {
      return String((item as any).id);
    }
    return index;
  };

  if (items.length === 0 && !isLoadingMore) {
    return (
      <div ref={internalRef} className={`relative overflow-y-auto ${className}`}>
        {emptyState}
      </div>
    );
  }

  return (
    <div
      ref={internalRef}
      onScroll={handleScroll}
      className={`relative overflow-y-auto min-h-0 ${className}`}
    >
      {topSpacerHeight > 0 && (
        <div
          aria-hidden='true'
          style={{ height: topSpacerHeight }}
        />
      )}

      {visibleItems.map((item, idx) => {
        const actualIndex = startIndex + idx;
        const key = keyExtractor(item, actualIndex);
        const style = { height: effectiveItemHeight };
        return (
          <React.Fragment key={key}>
            {drawRow(item, actualIndex, style)}
          </React.Fragment>
        );
      })}

      {bottomSpacerHeight > 0 && (
        <div
          aria-hidden='true'
          style={{ height: bottomSpacerHeight }}
        />
      )}

      {/* Sentinel for infinite scroll */}
      <div ref={sentinelRef} className="h-4 w-full" />

      {/* Loading More Spinner */}
      {isLoadingMore && (
        <div className="flex items-center justify-center py-4 gap-2 text-ink-secondary text-sm font-medium">
          <Loader2 className="w-4 h-4 animate-spin text-primary" />
          <span>Loading more items...</span>
        </div>
      )}
    </div>
  );
}
