import * as React from "react"
import { LucideIcon, ChevronDown, ChevronLeft, ChevronRight, Calendar as CalendarIcon, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { LabelWithHelp } from "@/components/UI/label/with-help"
import { Error } from "../text/typography"
import { motion } from "framer-motion"
import { Collapse } from "@/components/animation"
import dayjs from "dayjs"
import { AutoTooltip } from "../tooltip/auto-tooltip"

// --- Date Utilities ---

const daysOfWeek = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"]

const getDaysInMonth = (year: number, month: number) => {
    return new Date(year, month + 1, 0).getDate()
}

const getFirstDayOfMonth = (year: number, month: number) => {
    return new Date(year, month, 1).getDay()
}

const isSameDay = (d1?: Date, d2?: Date) => {
    if (!d1 || !d2) return false
    return d1.getDate() === d2.getDate() &&
        d1.getMonth() === d2.getMonth() &&
        d1.getFullYear() === d2.getFullYear()
}

const isDateInRange = (date: Date, start?: Date, end?: Date) => {
    if (!start || !end) return false
    const d = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime()
    const s = new Date(start.getFullYear(), start.getMonth(), start.getDate()).getTime()
    const e = new Date(end.getFullYear(), end.getMonth(), end.getDate()).getTime()
    return d >= Math.min(s, e) && d <= Math.max(s, e)
}

const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

// --- Component Types ---

export type DatePickerMode = 'single' | 'range' | 'multiple'

export interface DatePickerProps {
    label?: string
    mode?: DatePickerMode
    value?: Date | [Date | undefined, Date | undefined] | Date[]
    onChange?: (value: any) => void
    placeholder?: string
    error?: string
    className?: string
    containerClassName?: string
    disabled?: boolean
    helpTextShort?: string
    helpTextLong?: string
    icon?: LucideIcon
    minDate?: Date
    maxDate?: Date
    onMonthChange?: (date: Date) => void
}

interface MonthCalendarProps {
    monthDate: Date
    value: Date | [Date | undefined, Date | undefined] | Date[] | undefined
    mode: DatePickerMode
    onChange: (date: Date) => void
    minDate?: Date
    maxDate?: Date
}

const MonthCalendar: React.FC<MonthCalendarProps> = ({
    monthDate,
    value,
    mode,
    onChange,
    minDate,
    maxDate
}) => {
    const year = monthDate.getFullYear()
    const month = monthDate.getMonth()

    const daysInMonth = getDaysInMonth(year, month)
    const firstDay = getFirstDayOfMonth(year, month)

    const isSelected = (date: Date) => {
        if (mode === 'single') {
            return isSameDay(value as Date, date)
        }
        if (mode === 'range') {
            const [start, end] = (value as [Date | undefined, Date | undefined]) || []
            return isSameDay(start, date) || isSameDay(end, date)
        }
        if (mode === 'multiple') {
            return (value as Date[])?.some(d => isSameDay(d, date))
        }
        return false
    }

    const isInRangeMiddle = (date: Date) => {
        if (mode !== 'range') return false
        const [start, end] = (value as [Date | undefined, Date | undefined]) || []
        if (!start || !end) return false

        const d = date.getTime()
        const s = new Date(start.getFullYear(), start.getMonth(), start.getDate()).getTime()
        const e = new Date(end.getFullYear(), end.getMonth(), end.getDate()).getTime()

        // Strictly between, excluding start and end
        return d > Math.min(s, e) && d < Math.max(s, e)
    }

    return (
        <div className="w-full max-w-[280px]">
            <div className="flex items-center justify-center mb-4">
                <span className="text-sm font-medium text-ink-primary">
                    {monthDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                </span>
            </div>

            <div className="grid grid-cols-7 gap-0 mb-2">
                {daysOfWeek.map(day => (
                    <div key={day} className="text-center text-[10px] text-ink-secondary font-medium uppercase tracking-wider py-1">
                        {day}
                    </div>
                ))}
            </div>

            <div className="grid grid-cols-7 gap-y-1 gap-x-0">
                {Array.from({ length: firstDay }).map((_, i) => (
                    <div key={`empty-${i}`} />
                ))}
                {Array.from({ length: daysInMonth }).map((_, i) => {
                    const day = i + 1
                    const date = new Date(year, month, day)
                    const selected = isSelected(date)

                    let isRangeStart = false
                    let isRangeEnd = false
                    if (mode === 'range') {
                        const [start, end] = (value as [Date | undefined, Date | undefined]) || []
                        isRangeStart = !!start && isSameDay(start, date)
                        isRangeEnd = !!end && isSameDay(end, date)

                        // Swap visually if start > end (though logic usually handles this, just to be safe in rendering)
                        if (start && end && start > end) {
                            const temp = isRangeStart
                            isRangeStart = isRangeEnd
                            isRangeEnd = temp
                        }
                    }

                    const inRangeMiddle = isInRangeMiddle(date)
                    const isRangeBoundary = isRangeStart || isRangeEnd

                    return (
                        <div key={day} className="relative w-full h-8 flex items-center justify-center">
                            {/* Connecting Strip for Ranges */}
                            {(inRangeMiddle || isRangeStart || isRangeEnd) && (
                                <div
                                    className={cn(
                                        "absolute h-full top-0 bg-primary/10 ",
                                        inRangeMiddle && "left-0 right-0",
                                        isRangeStart && "left-1/2 right-0", // Start connects to right
                                        isRangeEnd && "left-0 right-1/2",   // End connects to left
                                        (isRangeStart && isRangeEnd && !inRangeMiddle) && "hidden" // Single day range edge case
                                    )}
                                />
                            )}

                            <button
                                onClick={(e) => {
                                    e.stopPropagation()
                                    onChange(date)
                                }}
                                className={cn(
                                    "relative z-10 w-8 h-8 rounded-full flex items-center justify-center text-xs transition-colors",
                                    selected ? "bg-primary text-primary-foreground font-medium shadow-sm hover:bg-primary/90" : "text-ink-primary hover:bg-black/5",
                                    inRangeMiddle && "text-primary font-medium" // Text color inside range
                                )}
                            >
                                {day}
                            </button>
                        </div>
                    )
                })}
            </div>
        </div>
    )
}

export const DatePicker = React.forwardRef<HTMLDivElement, DatePickerProps>(
    ({
        label,
        mode = 'single',
        value,
        onChange,
        placeholder = "Pick a date",
        error,
        className,
        containerClassName,
        disabled,
        helpTextShort,
        helpTextLong,
        icon: Icon = CalendarIcon,
        minDate,
        maxDate,
        onMonthChange // Destructure onMonthChange
    }, ref) => {
        const [isOpen, setIsOpen] = React.useState(false)
        const [currentDate, setCurrentDate] = React.useState(new Date())
        const containerRef = React.useRef<HTMLDivElement>(null)
        const buttonRef = React.useRef<HTMLButtonElement>(null)

        // Sync internal calendar view with value
        React.useEffect(() => {
            if (isOpen) {
                let targetDate = new Date()
                if (mode === 'single' && value instanceof Date) {
                    targetDate = new Date(value)
                } else if (mode === 'range' && Array.isArray(value) && value[0]) {
                    targetDate = new Date(value[0])
                } else if (mode === 'multiple' && Array.isArray(value) && value.length > 0) {
                    const lastDate = value[value.length - 1];
                    if (lastDate) targetDate = new Date(lastDate);
                }
                setCurrentDate(targetDate)
            }
        }, [isOpen, mode, value])

        // Click outside handler
        React.useEffect(() => {
            const handleClickOutside = (event: MouseEvent) => {
                if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                    setIsOpen(false)
                }
            }
            document.addEventListener("mousedown", handleClickOutside)
            return () => document.removeEventListener("mousedown", handleClickOutside)
        }, [])

        const handlePrevMonth = (e: React.MouseEvent) => {
            e.stopPropagation()
            const newDate = dayjs(currentDate).subtract(1, 'month');
            setCurrentDate(newDate.toDate());
            onMonthChange?.(newDate.toDate()); // Call onMonthChange
        }

        const handleNextMonth = (e: React.MouseEvent) => {
            e.stopPropagation()
            const newDate = dayjs(currentDate).add(1, 'month');
            setCurrentDate(newDate.toDate());
            onMonthChange?.(newDate.toDate()); // Call onMonthChange
        }

        const handleYearChange = (e: React.MouseEvent, offset: number) => {
            e.stopPropagation()
            const newDate = dayjs(currentDate).add(offset, 'year');
            setCurrentDate(newDate.toDate());
            onMonthChange?.(newDate.toDate()); // Call onMonthChange
        }

        // We can just keep simple month navigation for now
        // const handleYearChange = ... (removed for simplicity in dual view as it might be confusing which month shifts, 
        // usually dual view just has simple prev/next for months)

        const handleDateClick = (clickedDate: Date) => {
            if (mode === 'single') {
                onChange?.(clickedDate)
                setIsOpen(false)
            } else if (mode === 'range') {
                const currentRange = (value as [Date | undefined, Date | undefined]) || [undefined, undefined]
                const [start, end] = currentRange

                if (!start || (start && end)) {
                    onChange?.([clickedDate, undefined])
                } else {
                    // Ensure start is before end
                    if (clickedDate < start) {
                        onChange?.([clickedDate, start])
                    } else {
                        onChange?.([start, clickedDate])
                    }
                }
            } else if (mode === 'multiple') {
                const currentDates = (value as Date[]) || []
                const exists = currentDates.find(d => isSameDay(d, clickedDate))

                if (exists) {
                    onChange?.(currentDates.filter(d => !isSameDay(d, clickedDate)))
                } else {
                    onChange?.([...currentDates, clickedDate])
                }
            }
        }

        // Render Helpers
        const renderValue = () => {
            if (!value) return placeholder

            if (mode === 'single' && value instanceof Date) {
                return formatDate(value)
            }

            if (mode === 'range' && Array.isArray(value)) {
                const [start, end] = value as [Date | undefined, Date | undefined]
                if (start && end) return `${formatDate(start)} - ${formatDate(end)}`
                if (start) return `${formatDate(start)} - ...`
                return placeholder
            }

            if (mode === 'multiple' && Array.isArray(value)) {
                if (value.length === 0) return placeholder
                if (value.length === 1) return formatDate(value[0])
                return `${value.length} dates selected`
            }

            return placeholder
        }

        // Prepare the two months to display
        const nextMonthDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1)

        return (
            <div
                ref={ref}
                className={cn("relative w-full", isOpen && "z-50", containerClassName)}
            >
                {label && (
                    <LabelWithHelp
                        label={label}
                        helpTextShort={helpTextShort}
                        helpTextLong={helpTextLong}
                    />
                )}

                {/* Wrapper */}
                <div
                    ref={containerRef}
                    className={cn(
                        "mt-2 border border-transparent bg-glass rounded-[24px] overflow-hidden transition-all duration-700",
                        disabled && "opacity-50 pointer-events-none",
                        isOpen && "bg-panel border-primary"
                    )}
                >
                    <div className="relative">
                        <Icon className="absolute left-4 top-1/2 size-4 -translate-y-1/2 text-ink-primary pointer-events-none z-10" />
                        <button
                            type="button"
                            onClick={() => !disabled && setIsOpen(!isOpen)}
                            disabled={disabled}
                            className={cn(
                                "w-full group flex items-center justify-between",
                                "select rounded-[24px] py-3 ", // Match Select padding/height
                                "!pl-11",
                                error && "text-red-500",
                                className,
                                isOpen && "bg-glass"
                            )}
                            ref={buttonRef}
                        >
                            <AutoTooltip
                                content={renderValue()}
                                className={cn(
                                    "truncate text-xs text-left",
                                    !value || (Array.isArray(value) && value.length === 0) ? "text-ink-secondary" : "text-ink-primary"
                                )}
                            >
                                {renderValue()}
                            </AutoTooltip>

                            <div className="flex items-center gap-2">
                                {(value && ((mode === 'single') || (Array.isArray(value) && value.length > 0))) && !disabled && (
                                    <div
                                        className="p-1 hover:bg-black/5 rounded-full transition-colors cursor-pointer z-20"
                                        onClick={(e) => {
                                            e.stopPropagation()
                                            onChange?.(mode === 'single' ? undefined : (mode === 'range' ? [undefined, undefined] : []))
                                        }}
                                    >
                                        <X className="h-3 w-3 text-ink-secondary" />
                                    </div>
                                )}
                                <div className="flex rounded-full group-hover:bg-glass p-1 transition-colors duration-300">
                                    <motion.div
                                        animate={{ rotate: isOpen ? 180 : 0 }}
                                        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] as const }} // Added 'as const'
                                        className="flex p-2"
                                    >
                                        <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
                                    </motion.div>
                                </div>
                            </div>
                        </button>
                    </div>

                    {/* Dropdown Content */}
                    <Collapse
                        isOpen={isOpen}
                        duration={0.5}
                        className={cn("overflow-hidden  bg-panel",

                        )}
                    >
                        <div className="p-2 sm:p-4">
                            <div className="flex flex-col sm:flex-row gap-4 sm:gap-8 items-start justify-center relative">

                                {/* Prev Button Absolute Left */}
                                <div className="absolute left-0 top-1 flex items-center gap-1 z-10">
                                    <button
                                        onClick={(e) => handleYearChange(e, -1)}
                                        className="p-1 hover:bg-black/5 rounded-full text-ink-secondary hover:text-ink-primary transition-colors"
                                    >
                                        <span className="text-[10px] font-bold">{'<<'}</span>
                                    </button>
                                    <button
                                        onClick={handlePrevMonth}
                                        className="p-1 hover:bg-black/5 rounded-full text-ink-secondary hover:text-ink-primary transition-colors"
                                    >
                                        <ChevronLeft className="h-4 w-4" />
                                    </button>
                                </div>

                                {/* Month 1 */}
                                <MonthCalendar
                                    monthDate={currentDate}
                                    value={value}
                                    mode={mode}
                                    onChange={handleDateClick}
                                    minDate={minDate}
                                    maxDate={maxDate}
                                />

                                {mode === 'range' && (
                                    <>
                                        <div className="hidden sm:block w-[1px] bg-black/5 self-stretch"></div>

                                        <MonthCalendar
                                            monthDate={nextMonthDate}
                                            value={value}
                                            mode={mode}
                                            onChange={handleDateClick}
                                            minDate={minDate}
                                            maxDate={maxDate}
                                        />
                                    </>
                                )}

                                {/* Next Button Absolute Right */}
                                <div className="absolute right-0 top-1 flex items-center gap-1 z-10">
                                    <button
                                        onClick={handleNextMonth}
                                        className="p-1 hover:bg-black/5 rounded-full text-ink-secondary hover:text-ink-primary transition-colors"
                                    >
                                        <ChevronRight className="h-4 w-4" />
                                    </button>
                                    <button
                                        onClick={(e) => handleYearChange(e, 1)}
                                        className="p-1 hover:bg-black/5 rounded-full text-ink-secondary hover:text-ink-primary transition-colors"
                                    >
                                        <span className="text-[10px] font-bold">{'>>'}</span>
                                    </button>
                                </div>

                            </div>

                            {/* Footer for Today shortcut */}
                            <div className="mt-4 pt-3 border-t border-black/5 flex justify-center">
                                <button
                                    onClick={() => {
                                        const now = dayjs().toDate(); // Use dayjs for 'now'
                                        setCurrentDate(now);
                                        onMonthChange?.(now); // Call onMonthChange
                                        if (mode === 'single') {
                                            if (value instanceof Date && isSameDay(value, now)) return
                                            onChange?.(now)
                                            setIsOpen(false)
                                        }
                                    }}
                                    className="text-xs text-primary font-medium hover:underline"
                                >
                                    Today
                                </button>
                            </div>
                        </div>
                    </Collapse>
                </div>

                <Error show={(!!error)}>
                    {error}
                </Error>
            </div>
        )
    }
)

DatePicker.displayName = "DatePicker"
