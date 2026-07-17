'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { headers } from 'next/headers'

export async function login(formData: FormData) {
  const supabase = await createClient()

  const data = {
    email: formData.get('email') as string,
    password: formData.get('password') as string,
  }

  const { error } = await supabase.auth.signInWithPassword(data)

  if (error) {
    // You could return the error here to show in the UI, e.g., redirect('/login?message=Could not authenticate user')
    return { error: error.message }
  }

  revalidatePath('/', 'layout')
  redirect('/interview-prep')
}

export async function signup(formData: FormData) {
  const supabase = await createClient()

  const data = {
    email: formData.get('email') as string,
    password: formData.get('password') as string,
  }

  // Determine origin for email redirects (e.g. email confirmation)
  const originList = await headers()
  const origin = originList.get('origin')

  const { error } = await supabase.auth.signUp({
    email: data.email,
    password: data.password,
    options: {
      emailRedirectTo: `${origin}/auth/callback`, // Make sure this route exists or update it later
    }
  })

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/', 'layout')
  // Typically after signup, we ask them to check their email, or just redirect if auto-login is enabled
  redirect('/interview-prep') 
}

export async function logout() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/login')
}

export async function signInWithGoogle() {
  const supabase = await createClient()
  const originList = await headers()
  const origin = originList.get('origin')

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${origin}/auth/callback`,
      queryParams: {
        prompt: 'select_account',
      },
    },
  })

  if (data.url) {
    redirect(data.url) // use the redirect API for your server framework
  }
}
