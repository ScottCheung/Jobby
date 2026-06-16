"use client"

import { motion, useInView, UseInViewOptions } from "framer-motion"
import { cn } from "@/lib/utils"
import React, { useRef } from "react"

export interface InViewProps extends React.HTMLAttributes<HTMLDivElement> {
    children: React.ReactNode
    /**
     * Fallback to render when not in view.
     * Defaults to an empty skeleton container.
     */
    fallback?: React.ReactNode
    /**
     * Margin parameter for Framer Motion's useInView.
     * Defaults to '-30% 0px -30% 0px'.
     */
    margin?: UseInViewOptions["margin"]
    /**
     * If true, animation only plays once.
     * Defaults to true.
     */
    once?: boolean
    /**
     * Vertical offset for slide-fade effect. Defaults to 20.
     */
    yOffset?: number
    /**
     * Horizontal offset for slide-fade effect. Defaults to 0.
     */
    xOffset?: number
    /**
     * Animation duration in seconds. Defaults to 0.5.
     */
    duration?: number
}

export function InView({
    children,
    fallback,
    margin = '-30% 0px -30% 0px',
    once = true,
    yOffset = 20,
    xOffset = 0,
    duration = 0.5,
    className,
    ...props
}: InViewProps) {
    const ref = useRef<HTMLDivElement>(null)
    const isInView = useInView(ref, { once, margin })

    return (
        <div ref={ref} className={cn("w-full h-full relative", className)} {...props}>
            {isInView ? (
                <motion.div
                    initial={{ opacity: 0, y: yOffset, x: xOffset }}
                    animate={{ opacity: 1, y: 0, x: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration }}
                    className="w-full h-full"
                >
                    {children}
                </motion.div>
            ) : (
                fallback !== undefined ? (
                    fallback
                ) : (
                    <motion.div className="flex h-full w-full items-center justify-center bg-ink-secondary/10 rounded-xl" />
                )
            )}
        </div>
    )
}
