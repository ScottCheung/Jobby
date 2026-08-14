/** @format */

'use client';
/** @format */

import * as React from 'react';
import { cn } from '@/lib/utils';

export interface IPEmotionProps extends Omit<
  React.SVGProps<SVGSVGElement>,
  'ref'
> {
  emotionId?: number; // 0 to 15
}

const CELL_WIDTH = 350.5;
const CELL_HEIGHT = 280.5;

export function IPEmotion({
  emotionId = 0,
  className,
  style,
  viewBox: customViewBox,
  ...props
}: IPEmotionProps) {
  const safeId = Math.max(0, Math.min(15, Math.floor(emotionId)));

  // Default viewBox for single emotion (350.5 x 280.5 aspect ratio)
  const dynamicViewBox = customViewBox || `0 0 ${CELL_WIDTH} ${CELL_HEIGHT}`;

  return (
    <svg
      viewBox={dynamicViewBox}
      className={cn(
        'w-16 h-16 inline-block overflow-hidden shrink-0',
        className,
        emotionId === 15 && 'ml-[80px]',
        emotionId === 14 && 'ml-[40px]',
        emotionId === 13 && 'ml-[28px]',
        emotionId === 12 && 'mr-[20px]',
        emotionId === 11 && 'ml-[86px]',
        emotionId === 10 && 'ml-[36px]',
        emotionId === 9 && 'ml-[8px]',
        emotionId === 8 && 'mr-[18px]',
        emotionId === 7 && 'ml-[72px]',
        emotionId === 6 && 'ml-[50px]',
        emotionId === 5 && 'mr-[8px]',
        emotionId === 4 && 'mr-[24px]',
        emotionId === 3 && 'ml-[80px]',
        emotionId === 2 && 'ml-[20px]',
        emotionId === 1 && 'mr-[12px]',
        emotionId === 0 && 'mr-[24px]',
      )}
      style={style}
      {...props}
    >
      <use href={`/IP.svg#ip-${safeId}`} />
    </svg>
  );
}
