/** @format */

'use client';

import { Suspense, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';

function JobReviewRedirect() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const id = searchParams?.get('id');
    if (id) {
      router.replace(`/ai-studio/resumes/tailor/${id}`);
    } else {
      router.replace('/ai-studio/resumes/tailor');
    }
  }, [router, searchParams]);

  return (
    <div className='flex min-h-[400px] items-center justify-center gap-2'>
      <Loader2 className='h-6 w-6 animate-spin text-primary' />
      <span className='text-xs font-medium text-ink-secondary'>
        Redirecting to AI Studio...
      </span>
    </div>
  );
}

export default function JobReviewPage() {
  return (
    <Suspense
      fallback={
        <div className='flex min-h-[400px] items-center justify-center'>
          <Loader2 className='h-8 w-8 animate-spin text-primary' />
        </div>
      }
    >
      <JobReviewRedirect />
    </Suspense>
  );
}
