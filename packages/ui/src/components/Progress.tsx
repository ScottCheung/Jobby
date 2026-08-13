'use client';
export interface ProgressProps {
  value: number;
  max?: number;
  className?: string;
}

export function Progress({ value, max = 100, ...props }: ProgressProps) {
  const percentage = max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0;
  const Element = 'span' as any;
  return (
    <Element {...props} role='progressbar' aria-valuemin={0} aria-valuemax={max} aria-valuenow={value}>
      <span style={{ width: `${percentage}%` }} />
    </Element>
  );
}
