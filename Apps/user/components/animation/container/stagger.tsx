/** @format */

'use client';

import { motion, HTMLMotionProps, Variants } from 'framer-motion';
import { cn } from '@/lib/utils';
import React from 'react';

export interface StaggerProps extends HTMLMotionProps<'div'> {
  staggerDelay?: number;
  delayChildren?: number;
}

const staggerVariants = (
  staggerDelay: number,
  delayChildren: number,
): Variants => ({
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: staggerDelay,
      delayChildren: delayChildren,
    },
  },
});

export function Stagger({
  children,
  className,
  staggerDelay = 0.07,
  delayChildren = 0,
  variants,
  ...props
}: StaggerProps) {
  return (
    <motion.div
      initial='hidden'
      whileInView='visible'
      viewport={{ once: true }}
      variants={variants || staggerVariants(staggerDelay, delayChildren)}
      className={cn(className)}
      {...props}
    >
      {children}
    </motion.div>
  );
}

export interface StaggerItemProps extends HTMLMotionProps<'div'> {
  yOffset?: number;
  xOffset?: number;
}

const itemVariants = (y: number, x: number): Variants => ({
  hidden: {
    opacity: 0,
    y,
    x,
    filter: 'blur(4px)',
  },
  visible: {
    opacity: 1,
    y: 0,
    x: 0,
    filter: 'blur(0px)',
    transition: {
      opacity: { duration: 0.9, ease: 'easeInOut' },
      filter: { duration: 0.7, ease: 'easeInOut' },
      y: { duration: 0.7, ease: 'easeInOut' },
      x: { duration: 0.7, ease: 'easeInOut' },
    },
  },
});

export function StaggerItem({
  children,
  className,
  yOffset = 0,
  xOffset = 0,
  variants,
  ...props
}: StaggerItemProps) {
  return (
    <motion.div
      variants={variants || itemVariants(yOffset, xOffset)}
      className={cn(className)}
      {...props}
    >
      {children}
    </motion.div>
  );
}
