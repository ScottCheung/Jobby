import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { extensionCallbackPath, isAllowedExtensionRedirect } from '@/lib/auth/extension-redirect'

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    return supabaseResponse
  }

  try {
    const supabase = createServerClient(
      supabaseUrl,
      supabaseAnonKey,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll()
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
            supabaseResponse = NextResponse.next({
              request,
            })
            cookiesToSet.forEach(({ name, value, options }) =>
              supabaseResponse.cookies.set(name, value, options)
            )
          },
        },
      }
    )

    // IMPORTANT: Refreshing the auth token
    const {
      data: { user },
    } = await supabase.auth.getUser()

    const pathname = request.nextUrl.pathname
    const isAuthRoute = pathname.startsWith('/login')

    // Protected routes requiring authentication (personal data and settings)
    const isProtectedRoute =
      pathname.startsWith('/applications') ||
      pathname.startsWith('/job-application') ||
      pathname.startsWith('/job-review') ||
      pathname.startsWith('/ai-studio') ||
      pathname.startsWith('/prospects') ||
      pathname.startsWith('/automation') ||
      pathname.startsWith('/admin') ||
      pathname.startsWith('/settings')

    // If visiting a protected route without being authenticated, redirect to login with `next` query
    if (!user && isProtectedRoute) {
      const url = request.nextUrl.clone()
      url.pathname = '/login'
      const search = request.nextUrl.search
      const currentFullTarget = `${pathname}${search}`
      url.searchParams.set('next', currentFullTarget)
      return NextResponse.redirect(url)
    }

    // If authenticated user visits login route, redirect to requested target or home
    if (user && isAuthRoute) {
      const url = request.nextUrl.clone()
      const extensionRedirect = request.nextUrl.searchParams.get('extension_redirect')
      const nextParam = request.nextUrl.searchParams.get('next')

      if (extensionRedirect && isAllowedExtensionRedirect(extensionRedirect)) {
        url.pathname = '/auth/extension-callback'
        url.search = extensionCallbackPath(extensionRedirect).split('?')[1] || ''
      } else if (nextParam && nextParam.startsWith('/') && !nextParam.startsWith('//')) {
        return NextResponse.redirect(new URL(nextParam, request.url))
      } else {
        url.pathname = '/'
        url.search = ''
      }
      return NextResponse.redirect(url)
    }

    if (user?.email) {
      supabaseResponse.headers.set('X-User-Email', user.email)
    }

    return supabaseResponse
  } catch (error) {
    console.error('Middleware updateSession error:', error)
    return supabaseResponse
  }
}
