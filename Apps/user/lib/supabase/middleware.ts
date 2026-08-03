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

    const {
      data: { user },
    } = await supabase.auth.getUser()

    const isAuthRoute = request.nextUrl.pathname.startsWith('/login')
    const isProtectedRoute = request.nextUrl.pathname.startsWith('/interview-prep') || request.nextUrl.pathname.startsWith('/dashboard')

    if (!user && isProtectedRoute) {
      const url = request.nextUrl.clone()
      url.pathname = '/login'
      return NextResponse.redirect(url)
    }

    if (user && isAuthRoute) {
      const url = request.nextUrl.clone()
      const extensionRedirect = request.nextUrl.searchParams.get('extension_redirect')
      if (extensionRedirect && isAllowedExtensionRedirect(extensionRedirect)) {
        url.pathname = '/auth/extension-callback'
        url.search = extensionCallbackPath(extensionRedirect).split('?')[1] || ''
      } else {
        url.pathname = '/interview-prep'
        url.search = ''
      }
      return NextResponse.redirect(url)
    }

    let finalResponse = supabaseResponse

    if (user?.email) {
      const requestHeaders = new Headers(request.headers)
      requestHeaders.set('X-User-Email', user.email)
      
      finalResponse = NextResponse.next({
        request: {
          headers: requestHeaders,
        },
      })
      supabaseResponse.cookies.getAll().forEach(cookie => {
        finalResponse.cookies.set(cookie.name, cookie.value, cookie)
      })
    }

    return finalResponse
  } catch (error) {
    console.error('Middleware updateSession error:', error)
    return supabaseResponse
  }
}
