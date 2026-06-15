"use client"

import * as React from "react"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/UI/tooltip"
import { cn } from "@/lib/utils"

interface AutoTooltipProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "content"> {
    children: React.ReactNode
    content?: React.ReactNode
}

export function AutoTooltip({ children, content, className, ...props }: AutoTooltipProps) {
    const [isTruncated, setIsTruncated] = React.useState(false)

    const ref = React.useCallback((element: HTMLDivElement | null) => {
        if (!element) return

        const checkTruncation = () => {
            setIsTruncated(element.scrollWidth > element.clientWidth)
        }

        const observer = new ResizeObserver(() => {
            checkTruncation()
        })

        observer.observe(element)
        checkTruncation()

        return () => {
            observer.disconnect()
        }
    }, [children])

    const tooltipContent = content || children

    if (!isTruncated) {
        return (
            <div
                ref={ref}
                className={cn("truncate block", className)}
                {...props}
            >
                {children}
            </div>
        )
    }

    return (
        <Tooltip content={tooltipContent}>
            <div
                ref={ref}
                className={cn("truncate block cursor-default", className)}
                {...props}
            >
                {children}
            </div>
        </Tooltip>
    )
}