'use client';
/** @format */

import * as React from 'react';
import { cn } from '@/lib/utils';

export interface IPEmotionProps extends React.SVGProps<SVGSVGElement> {
  emotionId?: number; // 0 to 15
}

const CELL_WIDTH = 350.5;
const CELL_HEIGHT = 280.5;
const COLS = 4;

export function IPEmotion({
  emotionId = 0,
  className,
  style,
  viewBox: customViewBox,
  ...props
}: IPEmotionProps) {
  const safeId = Math.max(0, Math.min(15, Math.floor(emotionId)));
  const col = safeId % COLS;
  const row = Math.floor(safeId / COLS);

  // Default viewBox for single emotion (350.5 x 280.5 aspect ratio)
  const dynamicViewBox =
    customViewBox || `0 0 ${CELL_WIDTH} ${CELL_HEIGHT}`;

  return (
    <svg
      viewBox={dynamicViewBox}
      className={cn(
        'w-16 h-16 inline-block overflow-hidden shrink-0',
        className,
      )}
      style={style}
      {...props}
    >
      <use href={`/IP.svg#ip-${safeId}`} />
    </svg>
  );
}

