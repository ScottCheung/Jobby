/** @format */

'use client';

import * as React from 'react';
import { ClipboardPaste, LucideIcon, X, Eye, EyeOff } from 'lucide-react';
import { cn } from '@/lib/utils';
import { LabelWithHelp } from '../label/with-help';
import { Tooltip } from '../tooltip';
import { Error } from '../text/typography';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  icon?: LucideIcon;
  rightElement?: React.ReactNode;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, icon: Icon, rightElement, ...props }, ref) => {
    const isPassword = type === 'password';
    const [showPassword, setShowPassword] = React.useState(false);
    const resolvedType =
      isPassword ?
        showPassword ? 'text'
        : 'password'
      : type;

    return (
      <div className='relative w-full flex items-center'>
        {Icon && (
          <Icon className='absolute left-4 top-1/2 size-4 -translate-y-1/2 text-ink-secondary group-hover:text-primary transition-colors pointer-events-none z-10' />
        )}
        <input
          type={resolvedType}
          className={cn(
            'relative flex w-full items-center h-11 p-1 pl-4 pr-3 text-sm select-none',
            'rounded-full border transition-colors duration-200 outline-none',
            'bg-glass dark:bg-black/20 hover:bg-panel/50 focus:bg-background-primary',
            'border-transparent hover:border-primary/50 focus:border-primary',
            'text-ink-primary placeholder:text-ink-secondary/60',
            'disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none',
            Icon && '!pl-11',
            (rightElement || isPassword) && '!pr-12',
            className,
          )}
          ref={ref}
          {...props}
        />
        {(rightElement || isPassword) && (
          <div className='absolute right-1 top-1/2 -translate-y-1/2 flex items-center gap-1 z-20'>
            {rightElement}
            {isPassword && (
              <Tooltip
                content={showPassword ? 'Hide password' : 'Show password'}
                side='top'
              >
                <button
                  type='button'
                  onClick={() => setShowPassword(!showPassword)}
                  className='flex items-center justify-center size-9 rounded-full bg-background-secondary/60 hover:bg-background-secondary dark:bg-white/5 dark:hover:bg-white/10 text-ink-secondary hover:text-ink-primary transition-colors shrink-0 cursor-pointer'
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ?
                    <EyeOff className='h-4 w-4' />
                  : <Eye className='h-4 w-4' />}
                </button>
              </Tooltip>
            )}
          </div>
        )}
      </div>
    );
  },
);
Input.displayName = 'Input';

export interface InputFieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  icon?: LucideIcon;
  error?: string;
  containerClassName?: string;
  showCharCount?: boolean;
  helpTextShort?: string;
  helpTextLong?: string;
  required?: boolean;
  optional?: boolean;
  showClear?: boolean;
  showPaste?: boolean;
  rightElement?: React.ReactNode;
}

const InputField = React.forwardRef<HTMLInputElement, InputFieldProps>(
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
      required,
      optional,
      value,
      defaultValue,
      showClear,
      showPaste,
      rightElement,
      type,
      ...props
    },
    ref,
  ) => {
    const isPassword = type === 'password';
    const [showPassword, setShowPassword] = React.useState(false);
    const resolvedType =
      isPassword ?
        showPassword ? 'text'
        : 'password'
      : type;

    // For password fields, default clear & paste to false and show eye toggle instead
    const enableClear = showClear !== undefined ? showClear : !isPassword;
    const enablePaste = showPaste !== undefined ? showPaste : !isPassword;

    // Handle controlled vs uncontrolled value for character count
    const [internalValue, setInternalValue] = React.useState<string>(
      (value as string) || (defaultValue as string) || '',
    );
    const inputRef = React.useRef<HTMLInputElement>(null);

    React.useEffect(() => {
      if (value !== undefined) {
        setInternalValue(value as string);
      }
    }, [value]);

    const currentLength = internalValue.length;
    const hasValue = currentLength > 0;
    const isExceeded = maxLength ? currentLength > maxLength : false;

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (value === undefined) {
        setInternalValue(e.target.value);
      }
      onChange?.(e);
    };

    const handleClear = () => {
      if (inputRef.current) {
        const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
          window.HTMLInputElement.prototype,
          'value',
        )?.set;
        nativeInputValueSetter?.call(inputRef.current, '');

        const event = new Event('input', { bubbles: true });
        inputRef.current.dispatchEvent(event);

        if (value === undefined) {
          setInternalValue('');
        }

        inputRef.current.focus();
      }
    };

    const handlePaste = async () => {
      if (!inputRef.current || !navigator.clipboard?.readText) return;
      try {
        const pastedValue = await navigator.clipboard.readText();
        if (!pastedValue) return;
        const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
          window.HTMLInputElement.prototype,
          'value',
        )?.set;
        nativeInputValueSetter?.call(inputRef.current, pastedValue);
        inputRef.current.dispatchEvent(new Event('input', { bubbles: true }));
        if (value === undefined) setInternalValue(pastedValue);
        inputRef.current.focus();
      } catch {
        // Clipboard access can be denied by the browser or embedding context.
      }
    };

    const hasRightActions =
      Boolean(rightElement) ||
      isPassword ||
      (enableClear && hasValue && !props.disabled && !props.readOnly) ||
      (enablePaste && !hasValue && !props.disabled && !props.readOnly);

    const actionCount =
      (rightElement ? 1 : 0) +
      (isPassword ? 1 : 0) +
      ((enableClear && hasValue) || (enablePaste && !hasValue) ? 1 : 0);

    const isError = Boolean(error || isExceeded);

    return (
      <div
        className={cn(
          'relative w-full transition-none group',
          containerClassName,
        )}
      >
        {label && (
          <div className='flex justify-between items-center'>
            <LabelWithHelp
              label={label}
              helpTextShort={helpTextShort}
              helpTextLong={helpTextLong}
              required={required}
              optional={optional}
            />
            {showCharCount && maxLength && (
              <p
                className={cn(
                  'body-sm transition-colors',
                  isExceeded ?
                    'text-red-500 dark:text-red-400 font-medium'
                  : 'text-gray-400 dark:text-ink-secondary',
                )}
              >
                {currentLength} / {maxLength}
              </p>
            )}
          </div>
        )}

        <div className={cn('relative w-full transition-none', label && 'mt-2')}>
          {Icon && (
            <Icon className='absolute left-4 top-1/2 size-4 -translate-y-1/2 text-ink-secondary group-hover:text-primary transition-colors pointer-events-none z-10' />
          )}

          <input
            type={resolvedType}
            ref={(node) => {
              inputRef.current = node;
              if (typeof ref === 'function') {
                ref(node);
              } else if (ref) {
                ref.current = node;
              }
            }}
            className={cn(
              'relative flex w-full items-center h-11 p-1 pl-4 text-sm select-none',
              'rounded-full border border-transparent transition-colors duration-200 outline-none',
              'bg-glass dark:bg-black/20 hover:bg-panel/50 focus:bg-background-primary',
              isError ?
                'border-red-500 focus:border-red-500 text-red-600 dark:text-red-400'
              : 'border-transparent hover:border-primary/50 focus:border-primary',
              'text-ink-primary placeholder:text-ink-secondary/60',
              'disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none',
              Icon && '!pl-11',
              actionCount >= 2 ? '!pr-22'
              : hasRightActions ? '!pr-12'
              : '!pr-4',
              className,
            )}
            onChange={handleChange}
            onBlur={onBlur}
            value={value}
            defaultValue={defaultValue}
            {...props}
          />

          {hasRightActions && (
            <div className='absolute right-1 top-1/2 -translate-y-1/2 flex items-center gap-1 z-20'>
              {rightElement}
              {isPassword && (
                <Tooltip
                  content={showPassword ? 'Hide password' : 'Show password'}
                  side='top'
                >
                  <button
                    type='button'
                    onClick={() => setShowPassword(!showPassword)}
                    className='flex items-center justify-center size-9 rounded-full bg-background-secondary/60 hover:bg-background-secondary dark:bg-white/5 dark:hover:bg-white/10 text-ink-secondary hover:text-ink-primary transition-colors shrink-0 cursor-pointer'
                    aria-label={
                      showPassword ? 'Hide password' : 'Show password'
                    }
                  >
                    {showPassword ?
                      <EyeOff className='h-4 w-4' />
                    : <Eye className='h-4 w-4' />}
                  </button>
                </Tooltip>
              )}
              {enableClear &&
                hasValue &&
                !props.disabled &&
                !props.readOnly && (
                  <Tooltip content='Clear' side='top'>
                    <button
                      type='button'
                      onClick={handleClear}
                      className='flex items-center justify-center size-9 rounded-full bg-background-secondary/60 hover:bg-background-secondary dark:bg-white/5 dark:hover:bg-white/10 text-ink-secondary hover:text-ink-primary transition-colors shrink-0 cursor-pointer'
                      aria-label='Clear input'
                    >
                      <X className='h-4 w-4' />
                    </button>
                  </Tooltip>
                )}
              {enablePaste &&
                !hasValue &&
                !props.disabled &&
                !props.readOnly && (
                  <Tooltip content='Paste from clipboard' side='top'>
                    <button
                      type='button'
                      onClick={() => void handlePaste()}
                      className='flex items-center justify-center size-9 rounded-full bg-background-secondary/60 hover:bg-background-secondary dark:bg-white/5 dark:hover:bg-white/10 text-ink-secondary hover:text-primary transition-colors shrink-0 cursor-pointer'
                      aria-label='Paste from clipboard'
                    >
                      <ClipboardPaste className='h-4 w-4' />
                    </button>
                  </Tooltip>
                )}
            </div>
          )}
        </div>

        {(error || isExceeded) && (
          <div className='flex items-center justify-between mt-1'>
            <Error>
              {error ||
                (isExceeded &&
                  `Exceeds maximum length by ${
                    currentLength - (maxLength || 0)
                  } characters`)}
            </Error>
          </div>
        )}
      </div>
    );
  },
);
InputField.displayName = 'InputField';

export { InputField, Input };
