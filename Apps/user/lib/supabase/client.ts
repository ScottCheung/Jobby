import { createBrowserClient } from '@supabase/ssr'
import type { Session } from '@supabase/supabase-js'

let browserClient: ReturnType<typeof createBrowserClient> | undefined;

export function createClient() {
  if (!browserClient) {
    browserClient = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    );
  }
  return browserClient;
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
