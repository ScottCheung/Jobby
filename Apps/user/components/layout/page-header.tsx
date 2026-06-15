"use client"

import * as React from "react"
import { motion } from "framer-motion"
import { LinearBlur } from "progressive-blur"
import { cn } from "@/lib/utils"
import { H1, H2, Small } from "@/components/UI/text/typography"
import { ScrollLayout } from "@/components/animation"

interface PageHeaderProps {
    title: string
    description?: string
    actions?: React.ReactNode
    children?: React.ReactNode
    className?: string
    scrollContainerRef?: React.RefObject<HTMLElement | null>
}

export function PageHeader({
    title,
    description,
    actions,
    children,
    className,
    scrollContainerRef,
}: PageHeaderProps) {
    return (
        <motion.header
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className={cn("sticky top-0 left-0 right-0 z-40", className)}
        >
            {/* Background Blur */}
            <div className="absolute inset-0 -z-10 h-[150px] pointer-events-none">
                <div
                    className="flex z-10 from-[20%] h-[150px] pb-[12%] bg-gradient-to-b from-background to-transparent "
                ></div>
                <LinearBlur
                    steps={5}
                    strength={100}
                    side="top"
                    tint="var(--background)"
                    style={{
                        position: 'absolute',
                        inset: 0,
                        zIndex: -1,
                    }}
                />
            </div>

            <div className="space-y-4 p-page ">

                <ScrollLayout scrollContainerRef={scrollContainerRef}>
                    <ScrollLayout.TopToLeft>
                        <div>
                            <H1>
                                <span className="text-primary block pb-1">
                                    {title}
                                </span>
                            </H1>
                            {description && (
                                <Small className="mt-1 text-ink-secondary">
                                    {description}
                                </Small>
                            )}
                        </div>
                    </ScrollLayout.TopToLeft>

                    <ScrollLayout.BtmToRight>

                        {children}

                    </ScrollLayout.BtmToRight>
                </ScrollLayout>


            </div>
        </motion.header>
    )
}
