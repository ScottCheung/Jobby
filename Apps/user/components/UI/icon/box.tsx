import * as React from "react"
import { cn } from "@/lib/utils"

export interface IconBoxProps extends React.HTMLAttributes<HTMLDivElement> {
    children: React.ReactNode
}

export function IconBox({ className, children, ...props }: IconBoxProps) {
    return (
        <div
            className={cn(
                "flex size-12 items-center justify-center rounded-2xl bg-primary/5 text-primary transition-all duration-300 group-hover:bg-primary group-hover:text-white dark:bg-primary/20",
                className
            )}
            {...props}
        >
            {children}
        </div>
    )
}
