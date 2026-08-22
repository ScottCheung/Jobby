/** @format */

'use client';

import React, { useState } from 'react';
import { cn } from '@/lib/utils';
import { Check, Edit3, X } from 'lucide-react';

export interface PillOption {
  value: string;
  label: string;
  description?: string;
  icon?: React.ElementType;
}

export interface PillGroupProps {
  label?: string;
  hint?: string;
  required?: boolean;
  options: Array<string | PillOption>;
  value: string | null | undefined;
  onChange: (value: string) => void;
  allowCustom?: boolean;
  allowClear?: boolean;
  clearLabel?: string;
  customPlaceholder?: string;
  size?: 'sm' | 'md';
  className?: string;
  full?: boolean;
}

export function PillGroup({
  label,
  hint,
  required,
  options,
  value,
  onChange,
  allowCustom = false,
  allowClear = false,
  clearLabel = 'Not set',
  customPlaceholder = 'Custom...',
  size = 'sm',
  className,
  full = false,
}: PillGroupProps) {
  const [isCustomEditing, setIsCustomEditing] = useState(false);
  const [customDraft, setCustomDraft] = useState('');

  const normalizedOptions: PillOption[] = options.map((opt) =>
    typeof opt === 'string' ? { value: opt, label: opt } : opt,
  );

  const currentValue = value ?? '';
  const isPredefinedMatch = normalizedOptions.some(
    (opt) => opt.value.toLowerCase() === currentValue.toLowerCase(),
  );
  const isCustomValue = Boolean(
    allowCustom && currentValue && !isPredefinedMatch,
  );

  const handleSelect = (optionVal: string) => {
    setIsCustomEditing(false);
    if (allowClear && currentValue === optionVal) {
      onChange('');
    } else {
      onChange(optionVal);
    }
  };

  const handleClear = () => {
    setIsCustomEditing(false);
    onChange('');
  };

  const submitCustom = () => {
    if (customDraft.trim()) {
      onChange(customDraft.trim());
      setIsCustomEditing(false);
    }
  };

  return (
    <div
      className={cn(
        'flex flex-col gap-1.5 min-w-0',
        full ? 'col-span-full' : '',
        className,
      )}
    >
      {label && (
        <div className='flex items-center justify-between gap-2'>
          <div className='flex items-center gap-1'>
            <span className='text-xs font-semibold text-ink-primary select-none'>
              {label}
            </span>
            {required && <span className='text-rose-500 font-bold ml-0.5'>*</span>}
          </div>
          {hint && (
            <span className='text-[10px] text-ink-secondary/60'>{hint}</span>
          )}
        </div>
      )}

      <div className='flex flex-wrap items-center gap-1.5'>
        {allowClear && (
          <button
            type='button'
            onClick={handleClear}
            className={cn(
              'group relative inline-flex items-center gap-1 rounded-lg transition-all duration-150 font-medium select-none cursor-pointer',
              size === 'sm' ?
                'px-2.5 py-1 text-xs min-h-[30px]'
              : 'px-3 py-1.5 text-xs min-h-[34px]',
              !currentValue ?
                'bg-primary/20 text-primary font-semibold'
              : 'bg-background-secondary/60 hover:bg-background-secondary text-ink-secondary hover:text-ink-primary',
            )}
          >
            {!currentValue && <Check className='h-3 w-3 shrink-0' />}
            <span>{clearLabel}</span>
          </button>
        )}

        {normalizedOptions.map((option) => {
          const isSelected =
            currentValue.toLowerCase() === option.value.toLowerCase();
          const Icon = option.icon;

          return (
            <button
              key={option.value}
              type='button'
              onClick={() => handleSelect(option.value)}
              className={cn(
                'group relative inline-flex items-center gap-1 rounded-lg transition-all duration-150 font-medium select-none cursor-pointer',
                size === 'sm' ?
                  'px-2.5 py-1 text-xs min-h-[30px]'
                : 'px-3 py-1.5 text-xs min-h-[34px]',
                isSelected ?
                  'bg-primary/20 text-primary font-semibold shadow-2xs'
                : 'bg-background-secondary/60 hover:bg-background-secondary text-ink-secondary hover:text-ink-primary active:scale-[0.98]',
              )}
            >
              {Icon && <Icon className='h-3 w-3 shrink-0 opacity-80' />}
              {isSelected && !Icon && (
                <Check className='h-3 w-3 shrink-0 text-primary' />
              )}
              <span>{option.label}</span>
            </button>
          );
        })}

        {allowCustom && (
          <>
            {isCustomEditing ?
              <div className='flex items-center gap-1 bg-background-secondary rounded-lg p-0.5'>
                <input
                  type='text'
                  value={customDraft}
                  autoFocus
                  placeholder={customPlaceholder}
                  onChange={(e) => setCustomDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      submitCustom();
                    } else if (e.key === 'Escape') {
                      setIsCustomEditing(false);
                    }
                  }}
                  className='h-6 px-2 text-xs bg-transparent text-ink-primary outline-none min-w-[100px] max-w-[150px]'
                />
                <button
                  type='button'
                  onClick={submitCustom}
                  className='h-5 px-1.5 text-[10px] font-semibold bg-primary text-white rounded hover:bg-primary/90'
                >
                  OK
                </button>
                <button
                  type='button'
                  onClick={() => setIsCustomEditing(false)}
                  className='h-5 w-5 grid place-items-center text-ink-secondary hover:text-ink-primary'
                >
                  <X className='h-3 w-3' />
                </button>
              </div>
            : isCustomValue ?
              <button
                type='button'
                onClick={() => {
                  setCustomDraft(currentValue);
                  setIsCustomEditing(true);
                }}
                className={cn(
                  'group relative inline-flex items-center gap-1 rounded-lg transition-all duration-150 font-medium select-none cursor-pointer',
                  size === 'sm' ?
                    'px-2.5 py-1 text-xs min-h-[30px]'
                  : 'px-3 py-1.5 text-xs min-h-[34px]',
                  'bg-primary/20 text-primary font-semibold',
                )}
              >
                <Check className='h-3 w-3 shrink-0 text-primary' />
                <span>{currentValue}</span>
                <Edit3 className='h-2.5 w-2.5 opacity-60 ml-0.5' />
              </button>
            : <button
                type='button'
                onClick={() => {
                  setCustomDraft('');
                  setIsCustomEditing(true);
                }}
                className={cn(
                  'group relative inline-flex items-center gap-1 rounded-lg transition-all duration-150 font-medium select-none cursor-pointer',
                  size === 'sm' ?
                    'px-2 py-1 text-xs min-h-[30px]'
                  : 'px-2.5 py-1.5 text-xs min-h-[34px]',
                  'bg-background-secondary/40 hover:bg-background-secondary text-ink-secondary/70 hover:text-ink-primary',
                )}
              >
                <Edit3 className='h-2.5 w-2.5 shrink-0' />
                <span>Custom...</span>
              </button>
            }
          </>
        )}
      </div>
    </div>
  );
}
