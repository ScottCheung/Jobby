'use client';
import type { ReactNode } from 'react';

export interface ShimmerTextProps {
  children?: ReactNode;
  active?: boolean;
  className?: string;
}

export function ShimmerText({ active = true, className = '', children, ...props }: ShimmerTextProps) {
  return (
    <span
      {...props}
      className={`${className} ${active ? 'animate-text-shimmer animate-text-shimmer-primary' : ''}`.trim()}
    >
      {children}
    </span>
  );
}
