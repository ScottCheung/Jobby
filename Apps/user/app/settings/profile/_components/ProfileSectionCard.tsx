/** @format */

'use client';

import React from 'react';
import { CardWithNorth } from '@jobby/ui';
import { cn } from '@/lib/utils';

export interface ProfileSectionCardProps {
  id: string;
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

export function ProfileSectionCard({
  id,
  title,
  action,
  children,
  className,
}: ProfileSectionCardProps) {
  return (
    <div id={id} className={cn('scroll-mt-4 w-full', className)}>
      <CardWithNorth
        title={title}
        action={action}
        size='sm'
        className='w-full'
        contentClassName='p-4! sm:p-5!'
      >
        {children}
      </CardWithNorth>
    </div>
  );
}
