"use client"

import { motion, AnimatePresence, HTMLMotionProps, Variants } from "framer-motion"
import { cn } from "@/lib/utils"
import React from "react"

export interface SlideProps extends HTMLMotionProps<"div"> {
    /**
     * Controlled visibility state.
     */
    show?: boolean
    /**
     * Direction to slide FROM.
     * 'left' = slides in from left (starts at x: -100%)
     * 'right' = slides in from right (starts at x: 100%)
     * 'top' = slides in from top (starts at y: -100%)
     * 'bottom' = slides in from bottom (starts at y: 100%)
     */
    direction?: 'left' | 'right' | 'top' | 'bottom'
    /**
     * Distance to slide. Defaults to "100%" (of itself).
     * Can be pixel value e.g. 200.
     */
    offset?: string | number
    duration?: number
}

export function Slide({
    show,
    children,
    className,
    direction = 'left',
    offset = '100%',
    duration = 0.3,
    ...props
}: SlideProps) {

    const getInitial = () => {
        switch (direction) {
            case 'left': return { x: typeof offset === 'number' ? -offset : `-${offset}` }
            case 'right': return { x: offset }
            case 'top': return { y: typeof offset === 'number' ? -offset : `-${offset}` }
            case 'bottom': return { y: offset }
        }
    }

    const variants: Variants = {
        hidden: {
            ...getInitial(),
            opacity: 0,
        },
        visible: {
            x: 0,
            y: 0,
            opacity: 1,
            transition: {
                type: "spring",
                damping: 25,
                stiffness: 300,
                duration
            }
        },
        exit: {
            ...getInitial(),
            opacity: 0,
            transition: {
                duration: duration * 0.8,
                ease: "easeInOut"
            }
        }
    }

    if (show !== undefined) {
        return (
            <AnimatePresence mode="wait">
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
