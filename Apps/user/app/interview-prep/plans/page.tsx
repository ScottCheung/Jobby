'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function PlansRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/interview-prep');
  }, [router]);
  return (
    <div className='flex items-center justify-center h-full text-ink-secondary'>
      Redirecting to Dashboard...
    </div>
  );
}
