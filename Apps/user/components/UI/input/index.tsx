import * as React from "react"
import { LucideIcon, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { LabelWithHelp } from "@/components/UI/label/with-help"
import { Button } from "../Button"
import { Error } from "../text/typography"

// Define Base Input logic here since separate file was deleted
const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
    ({ className, type, ...props }, ref) => {
        return (
            <input
                type={type}
                className={cn(
                    "input ",
                    className
                )}
                ref={ref}
                {...props}
            />
        )
    }
)
Input.displayName = "Input"

export interface InputFieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
    label: string
    icon?: LucideIcon
    error?: string
    containerClassName?: string
    showCharCount?: boolean
    helpTextShort?: string
    helpTextLong?: string
    required?: boolean
}

const InputField = React.forwardRef<HTMLInputElement, InputFieldProps>(
    ({ label, icon: Icon, containerClassName, className, error, showCharCount = true, maxLength, onChange, onBlur, helpTextShort, helpTextLong, value, defaultValue, ...props }, ref) => {
        // Handle controlled vs uncontrolled value for character count
        const [internalValue, setInternalValue] = React.useState<string>(
            (value as string) || (defaultValue as string) || ""
        )
        const inputRef = React.useRef<HTMLInputElement>(null)

        React.useEffect(() => {
            if (value !== undefined) {
                setInternalValue(value as string)
            }
        }, [value])

        const currentLength = internalValue.length
        const hasValue = currentLength > 0
        const isExceeded = maxLength ? currentLength > maxLength : false

        const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
            if (value === undefined) {
                setInternalValue(e.target.value)
            }
            onChange?.(e)
        }

        const handleClear = () => {
            if (inputRef.current) {
                const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
                    window.HTMLInputElement.prototype,
                    "value"
                )?.set
                nativeInputValueSetter?.call(inputRef.current, "")

                const event = new Event("input", { bubbles: true })
                inputRef.current.dispatchEvent(event)

                if (value === undefined) {
                    setInternalValue("")
                }

                inputRef.current.focus()
            }
        }

        return (
            <div className={cn("group", containerClassName)}>
                <div className="flex justify-between items-center">
                    <LabelWithHelp
                        label={label}
                        helpTextShort={helpTextShort}
                        helpTextLong={helpTextLong}
                        required={props.required}
                    />
                    {showCharCount && maxLength && (
                        <p className={
                            cn(
                                "text-xs transition-colors",
                                isExceeded
                                    ? "text-red-500 dark:text-red-400 font-medium"
                                    : "text-gray-400 dark:text-ink-secondary"
                            )
                        }>
                            {currentLength} / {maxLength}
                        </p>
                    )}
                </div>
                <div className="relative mt-2">
                    {Icon && (
                        <Icon className="absolute z-20 left-4 top-1/2 size-4 -translate-y-1/2 transition-all duration-1000 text-ink-secondary group-focus-within:animate-pulse group-focus-within:scale-120 group-focus-within:text-primary" />
                    )}
                    <Input
                        ref={(node) => {
                            inputRef.current = node
                            if (typeof ref === 'function') {
                                ref(node)
                            } else if (ref) {
                                ref.current = node
                            }
                        }}
                        className={cn(
                            Icon && "!pl-11 z-0",
                            hasValue && "!pr-11",
                            error && "border-red-500 focus-visible:ring-red-500",
                            isExceeded && "border-red-500 focus-visible:ring-red-500",
                            "rounded-full",
                            className
                        )}
                        onChange={handleChange}
                        onBlur={onBlur}
                        value={value}
                        defaultValue={defaultValue}
                        {...props}
                    />
                    {hasValue && !props.disabled && (
                        <Button
                            Icon={X}
                            onClick={handleClear}
                            className="absolute right-1 top-1  text-ink-secondary"
                            variant="ghost"
                        />

                    )}
                </div>
                <div className='flex items-center justify-between mt-1'>
                    <Error>
                        {error || (isExceeded &&
                            `Exceeds maximum length by ${currentLength - (maxLength || 0)
                            } characters`)}
                    </Error>
                </div>

            </div>
        )
    }
)
InputField.displayName = "InputField"

export { InputField, Input as Input }
