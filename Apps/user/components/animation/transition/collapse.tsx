"use client"

import { motion, HTMLMotionProps, Variants } from "framer-motion"
import { cn } from "@/lib/utils"
import React from "react"

export interface CollapseProps extends Omit<HTMLMotionProps<"div">, 'initial' | 'animate' | 'exit' | 'variants'> {
    /**
     * Whether the content is visible/expanded.
     */
    isOpen: boolean
    /**
     * Animation duration in seconds. Defaults to 0.7s.
     */
    duration?: number
}

const EASE = [0.22, 1, 0.36, 1] as const

export function Collapse({
    isOpen,
    children,
    className,
    duration = 0.7,
    ...props
}: CollapseProps) {
    const variants: Variants = {
        open: {
            height: 'auto',
            transition: {
                duration, ease: EASE
            }
        },
        closed: {
            height: 0,
            transition: {
                duration, ease: EASE
            }
        }
    }

    return (
        <motion.div
            initial={false}
            animate={isOpen ? "open" : "closed"}
            variants={variants}
            className={cn("overflow-hidden", className)}
            {...props}
        >
            {children}
        </motion.div>
    )
}
