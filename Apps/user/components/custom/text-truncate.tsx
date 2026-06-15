"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import { Tooltip } from "@/components/UI/tooltip"

interface TextTruncateProps {
    text?: string | null
    maxLength?: number
    className?: string
    /**
     * If true, the text will be shown in full (wrapped).
     * If false, it will be truncated with ellipsis.
     * Default is false (truncated).
     */
    isExpanded?: boolean
}

export function TextTruncate({
    text,
    maxLength = 50,
    className,
    isExpanded = false,
}: TextTruncateProps) {
    // If expanded, just show the text with normal wrapping
    if (isExpanded) {
        return (
            <span className={cn("whitespace-normal break-words", className)}>
                {text}
            </span>
        )
    }

    // If text is empty/null, return nothing
    if (!text) {
        return null
    }

    // If text is shorter than limit, just show it
    if (text.length <= maxLength) {
        return <span className={className}>{text}</span>
    }

    // Truncate logic
    const truncatedText = text.slice(0, maxLength) + "..."

    return (
        <Tooltip content={text} side="top">
            <span className={cn("cursor-help truncate", className)}>
                {truncatedText}
            </span>
        </Tooltip>
    )
}
