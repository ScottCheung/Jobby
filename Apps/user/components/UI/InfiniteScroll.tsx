/** @format */
'use client';

import { useEffect, useRef, useCallback } from 'react';

interface InfiniteScrollProps {
  onLoadMore: () => void;
  hasMore: boolean;
  loading: boolean;
  children: React.ReactNode;
  threshold?: number;
}

export function InfiniteScroll({
  onLoadMore,
  hasMore,
  loading,
  children,
  threshold = 100,
}: InfiniteScrollProps) {
  const observerRef = useRef<IntersectionObserver | null>(null);
  const loadingRef = useRef<HTMLDivElement>(null);

  const handleObserver = useCallback(
    (entries: IntersectionObserverEntry[]) => {
      const [target] = entries;
      if (target.isIntersecting && hasMore && !loading) {
        onLoadMore();
      }
    },
    [hasMore, loading, onLoadMore]
  );

  useEffect(() => {
    const element = loadingRef.current;
    if (element) {
      observerRef.current = new IntersectionObserver(handleObserver, {
        rootMargin: `${threshold}px`,
      });
      observerRef.current.observe(element);
    }

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, [handleObserver, threshold]);

  return (
    <div>
      {children}
      {hasMore && (
        <div ref={loadingRef} className='py-4 text-center'>
          {loading ? (
            <div className='flex justify-center items-center h-screen'>
              <div className='w-6 h-6 rounded-full border-b-2 border-yellow-400 animate-spin'></div>
              <span className='ml-2 text-gray-500'>Loading more...</span>
            </div>
          ) : (
            <div className='h-4' />
          )}
        </div>
      )}
    </div>
  );
}
