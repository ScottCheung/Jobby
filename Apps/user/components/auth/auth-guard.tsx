'use client';

import React, { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useConsole } from '@/components/ConsoleContext';
import { createClient } from '@/lib/supabase/client';

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, hasLoadedInitialData } = useConsole();
  const [hasCheckedSession, setHasCheckedSession] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    async function checkAuth() {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        setIsAuthenticated(true);
      } else {
        setIsAuthenticated(false);
        const search = typeof window !== 'undefined' ? window.location.search : '';
        const target = encodeURIComponent(`${pathname}${search}`);
        router.push(`/login?next=${target}`);
      }
      setHasCheckedSession(true);
    }

    if (hasLoadedInitialData) {
      if (user) {
        setIsAuthenticated(true);
        setHasCheckedSession(true);
      } else {
        void checkAuth();
      }
    }
  }, [user, hasLoadedInitialData, pathname, router]);

  if (!hasCheckedSession) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-primary border-r-transparent" />
          <p className="text-sm mt-4 text-ink-secondary">验证身份中...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return <>{children}</>;
}
