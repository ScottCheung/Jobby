"use client"

import * as React from "react"
import * as TooltipPrimitive from "@radix-ui/react-tooltip"

import { cn } from "@/lib/utils"

const TooltipProvider = TooltipPrimitive.Provider

const TooltipRoot = TooltipPrimitive.Root

const TooltipTrigger = TooltipPrimitive.Trigger
const style = 'max-w-[300px] break-words rounded-[14px] border-2 border-panel text-[14px] px-4 py-2 bg-primary  text-primary-foreground  z-50'
const TooltipContent = React.forwardRef<
    React.ElementRef<typeof TooltipPrimitive.Content>,
    React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Content>
>(({ className, sideOffset = 16, ...props }, ref) => (
    <TooltipPrimitive.Portal>
        <TooltipPrimitive.Content
            ref={ref}
            sideOffset={sideOffset}
            className={cn(
                style,
                className
            )}
            {...props}
        />
    </TooltipPrimitive.Portal>
))
TooltipContent.displayName = TooltipPrimitive.Content.displayName

// Wrapper component to match previous API
interface TooltipProps {
    content: React.ReactNode
    children: React.ReactNode
    side?: "top" | "bottom" | "left" | "right"
    className?: string
    delay?: number
}

export function Tooltip({
    content,
    children,
    side = "top",
    className,
    delay = 200,
}: TooltipProps) {
    return (
        <TooltipProvider delayDuration={delay}>
            <TooltipRoot>
                <TooltipTrigger asChild>
                    {children}
                </TooltipTrigger>
                {content && <TooltipContent
                    side={side}
                    className={cn(style, className)}
                >
                    {content}
                </TooltipContent>}
            </TooltipRoot>
        </TooltipProvider>
    )
}

export { TooltipRoot, TooltipTrigger, TooltipContent, TooltipProvider }
