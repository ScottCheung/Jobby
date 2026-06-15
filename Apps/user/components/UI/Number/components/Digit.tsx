import { AnimatePresence, motion as m } from 'framer-motion';
import { AnimationType } from '../Number';
import { getVariants } from '../util/getAnimationVariants';

export const Digit: React.FC<{
  value: string;
  prevValue: string;
  animation: AnimationType;
  duration: number;
  delay: number;
  fontSize?: string;
  commaWidth?: string;
}> = ({
  value,
  prevValue,
  animation,
  duration,
  delay,
  fontSize,
  commaWidth,
}) => {
    const variants = getVariants(animation, duration, delay);
    const hasChanged = value !== prevValue;

    const direction = hasChanged
      ? Number(value) > Number(prevValue)
        ? 'up'
        : 'down'
      : 'up';

    const isComma = value === ',';
    const isDecimalPoint = value === '.';
    const isNumber = /^[0-9]$/.test(value);

    // 统一样式配置
    const baseStyle = {
      fontSize,
      width: isComma
        ? commaWidth || '0.4em'
        : isDecimalPoint
          ? '0.4em'
          : isNumber
            ? '0.7em'
            : '1em',
      minWidth: isComma
        ? commaWidth || '0.4em'
        : isDecimalPoint
          ? '0.4em'
          : isNumber
            ? '0.8em'
            : '1em',
      height: '1em',
      margin: isComma || isDecimalPoint ? '0 -0.05em' : '',
    };

    const separatorClass = isComma ? '' : isDecimalPoint ? '' : '';

    // 渲染无动画模式
    if (animation === 'none') {
      return (
        <div
          className={`relative inline-flex items-center justify-center font-medium ${separatorClass}`}
          style={baseStyle}
          dangerouslySetInnerHTML={{ __html: value }}
        />
      );
    }

    // 动画配置
    const motionConfig = {
      layout: true,
      variants,
      custom: direction,
      viewport: { margin: '30px 0px -30px 0px', once: true },
      transition: {
        duration: duration,
        delay,
        type: 'spring' as const,
        stiffness: 300,
        damping: 20,
      },
      className: `absolute inset-0 flex items-center justify-center font-medium ${separatorClass}`,
      dangerouslySetInnerHTML: { __html: value },
    };

    return (
      <m.div
        layout
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{
          type: 'spring' as const,
          stiffness: 300,
          damping: 20,
        }}
        className='relative inline-flex overflow-hidden items-center justify-center'
        style={baseStyle}
      >
        <AnimatePresence mode='wait'>
          {hasChanged ? (
            <>
              <m.div
                key={`exit-${prevValue}`}
                initial='center'
                whileInView='exit'
                exit='exit'
                {...motionConfig}
                dangerouslySetInnerHTML={{ __html: prevValue }}
              />
              <m.div
                key={`enter-${value}`}
                initial='enter'
                whileInView='center'
                {...motionConfig}
              />
            </>
          ) : (
            <div
              className={`absolute inset-0 transition-all flex items-center justify-center font-medium ${separatorClass}`}
              dangerouslySetInnerHTML={{ __html: value }}
            />
          )}
        </AnimatePresence>
      </m.div>
    );
  };
