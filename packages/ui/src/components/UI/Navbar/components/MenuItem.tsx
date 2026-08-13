'use client';
/** @format */

// components/MenuItem.tsx

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/utils/twMerge';

const MenuItem = ({
  setActive,
  active,
  item,
  type = 'card',
  children,
}: {
  setActive: (item: string) => void;
  active: string | null;
  item: string;
  type?: string;
  children?: React.ReactNode;
}) => {
  return (
    <div onMouseEnter={() => setActive(item)} className='relative'>
      <motion.button
        transition={{ duration: 0.3 }}
        className='cursor-pointer  py-3 px-3 hover:opacity-[0.5]'
      >
        <div
          className='icon-container'
          dangerouslySetInnerHTML={{ __html: item }}
        />
      </motion.button>

      {active !== null && (
        <motion.div
          initial={{ opacity: 0, scale: 0.85, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={transition}
        >
          {active === item && (
            <div className='transform left-1/2 -translate-x-1/2 absolute'>
              <motion.div
                transition={transition}
                layoutId='active'
                className={cn(
                  'bg-white border border-black/[0.2] shadow-xl mt-[1.2rem]  backdrop-blur-sm overflow-hidden darkk:bg-black darkk:border-white/[0.2]',
                  type === 'card'
                    ? 'card-rounded card-padding'
                    : ' px-2 py-1 rounded-sm',
                )}
              >
                <motion.div layout className='h-full w-max'>
                  {children}
                </motion.div>
              </motion.div>
            </div>
          )}
        </motion.div>
      )}
    </div>
  );
};

export default MenuItem;

const transition = {
  duration: 1,
  ease: [0.23, 1, 0.36, 1],
};
