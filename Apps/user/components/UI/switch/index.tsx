"use client"

import * as React from "react"
import { motion } from "framer-motion"
import { Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"

interface SwitchProps {
    checked: boolean
    onCheckedChange: (checked: boolean) => void
    disabled?: boolean
    className?: string
    id?: string
    isLoading?: boolean
}

export function Switch({
    checked,
    onCheckedChange,
    disabled = false,
    className,
    id,
    isLoading = false,
}: SwitchProps) {
    const generatedId = React.useId()
    const switchId = id || generatedId

    return (
        <button
            type="button"
            role="switch"
            id={switchId}
            aria-checked={checked}
            disabled={disabled}
            onClick={() => onCheckedChange(!checked)}
            className={cn(
                "relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-50",
                checked ? "bg-primary" : "bg-glass",
                className
            )}
        >
            <motion.span
                layout
                transition={{ type: "spring", stiffness: 500, damping: 30 }}
                className={cn(
                    "pointer-events-none block h-5 w-5 rounded-full bg-primary-foreground -lg ring-0 transition-transform",
                    checked ? "translate-x-5" : "translate-x-0"
                )}
            >
                {isLoading && (
                    <div className="flex h-full w-full items-center justify-center">
                        <Loader2 className="h-3 w-3 animate-spin text-gray-400" />
                    </div>
                )}
            </motion.span>
        </button>
    )
}
