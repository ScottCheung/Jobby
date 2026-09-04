/** @format */

'use client';

import { useEffect } from 'react';
import { Button } from '@jobby/ui';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className='flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center'>
      <h2 className='text-2xl font-bold text-ink-primary'>Something went wrong</h2>
      <p className='text-xs text-ink-secondary'>
        {error.message || 'An unexpected error occurred.'}
      </p>
      <Button size='sm' onClick={() => reset()}>
        Try again
      </Button>
    </div>
  );
}
