"use client"

import * as React from "react"
import { useTheme, ThemeColor } from "@/components/theme-provider"
import { cn } from "@/lib/utils"
import { Check } from "lucide-react"
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/UI/tooltip"

const colors: { name: ThemeColor; class: string }[] = [
    { name: "blue", class: "bg-[#0f4c81]" },
    { name: "purple", class: "bg-[#7c3aed]" },
    { name: "green", class: "bg-[#10b981]" },
    { name: "orange", class: "bg-[#f97316]" },
    { name: "rose", class: "bg-[#e11d48]" },
]

export function ColorPicker() {
    const { setThemeColor, themeColor } = useTheme()

    return (
        <div className="inline-flex items-center gap-2 bg-glass rounded-card p-2">
            {colors.map((color) => (
                <Tooltip
                    key={color.name}
                    content={<span className="capitalize">{color.name}</span>}
                    side="bottom"
                    delay={0}
                >
                    <button
                        onClick={() => setThemeColor(color.name)}
                        className={cn(
                            "flex size-5 items-center justify-center rounded-full transition-all opacity-50 hover:opacity-100",
                            color.class,
                            themeColor === color.name
                                ? "ring-2 ring-offset-1 ring-offset-white ring-ink-primary "
                                : ""
                        )}
                    >
                        {/* {themeColor === color.name && (
                            <Check className="size-3  text-white" />
                        )} */}
                        <span className="sr-only">{color.name}</span>
                    </button>
                </Tooltip>
            ))}
        </div>
    )
}
