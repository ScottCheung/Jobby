import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isAllowedExtensionRedirect } from '@/lib/auth/extension-redirect'

function errorRedirect(redirectUri: string, message: string): NextResponse {
  const callback = new URL(redirectUri)
  callback.hash = new URLSearchParams({ error: message }).toString()
  return NextResponse.redirect(callback)
}

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const redirectUri = searchParams.get('redirect_uri')

  if (!isAllowedExtensionRedirect(redirectUri)) {
    return NextResponse.redirect(`${origin}/login?error=Invalid extension redirect`)
  }

  const supabase = await createClient()
  const { data: userData, error: userError } = await supabase.auth.getUser()
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession()
  const session = sessionData.session
  const user = userData.user
  if (userError || sessionError || !session?.access_token || !user?.email) {
    return errorRedirect(
      redirectUri,
      userError?.message || sessionError?.message || 'The Jobby web session is not available.',
    )
  }

  const callback = new URL(redirectUri)
  const hashParams = new URLSearchParams({
    access_token: session.access_token,
    expires_at: String(session.expires_at || Math.floor(Date.now() / 1000) + (session.expires_in || 3600)),
    user_id: user.id,
    email: user.email,
  })
  if (session.refresh_token) {
    hashParams.set('refresh_token', session.refresh_token)
  }
  callback.hash = hashParams.toString()
  return NextResponse.redirect(callback)
}
