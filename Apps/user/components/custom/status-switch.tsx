import { useState } from "react"
import { Switch } from "@/components/UI/switch"
import { notify } from "@/lib/notifications"

interface StatusSwitchProps {
    checked: boolean
    onCheckedChange: (checked: boolean) => Promise<void>
    disabled?: boolean
    className?: string
}

export function StatusSwitch({ checked: initialChecked, onCheckedChange, disabled, className }: StatusSwitchProps) {
    const [checked, setChecked] = useState(initialChecked)
    const [isLoading, setIsLoading] = useState(false)

    const handleCheckedChange = async (newChecked: boolean) => {
        // Optimistic update
        setChecked(newChecked)
        setIsLoading(true)

        try {
            await onCheckedChange(newChecked)
        } catch (error) {
            // Revert on error
            setChecked(!newChecked)
            notify.error("Failed to update status")
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <div onClick={(e) => e.stopPropagation()}>
            <Switch
                checked={checked}
                onCheckedChange={handleCheckedChange}
                disabled={disabled || isLoading}
                isLoading={isLoading}
                className={className}
            />
        </div>
    )
}
