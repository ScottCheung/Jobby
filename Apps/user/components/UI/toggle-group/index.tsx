"use client"

import * as React from "react"
import { motion } from "framer-motion"
import { cn } from "@/lib/utils"
import { Tooltip } from "@/components/UI/tooltip"

export interface ToggleGroupItem {
    value: string
    label: string
    icon?: React.ElementType
}

interface ToggleGroupProps {
    items: ToggleGroupItem[]
    value: string
    onValueChange: (value: string) => void
    className?: string
    id?: string // Optional unique identifier for this toggle group
}

export function ToggleGroup({
    items,
    value,
    onValueChange,
    className,
    id,
}: ToggleGroupProps) {
    const generatedId = React.useId()
    // Generate a unique layoutId for this instance
    const layoutId = id || `toggle-group-${generatedId}`
    return (
        <div
            className={cn(
                "inline-flex items-center gap-1 rounded-full p-1 bg-glass",
                className
            )}
        >
            {items.map((item) => {
                const isSelected = value === item.value
                return (
                    <Tooltip
                        key={item.value}
                        content={item.label}
                        side="bottom"
                        delay={0}
                    >
                        <button
                            onClick={() => onValueChange(item.value)}
                            className={cn(
                                "relative flex size-8 items-center justify-center rounded-full text-sm font-medium transition-colors",
                                isSelected
                                    ? "text-ink-primary"
                                    : "text-ink-secondary"
                            )}
                            type="button"
                        >
                            {isSelected && (
                                <motion.div
                                    layoutId={layoutId}
                                    className="absolute inset-0 rounded-full bg-panel"
                                    transition={{
                                        type: "spring",
                                        bounce: 0.2,
                                        duration: 0.6,
                                    }}
                                />
                            )}
                            <span className="relative z-10 flex items-center justify-center">
                                {item.icon ? (
                                    <item.icon className="size-4" />
                                ) : (
                                    item.label
                                )}
                            </span>
                        </button>
                    </Tooltip>
                )
            })}
        </div>
    )
}
