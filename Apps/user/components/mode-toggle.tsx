"use client"

import * as React from "react"
import { Moon, Sun, Monitor } from "lucide-react"
import { useTheme } from "@/components/theme-provider"
import { ToggleGroup, ToggleGroupItem } from "@/components/UI/toggle-group"

export function ModeToggle() {
    const { setTheme, theme } = useTheme()

    const items: ToggleGroupItem[] = [
        { value: "system", label: "System", icon: Monitor },
        { value: "light", label: "Light", icon: Sun },
        { value: "dark", label: "Dark", icon: Moon },
    ]

    return (
        <ToggleGroup
            id="theme-toggle"
            items={items}
            value={theme}
            onValueChange={(val) => setTheme(val as any)}
        />
    )
}
