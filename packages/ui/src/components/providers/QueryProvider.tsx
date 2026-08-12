/**
 * TanStack React Query Provider
 *
 * Provides central caching, automatic refetching, and state synchronization
 * for Next.js App Router client components.
 *
 * @format
 */

'use client';

import React, { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 1000 * 60 * 5, // Data remains fresh for 5 minutes
            gcTime: 1000 * 60 * 15, // Cache is retained for 15 minutes
            refetchOnWindowFocus: false,
            retry: 1,
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      {children as any}
    </QueryClientProvider>
  );
}
