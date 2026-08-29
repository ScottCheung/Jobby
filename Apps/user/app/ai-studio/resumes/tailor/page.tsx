/** @format */

'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { TailoredResumeStudio } from '../../_components/tailored-resume-studio';

function TailoredResumesContent() {
  const searchParams = useSearchParams();
  const id = searchParams?.get('id') || undefined;

  return <TailoredResumeStudio targetId={id} />;
}

export default function TailoredResumesPage() {
  return (
    <Suspense
      fallback={
        <div className='flex min-h-[400px] items-center justify-center'>
          <Loader2 className='h-8 w-8 animate-spin text-primary' />
        </div>
      }
    >
      <TailoredResumesContent />
    </Suspense>
  );
}
