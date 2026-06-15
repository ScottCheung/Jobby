import React, { useEffect } from 'react';
import { motion, Variants } from 'framer-motion';

interface AnimatedIconProps {
  className?: string;
  color?: string;
  icon: 'success' | 'error' | 'warning' | 'info';
}

const iconVariants: Variants = {
  hidden: { pathLength: 0, opacity: 0 },
  visible: (i: number) => ({
    pathLength: 1,
    opacity: 1,
    transition: {
      delay: i * 0.2 + 0.5,
      duration: 0.5,
      ease: 'easeInOut',
    },
  }),
};

const svgPaths = {
  success: [
    <motion.circle
      key='circle'
      fill='none'
      strokeWidth='12'
      cx='50'
      cy='50'
      r='46'
      strokeLinecap='round'
      transform='rotate(-90 50 50)'
      custom={0}
      variants={iconVariants}
    />,
    <motion.polyline
      key='tick'
      fill='none'
      strokeWidth='12'
      points='25,55 45,75 75,35'
      strokeLinecap='round'
      strokeLinejoin='round'
      custom={1}
      variants={iconVariants}
    />,
  ],
  error: [
    <motion.circle
      key='circle'
      fill='none'
      strokeWidth='12'
      cx='50'
      cy='50'
      r='46'
      strokeLinecap='round'
      transform='rotate(-90 50 50)'
      custom={0}
      variants={iconVariants}
    />,
    <motion.line
      key='line1'
      x1='35'
      y1='35'
      x2='65'
      y2='65'
      strokeWidth='12'
      strokeLinecap='round'
      custom={1}
      variants={iconVariants}
    />,
    <motion.line
      key='line2'
      x1='65'
      y1='35'
      x2='35'
      y2='65'
      strokeWidth='12'
      strokeLinecap='round'
      custom={1}
      variants={iconVariants}
    />,
  ],
  warning: [
    <motion.path
      key='triangle'
      d='M50 10 L90 80 L10 80 Z'
      strokeWidth='12'
      strokeLinejoin='round'
      strokeLinecap='round'
      fill='none'
      custom={0}
      variants={iconVariants}
    />,
    <motion.line
      key='line'
      x1='50'
      y1='40'
      x2='50'
      y2='60'
      strokeWidth='12'
      strokeLinecap='round'
      custom={1}
      variants={iconVariants}
    />,
    <motion.circle
      key='dot'
      cx='50'
      cy='75'
      r='1'
      fill='currentColor'
      custom={1}
      variants={iconVariants}
    />,
  ],
  info: [
    <motion.circle
      key='circle'
      fill='none'
      strokeWidth='12'
      cx='50'
      cy='50'
      r='46'
      strokeLinecap='round'
      transform='rotate(-90 50 50)'
      custom={0}
      variants={iconVariants}
    />,
    <motion.line
      key='line'
      x1='50'
      y1='45'
      x2='50'
      y2='70'
      strokeWidth='12'
      strokeLinecap='round'
      custom={1}
      variants={iconVariants}
    />,
    <motion.circle
      key='dot'
      cx='50'
      cy='30'
      r='1'
      fill='currentColor'
      custom={1}
      variants={iconVariants}
    />,
  ],
};

const AnimatedIcon: React.FC<AnimatedIconProps> = ({
  className = '',
  color,
  icon,
}) => {
  return (
    <motion.svg
      xmlns='http://www.w3.org/2000/svg'
      viewBox='0 0 100 100'
      className={className}
      initial='hidden'
      animate='visible'
    >
      {svgPaths[icon].map((path) => (
        <motion.g
          key={path.key}
          className={color}
        >
          {path}
        </motion.g>
      ))}
    </motion.svg>
  );
};

interface SVGAnimationProps {
  className?: string;
  message?: string;
  withMessage?: boolean;
  withSound?: boolean;
  icon: 'success' | 'error' | 'warning' | 'info';
}

const colorMap = {
  success: 'stroke-green-500 text-green-500',
  error: 'stroke-red-500 text-red-500',
  warning: 'stroke-yellow-500 text-yellow-500',
  info: 'stroke-blue-500 text-blue-500',
};

const soundMap = {
  success: '/sound/success.mp3',
  error: '/sound/error.mp3',
  warning: '/sound/warning.mp3',
  info: '/sound/info.mp3',
};

export const SVGAnimation: React.FC<SVGAnimationProps> = ({
  className = '',
  message,
  withMessage = true,
  withSound = false,
  icon,
}) => {
  const defaultMessages = {
    success: 'Success!',
    error: 'Something went wrong!',
    warning: 'Warning!',
    info: 'Information',
  };

  const currentMessage = message || defaultMessages[icon];
  const color = colorMap[icon];
  const soundSrc = soundMap[icon];

  useEffect(() => {
    if (!withSound) return;

    const audio = new Audio(soundSrc);
    const playPromise = audio.play();

    if (playPromise !== undefined) {
      playPromise.catch((error) => {
        console.error('Audio play failed:', error);
      });
    }

    return () => {
      audio.pause();
      audio.currentTime = 0;
    };
  }, [withSound, soundSrc]);

  return (
    <div
      className={`flex flex-col items-center justify-center relative ${className}`}
    >
      <AnimatedIcon
        icon={icon}
        color={color}
        className='w-48 h-48'
      />

      {withMessage && (
        <motion.h2
          className='font-semibold mt-6 text-2xl text-gray-800 dark:text-white'
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 1 }}
        >
          {currentMessage}
        </motion.h2>
      )}
    </div>
  );
};
