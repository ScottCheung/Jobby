'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { headers } from 'next/headers'
import { extensionCallbackPath, isAllowedExtensionRedirect } from '@/lib/auth/extension-redirect'

function nextPathFromForm(formData: FormData): string {
  const extensionRedirect = formData.get('extension_redirect')
  if (typeof extensionRedirect === 'string' && isAllowedExtensionRedirect(extensionRedirect)) {
    return extensionCallbackPath(extensionRedirect)
  }
  const next = formData.get('next')
  if (typeof next === 'string' && next.startsWith('/') && !next.startsWith('//')) {
    return next
  }
  return '/'
}

export async function login(formData: FormData) {
  const supabase = await createClient()

  const data = {
    email: (formData.get('email') as string)?.trim().toLowerCase(),
    password: formData.get('password') as string,
  }
  const next = nextPathFromForm(formData)

  const { error } = await supabase.auth.signInWithPassword(data)

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/', 'layout')
  redirect(next)
}

export async function signup(formData: FormData) {
  const supabase = await createClient()

  const data = {
    email: (formData.get('email') as string)?.trim().toLowerCase(),
    password: formData.get('password') as string,
  }
  const next = nextPathFromForm(formData)

  // Determine origin for email redirects (e.g. email confirmation)
  const originList = await headers()
  const origin = originList.get('origin') || ''

  const { error } = await supabase.auth.signUp({
    email: data.email,
    password: data.password,
    options: {
      emailRedirectTo: origin ? `${origin}/auth/callback?next=${encodeURIComponent(next)}` : undefined,
    }
  })

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/', 'layout')
  redirect(next)
}

export async function logout() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/login')
}

export async function signInWithGoogle(options?: { extensionRedirect?: string; next?: string }) {
  const supabase = await createClient()
  const originList = await headers()
  const origin = originList.get('origin') || ''
  
  let next = '/'
  if (options?.extensionRedirect && isAllowedExtensionRedirect(options.extensionRedirect)) {
    next = extensionCallbackPath(options.extensionRedirect)
  } else if (options?.next && options.next.startsWith('/') && !options.next.startsWith('//')) {
    next = options.next
  }

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: origin ? `${origin}/auth/callback?next=${encodeURIComponent(next)}` : undefined,
      queryParams: {
        prompt: 'select_account',
      },
    },
  })

  if (error) return { error: error.message }
  if (data.url) {
    redirect(data.url)
  }
}
