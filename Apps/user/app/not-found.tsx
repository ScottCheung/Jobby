/** @format */

'use client';

import Link from 'next/link';
import { Button } from '@jobby/ui';

export default function NotFound() {
  return (
    <div className='flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center'>
      <h2 className='text-2xl font-bold text-ink-primary'>Page Not Found</h2>
      <p className='text-xs text-ink-secondary'>Could not find the requested resource.</p>
      <Link href='/'>
        <Button size='sm'>Return Home</Button>
      </Link>
    </div>
  );
}
