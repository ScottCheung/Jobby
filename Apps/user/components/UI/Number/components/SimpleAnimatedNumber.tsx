import { motion } from 'framer-motion';
import React, { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { formatNumberValue } from '../utils/numberFormatters';

interface AnimatedNumberProps {
  value: number;
  useShortFormat?: boolean;
  maxSignificantDigits?: number;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  fontWeight?: 'normal' | 'medium' | 'semibold' | 'bold';
  textColor?: string;
  animate?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * Simple animated number component that displays a number with animation
 * Supports short format (K, M, B) or significant digits formatting
 */
export const SimpleAnimatedNumber: React.FC<AnimatedNumberProps> = ({
  value,
  useShortFormat = false,
  maxSignificantDigits = 3,
  size = 'md',
  fontWeight = 'semibold',
  textColor = 'text-gray-700',
  animate = true,
  className,
  style,
}) => {
  const [displayValue, setDisplayValue] = useState<string>('0');

  // Size class mapping
  const sizeClasses = {
    sm: 'text-sm',
    md: 'text-base',
    lg: 'text-lg',
    xl: 'text-xl',
  };

  // Weight class mapping
  const weightClasses = {
    normal: 'font-normal',
    medium: 'font-medium',
    semibold: 'font-semibold',
    bold: 'font-bold',
  };

  useEffect(() => {
    // Format number based on configuration
    // useShortFormat and maxSignificantDigits are mutually exclusive
    const formatted = formatNumberValue(value, useShortFormat, maxSignificantDigits);
    setDisplayValue(formatted);
  }, [value, useShortFormat, maxSignificantDigits]);

  // Split the formatted value into individual characters for animation
  const digits = displayValue.split('');

  // Animation variants
  const variants = {
    initial: { opacity: 0, y: 10 },
    animate: { opacity: 1, y: 0 },
  };

  return (
    <div
      className={cn(
        'flex items-center tabular-nums',
        sizeClasses[size],
        weightClasses[fontWeight],
        textColor,
        className
      )}
      style={style}
    >
      {digits.map((char, index) => (
        <motion.div
          key={`${index}-${char}`}
          variants={animate ? variants : undefined}
          initial={animate ? 'initial' : undefined}
          animate={animate ? 'animate' : undefined}
          transition={{
            duration: 0.3,
            delay: animate ? index * 0.05 : 0,
            ease: 'easeOut'
          }}
        >
          {char}
        </motion.div>
      ))}
    </div>
  );
};