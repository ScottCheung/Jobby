import React from 'react';

interface NotificationBadgeProps {
  count: number | React.ReactNode;
  children: React.ReactNode;
  className?: string;
  showBadge?: boolean;
  badgeClassName?: string;
}

export const NotificationBadge: React.FC<NotificationBadgeProps> = ({
  count,
  children,
  className = '',
  showBadge = true,
  badgeClassName = '',
}) => {
  const shouldShowBadge = showBadge && typeof count === 'number' && count > 0;

  return (
    <div className={`relative inline-block ${className}`}>
      {children}
      {shouldShowBadge && (
        <span
          className={`
            absolute 
            min-w-5 h-5 px-1 border-2 border-white
            bg-red-500 text-white text-xs 
            rounded-full
            flex items-center justify-center
            ${badgeClassName}
          `}
          style={{
            top: '2.5px',
            right: '2.5px',
            transform: 'translate(50%, -50%)',
            transformOrigin: 'center',
          }}
        >
          {typeof count === 'number' ? (count > 99 ? '99+' : count) : count}
        </span>
      )}
    </div>
  );
};
