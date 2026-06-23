/** @format */

import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';
import { Loader2, LucideIcon } from 'lucide-react';

/** 加载动画最短显示时长（ms），防止 API 太快导致按钮闪烁跳动 */
const MIN_LOADING_MS = 200;

const buttonVariants = cva(
  'inline-flex items-center gap-3 p-1 justify-center whitespace-nowrap rounded-full transition-all focus-visible:outline-none duration-400 focus-visible:ring-2 focus-visible:ring-primary disabled:pointer-events-none disabled:opacity-50 active:scale-95 cursor-pointer',
  {
    variants: {
      variant: {
        default:
          'bg-primary-gradient hover:bg-primary text-primary-foreground ',
        secondary:
          'border border-transparent hover:bg-primary/5 backdrop-blur-[20px]  bg-background text-ink-primary hover:text-primary',
        destructive:
          'bg-destructive  hover:bg-destructive/80 text-destructive-foreground',
        outline:
          'border border-primary  text-primary hover:bg-primary  hover:text-primary-foreground',
        icon: 'bg-glass text-ink-secondary hover:bg-primary/90 hover:text-primary-foreground rounded-full ',
        ghost:
          'text-ink-primary bg-ink-secondary/20 hover:bg-primary/50 hover:text-primary-foreground',
        link: 'text-primary underline-offset-4 hover:underline',
      },
      size: {
        link: 'p-0',
        sm: 'h-[40px] px-3 font-semibold',
        icon: 'h-[40px] w-[40px] shrink-0',
        default: 'h-[48px] px-6 py-2 font-semibold',
        lg: 'h-[52px]  px-6 text-lg font-semibold uppercase italic',
        WithIcons: 'p-1',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
);

export interface ButtonProps
  extends
    React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  Icon?: LucideIcon;
  isLoading?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant,
      size,
      asChild = false,
      Icon,
      children,
      isLoading = false,
      ...props
    },
    ref,
  ) => {
    const resolvedVariant = variant || (Icon && !children ? 'icon' : undefined);
    const resolvedSize = size || (Icon && !children ? 'icon' : undefined);

    const [latch, setLatch] = React.useState(false);
    const timerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

    React.useEffect(() => {
      if (isLoading) {
        if (timerRef.current) clearTimeout(timerRef.current);
        setLatch(true);
      } else {
        timerRef.current = setTimeout(() => {
          setLatch(false);
        }, MIN_LOADING_MS);
      }
      return () => {
        if (timerRef.current) clearTimeout(timerRef.current);
      };
    }, [isLoading]);

    const displayLoading = isLoading || latch;

    return (
      <button
        className={cn(
          buttonVariants({
            variant: resolvedVariant,
            size: resolvedSize,
            className,
          }),
          displayLoading && 'cursor-not-allowed opacity-50',
        )}
        ref={ref}
        {...props}
      >
        {Icon && !displayLoading && <Icon className={cn('size-4')} />}
        <div className={displayLoading ? 'opacity-0' : ''}>{children}</div>
        {displayLoading && <Loader2 className='size-6 animate-spin absolute' />}
      </button>
    );
  },
);
Button.displayName = 'Button';

export { Button, buttonVariants };
