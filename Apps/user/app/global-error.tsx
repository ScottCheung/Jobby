/** @format */

'use client';

import { useEffect } from 'react';
import './globals.css';

export default function GlobalError({
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
    <html lang='en'>
      <body className='flex min-h-screen flex-col items-center justify-center gap-4 bg-background p-4 text-center'>
        <h2 className='text-2xl font-bold text-ink-primary'>Application Error</h2>
        <p className='text-xs text-ink-secondary'>
          {error.message || 'A critical error occurred.'}
        </p>
        <button
          type='button'
          onClick={() => reset()}
          className='rounded-lg bg-primary px-4 py-2 text-xs font-medium text-white transition hover:opacity-90'
        >
          Try again
        </button>
      </body>
    </html>
  );
}
