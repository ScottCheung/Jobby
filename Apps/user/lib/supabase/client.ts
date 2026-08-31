import { createBrowserClient } from '@supabase/ssr'
import type { Session } from '@supabase/supabase-js'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

export async function getValidAuthSession(): Promise<Session | null> {
  if (typeof window === 'undefined') {
    return null
  }

  const {
    data: { session },
    error,
  } = await createClient().auth.getSession()

  return error ? null : session
}
