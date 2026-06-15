// ... imports
import { cn } from '@/lib/utils';
import { motion, useReducedMotion } from 'framer-motion';
import { ChevronDown } from 'lucide-react';
import React, { useCallback, useId, useRef, useState } from 'react';
import { H4 } from '../text/typography';
import { Collapse } from '@/components/animation';

export interface AccordionProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'onChange'> {
  /** The title of the accordion header */
  title: string;
  /** The content to be displayed when expanded */
  children: React.ReactNode;
  /** Whether the accordion is open by default */
  defaultOpen?: boolean;
  /** Controlled open state */
  isOpen?: boolean;
  /** Callback when the open state changes */
  onChange?: (isOpen: boolean) => void;
  /** Whether the accordion is disabled */
  disabled?: boolean;
  /** Custom icon to replace the default chevron */
  icon?: React.ReactNode;
  /** Whether clicking anywhere on the card toggles the accordion */
  quickOpenClose?: boolean;
  /** Custom transition duration in seconds */
  duration?: number;
  /** Custom class for the header */
  headerClassName?: string;
  /** Custom class for the content */
  contentClassName?: string;
  /** Custom class for the icon container */
  iconContainerClassName?: string;
}

// Icon animation variants
const iconVariants = {
  open: { rotate: 180 },
  closed: { rotate: 0 }
};

export const Accordion = React.forwardRef<HTMLDivElement, AccordionProps>(
  (
    {
      className,
      title,
      children,
      defaultOpen = false,
      isOpen: controlledIsOpen,
      onChange,
      disabled = false,
      quickOpenClose = false,
      icon,
      duration = 0.4,
      headerClassName,
      contentClassName,
      iconContainerClassName,
      ...props
    },
    ref
  ) => {
    const isControlled = controlledIsOpen !== undefined;
    const [uncontrolledIsOpen, setUncontrolledIsOpen] = useState(defaultOpen);
    const isOpen = isControlled ? controlledIsOpen : uncontrolledIsOpen;
    const headerId = useId();
    const contentId = useId();
    const shouldReduceMotion = useReducedMotion();
    const animationDuration = shouldReduceMotion ? 0 : duration;

    // Toggle the accordion open/close state
    const toggleOpen = useCallback(() => {
      if (disabled) return;

      const newValue = !isOpen;
      if (!isControlled) {
        setUncontrolledIsOpen(newValue);
      }
      onChange?.(newValue);
    }, [disabled, isOpen, isControlled, onChange]);

    // Handle keyboard navigation
    const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        toggleOpen();
      }
    }, [toggleOpen]);

    // Calculate header classes
    const headerClasses = cn(
      !quickOpenClose && !disabled && 'cursor-pointer group',
      disabled && 'cursor-not-allowed',
      !headerClassName && [
        'flex w-full items-center justify-between gap-3',
        'p-[14px] md:text-md lg:text-lg font-medium text-ink-secondary',
      ],
      headerClassName
    );

    // Calculate container classes
    const containerClasses = cn(
      'border border-gray-200 overflow-hidden bg-panel  rounded-card',
      quickOpenClose && !disabled && 'cursor-pointer group',
      disabled && 'opacity-50 cursor-not-allowed',
      className
    );

    // Calculate icon container classes
    const iconContainerClasses = cn(
      'group-hover:bg-primary z-30 bg-glass rounded-full p-2 ',
      'transition-colors duration-200',
      iconContainerClassName
    );

    return (
      <div
        ref={ref}
        onClick={quickOpenClose ? toggleOpen : undefined}
        className={containerClasses}
        role="region"
        aria-labelledby={headerId}
        {...props}
      >
        <div
          id={headerId}
          role="button"
          tabIndex={disabled ? -1 : 0}
          aria-expanded={isOpen}
          aria-controls={contentId}
          aria-disabled={disabled}
          onClick={quickOpenClose ? undefined : toggleOpen}
          onKeyDown={handleKeyDown}
          className={headerClasses}
        >
          <H4 className={cn(headerClassName, 'pl-2.5')}>{title}</H4>
          <motion.div
            aria-hidden="true"
            variants={iconVariants}
            initial={false}
            animate={isOpen ? 'open' : 'closed'}
            transition={{ duration: animationDuration, ease: [0.22, 1, 0.36, 1] }}
            className={iconContainerClasses}
          >
            {icon || <ChevronDown className="text-ink-primary group-hover:text-primary-foreground" />}
          </motion.div>
        </div>

        <Collapse
          isOpen={!!isOpen}
          duration={animationDuration}
          id={contentId}
          className={contentClassName}
        >
          <div className="text-sm text-gray-500 px-card pb-card">
            {children}
          </div>
        </Collapse>
      </div>
    );
  }
);

Accordion.displayName = 'Accordion';