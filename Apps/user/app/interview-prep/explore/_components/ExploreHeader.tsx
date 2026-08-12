/** @format */

'use client';

import { Compass, Plus } from 'lucide-react';
import { Button } from '@jobby/ui';

type ExploreHeaderProps = {
  onCreateSet: () => void;
};

export function ExploreHeader({ onCreateSet }: ExploreHeaderProps) {
  return (
    <header className='shrink-0 border-b border-border/40 px-5 py-5'>
      <div className='flex flex-col gap-4'>
        <div className='flex flex-wrap items-center justify-between gap-3'>
          <div>
            <h1 className='title-page flex items-center gap-2'>
              <Compass className='h-5 w-5 text-primary' />
              Explore
            </h1>
            <p className='body-sm mt-1 text-ink-secondary'>
              Find fresh questions, tailored practice, and Question Sets worth
              your time.
            </p>
          </div>
          <Button onClick={onCreateSet} Icon={Plus}>
            Create Question Set
          </Button>
        </div>

      </div>
    </header>
  );
}
