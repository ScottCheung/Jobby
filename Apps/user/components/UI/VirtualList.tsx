'use client';

import React from 'react';

type VirtualListProps<T> = {
  items: T[];
  rowHeight: number | ((index: number, item: T) => number);
  renderRow: (
    item: T,
    index: number,
    style: React.CSSProperties,
  ) => React.ReactElement;
  className?: string;
  overscanCount?: number;
  onEndReached?: () => void;
  onScroll?: (event: React.UIEvent<HTMLDivElement>) => void;
  scrollThreshold?: number;
  outerRef?: React.Ref<HTMLDivElement>;
};

function assignRef<T>(ref: React.Ref<T> | undefined, value: T) {
  if (!ref) return;
  if (typeof ref === 'function') {
    ref(value);
    return;
  }
  (ref as React.MutableRefObject<T>).current = value;
}

export function VirtualList<T>({
  items,
  rowHeight,
  renderRow,
  className,
  overscanCount = 6,
  onEndReached,
  onScroll,
  scrollThreshold = 500,
  outerRef,
}: VirtualListProps<T>) {
  const viewportRef = React.useRef<HTMLDivElement | null>(null);
  const rafIdRef = React.useRef<number | null>(null);
  const endReachedLockedRef = React.useRef(false);
  const [scrollTop, setScrollTop] = React.useState(0);
  const [viewportHeight, setViewportHeight] = React.useState(0);

  const resolvedRowHeight = React.useMemo(() => {
    if (typeof rowHeight === 'number') {
      return rowHeight;
    }
    if (items.length === 0) {
      return 0;
    }
    return rowHeight(0, items[0]);
  }, [items, rowHeight]);

  const totalHeight = items.length * resolvedRowHeight;

  const setCombinedRef = React.useCallback(
    (node: HTMLDivElement | null) => {
      viewportRef.current = node;
      if (node) {
        assignRef(outerRef, node);
        setViewportHeight(node.clientHeight);
        return;
      }
      assignRef(outerRef, node as any);
    },
    [outerRef],
  );

  const checkEndReached = React.useCallback(
    (element: HTMLDivElement) => {
      if (!onEndReached) return;
      const distance = element.scrollHeight - element.scrollTop - element.clientHeight;

      if (distance <= scrollThreshold) {
        if (!endReachedLockedRef.current) {
          endReachedLockedRef.current = true;
          onEndReached();
        }
        return;
      }

      endReachedLockedRef.current = false;
    },
    [onEndReached, scrollThreshold],
  );

  const handleScroll = React.useCallback(
    (event: React.UIEvent<HTMLDivElement>) => {
      const currentTarget = event.currentTarget;

      if (rafIdRef.current !== null) {
        return;
      }

      rafIdRef.current = window.requestAnimationFrame(() => {
        rafIdRef.current = null;
        setScrollTop(currentTarget.scrollTop);

        if (onScroll) {
          onScroll(event);
        }

        checkEndReached(currentTarget);
      });
    },
    [checkEndReached, onScroll],
  );

  React.useEffect(() => {
    const element = viewportRef.current;
    if (!element || typeof ResizeObserver === 'undefined') {
      return;
    }

    const observer = new ResizeObserver(() => {
      setViewportHeight(element.clientHeight);
      checkEndReached(element);
    });

    observer.observe(element);
    return () => observer.disconnect();
  }, [checkEndReached]);

  React.useEffect(() => {
    const element = viewportRef.current;
    if (!element) return;

    endReachedLockedRef.current = false;
    setViewportHeight(element.clientHeight);
    checkEndReached(element);
  }, [checkEndReached, items]);

  React.useEffect(() => {
    return () => {
      if (rafIdRef.current !== null) {
        window.cancelAnimationFrame(rafIdRef.current);
      }
    };
  }, []);

  if (resolvedRowHeight <= 0) {
    return (
      <div
        ref={setCombinedRef}
        className={className}
        style={{ height: '100%', width: '100%', overflow: 'auto' }}
        onScroll={handleScroll}
      />
    );
  }

  const visibleStartIndex = Math.max(
    0,
    Math.floor(scrollTop / resolvedRowHeight) - overscanCount,
  );
  const visibleEndIndex = Math.min(
    items.length - 1,
    Math.ceil((scrollTop + viewportHeight) / resolvedRowHeight) + overscanCount - 1,
  );

  const visibleRows: React.ReactElement[] = [];
  for (let index = visibleStartIndex; index <= visibleEndIndex; index += 1) {
    const item = items[index];
    if (item === undefined) continue;

    visibleRows.push(
      renderRow(item, index, {
        position: 'absolute',
        top: index * resolvedRowHeight,
        left: 0,
        width: '100%',
        height: resolvedRowHeight,
      }),
    );
  }

  return (
    <div
      ref={setCombinedRef}
      className={className}
      style={{ height: '100%', width: '100%', overflow: 'auto' }}
      onScroll={handleScroll}
    >
      <div
        style={{
          position: 'relative',
          height: totalHeight,
          width: '100%',
        }}
      >
        {visibleRows}
      </div>
    </div>
  );
}
