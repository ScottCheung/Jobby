/** @format */

'use client';
import { Textarea } from '@jobby/ui';

import React from 'react';
import { cn } from '@/lib/utils';


export function toInputDateTime(value?: string | null) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const offsetMs = date.getTimezoneOffset() * 60 * 1000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
}

export function fromInputDateTime(value: string) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toISOString();
}

interface FormFieldProps {
  label: string;
  value: string | number | null | undefined;
  onChange: (val: string) => void;
  type?: string;
  placeholder?: string;
  disabled?: boolean;
  icon?: React.ComponentType<{ className?: string }>;
}

export function FormField({
  label,
  value,
  onChange,
  type = 'text',
  placeholder = '',
  disabled = false,
  icon: Icon,
}: FormFieldProps) {
  return (
    <div className='flex flex-col gap-1.5 w-full'>
      <label className='text-[10px] font-bold text-ink-secondary uppercase tracking-wider'>
        {label}
      </label>
      <div className='relative'>
        {Icon && (
          <div className='absolute left-3 top-1/2 -translate-y-1/2 text-ink-secondary pointer-events-none'>
            <Icon className='w-4 h-4' />
          </div>
        )}
        <input
          type={type}
          value={value ?? ''}
          placeholder={placeholder}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
          className={cn(
            'body-md px-3 py-2 rounded-xl bg-glass text-ink-primary focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all placeholder-ink-secondary w-full',
            Icon && 'pl-9',
          )}
        />
      </div>
    </div>
  );
}

interface FormSelectProps {
  label: string;
  value: string | null | undefined;
  onChange: (val: string) => void;
  options: Array<{ value: string; label: string }>;
  disabled?: boolean;
  icon?: React.ComponentType<{ className?: string }>;
}

export function FormSelect({
  label,
  value,
  onChange,
  options,
  disabled = false,
  icon: Icon,
}: FormSelectProps) {
  return (
    <div className='flex flex-col gap-1.5 w-full'>
      <label className='text-[10px] font-bold text-ink-secondary uppercase tracking-wider'>
        {label}
      </label>
      <div className='relative'>
        {Icon && (
          <div className='absolute left-3 top-1/2 -translate-y-1/2 text-ink-secondary pointer-events-none'>
            <Icon className='w-4 h-4' />
          </div>
        )}
        <select
          value={value ?? ''}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
          className={cn(
            'body-md px-3 py-2 rounded-xl bg-glass text-ink-primary focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all cursor-pointer w-full appearance-none',
            Icon && 'pl-9 pr-8',
          )}
        >
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <div className='absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-ink-secondary'>
          <svg className='w-4 h-4 fill-current' viewBox='0 0 20 20'>
            <path d='M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z' />
          </svg>
        </div>
      </div>
    </div>
  );
}

interface FormTextareaProps {
  label: string;
  value: string | null | undefined;
  onChange: (val: string) => void;
  placeholder?: string;
  rows?: number;
  disabled?: boolean;
}

export function FormTextarea({
  label,
  value,
  onChange,
  placeholder = '',
  rows = 4,
  disabled = false,
}: FormTextareaProps) {
  return (
    <Textarea
      label={label}
      value={value ?? ''}
      rows={rows}
      placeholder={placeholder}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
      minHeight={rows ? rows * 24 : 96}
    />
  );
}
