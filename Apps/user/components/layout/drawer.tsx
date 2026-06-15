"use client"

import * as React from "react"
import { motion, AnimatePresence, HTMLMotionProps } from "framer-motion"
import { cn } from "@/lib/utils"

interface DrawerProps extends Omit<HTMLMotionProps<"div">, "children"> {
    isOpen: boolean
    onClose?: () => void
    width?: number | string
    children: React.ReactNode
}

export function Drawer({
    isOpen,
    onClose,
    width = 400,
    children,
    className,
    ...props
}: DrawerProps) {
    const springTransition = {
        type: 'spring',
        stiffness: 400,
        damping: 40,
    } as const

    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    initial={{ width: 0, opacity: 0 }}
                    animate={{ width: width, opacity: 1 }}
                    exit={{ width: 0, opacity: 0 }}
                    transition={springTransition}
                    className={cn(
                        "flex-shrink-0 overflow-hidden border-l border-border bg-panel h-screen sticky top-0",
                        className
                    )}
                    {...props}
                >
                    <div
                        className="h-full overflow-y-auto scrollbar-gutter-stable"
                        style={{
                            width,
                            scrollbarGutter: 'stable'
                        }}
                    >
                        {children}
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    )
}
