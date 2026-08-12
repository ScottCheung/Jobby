import { Variants } from 'framer-motion';
export type AnimationType = 'flip' | 'slide' | 'fade' | 'none';

// This function is used to get the variants for the animation
// It is used by the AnimatedNumber component to get the variants for the animation.
//
// Parameters:
// animation: The animation to use for the number (flip, slide, fade, none).
// duration: The duration of the animation.
// delay: The delay of the animation.
// Returns: The variants for the animation.

const commonTransition = (duration: number, delay: number) => ({
  type: 'spring' as const,
  stiffness: 200,
  damping: 20,
  bounce: 0.5,
  duration: duration / 2,
  delay,
});

export const getVariants = (
  animation: AnimationType,
  duration: number = 0.5,
  delay: number = 0,
): Variants => {
  const commonStates = {
    center: {
      opacity: 1,
      transition: commonTransition(duration, delay),
    },
    exit: {
      opacity: 0,
      transition: commonTransition(duration, delay),
    },
  };

  switch (animation) {
    case 'flip':
      return {
        enter: (direction: 'up' | 'down') => ({
          rotateX: direction === 'up' ? 90 : -90,
          opacity: 0,

          transition: commonTransition(duration, delay),
        }),
        ...commonStates,
        center: {
          ...commonStates.center,
          rotateX: 0,
        },
        exit: (direction: 'up' | 'down') => ({
          ...commonStates.exit,
          rotateX: direction === 'up' ? -90 : 90,
          transition: commonTransition(duration, delay),
        }),
      };

    case 'slide':
      return {
        enter: (direction: 'up' | 'down') => ({
          y: direction === 'up' ? '100%' : '-100%',
          opacity: 0,
          transition: commonTransition(duration, delay),
        }),
        ...commonStates,
        center: {
          ...commonStates.center,
          y: 0,
        },
        exit: (direction: 'up' | 'down') => ({
          ...commonStates.exit,
          y: direction === 'up' ? '-100%' : '100%',
          transition: commonTransition(duration, delay),
        }),
      };

    case 'fade':
      return {
        enter: {
          opacity: 0,
          transition: commonTransition(duration, delay),
        },
        ...commonStates,
      };

    default:
      return {};
  }
};
