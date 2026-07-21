/** @format */

'use client';

import React, { FC, useRef } from 'react';
import { HTMLMotionProps, motion, useInView } from 'framer-motion';

type AnimationType =
  | 'fadeIn'
  | 'fadeInUp'
  | 'popIn'
  | 'shiftInUp'
  | 'rollIn'
  | 'whipIn'
  | 'whipInUp'
  | 'calmInUp';

interface Props extends HTMLMotionProps<'div'> {
  text: string;
  type?: AnimationType;
  delay?: number;
  duration?: number;
  animateOnce?: boolean;
}

const animationVariants = (delay: number = 0, duration: number = 0.5) => ({
  fadeIn: {
    container: {
      hidden: { opacity: 0 },
      visible: (i: number = 1) => ({
        opacity: 1,
        transition: { staggerChildren: 0.05, delayChildren: i * delay },
      }),
    },
    child: {
      visible: {
        opacity: 1,
        y: [0, -10, 0],
        transition: {
          type: 'spring',
          damping: 12,
          stiffness: 100,
          duration: duration,
        },
      },
      hidden: { opacity: 0, y: 10 },
    },
  },
  fadeInUp: {
    container: {
      hidden: { opacity: 0 },
      visible: {
        opacity: 1,
        transition: { staggerChildren: 0.1, delayChildren: delay },
      },
    },
    child: {
      visible: { opacity: 1, y: 0, transition: { duration: duration } },
      hidden: { opacity: 0, y: 20 },
    },
  },
  popIn: {
    container: {
      hidden: { scale: 0 },
      visible: {
        scale: 1,
        transition: { staggerChildren: 0.05, delayChildren: delay },
      },
    },
    child: {
      visible: {
        opacity: 1,
        scale: 1.1,
        transition: {
          type: 'spring',
          damping: 15,
          stiffness: 400,
          duration: duration,
        },
      },
      hidden: { opacity: 0, scale: 0 },
    },
  },
  calmInUp: {
    container: {
      hidden: {},
      visible: (i: number = 1) => ({
        transition: { staggerChildren: 0.01, delayChildren: delay * i },
      }),
    },
    child: {
      hidden: {
        y: '200%',
        transition: { ease: [0.455, 0.03, 0.515, 0.955], duration: duration },
      },
      visible: {
        y: 0,
        transition: {
          ease: [0.125, 0.92, 0.69, 0.975],
          duration: duration,
        },
      },
    },
  },
  shiftInUp: {
    container: {
      hidden: {},
      visible: (i: number = 1) => ({
        transition: { staggerChildren: 0.01, delayChildren: delay * i },
      }),
    },
    child: {
      hidden: {
        y: '100%',
        transition: {
          ease: [0.75, 0, 0.25, 1],
          duration: duration,
        },
      },
      visible: {
        y: 0,
        transition: {
          duration: duration,
          ease: [0.22, 1, 0.36, 1],
        },
      },
    },
  },
  whipInUp: {
    container: {
      hidden: {},
      visible: (i: number = 1) => ({
        transition: { staggerChildren: 0.01, delayChildren: delay * i },
      }),
    },
    child: {
      hidden: {
        y: '200%',
        transition: { ease: [0.455, 0.03, 0.515, 0.955], duration: duration },
      },
      visible: {
        y: 0,
        transition: {
          ease: [0.5, -0.15, 0.25, 1.05],
          duration: duration,
        },
      },
    },
  },
  rollIn: {
    container: {
      hidden: {},
      visible: {},
    },
    child: {
      hidden: {
        opacity: 0,
        y: `0.25em`,
      },
      visible: {
        opacity: 1,
        y: `0em`,
        transition: {
          duration: duration,
          ease: [0.65, 0, 0.75, 1],
        },
      },
    },
  },
  whipIn: {
    container: {
      hidden: {},
      visible: {},
    },
    child: {
      hidden: {
        opacity: 0,
        y: `0.35em`,
      },
      visible: {
        opacity: 1,
        y: `0em`,
        transition: {
          duration: duration,
          ease: [0.85, 0.1, 0.9, 1.2],
        },
      },
    },
  },
});

const TextAnimate: FC<Props> = ({
  text,
  type = 'whipInUp',
  delay = 0,
  duration = 0.5,
  animateOnce = true,
  ...props
}: Props) => {
  const ref = useRef(null);

  const letters = Array.from(text);
  const { container, child } = animationVariants(delay, duration)[type];

  return (
    <motion.h2
      ref={ref}
      style={{ display: 'flex', overflow: 'hidden' }}
      role='heading'
      variants={container}
      initial='hidden'
      whileInView='visible'
      viewport={{ once: animateOnce }}
      className='px-8 py-5 pb-8 mt-10 text-4xl font-black text-black darrk:text-neutral-100 md:text-5xl'
      {...props}
    >
      {letters.map((letter, index) => (
        <motion.span key={index} variants={child}>
          {letter === ' ' ? '\u00A0' : letter}
        </motion.span>
      ))}
    </motion.h2>
  );
};

export { TextAnimate };
export default TextAnimate;
