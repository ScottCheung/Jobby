import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"
import { Loader2, LucideIcon } from "lucide-react"

const buttonVariants = cva(
    "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 disabled:pointer-events-none disabled:opacity-50 active:scale-[0.98] cursor-pointer",
    {
        variants: {
            variant: {
                default: "bg-zinc-900 text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-100 shadow-sm",
                secondary: "bg-zinc-100 text-zinc-900 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-100 dark:hover:bg-zinc-700",
                destructive: "bg-red-600 text-white hover:bg-red-700 dark:bg-red-600/90 dark:hover:bg-red-700",
                outline: "border border-zinc-200 bg-transparent hover:bg-zinc-50 text-zinc-900 dark:border-zinc-800 dark:text-zinc-100 dark:hover:bg-zinc-900",
                icon: "bg-transparent text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-900 dark:hover:text-zinc-100 rounded-xl",
                ghost: "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800/50 dark:hover:text-zinc-100",
                link: "text-zinc-900 dark:text-zinc-100 underline-offset-4 hover:underline",
            },
            size: {
                link: "p-0",
                sm: "h-9 px-3 text-xs font-semibold",
                icon: "h-9 w-9 shrink-0",
                default: "h-11 px-4 py-2 font-semibold",
                lg: "h-12 px-6 text-base font-semibold",
                WithIcons: "p-1.5"
            },
        },
        defaultVariants: {
            variant: "default",
            size: "default",
        },
    }
)

export interface ButtonProps
    extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
    asChild?: boolean
    Icon?: LucideIcon
    isLoading?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
    ({ className, variant, size, asChild = false, Icon, children, isLoading = false, ...props }, ref) => {
        const resolvedVariant = variant || (Icon && !children ? "icon" : undefined)
        const resolvedSize = size || (Icon && !children ? "icon" : undefined)

        return (
            <button
                className={cn(
                    buttonVariants({ variant: resolvedVariant, size: resolvedSize, className }),
                    isLoading && "cursor-not-allowed opacity-50"
                )}
                ref={ref}
                {...props}
            >
                {Icon && !isLoading && <Icon className={cn('size-4')} />}
                {children}
                {isLoading && <Loader2 className="size-4 animate-spin" />}
            </button>
        )
    }
)
Button.displayName = "Button"

export { Button, buttonVariants }
