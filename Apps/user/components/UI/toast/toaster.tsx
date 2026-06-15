"use client"

import * as React from "react"
import { AnimatePresence, motion } from "framer-motion"
import { CheckCircle, XCircle, Info, AlertTriangle, X } from "lucide-react"

import { useLayoutStore } from "@/lib/store/layout-store"
import { cn } from "@/lib/utils"

const icons = {
    success: CheckCircle,
    error: XCircle,
    info: Info,
    warning: AlertTriangle,
}

const colors = {
    success: "text-success",
    error: "text-error",
    info: "text-info",
    warning: "text-warning",
}

const iconColors = {
    success: "text-success",
    error: "text-error",
    info: "text-info",
    warning: "text-warning",
}

interface StaticToastProps {
    type: 'success' | 'error' | 'info' | 'warning';
    title?: string;
    message: string;
    onClose?: () => void;
    duration?: number;
    className?: string; // Add className prop
}

export function StaticToast({ type, title, message, onClose, duration = 5000, className }: StaticToastProps) {
    const Icon = icons[type]

    return (
        <div
            className={cn(
                "pointer-events-auto relative flex w-full max-w-sm items-center gap-3.5 rounded-2xl border p-4",
                "shadow-lg shadow-black/20 bg-panel ",
                "dark:shadow-black/20",
                colors[type],
                className
            )}
        >
            {/* Content Area */}
            <div className="flex items-start gap-3.5 flex-1">
                <div className="shrink-0">
                    <Icon className={cn("w-5 h-5 mt-0.5", iconColors[type])} />
                </div>

                <div className="flex-1 min-w-0">
                    {onClose && (
                        <div
                            onClick={onClose}
                            className="float-right ml-2 relative group flex items-start justify-center w-8 h-8 shrink-0 cursor-pointer"
                        >
                            {(duration ?? 0) > 0 && (
                                <svg
                                    className="absolute inset-0 w-full h-full -rotate-90"
                                    viewBox="0 0 100 100"
                                >
                                    <motion.circle
                                        cx="50"
                                        cy="50"
                                        r="45"
                                        fill="none"
                                        stroke="currentColor"
                                        strokeWidth="10"
                                        strokeLinecap="round"
                                        initial={{ pathLength: 1 }}
                                        animate={{ pathLength: 0 }}
                                        transition={{
                                            duration: (duration ?? 5000) / 1000,
                                            ease: "linear",
                                        }}
                                    />
                                </svg>
                            )}
                            <button
                                className={cn(
                                    "relative z-10 cursor-pointer flex items-center justify-center w-full h-full rounded-full",
                                    "hover:bg-background",
                                    "active:scale-90"
                                )}
                            >
                                <X className="w-4 h-4 opacity-40 group-hover:opacity-100 transition-opacity" />
                            </button>
                        </div>
                    )}


                    {title && (
                        <p className="font-semibold text-sm mb-0.5 leading-tight">
                            {title}
                        </p>
                    )}
                    <p className="text-sm leading-relaxed opacity-90">
                        {message}
                    </p>
                </div>
            </div>
        </div>
    )
}


export function Toaster() {
    const notifications = useLayoutStore((state) => state.notifications)
    const removeNotification = useLayoutStore((state) => state.actions.removeNotification)

    return (
        <div className="fixed bottom-4 left-4 z-50 flex flex-col justify-end gap-3 sm:bottom-auto sm:top-4 sm:flex-col-reverse">
            <AnimatePresence mode="popLayout">
                {notifications.map((notification) => {
                    return (
                        <motion.div
                            key={notification.id}
                            layout
                            initial={{ opacity: 0, y: 20, scale: 0.95 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{
                                opacity: 0,
                                x: -100,
                                scale: 0.9,
                                transition: { duration: 0.2, ease: "easeIn" }
                            }}
                            transition={{
                                layout: { duration: 0.2, ease: "easeInOut" }
                            }}
                        >
                            <StaticToast
                                type={notification.type}
                                title={notification.title}
                                message={notification.message}
                                onClose={() => removeNotification(notification.id)}
                                duration={notification.duration}
                            />
                        </motion.div>
                    )
                })}
            </AnimatePresence>
        </div>
    )
}