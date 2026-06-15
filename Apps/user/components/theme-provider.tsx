"use client"

import React, { createContext, useContext, useEffect, useState } from "react"

type Theme = "dark" | "light" | "system"
export type ThemeColor = "blue" | "purple" | "green" | "orange" | "rose"

type ThemeProviderProps = {
    children: React.ReactNode
    defaultTheme?: Theme
    defaultColor?: ThemeColor
    storageKey?: string
    colorStorageKey?: string
}

type ThemeProviderState = {
    theme: Theme
    setTheme: (theme: Theme) => void
    themeColor: ThemeColor
    setThemeColor: (color: ThemeColor) => void
}

const initialState: ThemeProviderState = {
    theme: "system",
    setTheme: () => null,
    themeColor: "blue",
    setThemeColor: () => null,
}

const ThemeProviderContext = createContext<ThemeProviderState>(initialState)

export function ThemeProvider({
    children,
    defaultTheme = "system",
    defaultColor = "blue",
    storageKey = "vite-ui-theme",
    colorStorageKey = "vite-ui-theme-color",
    ...props
}: ThemeProviderProps) {
    const [theme, setTheme] = useState<Theme>(() => {
        if (typeof window !== "undefined" && localStorage.getItem(storageKey)) {
            return localStorage.getItem(storageKey) as Theme
        }
        return defaultTheme
    })
    const [themeColor, setThemeColor] = useState<ThemeColor>(() => {
        if (typeof window !== "undefined" && localStorage.getItem(colorStorageKey)) {
            return localStorage.getItem(colorStorageKey) as ThemeColor
        }
        return defaultColor
    })

    // Load initial state from localStorage
    useEffect(() => {
        const savedTheme = localStorage.getItem(storageKey) as Theme | null
        if (savedTheme) {
            setTheme(savedTheme)
        }

        const savedColor = localStorage.getItem(colorStorageKey) as ThemeColor | null
        if (savedColor) {
            setThemeColor(savedColor)
        }
    }, [storageKey, colorStorageKey])

    useEffect(() => {
        const root = window.document.documentElement

        root.classList.remove("light", "dark")

        if (theme === "system") {
            const systemTheme = window.matchMedia("(prefers-color-scheme: dark)")
                .matches
                ? "dark"
                : "light"

            if (systemTheme === "dark") {
                root.classList.add("dark")
            }
        } else if (theme === "dark") {
            root.classList.add("dark")
        }
    }, [theme])

    useEffect(() => {
        const root = window.document.documentElement
        root.setAttribute("data-theme-color", themeColor)
    }, [themeColor])

    const value = {
        theme,
        setTheme: (theme: Theme) => {
            localStorage.setItem(storageKey, theme)
            setTheme(theme)
        },
        themeColor,
        setThemeColor: (color: ThemeColor) => {
            localStorage.setItem(colorStorageKey, color)
            setThemeColor(color)
        },
    }

    return (
        <ThemeProviderContext.Provider {...props} value={value}>
            {children}
        </ThemeProviderContext.Provider>
    )
}

export const useTheme = () => {
    const context = useContext(ThemeProviderContext)

    if (context === undefined)
        throw new Error("useTheme must be used within a ThemeProvider")

    return context
}
