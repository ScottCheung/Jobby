"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useAuthStore } from "@/lib/store"

export default function AuthGuard({ children }: { children: React.ReactNode }) {
    const router = useRouter()
    const token = useAuthStore((state) => state.token)
    const isTokenExpired = useAuthStore((state) => state.isTokenExpired)
    const logout = useAuthStore((state) => state.logout)
    const [isLoading, setIsLoading] = useState(true)

    useEffect(() => {
        // Give zustand persist time to rehydrate from storage
        const timer = setTimeout(() => {
            setIsLoading(false)
        }, 100)

        return () => clearTimeout(timer)
    }, [])

    useEffect(() => {
        if (!isLoading) {
            // Check if token is expired
            if (token && isTokenExpired()) {
                logout()
                router.push("/login")
                return
            }

            // Check if token exists
            if (!token) {
                router.push("/login")
            }
        }
    }, [token, router, isLoading, isTokenExpired, logout])

    // Show loading state while checking authentication
    if (isLoading) {
        return (
            <div className="flex min-h-screen items-center justify-center">
                <div className="text-center">
                    <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-primary border-r-transparent"></div>
                    <p className="mt-4 text-sm text-ink-secondary dark:text-gray-400">Loading...</p>
                </div>
            </div>
        )
    }

    if (!token) {
        return null
    }

    return <>{children}</>
}
