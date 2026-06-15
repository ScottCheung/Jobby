// ... imports
import * as React from "react"
import { LucideIcon, ChevronDown, Check } from "lucide-react"
import { cn } from "@/lib/utils"
import { LabelWithHelp } from "@/components/UI/label/with-help"
import { Error } from "../text/typography"
import { AutoTooltip } from "@/components/UI/tooltip/auto-tooltip"
import { motion } from "framer-motion"
import { Collapse, Stagger, StaggerItem } from "@/components/animation"

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
    label: string
    icon?: LucideIcon
    error?: string
    containerClassName?: string
    helpTextShort?: string
    helpTextLong?: string
    placeholder?: string
}

// Utility to parse options from children
const getOptions = (children: React.ReactNode) => {
    const options: { value: string; label: string }[] = []
    React.Children.forEach(children, (child) => {
        if (React.isValidElement(child) && child.type === 'option') {
            options.push({
                value: (child.props as any).value || (child.props as any).children,
                label: (child.props as any).children,
            })
        }
    })
    return options
}

const Select = React.forwardRef<HTMLDivElement, SelectProps>(
    ({ label, icon: Icon, containerClassName, className, children, error, helpTextShort, helpTextLong, onChange, placeholder = "Select...", value, defaultValue, disabled, ...props }, ref) => {
        const [isOpen, setIsOpen] = React.useState(false)
        const [internalValue, setInternalValue] = React.useState(value || defaultValue || "")
        const contentRef = React.useRef<HTMLDivElement>(null)
        const buttonRef = React.useRef<HTMLButtonElement>(null)

        // Update internal value if controlled value changes
        React.useEffect(() => {
            if (value !== undefined) {
                setInternalValue(value)
            }
        }, [value])

        const options = React.useMemo(() => getOptions(children), [children])
        const selectedOption = options.find(opt => opt.value === internalValue || opt.label === internalValue)
        const containerRef = React.useRef<HTMLDivElement>(null)

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

        const handleSelect = (optionValue: string) => {
            if (value === undefined) {
                setInternalValue(optionValue)
            }

            // Create a synthetic event object compatible with react-hook-form
            if (onChange) {
                const syntheticEvent = {
                    target: {
                        value: optionValue,
                        name: props.name || '',
                    },
                } as React.ChangeEvent<HTMLSelectElement>
                onChange(syntheticEvent)
            }

            setIsOpen(false)
        }

        return (
            <div
                ref={ref}
                className={cn("relative w-full",
                    isOpen && "z-50",
                    containerClassName)
                }
            >
                <LabelWithHelp
                    label={label}
                    helpTextShort={helpTextShort}
                    helpTextLong={helpTextLong}
                    required={props.required}

                />

                {/* Wrapper with border and overflow-hidden for unified appearance */}
                < div
                    className={
                        cn(
                            " mt-2 border border-transparent bg-glass rounded-[24px] overflow-hidden transition-all duration-700",
                            disabled && "opacity-50 pointer-events-none",
                            isOpen && "bg-panel border-primary "
                        )}
                >
                    {/* Select button */}
                    < div className={cn("relative",)} >
                        {Icon && (
                            <Icon className="absolute left-4 top-1/2 size-4 -translate-y-1/2 text-ink-primary pointer-events-none z-10" />
                        )}

                        <button
                            type="button"
                            onClick={() => !disabled && setIsOpen(!isOpen)}
                            className={cn(
                                "w-full group flex items-center justify-between   ",
                                "select rounded-[24px] ",
                                Icon && "!pl-11",
                                error && "text-red-500",
                                className,
                                isOpen && "bg-glass "
                            )}
                            ref={buttonRef}
                            disabled={disabled}
                        >
                            <AutoTooltip className={cn(
                                'text-xs',
                                !selectedOption ? "text-ink-secondary" : "text-ink-primary"
                            )} content={selectedOption ? selectedOption.label : placeholder}>
                                {selectedOption ? selectedOption.label : placeholder}</AutoTooltip>
                            <div className="flex rounded-full group-hover:bg-glass p-3 transition-colors duration-300">
                                <motion.div
                                    animate={{ rotate: isOpen ? 180 : 0 }}
                                    transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] as const }}
                                    className="flex"
                                >
                                    <ChevronDown
                                        className="h-4 w-4 shrink-0 opacity-50"
                                    />
                                </motion.div>
                            </div>
                        </button>
                    </div >

                    {/* Dropdown content - expands from the select button */}
                    <Collapse
                        isOpen={isOpen}
                        className={cn(
                            isOpen && "w-full z-50 "
                        )}
                    >

                        <div className="max-h-100 overflow-y-auto overflow-x-hidden p-3">
                            <Stagger
                                className="space-y-1 "
                                animate={isOpen ? "visible" : "hidden"}
                                staggerDelay={0.1}
                            >
                                {options.map((option, index) => {
                                    const isSelected = option.value === internalValue || option.label === internalValue

                                    return (
                                        <StaggerItem
                                            key={`option-${index}-${option.value}`}
                                            onClick={() => handleSelect(option.value)}
                                            xOffset={20}
                                            className={cn(
                                                "relative flex w-full text-ink-secondary cursor-pointer select-none items-center rounded-card py-2.5 pl-3 pr-9 text-xs outline-none transition-colors",
                                                "hover:bg-primary hover:text-primary-foreground",
                                                isSelected && "bg-primary/20 text-ink-primary font-medium"
                                            )}
                                        >
                                            <AutoTooltip content={option.label}>{option.label}</AutoTooltip>
                                            {isSelected && (
                                                <span className="absolute right-3 flex h-3.5 w-3.5 items-center justify-center text-primary">
                                                    <Check className="h-4 w-4" />
                                                </span>
                                            )}
                                        </StaggerItem>
                                    )
                                })}
                                {options.length === 0 && (
                                    <div className="py-6 text-center text-sm text-muted-foreground">
                                        No options found
                                    </div>
                                )}
                            </Stagger>
                        </div>

                    </Collapse>
                </div >


                <Error show={(!!error)}>
                    {error}
                </Error>
            </div >
        )
    }
)
Select.displayName = "Select"

export { Select }

