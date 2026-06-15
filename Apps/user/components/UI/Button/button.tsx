import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"
import { Loader2, LucideIcon } from "lucide-react"

const buttonVariants = cva(
    "inline-flex items-center gap-3 p-1 justify-center whitespace-nowrap rounded-full transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:pointer-events-none disabled:opacity-50 active:scale-95 cursor-pointer",
    {
        variants: {
            variant: {
                default: "bg-primary hover:bg-primary/80 text-primary-foreground",
                secondary: "border border-transparent hover:bg-primary/5 backdrop-blur-[20px]  bg-background text-ink-primary hover:text-primary",
                destructive: "bg-destructive  hover:bg-destructive/80 text-destructive-foreground",
                outline: "border border-primary text-primary hover:bg-primary  hover:text-primary-foreground",
                icon: "bg-glass text-ink-secondary hover:bg-primary/90 hover:text-primary-foreground rounded-full ",
                ghost: "text-ink-primary hover:bg-primary-gradient hover:text-primary-foreground",
                link: "text-primary underline-offset-4 hover:underline",
            },
            size: {
                link: "p-0",
                sm: "h-[40px] px-3 font-semibold",
                icon: "h-[40px] w-[40px] shrink-0",
                default: "h-[48px] px-6 py-2 font-semibold",
                lg: "h-[52px]  px-6 text-lg font-semibold uppercase italic",
                WithIcons: 'p-1'
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
