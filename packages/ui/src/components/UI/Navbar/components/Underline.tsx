import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';

export default function Underline({
  color = 'current',
  height = 1,
  margintop = 2,
  alwaysShow = false,
}) {
  return (
    <motion.span
      initial={{ width: 0, opacity: 0 }}
      animate={{ width: '100%', opacity: alwaysShow ? 1 : 0 }}
      exit={{ width: 0, opacity: 0 }}
      transition={{ duration: 0.3 }}
      className={`absolute top-0 -bottom-${margintop} z-[99999] left-0 right-0 ${alwaysShow ? 'w-full' : 'w-0'} bg-${color}  bg-${color}-800 h-${height} rounded-full  group-hover:w-full`}
    ></motion.span>
  );
}
