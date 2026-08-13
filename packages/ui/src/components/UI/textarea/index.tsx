'use client';
/** @format */

import * as React from 'react';
import { ClipboardPaste, LucideIcon, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { LabelWithHelp } from '@/components/UI/label/with-help';
import { Tooltip } from '@/components/UI/tooltip';
import { Button } from '../Button';
import { Error } from '@/components/UI/text/typography';

export interface LabeledTextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  icon?: LucideIcon;
  error?: string;
  containerClassName?: string;
  showCharCount?: boolean;
  helpTextShort?: string;
  helpTextLong?: string;
  optional?: boolean;
  minHeight?: number | string;
  showClearButton?: boolean;
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
      optional,
      minHeight,
      showClearButton = true,
      style,
      ...props
    },
    ref,
  ) => {
    const [currentValue, setCurrentValue] = React.useState(
      String(props.value ?? props.defaultValue ?? ''),
    );
    const textareaRef = React.useRef<HTMLTextAreaElement>(null);

    // Update current value when props value changes
    React.useEffect(() => {
      if (props.value !== undefined) {
        setCurrentValue(String(props.value ?? ''));
      } else if (textareaRef.current) {
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

    const handleClear = (e: React.MouseEvent<HTMLButtonElement>) => {
      e.preventDefault();
      e.stopPropagation();

      if (textareaRef.current) {
        textareaRef.current.value = '';
      }

      const event = {
        target: { value: '' },
        currentTarget: { value: '' },
      } as React.ChangeEvent<HTMLTextAreaElement>;

      setCurrentValue('');
      onChange?.(event);
      textareaRef.current?.focus();
    };

    const handlePaste = async () => {
      if (!textareaRef.current || !navigator.clipboard?.readText) return;
      try {
        const pastedValue = await navigator.clipboard.readText();
        if (!pastedValue) return;
        const nativeTextareaValueSetter = Object.getOwnPropertyDescriptor(
          window.HTMLTextAreaElement.prototype,
          'value',
        )?.set;
        nativeTextareaValueSetter?.call(textareaRef.current, pastedValue);
        textareaRef.current.dispatchEvent(new Event('input', { bubbles: true }));
        setCurrentValue(pastedValue);
        textareaRef.current.focus();
      } catch {
        // Clipboard access can be denied by the browser or embedding context.
      }
    };

    const showHeader = Boolean(label || (showCharCount && maxLength));
    const minHeightStyle =
      minHeight !== undefined ?
        {
          minHeight:
            typeof minHeight === 'number' ? `${minHeight}px` : minHeight,
        }
      : undefined;
    const canClear =
      hasValue && showClearButton && !props.disabled && !props.readOnly;

    return (
      <div className={cn('group w-full', containerClassName)}>
        {showHeader && (
          <div className='flex items-center justify-between gap-2 mb-1.5'>
            {label ?
              <LabelWithHelp
                label={label}
                helpTextShort={helpTextShort}
                helpTextLong={helpTextLong}
                required={props.required}
                optional={optional}
              />
            : <div />}
            {showCharCount && maxLength && (
              <p
                className={cn(
                  'body-sm transition-colors',
                  isExceeded ?
                    'text-red-500 dark:text-red-400 font-medium'
                  : 'text-gray-400 dark:text-ink-secondary',
                )}
              >
                {currentLength}/{maxLength}
              </p>
            )}
          </div>
        )}
        <div className='relative w-full'>
          {Icon && (
            <Icon className='absolute text-gray-400 left-4 top-4 size-4 pointer-events-none' />
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
            style={{ ...minHeightStyle, ...style }}
            className={cn(
              'textarea',
              Icon && 'pl-11',
              showClearButton && 'pr-10',
              error && 'border-red-500 focus-visible:border-red-500',
              isExceeded && 'border-red-500 focus-visible:border-red-500',
              className,
            )}
            value={props.value !== undefined ? props.value : currentValue}
            onChange={handleChange}
            onBlur={onBlur}
            {...props}
          />
          {canClear && (
            <Tooltip content='Clear' side='top'>
              <Button
                type='button'
                Icon={X}
                variant='icon'
                onClick={handleClear}
                className='absolute right-3 bottom-3'
                aria-label='Clear input'
              />
            </Tooltip>
          )}
          {!hasValue && showClearButton && !props.disabled && !props.readOnly && (
            <Tooltip content='Paste from clipboard' side='top'>
              <Button
                type='button'
                Icon={ClipboardPaste}
                variant='icon'
                onClick={() => void handlePaste()}
                className='absolute right-3 bottom-3'
                aria-label='Paste from clipboard'
              />
            </Tooltip>
          )}
        </div>
        <Error show={!!error || isExceeded}>
          {error ||
            `Exceeds maximum length by ${
              currentLength - (maxLength || 0)
            } characters`}
        </Error>
      </div>
    );
  },
);
Textarea.displayName = 'Textarea';

export { Textarea };
