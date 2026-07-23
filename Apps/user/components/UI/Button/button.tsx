/** @format */

import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { Loader2, LucideIcon } from 'lucide-react';
import { style } from 'framer-motion/client';
import { ref } from 'process';

/** 加载动画最短显示时长（ms），防止 API 太快导致按钮闪烁跳动 */
const MIN_LOADING_MS = 200;

const buttonVariants = cva(
  'inline-flex items-center gap-3 p-1 justify-center whitespace-nowrap rounded-full transition-all focus-visible:outline-none duration-400 focus-visible:ring-2 focus-visible:ring-primary disabled:pointer-events-none disabled:opacity-50 active:scale-95 cursor-pointer',
  {
    variants: {
      variant: {
        custom: '',
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
        toolbar:
          'text-ink-secondary hover:text-ink-primary hover:bg-primary/10  rounded-full  transition-all duration-200 active:scale-95 disabled:opacity-40 disabled:scale-100 disabled:cursor-not-allowed',
        toolbarActive:
          'text-primary hover:bg-primary/20 rounded-full text-primary transition-all duration-200 active:scale-95 disabled:opacity-40 disabled:scale-100 disabled:cursor-not-allowed',
      },
      size: {
        link: 'p-0',
        sm: 'h-[30px] px-3 font-semibold',
        md: 'h-[40px] pl-3 pr-4 font-semibold',
        icon: 'h-[40px] w-[40px] shrink-0',
        default: 'h-[48px] px-6 py-2 font-semibold',
        lg: 'title-card h-[52px] px-6 uppercase italic',
        WithIcons: 'p-1',
        toolbar: 'p-3 h-auto ',
        toolbarSm: 'px-3 py-1.5 h-auto ',
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
  layoutId?: string;
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
      layoutId,
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
      <motion.button
        layoutId={layoutId}
        transition={{
          type: 'spring',
          duration: 0.7,
          bounce: 0.2,
          ease: [0.22, 1, 0.36, 1],
        }}
        className={cn(
          buttonVariants({
            variant: resolvedVariant,
            size: resolvedSize,
            className,
          }),
          displayLoading && 'cursor-not-allowed  opacity-50',
        )}
        style={
          layoutId ?
            {
              transition: 'none',
            }
          : undefined
        }
        ref={ref as any}
        {...(props as any)}
      >
        {Icon && <Icon className={cn('size-4')} />}
        <div className={displayLoading ? 'opacity-0' : ''}>{children}</div>
        {displayLoading && <Loader2 className='size-6 animate-spin absolute' />}
      </motion.button>
    );
  },
);
Button.displayName = 'Button';

export { Button, buttonVariants };
