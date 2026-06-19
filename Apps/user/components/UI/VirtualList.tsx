'use client';

import React from 'react';
import { List, type RowComponentProps } from 'react-window';

type VirtualListProps<T> = {
  items: T[];
  rowHeight: number | ((index: number, item: T) => number);
  renderRow: (item: T, index: number, style: React.CSSProperties) => React.ReactElement;
  className?: string;
  overscanCount?: number;
  onEndReached?: () => void;
  scrollThreshold?: number;
};

type RowRendererProps<T> = {
  items: T[];
  renderRow: VirtualListProps<T>['renderRow'];
};

function RowRenderer<T>({
  index,
  style,
  items,
  renderRow,
}: RowComponentProps<RowRendererProps<T>>) {
  return renderRow(items[index], index, style);
}

export function VirtualList<T>({
  items,
  rowHeight,
  renderRow,
  className,
  overscanCount = 6,
  onEndReached,
  scrollThreshold = 500,
}: VirtualListProps<T>) {
  const listRef = React.useRef<any>(null);

  const handleScroll = React.useCallback(
    (event: React.UIEvent<HTMLDivElement>) => {
      if (!onEndReached) return;
      const { scrollTop, scrollHeight, clientHeight } = event.currentTarget;
      const distance = scrollHeight - scrollTop - clientHeight;
      if (distance <= scrollThreshold) {
        onEndReached();
      }
    },
    [onEndReached, scrollThreshold],
  );

  // If the items height is less than or equal to the viewport height (no scrollbar),
  // automatically trigger onEndReached to fill the viewport and enable scrolling.
  React.useEffect(() => {
    if (!onEndReached || !listRef.current?.element) return;
    const { scrollHeight, clientHeight } = listRef.current.element;
    if (scrollHeight > 0 && scrollHeight <= clientHeight) {
      onEndReached();
    }
  }, [items.length, onEndReached]);

  const getRowHeight = React.useCallback(
    (index: number) =>
      typeof rowHeight === 'function' ? rowHeight(index, items[index]) : rowHeight,
    [items, rowHeight],
  );

  return (
    <List
      className={className}
      style={{ height: '100%', width: '100%' }}
      rowCount={items.length}
      rowHeight={getRowHeight}
      rowComponent={RowRenderer}
      rowProps={{ items, renderRow }}
      overscanCount={overscanCount}
      onScroll={handleScroll}
      listRef={listRef}
    />
  );
}

