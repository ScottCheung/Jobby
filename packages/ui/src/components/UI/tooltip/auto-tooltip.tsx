"use client"

import * as React from "react"
import { Tooltip } from "./index"
import { cn } from "@/lib/utils"

const LINE_CLAMP_CLASSES: Record<number, string> = {
    1: "line-clamp-1",
    2: "line-clamp-2",
    3: "line-clamp-3",
    4: "line-clamp-4",
    5: "line-clamp-5",
    6: "line-clamp-6",
}

interface AutoTooltipProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "content"> {
    children: React.ReactNode
    content?: React.ReactNode
    lineClamp?: number
}

export function AutoTooltip({ children, content, className, lineClamp, ...props }: AutoTooltipProps) {
    const [isTruncated, setIsTruncated] = React.useState(false)
    const elementRef = React.useRef<HTMLDivElement | null>(null)

    const hasLineClamp = lineClamp !== undefined || /\bline-clamp\b/.test(className || "")

    React.useEffect(() => {
        const element = elementRef.current
        if (!element) return

        const checkTruncation = () => {
            const isHorizontalOverflow = element.scrollWidth > element.clientWidth
            const isVerticalOverflow = element.scrollHeight > element.clientHeight
            setIsTruncated(isHorizontalOverflow || isVerticalOverflow)
        }

        const observer = new ResizeObserver(() => {
            checkTruncation()
        })

        observer.observe(element)
        checkTruncation()

        return () => {
            observer.disconnect()
        }
    }, [children, content, className, lineClamp])

    const tooltipContent = content || children

    const combinedClassName = cn(
        !hasLineClamp && "truncate block",
        lineClamp && (LINE_CLAMP_CLASSES[lineClamp] || `line-clamp-[${lineClamp}]`),
        className
    )

    if (!isTruncated) {
        return (
            <div
                ref={elementRef}
                className={combinedClassName}
                {...props}
            >
                {children}
            </div>
        )
    }

    return (
        <Tooltip content={tooltipContent}>
            <div
                ref={elementRef}
                className={cn(combinedClassName, "cursor-default")}
                {...props}
            >
                {children}
            </div>
        </Tooltip>
    )
}