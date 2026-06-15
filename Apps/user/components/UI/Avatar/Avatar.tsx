/** @format */

import { cn } from '@/lib/utils';
import React from 'react';
import { getColorFromName } from './util/getColorFromString';
import getContrastTextColor from './util/getContrastTextColor';

export interface AvatarProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, 'children'> {
  src?: string;
  alt?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  name?: string;
  status?: 'online' | 'offline' | 'away' | 'busy';
  bordered?: boolean;
  ring?: boolean;
  customSize?: string;
  ringColor?: string;
  bgColor?: string;
  borderColor?: string;
  message?: number;
  rounded?: string;
}

const sizeStyles = {
  sm: {
    container: 'size-6  flex items-center justify-center',
    text: 'text-md',
  },
  md: {
    container:
      'size-6 md:size-10 lg:size-14 xl:size-18 flex items-center justify-center',
    text: 'text-md md:text-lg',
  },
  lg: {
    container:
      'size-8 md:size-12 lg:size-16 xl:size-20 flex items-center justify-center',
    text: 'text-md md:text-lg lg:text-xl',
  },
  xl: {
    container:
      'size-12 md:size-16 lg:size-20 xl:size-24 flex items-center justify-center',
    text: 'text-md md:text-lg lg:text-xl xl:text-xl',
  },
};

const statusStyles = {
  online: 'bg-gradient-to-br from-green-500 to-green-300',
  offline: 'bg-gradient-to-br from-gray-500 to-gray-300',
  away: 'bg-gradient-to-br from-yellow-500 to-yellow-300',
  busy: 'bg-gradient-to-br from-red-500 to-red-300',
  custom: 'bg-gradient-to-br from-blue-500 to-blue-300 ',
};

const getInitials = (name: string) =>
  name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase();

export const Avatar = React.forwardRef<HTMLDivElement, AvatarProps>(
  (
    {
      className,
      src,
      alt,
      size = 'md',
      name,
      status,
      bordered = false,
      ring = false,
      ringColor = 'ring-primary-500',
      borderColor = 'border-gray-400',
      message,
      bgColor,
      customSize,
      rounded,
      ...props
    },
    ref
  ) => {
    const computedBg =
      bgColor || (name && !src ? getColorFromName(name) : undefined);
    const computedText = getContrastTextColor(computedBg || 'white');

    return (
      <div className='relative inline-block'>
        <div
          ref={ref}
          style={{
            width: customSize,
            height: customSize,
            backgroundColor: computedBg,
            borderColor: !borderColor.startsWith('border-')
              ? borderColor
              : undefined,
            boxShadow:
              ring && !ringColor.startsWith('ring-')
                ? `0 0 0 2px ${ringColor}`
                : undefined,
          }}
          className={cn(
            'relative flex items-center justify-center overflow-hidden ',
            !customSize && sizeStyles[size]?.container,
            rounded ? rounded : 'rounded-full',
            (!src || src === '') && 'bg-gray-100',
            bordered &&
            borderColor.startsWith('border-') &&
            `border ${borderColor}`,
            ring && ringColor.startsWith('ring-') && `ring ${ringColor}`,
            className
          )}
          {...props}
        >
          {src ? (
            <img
              src={src}
              alt={alt || name}
              className='h-full w-full object-cover'
            />
          ) : name ? (
            <span
              className={cn(
                'font-medium text-center',
                sizeStyles[size]?.text,
                `text-${computedText}`
              )}
            >
              {getInitials(name)}
            </span>
          ) : (
            <svg
              className='h-full w-full text-gray-300'
              fill='currentColor'
              viewBox='0 0 24 24'
            >
              <path d='M24 20.993V24H0v-2.996A14.977 14.977 0 0112.004 15c4.904 0 9.26 2.354 11.996 5.993zM16.002 8.999a4 4 0 11-8 0 4 4 0 018 0z' />
            </svg>
          )}
        </div>

        {message !== undefined && message > 0 && (
          <span className='absolute -top-[0.5em] -right-[0.5em]'>
            <div className='inline-flex h-5 px-1 rounded-full border-2 border-white bg-gradient-to-r from-red-500 to-red-300 items-center justify-center'>
              <div className='px-1 text-white text-xs font-semibold'>
                {message < 100 ? message : '99+'}
              </div>
            </div>
          </span>
        )}

        {status && (
          <span
            className={cn(
              'absolute bottom-0 right-0 rounded-full border-2 border-white',
              'xl:h-4 xl:w-4 lg:h-3.5 lg:w-3.5 md:h-3.5 md:w-3.5 h-2 w-2',
              statusStyles[status]
            )}
          />
        )}
      </div>
    );
  }
);

Avatar.displayName = 'Avatar';
