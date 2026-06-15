import { Check } from "lucide-react"

export function SelectionOverlay() {
    return (
        <div className="absolute top-0 right-0 z-20 flex w-full h-full items-center justify-center pointer-events-none">
            <div className="rounded-full bg-green-500 p-3 text-white opacity-50">
                <Check className="size-6" />
            </div>
        </div>
    )
}
