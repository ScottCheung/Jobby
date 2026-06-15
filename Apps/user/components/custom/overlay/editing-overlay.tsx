import { Edit2 } from "lucide-react"

export function EditingOverlay() {
    return (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/60  transition-all duration-300">
            <div className="flex flex-col items-center gap-2 animate-in fade-in zoom-in duration-300">
                <div className="rounded-full bg-primary-foreground/10 flex size-12 items-center justify-center rounded-2xl">
                    <Edit2 className="size-4 text-primary-foreground " />
                </div>
                <span className="text-sm font-medium animate-pulse text-primary-foreground">
                    Editing...
                </span>
            </div>
        </div>
    )
}
