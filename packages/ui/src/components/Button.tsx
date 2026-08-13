'use client';
import type { ReactNode } from 'react';

export interface ButtonProps {
  children?: ReactNode;
  loading?: boolean;
  disabled?: boolean;
  type?: 'button' | 'submit' | 'reset';
  className?: string;
  onClick?: (...args: any[]) => void;
}

export function Button({ loading = false, disabled, children, ...props }: ButtonProps) {
  const Element = 'button' as any;
  return (
    <Element {...props} disabled={disabled || loading} aria-busy={loading || undefined}>
      {children}
    </Element>
  );
}
