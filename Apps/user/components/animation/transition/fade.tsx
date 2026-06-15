"use client"

import { motion, AnimatePresence, HTMLMotionProps, Variants } from "framer-motion"
import { cn } from "@/lib/utils"
import React from "react"

export interface FadeProps extends HTMLMotionProps<"div"> {
    /**
     * Whether the element should be visible.
     * If provided, wraps children in AnimatePresence.
     * If undefined, assumes parent controls presence.
     */
    show?: boolean
    /**
     * Blur amount in px. Defaults to 0 (no blur) or 8 if boolean true.
     */
    blur?: boolean | number
    /**
     * Vertical offset for slide-fade effect. Defaults to 0.
     */
    yOffset?: number
    /**
    * Horizontal offset for slide-fade effect. Defaults to 0.
    */
    xOffset?: number
    duration?: number
    delay?: number
}

export function Fade({
    show,
    children,
    className,
    blur = false,
    yOffset = 0,
    xOffset = 0,
    duration = 0.4,
    delay = 0,
    ...props
}: FadeProps) {
    const blurValue = typeof blur === 'number' ? blur : blur ? 8 : 0

    const variants: Variants = {
        hidden: {
            opacity: 0,
            y: yOffset,
            x: xOffset,
            filter: blurValue ? `blur(${blurValue}px)` : undefined,
        },
        visible: {
            opacity: 1,
            y: 0,
            x: 0,
            filter: "blur(0px)",
            transition: {
                duration,
                delay,
                ease: [0.22, 1, 0.36, 1],
            }
        },
        exit: {
            opacity: 0,
            y: yOffset,
            x: xOffset,
            filter: blurValue ? `blur(${blurValue}px)` : undefined,
            transition: {
                duration: duration * 0.75,
                ease: [0.22, 1, 0.36, 1],
            }
        }
    }

    // If 'show' is strictly controlled, we handle AnimatePresence
    if (show !== undefined) {
        return (
            <AnimatePresence>
                {show && (
                    <motion.div
                        initial="hidden"
                        animate="visible"
                        exit="exit"
                        variants={variants}
                        className={cn(className)}
                        {...props}
                    >
                        {children}
                    </motion.div>
                )}
            </AnimatePresence>
        )
    }

    // Otherwise pass through (parent handles presence or it's just an entry anim)
    return (
        <motion.div
            initial="hidden"
            animate="visible"
            exit="exit"
            variants={variants}
            className={cn(className)}
            {...props}
        >
            {children}
        </motion.div>
    )
}
