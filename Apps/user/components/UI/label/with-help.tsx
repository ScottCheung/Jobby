import * as React from "react"
import { HelpCircle } from "lucide-react"
import { cn } from "@/lib/utils"
import { TooltipProvider, TooltipRoot, TooltipTrigger, TooltipContent } from "@/components/UI/tooltip"

export interface LabelWithHelpProps {
    label: string
    helpTextShort?: string
    helpTextLong?: string
    className?: string
    required?: boolean
}

export const LabelWithHelp: React.FC<LabelWithHelpProps> = ({
    label,
    helpTextShort,
    helpTextLong,
    className,
    required = false,
}) => {
    // 安全检查：只在有有效内容时才显示帮助文本
    const hasLongHelp = helpTextLong && helpTextLong.trim().length > 0
    const hasShortHelp = helpTextShort && helpTextShort.trim().length > 0

    return (
        <div className={cn("flex items-center gap-2", className)}>
            <label className="text-sm font-medium text-ink-primary">
                {label}
                {required && <span className="text-red-500 ml-1">*</span>}
            </label>
            {hasLongHelp && (
                <TooltipProvider delayDuration={200}>
                    <TooltipRoot>
                        <TooltipTrigger asChild>
                            <button type="button" className="inline-flex items-center">
                                <HelpCircle className="size-3.5 text-ink-secondary cursor-help hover:text-primary transition-colors" />
                            </button>
                        </TooltipTrigger>
                        <TooltipContent
                            side="right"
                            className="max-w-xs text-xs"
                            sideOffset={5}
                        >
                            <p>{helpTextLong}</p>
                        </TooltipContent>
                    </TooltipRoot>
                </TooltipProvider>
            )}
            {hasShortHelp && !hasLongHelp && (
                <span className="text-xs text-ink-secondary">
                    {helpTextShort}
                </span>
            )}
        </div>
    )
}
