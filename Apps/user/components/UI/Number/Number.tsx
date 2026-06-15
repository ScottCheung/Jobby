import { cn } from '@/lib/utils';
import React, { useEffect, useRef, useState } from 'react';
import { Digit } from './components/Digit';
import { formatNumber } from './util/formatNumber';
import { parseFormattedNumber } from './util/parseFormattedNumber';

export type NumberFormat = 'none' | 'currency' | 'percentage' | 'decimal';

export type NumberType =
  | 'standard' // 标准数字格式
  | 'scientific' // 科学计数法
  | 'engineering'; // 工程计数法

export type AnimationType = 'flip' | 'slide' | 'fade' | 'none';

interface AnimatedNumberProps {
  value: number | string;
  format?: NumberFormat;
  animation?: AnimationType;
  duration?: number;
  debounceDuration?: number;
  decimalPlaces?: number;
  prefix?: string;
  suffix?: string;
  locale?: string;
  maxNumberPlaces?: number;
  delayPerChar?: number;
  currencyType?: string;
  useShortFormat?: boolean;
  numberType?: NumberType;
  currencySymbolSize?: string;
  integerPartSize?: string;
  decimalPartSize?: string;
  suffixSize?: string;
  commaWidth?: string;
  className?: string;
}

export const Number: React.FC<AnimatedNumberProps> = ({
  value,
  format = 'none',
  animation = 'slide',
  duration = 0.5,
  debounceDuration = 30,
  decimalPlaces = 0,
  prefix = '',
  suffix = '',
  locale = 'en-US',
  maxNumberPlaces = 0,
  delayPerChar = 0.05,
  currencyType = 'USD',
  useShortFormat = false,
  numberType = 'standard',
  currencySymbolSize,
  integerPartSize,
  decimalPartSize,
  suffixSize,
  commaWidth = '0.4em',
  className,
  ...props
}) => {
  const [formattedParts, setFormattedParts] = useState<{
    currencySymbol: string;
    integerPart: string;
    decimalPart: string;
    fullText: string;
  }>({
    currencySymbol: '',
    integerPart: '',
    decimalPart: '',
    fullText: '',
  });
  const [prevFormattedParts, setPrevFormattedParts] = useState<{
    currencySymbol: string;
    integerPart: string;
    decimalPart: string;
    fullText: string;
  }>({
    currencySymbol: '',
    integerPart: '',
    decimalPart: '',
    fullText: '',
  });
  const prevValueRef = useRef(0);

  const debounceTimer = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const numValue =
      typeof value === 'number' ? value : parseFloat(value.toString());
    if (isNaN(numValue)) return;

    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }

    debounceTimer.current = setTimeout(() => {
      setPrevFormattedParts(formattedParts);
      const formatted = formatNumber(
        numValue,
        format,
        decimalPlaces,
        locale,
        currencyType,
        useShortFormat,
        numberType,
        maxNumberPlaces,
      );
      const parsedParts = parseFormattedNumber(formatted, format, currencyType);
      setFormattedParts({
        ...parsedParts,
        fullText: formatted,
      });
      prevValueRef.current = numValue;
    }, debounceDuration);
  }, [
    value,
    format,
    decimalPlaces,
    currencyType,
    useShortFormat,
    numberType,
    maxNumberPlaces,
  ]);

  const calculateDelay = (
    index: number,
    totalLength: number,
    changed: boolean,
  ) => {
    if (!changed || animation === 'none') return 0;
    const reverseIndex = totalLength - 1 - index;
    return reverseIndex * delayPerChar;
  };

  const renderPart = (
    text: string,
    prevText: string,
    partFontSize?: string,
  ) => {
    const chars = text.split('');
    const prevChars = prevText
      ? prevText.split('')
      : Array(chars.length).fill(' ');

    return chars.map((char, index) => {
      const prevChar = prevChars[index] || ' ';
      const changed = prevChar !== char && prevChar !== ' ';
      const delay = calculateDelay(index, chars.length, changed);

      return (
        <Digit
          key={`${index}-${char}`}
          value={char}
          prevValue={prevChar}
          animation={animation}
          duration={duration}
          delay={delay}
          fontSize={partFontSize}
          commaWidth={commaWidth}
        />
      );
    });
  };

  return (
    <div
      className={cn('inline-flex items-end', className)}
      {...props}
    >
      {prefix && (
        <span
          className='mr-1'
          dangerouslySetInnerHTML={{ __html: prefix }}
        />
      )}

      <div className='flex overflow-hidden items-baseline'>
        {formattedParts.currencySymbol && (
          <div
            className='flex'
            style={currencySymbolSize ? { fontSize: currencySymbolSize } : {}}
          >
            {renderPart(
              formattedParts.currencySymbol,
              prevFormattedParts.currencySymbol,
              currencySymbolSize,
            )}
          </div>
        )}

        <div
          className='flex'
          style={integerPartSize ? { fontSize: integerPartSize } : {}}
        >
          {renderPart(
            formattedParts.integerPart,
            prevFormattedParts.integerPart,
            integerPartSize,
          )}
        </div>

        {formattedParts.decimalPart && (
          <div
            className='flex'
            style={decimalPartSize ? { fontSize: decimalPartSize } : {}}
          >
            {renderPart(
              formattedParts.decimalPart,
              prevFormattedParts.decimalPart,
              decimalPartSize,
            )}
          </div>
        )}
      </div>

      {suffix && (
        <span
          className='ml-1'
          style={suffixSize ? { fontSize: suffixSize } : {}}
          dangerouslySetInnerHTML={{ __html: suffix }}
        />
      )}
    </div>
  );
};
