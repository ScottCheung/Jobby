import { createBrowserClient } from '@supabase/ssr'
import type { Session } from '@supabase/supabase-js'

export const SEVEN_DAYS_SECONDS = 7 * 24 * 60 * 60

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookieOptions: {
        maxAge: SEVEN_DAYS_SECONDS,
      },
    }
  )
}

const REFRESH_SKEW_SECONDS = 60
let refreshPromise: Promise<Session | null> | null = null

export async function getValidAuthSession(): Promise<Session | null> {
  if (typeof window === 'undefined') {
    return null
  }

  // Check 7-day expiration from auth store
  try {
    const rawAuth = localStorage.getItem('auth-storage')
    if (rawAuth) {
      const parsed = JSON.parse(rawAuth)
      const state = parsed?.state
      if (state?.loginTime) {
        const elapsed = Date.now() - Number(state.loginTime)
        if (elapsed > SEVEN_DAYS_SECONDS * 1000) {
          const supabase = createClient()
          await supabase.auth.signOut().catch(() => {})
          localStorage.removeItem('auth-storage')
          return null
        }
      }
    }
  } catch {
    // Ignore localStorage parsing errors
  }

  const supabase = createClient()
  const {
    data: { session },
  } = await supabase.auth.getSession()

  if (!session) {
    return null
  }

  const nowSec = Math.floor(Date.now() / 1000)
  const isExpiringSoon = session.expires_at ? session.expires_at - nowSec <= REFRESH_SKEW_SECONDS : false

  if (!isExpiringSoon) {
    return session
  }

  if (refreshPromise) {
    return refreshPromise
  }

  refreshPromise = (async () => {
    try {
      const { data, error } = await supabase.auth.refreshSession()
      if (error || !data.session) {
        if (error && (error.status === 400 || error.status === 401 || error.message?.toLowerCase().includes('refresh token'))) {
          await supabase.auth.signOut().catch(() => {})
          localStorage.removeItem('auth-storage')
          return null
        }
        return session
      }

      // Sync back new token to store if present
      try {
        const rawAuth = localStorage.getItem('auth-storage')
        if (rawAuth) {
          const parsed = JSON.parse(rawAuth)
          if (parsed?.state) {
            parsed.state.token = data.session.access_token
            localStorage.setItem('auth-storage', JSON.stringify(parsed))
          }
        }
      } catch {
        // Ignore
      }

      return data.session
    } catch {
      return session
    } finally {
      refreshPromise = null
    }
  })()

  return refreshPromise
}
