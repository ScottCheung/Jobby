/** @format */

import * as React from 'react';
import { LucideIcon, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { LabelWithHelp } from '@/components/UI/label/with-help';
import { Button } from '../Button';
import { Error } from '@/components/UI/text/typography';

export interface LabeledTextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string;
  icon?: LucideIcon;
  error?: string;
  containerClassName?: string;
  showCharCount?: boolean;
  helpTextShort?: string;
  helpTextLong?: string;
}

const Textarea = React.forwardRef<HTMLTextAreaElement, LabeledTextareaProps>(
  (
    {
      label,
      icon: Icon,
      containerClassName,
      className,
      error,
      showCharCount = true,
      maxLength,
      onChange,
      onBlur,
      helpTextShort,
      helpTextLong,
      ...props
    },
    ref,
  ) => {
    const [currentValue, setCurrentValue] = React.useState('');
    const textareaRef = React.useRef<HTMLTextAreaElement>(null);

    // Update current value when input changes
    React.useEffect(() => {
      if (textareaRef.current) {
        setCurrentValue(textareaRef.current.value || '');
      }
    }, [props.value, props.defaultValue]);

    const currentLength = currentValue.length;
    const hasValue = currentLength > 0;
    const isExceeded = maxLength ? currentLength > maxLength : false;

    const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setCurrentValue(e.target.value);
      onChange?.(e);
    };

    const handleClear = () => {
      const event = {
        target: { value: '' },
        currentTarget: { value: '' },
      } as React.ChangeEvent<HTMLTextAreaElement>;

      setCurrentValue('');
      onChange?.(event);
      textareaRef.current?.focus();
    };

    return (
      <div className={cn('group', containerClassName)}>
        <div className='flex items-center justify-between'>
          <LabelWithHelp
            label={label}
            helpTextShort={helpTextShort}
            helpTextLong={helpTextLong}
            required={props.required}
          />
          {showCharCount && maxLength && (
            <p
              className={cn(
                'text-xs transition-colors',
                isExceeded
                  ? 'text-red-500 dark:text-red-400 font-medium'
                  : 'text-gray-400 dark:text-ink-secondary',
              )}
            >
              {currentLength}/{maxLength}
            </p>
          )}
        </div>
        <div className='relative mt-2'>
          {Icon && (
            <Icon className='absolute text-gray-400 left-4 top-4 size-4' />
          )}
          <textarea
            ref={(node) => {
              textareaRef.current = node;
              if (typeof ref === 'function') {
                ref(node);
              } else if (ref) {
                ref.current = node;
              }
            }}
            className={cn(
              'flex min-h-[80px] textarea',
              Icon && 'pl-11',
              hasValue && 'pr-11',
              error && 'border-red-500 focus-visible:border-red-500',
              isExceeded && 'border-red-500 focus-visible:border-red-500',
              className,
            )}
            onChange={handleChange}
            onBlur={onBlur}
            {...props}
          />
          {hasValue && (

            <Button
              Icon={X}
              onClick={handleClear}
              className="absolute right-1 top-1  text-ink-secondary"
              variant="ghost"

            />
          )}
        </div>
        <Error show={(!!error || isExceeded)}>
          {error ||
            `Exceeds maximum length by ${currentLength - (maxLength || 0)
            } characters`}
        </Error>
      </div>
    );
  },
);
Textarea.displayName = 'Textarea';

export { Textarea };
