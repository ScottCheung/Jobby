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
  return '/interview-prep'
}

export async function login(formData: FormData) {
  const supabase = await createClient()

  const data = {
    email: formData.get('email') as string,
    password: formData.get('password') as string,
  }
  const next = nextPathFromForm(formData)

  const { error } = await supabase.auth.signInWithPassword(data)

  if (error) {
    // You could return the error here to show in the UI, e.g., redirect('/login?message=Could not authenticate user')
    return { error: error.message }
  }

  revalidatePath('/', 'layout')
  redirect(next)
}

export async function signup(formData: FormData) {
  const supabase = await createClient()

  const data = {
    email: formData.get('email') as string,
    password: formData.get('password') as string,
  }
  const next = nextPathFromForm(formData)

  // Determine origin for email redirects (e.g. email confirmation)
  const originList = await headers()
  const origin = originList.get('origin')

  const { error } = await supabase.auth.signUp({
    email: data.email,
    password: data.password,
    options: {
      emailRedirectTo: `${origin}/auth/callback?next=${encodeURIComponent(next)}`,
    }
  })

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/', 'layout')
  // Typically after signup, we ask them to check their email, or just redirect if auto-login is enabled
  redirect(next)
}

export async function logout() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/login')
}

export async function signInWithGoogle(extensionRedirect?: string) {
  const supabase = await createClient()
  const originList = await headers()
  const origin = originList.get('origin')
  const next = extensionRedirect && isAllowedExtensionRedirect(extensionRedirect)
    ? extensionCallbackPath(extensionRedirect)
    : '/interview-prep'

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${origin}/auth/callback?next=${encodeURIComponent(next)}`,
      queryParams: {
        prompt: 'select_account',
      },
    },
  })

  if (error) return { error: error.message }
  if (data.url) {
    redirect(data.url) // use the redirect API for your server framework
  }
}
