/** @format */

'use client';

import type { ReactNode } from 'react';
import React, {
  createContext,
  forwardRef,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useImperativeHandle,
} from 'react';
import type {
  GlobalOptions as ConfettiGlobalOptions,
  CreateTypes as ConfettiInstance,
  Options as ConfettiOptions,
} from 'canvas-confetti';
import confetti from 'canvas-confetti';
import { AnimatePresence, motion } from 'framer-motion';

import { resolveCelebrationStyle } from '@/lib/celebration-config';
import { useLayoutStore } from '@/lib/store/layout-store';
import { Button } from '@jobby/ui';
import { Trophy } from 'lucide-react';

type Api = {
  fire: (options?: ConfettiOptions) => void;
};

type Props = React.ComponentPropsWithRef<'canvas'> & {
  options?: ConfettiOptions;
  globalOptions?: ConfettiGlobalOptions;
  manualstart?: boolean;
  children?: ReactNode;
};

export type ConfettiRef = Api | null;

const ConfettiContext = createContext<Api>({} as Api);

// Define Confetti Component
const ConfettiComponent = forwardRef<ConfettiRef, Props>((props, ref) => {
  const {
    options,
    globalOptions = { resize: true, useWorker: true },
    manualstart = false,
    children,
    ...rest
  } = props;
  const instanceRef = useRef<ConfettiInstance | null>(null);

  const canvasRef = useCallback(
    (node: HTMLCanvasElement | null) => {
      if (node !== null) {
        if (instanceRef.current) return;
        instanceRef.current = confetti.create(node, {
          ...globalOptions,
          resize: true,
        });
      } else {
        if (instanceRef.current) {
          instanceRef.current.reset();
          instanceRef.current = null;
        }
      }
    },
    [globalOptions],
  );

  const fire = useCallback(
    async (opts = {}) => {
      try {
        await instanceRef.current?.({ ...options, ...opts });
      } catch (error) {
        console.error('Confetti error:', error);
      }
    },
    [options],
  );

  const api = useMemo(
    () => ({
      fire,
    }),
    [fire],
  );

  useImperativeHandle(ref, () => api, [api]);

  useEffect(() => {
    if (!manualstart) {
      (async () => {
        try {
          await fire();
        } catch (error) {
          console.error('Confetti effect error:', error);
        }
      })();
    }
  }, [manualstart, fire]);

  return (
    <ConfettiContext.Provider value={api}>
      <canvas ref={canvasRef} {...rest} />
      {children}
    </ConfettiContext.Provider>
  );
});

ConfettiComponent.displayName = 'Confetti';

export const Confetti = ConfettiComponent;

// Confetti Button Component
interface ConfettiButtonProps extends React.ComponentProps<typeof Button> {
  options?: ConfettiOptions &
    ConfettiGlobalOptions & { canvas?: HTMLCanvasElement };
}

const ConfettiButtonComponent = ({
  options,
  children,
  ...props
}: ConfettiButtonProps) => {
  const handleClick = async (event: React.MouseEvent<HTMLButtonElement>) => {
    try {
      const rect = event.currentTarget.getBoundingClientRect();
      const x = rect.left + rect.width / 2;
      const y = rect.top + rect.height / 2;
      await confetti({
        ...options,
        origin: {
          x: x / window.innerWidth,
          y: y / window.innerHeight,
        },
      });
    } catch (error) {
      console.error('Confetti button error:', error);
    }
  };

  return (
    <Button onClick={handleClick} {...props}>
      {children}
    </Button>
  );
};

ConfettiButtonComponent.displayName = 'ConfettiButton';

export const ConfettiButton = ConfettiButtonComponent;

// Global Celebration Layer Component
export function CelebrationLayer() {
  const celebration = useLayoutStore((state) => state.celebration);
  const clearCelebration = useLayoutStore(
    (state) => state.actions.clearCelebration,
  );
  const resolvedStyle =
    celebration?.style ?? resolveCelebrationStyle(celebration?.type ?? 'basic');

  useEffect(() => {
    if (!celebration) return;

    const celebrationDuration =
      celebration.duration ?? resolvedStyle.durationMs;
    const intensity = resolvedStyle.particleMultiplier;
    const colors = [
      '#22c55e',
      '#3b82f6',
      '#f59e0b',
      '#ec4899',
      '#a855f7',
      '#f97316',
    ];

    let cancelTimer: (() => void) | undefined;

    if (celebration.type === 'basic') {
      confetti({
        particleCount: Math.round(100 * intensity),
        spread: 70 + intensity * 8,
        origin: { y: 0.6 },
        colors: colors,
        zIndex: 100,
      });
    } else if (celebration.type === 'fireworks') {
      const duration = celebrationDuration - 200;
      const animationEnd = Date.now() + duration;
      const defaults = {
        startVelocity: 28 + intensity * 8,
        spread: 360,
        ticks: 60,
        zIndex: 100,
      };

      const randomInRange = (min: number, max: number) =>
        Math.random() * (max - min) + min;

      const interval = window.setInterval(() => {
        const timeLeft = animationEnd - Date.now();

        if (timeLeft <= 0) {
          clearInterval(interval);
          return;
        }

        const particleCount = 42 * intensity * (timeLeft / duration);

        confetti({
          ...defaults,
          particleCount,
          origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 },
        });
        confetti({
          ...defaults,
          particleCount,
          origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 },
        });
      }, 250);

      cancelTimer = () => clearInterval(interval);
    } else if (celebration.type === 'stars') {
      const defaults = {
        spread: 360,
        ticks: 50,
        gravity: 0,
        decay: 0.94,
        startVelocity: 26 + intensity * 10,
        colors: ['#FFE400', '#FFBD00', '#E89400', '#FFCA6C', '#FDFFB8'],
        zIndex: 100,
      };

      const shoot = () => {
        confetti({
          ...defaults,
          particleCount: Math.round(36 * intensity),
          scalar: 1.2,
          shapes: ['star'],
        });

        confetti({
          ...defaults,
          particleCount: Math.max(6, Math.round(10 * intensity)),
          scalar: 0.75,
          shapes: ['circle'],
        });
      };

      shoot();
      const t1 = setTimeout(shoot, 100);
      const t2 = setTimeout(shoot, 200);
      cancelTimer = () => {
        clearTimeout(t1);
        clearTimeout(t2);
      };
    } else {
      // Default: side-cannons
      const end = Date.now() + celebrationDuration;
      let frameId: number;

      const frame = () => {
        if (Date.now() > end) return;

        confetti({
          particleCount: Math.max(2, Math.round(3 * intensity)),
          angle: 60,
          spread: 55,
          startVelocity: 50 + intensity * 8,
          origin: { x: 0, y: 0.8 },
          colors: colors,
          zIndex: 100,
        });
        confetti({
          particleCount: Math.max(2, Math.round(3 * intensity)),
          angle: 120,
          spread: 55,
          startVelocity: 50 + intensity * 8,
          origin: { x: 1, y: 0.8 },
          colors: colors,
          zIndex: 100,
        });

        frameId = requestAnimationFrame(frame);
      };

      frame();
      cancelTimer = () => cancelAnimationFrame(frameId);
    }

    const timeout = window.setTimeout(
      () => clearCelebration(),
      celebrationDuration,
    );

    return () => {
      window.clearTimeout(timeout);
      if (cancelTimer) cancelTimer();
    };
  }, [celebration, clearCelebration, resolvedStyle]);

  return (
    <AnimatePresence>
      {celebration && (
        <div className='pointer-events-none fixed inset-0 z-60 overflow-hidden flex items-center justify-center'>
          {resolvedStyle.panelEnabled && (
            <motion.div
              initial={{ opacity: 0, scale: 0.85, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: -20 }}
              transition={{ type: 'spring', damping: 15, stiffness: 200 }}
              style={{
                background: 'linear-gradient(135deg, #100f11, #08164c)',
              }}
              className='relative max-w-sm rounded-2xl border flex flex-col gap-1 px-8 py-5 backdrop-blur-2xl text-center shadow-[0_0_50px_rgba(0,0,0,0.5),0_0_20px_rgba(34,197,94,0.1)]'
            >
              <div className='mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full border  border-[#F3D092]/30 text-[#F3D092]'>
                <Trophy />
              </div>
              <h3 className='label mb-1 text-[#F3D092]!'>Celebration!</h3>
              <p className='title-sub text-[#F3D092]!'>
                {celebration.message || 'Unlocked!'}
              </p>
            </motion.div>
          )}
        </div>
      )}
    </AnimatePresence>
  );
}
