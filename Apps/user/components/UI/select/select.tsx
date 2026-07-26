/** @format */

'use client';

import * as React from 'react';
import { createPortal } from 'react-dom';
import { LucideIcon, ChevronDown, Check, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { LabelWithHelp } from '@/components/UI/label/with-help';
import { Error } from '../text/typography';
import { motion, AnimatePresence } from 'framer-motion';

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  icon?: LucideIcon;
  error?: string;
  containerClassName?: string;
  helpTextShort?: string;
  helpTextLong?: string;
  placeholder?: string;
  searchThreshold?: number;
  searchPlaceholder?: string;
  optional?: boolean;
}

interface OptionItem {
  value: string;
  label: string;
  disabled?: boolean;
}

const getOptions = (children: React.ReactNode): OptionItem[] => {
  const options: OptionItem[] = [];
  React.Children.forEach(children, (child) => {
    if (React.isValidElement(child) && child.type === 'option') {
      const props = child.props as any;
      options.push({
        value:
          props.value !== undefined ?
            String(props.value)
          : String(props.children || ''),
        label: String(props.children || props.value || ''),
        disabled: Boolean(props.disabled),
      });
    }
  });
  return options;
};

const Select = React.forwardRef<HTMLDivElement, SelectProps>(
  (
    {
      label,
      icon: Icon,
      containerClassName,
      className,
      children,
      error,
      helpTextShort,
      helpTextLong,
      placeholder = 'Select...',
      searchThreshold = 7,
      searchPlaceholder = 'Search...',
      value,
      defaultValue,
      disabled,
      onChange,
      name,
      required,
      optional,
      id,
      ...props
    },
    ref,
  ) => {
    const [isOpen, setIsOpen] = React.useState(false);
    const [internalValue, setInternalValue] = React.useState<string>(
      ((value !== undefined ? value : defaultValue) as string) || '',
    );
    const [focusedIndex, setFocusedIndex] = React.useState<number>(-1);
    const [searchQuery, setSearchQuery] = React.useState('');
    // 下拉框位置信息：坐标 + 是否向上展开
    const [dropdownStyle, setDropdownStyle] = React.useState<{
      top: number;
      left: number;
      width: number;
      openUp: boolean;
      maxHeight: number;
    } | null>(null);

    const containerRef = React.useRef<HTMLDivElement>(null);
    const triggerRef = React.useRef<HTMLButtonElement>(null);
    const listboxRef = React.useRef<HTMLDivElement>(null);
    const searchInputRef = React.useRef<HTMLInputElement>(null);
    const selectLayoutId = `select-${React.useId()}`;

    React.useEffect(() => {
      if (value !== undefined) {
        setInternalValue(value as string);
      }
    }, [value]);

    const allOptions = React.useMemo(() => getOptions(children), [children]);
    const showSearch = allOptions.length > searchThreshold;

    // 根据搜索词过滤
    const options = React.useMemo(() => {
      if (!showSearch || !searchQuery.trim()) return allOptions;
      const q = searchQuery.trim().toLowerCase();
      return allOptions.filter((opt) => opt.label.toLowerCase().includes(q));
    }, [allOptions, searchQuery, showSearch]);

    const selectedOption = React.useMemo(
      () =>
        allOptions.find(
          (opt) => opt.value === internalValue || opt.label === internalValue,
        ),
      [allOptions, internalValue],
    );

    // 计算下拉框应该展开的位置和方向
    const calculatePosition = React.useCallback(() => {
      const trigger = triggerRef.current;
      if (!trigger) return;

      const rect = trigger.getBoundingClientRect();
      const viewportHeight = window.innerHeight;
      const DROPDOWN_MAX_HEIGHT = 280; // 预估的下拉框最大高度（含搜索框）
      const GAP = 6;

      const spaceBelow = viewportHeight - rect.bottom - GAP;
      const spaceAbove = rect.top - GAP;

      // 优先向下展开，除非下面空间不够 且 上面空间明显更大
      const openUp =
        spaceBelow < DROPDOWN_MAX_HEIGHT && spaceAbove > spaceBelow;

      const maxHeight = Math.min(
        DROPDOWN_MAX_HEIGHT,
        (openUp ? spaceAbove : spaceBelow) - 8,
      );

      setDropdownStyle({
        top: openUp ? rect.top - GAP : rect.bottom + GAP,
        left: rect.left,
        width: rect.width,
        openUp,
        maxHeight: Math.max(maxHeight, 120), // 至少保留一点高度
      });
    }, []);

    // 打开时计算一次位置；打开状态下监听 scroll / resize 实时更新
    React.useLayoutEffect(() => {
      if (!isOpen) return;
      calculatePosition();

      const handleUpdate = () => calculatePosition();
      window.addEventListener('scroll', handleUpdate, true);
      window.addEventListener('resize', handleUpdate);
      return () => {
        window.removeEventListener('scroll', handleUpdate, true);
        window.removeEventListener('resize', handleUpdate);
      };
    }, [isOpen, calculatePosition]);

    // 打开后自动聚焦搜索框
    React.useEffect(() => {
      if (isOpen && showSearch) {
        // 等一帧，避免动画/portal挂载的时序问题
        const t = requestAnimationFrame(() => searchInputRef.current?.focus());
        return () => cancelAnimationFrame(t);
      }
    }, [isOpen, showSearch]);

    // 关闭时清空搜索词
    React.useEffect(() => {
      if (!isOpen) {
        setSearchQuery('');
      }
    }, [isOpen]);

    // 点击外部关闭（触发按钮 或 portal 出去的下拉框都要判断）
    React.useEffect(() => {
      if (!isOpen) return;

      const handleClickOutside = (event: MouseEvent) => {
        const target = event.target as Node;
        const clickedTrigger = containerRef.current?.contains(target);
        const clickedDropdown = listboxRef.current
          ?.closest('[data-select-popover]')
          ?.contains(target);
        if (!clickedTrigger && !clickedDropdown) {
          setIsOpen(false);
        }
      };

      document.addEventListener('mousedown', handleClickOutside);
      return () =>
        document.removeEventListener('mousedown', handleClickOutside);
    }, [isOpen]);

    React.useEffect(() => {
      if (isOpen && focusedIndex >= 0 && listboxRef.current) {
        const optionEls =
          listboxRef.current.querySelectorAll('[role="option"]');
        if (optionEls[focusedIndex]) {
          optionEls[focusedIndex].scrollIntoView({ block: 'nearest' });
        }
      }
    }, [isOpen, focusedIndex]);

    const handleSelect = (optionValue: string) => {
      if (value === undefined) {
        setInternalValue(optionValue);
      }

      if (onChange) {
        const syntheticEvent = {
          target: {
            value: optionValue,
            name: name || '',
          },
        } as React.ChangeEvent<HTMLSelectElement>;
        onChange(syntheticEvent);
      }

      setIsOpen(false);
      triggerRef.current?.focus();
    };

    const openDropdown = () => {
      if (disabled) return;
      setIsOpen(true);
      const idx = options.findIndex((opt) => opt.value === internalValue);
      setFocusedIndex(idx >= 0 ? idx : 0);
    };

    const handleTriggerKeyDown = (e: React.KeyboardEvent) => {
      if (disabled) return;

      if (!isOpen) {
        if (['Enter', ' ', 'ArrowDown', 'ArrowUp'].includes(e.key)) {
          e.preventDefault();
          openDropdown();
        }
        return;
      }
    };

    // 搜索框和列表都要处理键盘导航，抽成公共函数
    const handleListKeyDown = (e: React.KeyboardEvent) => {
      switch (e.key) {
        case 'Escape':
          e.preventDefault();
          setIsOpen(false);
          triggerRef.current?.focus();
          break;
        case 'ArrowDown':
          e.preventDefault();
          setFocusedIndex((prev) => (prev < options.length - 1 ? prev + 1 : 0));
          break;
        case 'ArrowUp':
          e.preventDefault();
          setFocusedIndex((prev) => (prev > 0 ? prev - 1 : options.length - 1));
          break;
        case 'Enter':
          e.preventDefault();
          if (focusedIndex >= 0 && focusedIndex < options.length) {
            const targetOpt = options[focusedIndex];
            if (!targetOpt.disabled) {
              handleSelect(targetOpt.value);
            }
          }
          break;
        case 'Tab':
          setIsOpen(false);
          break;
      }
    };

    return (
      <div
        ref={(node) => {
          (
            containerRef as React.MutableRefObject<HTMLDivElement | null>
          ).current = node;
          if (typeof ref === 'function') ref(node);
          else if (ref)
            (ref as React.MutableRefObject<HTMLDivElement | null>).current =
              node;
        }}
        className={cn('relative w-full group', containerClassName)}
      >
        {label && (
          <LabelWithHelp
            label={label}
            helpTextShort={helpTextShort}
            helpTextLong={helpTextLong}
            required={required}
            optional={optional}
          />
        )}

        <motion.div className={cn('relative w-full', label && 'mt-2')}>
          {Icon && (
            <Icon className='absolute left-4 top-1/2 size-4 -translate-y-1/2 text-ink-secondary group-hover:text-primary transition-colors pointer-events-none z-10' />
          )}

          <button
            ref={triggerRef}
            type='button'
            disabled={disabled}
            onClick={() => {
              if (!disabled) {
                if (isOpen) {
                  setIsOpen(false);
                } else {
                  openDropdown();
                }
              }
            }}
            onKeyDown={handleTriggerKeyDown}
            aria-expanded={isOpen}
            aria-haspopup='listbox'
            id={id}
            className={cn(
              'relative flex w-full items-center justify-between h-11  p-1 text-sm select-none',
              'rounded-2xl border transition-all duration-200 outline-none cursor-pointer',
              'bg-glass dark:bg-black/20 hover:bg-panel focus:bg-panel',
              'border-border/60 hover:border-primary/40 focus:border-primary focus:ring-2 focus:ring-primary/20',
              isOpen &&
                'border-primary ring-2 ring-primary/20 bg-panel shadow-sm',
              disabled && 'opacity-50 cursor-not-allowed pointer-events-none',
              error && 'border-red-500 focus:ring-red-500/20',
              Icon && '!pl-11',
              className,
            )}
          >
            <span
              className={cn(
                'truncate text-left font-normal flex-1 mr-2',
                !selectedOption ?
                  'text-ink-secondary/60'
                : 'text-ink-primary font-medium',
              )}
            >
              {selectedOption ? selectedOption.label : placeholder}
            </span>

            <div className='flex items-center justify-center p-2 rounded-full bg-background-secondary/60 dark:bg-white/5 text-ink-secondary group-hover:text-ink-primary transition-colors shrink-0'>
              <ChevronDown
                className={cn(
                  'h-4 w-4 transition-transform duration-200 ease-out',
                  isOpen && 'rotate-180 text-primary',
                )}
              />
            </div>
          </button>

          <motion.div
            layoutId={selectLayoutId}
            transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
            className='pointer-events-none absolute top-0 h-full w-full bg-glass -z-50 rounded-2xl '
          ></motion.div>
        </motion.div>

        {/* Portal 出去的下拉框，脱离父容器的 overflow / z-index 限制 */}
        {typeof document !== 'undefined' &&
          createPortal(
            <AnimatePresence>
              {isOpen && dropdownStyle && (
                <motion.div
                  data-select-popover
                  layoutId={selectLayoutId}
                  transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
                  style={{
                    position: 'fixed',
                    left: dropdownStyle.left,
                    width: dropdownStyle.width,
                    top: dropdownStyle.openUp ? undefined : dropdownStyle.top,
                    bottom:
                      dropdownStyle.openUp ?
                        window.innerHeight - dropdownStyle.top
                      : undefined,
                    zIndex: 9999,
                  }}
                  className={cn(
                    'overflow-hidden rounded-2xl p-1.5 border border-border/80 shadow-xl shadow-black/10 dark:shadow-black/40',
                    'bg-panel/95 dark:bg-panel/90 backdrop-blur-xl',
                  )}
                >
                  {showSearch && (
                    <div className='relative mb-1'>
                      <Search className='absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-ink-secondary pointer-events-none' />
                      <input
                        ref={searchInputRef}
                        type='text'
                        value={searchQuery}
                        onChange={(e) => {
                          setSearchQuery(e.target.value);
                          setFocusedIndex(0);
                        }}
                        onKeyDown={handleListKeyDown}
                        placeholder={searchPlaceholder}
                        className={cn(
                          'w-full h-9 pl-8 pr-3 text-sm rounded-xl outline-none',
                          'bg-background-secondary/60 dark:bg-white/5',
                          'placeholder:text-ink-secondary/60 text-ink-primary',
                          'border border-transparent focus:border-primary/40',
                        )}
                      />
                    </div>
                  )}

                  <div
                    ref={listboxRef}
                    role='listbox'
                    tabIndex={showSearch ? -1 : 0}
                    onKeyDown={showSearch ? undefined : handleListKeyDown}
                    style={{
                      maxHeight:
                        showSearch ?
                          dropdownStyle.maxHeight - 44
                        : dropdownStyle.maxHeight,
                    }}
                    className='overflow-y-auto custom-scrollbar space-y-0.5'
                  >
                    {options.map((option, index) => {
                      const isSelected =
                        option.value === internalValue ||
                        option.label === internalValue;
                      const isFocused = focusedIndex === index;

                      return (
                        <div
                          key={`option-${index}-${option.value}`}
                          role='option'
                          aria-selected={isSelected}
                          title={option.label}
                          onClick={() =>
                            !option.disabled && handleSelect(option.value)
                          }
                          onMouseEnter={() => setFocusedIndex(index)}
                          className={cn(
                            'relative flex w-full items-center justify-between py-2 px-3 text-sm cursor-pointer select-none transition-all duration-150',
                            'rounded-xl',
                            isSelected ?
                              'bg-primary/10 text-primary font-semibold'
                            : 'text-ink-primary hover:bg-background-secondary/80 dark:hover:bg-white/5',
                            isFocused &&
                              !isSelected &&
                              'bg-background-secondary/80 dark:hover:bg-white/5 text-ink-primary',
                            option.disabled &&
                              'opacity-40 cursor-not-allowed pointer-events-none',
                          )}
                        >
                          <span className='truncate pr-1'>{option.label}</span>
                          {isSelected && (
                            <Check className='h-4 w-4 text-primary shrink-0 ml-2' />
                          )}
                        </div>
                      );
                    })}

                    {options.length === 0 && (
                      <div className='py-6 text-center text-xs text-ink-secondary'>
                        {searchQuery ?
                          'No matches found'
                        : 'No options available'}
                      </div>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>,
            document.body,
          )}

        {error && <Error show={!!error}>{error}</Error>}
      </div>
    );
  },
);
Select.displayName = 'Select';

export { Select };
