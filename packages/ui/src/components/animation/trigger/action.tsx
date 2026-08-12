"use client"

import { motion, HTMLMotionProps } from "framer-motion"
import { cn } from "@/lib/utils"
import React from "react"

export interface ActionProps extends HTMLMotionProps<"div"> {
    children: React.ReactNode
    /**
     * Scale on hover. Default 1.05.
     */
    hoverScale?: number
    /**
     * Scale on tap/click. Default 0.95.
     */
    tapScale?: number
    /**
     * Brightness filter on hover. Default 1 (no change). 
     * Example: 1.1 for slight brighten.
     */
    hoverBrightness?: number
    /**
     * Whether to trigger disabled state (no interaction).
     */
    disabled?: boolean
}

export function Action({
    children,
    className,
    hoverScale = 1.05,
    tapScale = 0.95,
    hoverBrightness = 1,
    disabled = false,
    ...props
}: ActionProps) {
    if (disabled) {
        return <div className={cn(className)}>{children}</div>
    }

    return (
        <motion.div
            whileHover={{
                scale: hoverScale,
                filter: hoverBrightness !== 1 ? `brightness(${hoverBrightness})` : undefined
            }}
            whileTap={{ scale: tapScale }}
            className={cn("cursor-pointer", className)}
            {...props}
        >
            {children}
        </motion.div>
    )
}
