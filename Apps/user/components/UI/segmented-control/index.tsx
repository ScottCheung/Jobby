/** @format */

'use client';

import * as React from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { useId } from 'react';

interface SegmentedControlProps {
    options: {
        value: string;
        label: string;
        icon?: React.ElementType;
    }[];
    value: string;
    onChange: (value: string) => void;
    className?: string;
    size?: 'sm' | 'md' | 'lg';
}

export function SegmentedControl({
    options,
    value,
    size = 'md',
    onChange,
    className,
}: SegmentedControlProps) {
    const layoutId = useId();

    return (
        <div
            className={cn(

                size === 'sm' && 'p-0.5',
                size === 'md' && 'p-1',
                size === 'lg' && 'p-1',
                'inline-flex  bg-glass rounded-full mx-auto', className)}
        >
            {options.map((option) => {
                const isSelected = value === option.value;
                return (
                    <button
                        type='button'
                        key={option.value}
                        onClick={() => onChange(option.value)}
                        className={cn(
                            'relative flex items-center justify-center text-sm font-medium transition-colors rounded-full',
                            isSelected
                                ? 'text-primary'
                                : 'text-ink-secondary hover:text-ink-primary hover:bg-glass',
                        )}
                    >
                        {isSelected && (
                            <motion.div
                                layoutId={layoutId}
                                className='absolute inset-0 rounded-full bg-panel'
                                transition={{ type: 'spring', bounce: 0.2, duration: 0.6 }}
                            />
                        )}
                        <span
                            className={cn(
                                'relative z-10 flex justify-center items-center',

                                size === 'sm' && 'gap-1 text-xs px-3 py-2 ',
                                size === 'md' && 'gap-2 text-sm px-3 py-2 ',
                                size === 'lg' && 'gap-2.5 text-base px-4 py-2 ',
                            )}
                        >
                            {option.icon && <option.icon className='size-3.5' />}
                            {option.label}
                        </span>
                    </button>
                );
            })}
        </div>
    );
}
