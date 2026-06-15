import React from 'react';

interface NotificationBadgeProps {
  text: string;
  children: React.ReactNode;
  className?: string;
  showBadge?: boolean;
  badgeClassName?: string;
}

export const textBadge: React.FC<NotificationBadgeProps> = ({
  text,
  children,
  className = '',
  showBadge = true,
  badgeClassName = '',
}) => {
  const shouldShowBadge = showBadge && text !== '';

  return (
    <div className={`relative inline-block ${className}`}>
      {children}
      {shouldShowBadge && (
        <span
          className={`
            absolute 
            min-w-5 h-5 px-1 border-2 border-white
            text-white text-xs 
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
          {text}
        </span>
      )}
    </div>
  );
};
