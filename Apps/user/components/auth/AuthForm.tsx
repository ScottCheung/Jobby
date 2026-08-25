/** @format */

'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mail, Lock, LogIn, UserPlus } from 'lucide-react';
import { signInWithGoogle } from '@/app/auth/actions';
import { createClient } from '@/lib/supabase/client';
import {
  extensionCallbackPath,
  isAllowedExtensionRedirect,
} from '@/lib/auth/extension-redirect';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuthStore } from '@/lib/store';

// Use components from @jobby/ui
import { InputField, Button, Checkbox } from '@jobby/ui';

interface AuthFormProps {
  initialMode?: 'login' | 'signup';
  next?: string;
  extensionRedirect?: string;
  reason?: string;
  isModal?: boolean;
  onSuccess?: () => void;
  onClose?: () => void;
}

export function AuthForm({
  initialMode = 'login',
  next,
  extensionRedirect,
  reason,
  isModal = false,
  onSuccess,
  onClose,
}: AuthFormProps) {
  const router = useRouter();
  const [mode, setMode] = useState<'login' | 'signup'>(initialMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [rememberMe, setRememberMe] = useState(
    () => useAuthStore.getState().rememberMe ?? true,
  );

  const isLogin = mode === 'login';

  const handlePostAuthRedirect = () => {
    if (extensionRedirect && isAllowedExtensionRedirect(extensionRedirect)) {
      window.location.href = extensionCallbackPath(extensionRedirect);
      return;
    }
    if (onSuccess) {
      onSuccess();
    } else if (next && next.startsWith('/') && !next.startsWith('//')) {
      router.push(next);
    } else {
      router.push('/');
    }
    if (onClose) onClose();
  };

  const validateConsent = () => {
    if (!agreedToTerms) {
      setError('Please agree to the Terms of Service and Privacy Policy to continue.');
      return false;
    }
    return true;
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);

    if (!validateConsent()) {
      return;
    }

    setIsLoading(true);
    const supabase = createClient();

    try {
      if (isLogin) {
        const { data, error: signInError } =
          await supabase.auth.signInWithPassword({
            email: email.trim().toLowerCase(),
            password,
          });

        if (signInError) {
          setError(
            signInError.message ||
              'Invalid email or password. Please try again.',
          );
          setIsLoading(false);
          return;
        }

        if (data.session) {
          useAuthStore
            .getState()
            .login(data.session.access_token, rememberMe);
          handlePostAuthRedirect();
        }
      } else {
        const origin =
          typeof window !== 'undefined' ? window.location.origin : '';
        const callbackNext =
          extensionRedirect && isAllowedExtensionRedirect(extensionRedirect) ?
            extensionCallbackPath(extensionRedirect)
          : next || '/';
        const { data, error: signUpError } = await supabase.auth.signUp({
          email: email.trim().toLowerCase(),
          password,
          options: {
            emailRedirectTo: `${origin}/auth/callback?next=${encodeURIComponent(callbackNext)}`,
          },
        });

        if (signUpError) {
          setError(
            signUpError.message ||
              'Unable to create account. Please try again.',
          );
          setIsLoading(false);
          return;
        }

        if (data.session) {
          useAuthStore
            .getState()
            .login(data.session.access_token, rememberMe);
          handlePostAuthRedirect();
        } else {
          setSuccessMessage(
            'Confirmation email sent! Please check your inbox to verify your account.',
          );
          setMode('login');
        }
      }
    } catch (err) {
      setError(
        err instanceof Error ?
          err.message
        : 'An unexpected error occurred. Please try again.',
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setError(null);
    if (!validateConsent()) {
      return;
    }

    setIsLoading(true);
    try {
      const result = await signInWithGoogle({ next, extensionRedirect });
      if (result?.error) {
        setError(result.error);
        setIsLoading(false);
      }
    } catch {
      setError('Failed to initiate Google authentication.');
      setIsLoading(false);
    }
  };

  return (
    <div className='w-full'>
      {/* Header */}
      <div className='text-center mb-6'>
        <h2 className='text-2xl font-bold tracking-tight text-ink-primary font-serif'>
          {isLogin ? 'Welcome Back' : 'Create an Account'}
        </h2>
        {reason && (
          <p className='mt-2 text-xs text-ink-secondary leading-relaxed'>
            {reason}
          </p>
        )}
      </div>

      {/* 1. Google OAuth Button */}
      <button
        type='button'
        onClick={handleGoogleSignIn}
        disabled={isLoading}
        className='w-full h-11 px-4 bg-surface/80 hover:bg-surface-secondary border border-primary/80 text-ink-primary rounded-full font-medium transition-all flex items-center justify-center gap-3 text-sm disabled:opacity-50 cursor-pointer active:scale-[0.99] group'
      >
        <svg
          className='w-4 h-4 shrink-0 transition-transform group-hover:scale-110'
          viewBox='0 0 24 24'
        >
          <path
            d='M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z'
            fill='#4285F4'
          />
          <path
            d='M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z'
            fill='#34A853'
          />
          <path
            d='M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z'
            fill='#FBBC05'
          />
          <path
            d='M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z'
            fill='#EA4335'
          />
        </svg>
        <span className='font-semibold text-sm'>Continue with Google</span>
      </button>

      {/* Divider */}
      <div className='relative my-5 flex items-center justify-center'>
        <div className='absolute inset-0 flex items-center'>
          <div className='w-full border-t border-primary/60' />
        </div>
        <span className='relative bg-panel px-3 text-xs text-ink-secondary'>
          or continue with email
        </span>
      </div>

      {/* Alert Error / Success */}
      <AnimatePresence mode='wait'>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            className='mb-4 p-3.5 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-500 dark:text-red-400 text-xs leading-relaxed'
          >
            {error}
          </motion.div>
        )}
        {successMessage && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            className='mb-4 p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs leading-relaxed'
          >
            {successMessage}
          </motion.div>
        )}
      </AnimatePresence>

      {/* 2. Email / Password Form */}
      <form onSubmit={handleSubmit} className='space-y-4'>
        <InputField
          label='Email Address'
          icon={Mail}
          type='email'
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder='name@example.com'
          showCharCount={false}
        />

        <InputField
          label='Password'
          icon={Lock}
          type='password'
          required
          minLength={6}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder='At least 6 characters'
          showCharCount={false}
        />

        {/* Checkboxes: Trust this device & Terms consent */}
        <div className='space-y-2.5 pt-1 pb-1'>
          <label className='flex items-center gap-2.5 cursor-pointer select-none text-ink-secondary hover:text-ink-primary transition-colors'>
            <Checkbox
              checked={rememberMe}
              onCheckedChange={(checked) => {
                const val = !!checked;
                setRememberMe(val);
                useAuthStore.getState().setRememberMe(val);
              }}
              className='rounded-md'
            />
            <span className='text-xs font-medium'>Trust this device for 7 days</span>
          </label>

          <label className='flex items-start gap-2.5 cursor-pointer select-none text-ink-secondary hover:text-ink-primary transition-colors'>
            <Checkbox
              checked={agreedToTerms}
              onCheckedChange={(checked) => {
                setAgreedToTerms(!!checked);
                if (error) setError(null);
              }}
              className='mt-0.5 rounded-md shrink-0'
            />
            <span className='text-xs leading-snug'>
              I agree to the{' '}
              <Link
                href='/terms'
                target='_blank'
                className='text-primary hover:underline font-medium'
                onClick={(e) => e.stopPropagation()}
              >
                Terms of Service
              </Link>{' '}
              and{' '}
              <Link
                href='/privacy'
                target='_blank'
                className='text-primary hover:underline font-medium'
                onClick={(e) => e.stopPropagation()}
              >
                Privacy Policy
              </Link>
            </span>
          </label>
        </div>

        {/* Submit button */}
        <Button
          type='submit'
          disabled={isLoading}
          variant='default'
          className='w-full h-11 rounded-full font-semibold mt-2 text-sm justify-center cursor-pointer'
        >
          {isLoading ?
            <div className='w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin' />
          : isLogin ?
            <>
              <LogIn className='w-4 h-4 mr-2' />
              Sign In
            </>
          : <>
              <UserPlus className='w-4 h-4 mr-2' />
              Create Account
            </>
          }
        </Button>

        {/* Mode Switcher as compact text hint below */}
        <div className='text-center text-xs text-ink-secondary pt-2'>
          {isLogin ? (
            <span>
              Don&apos;t have an account?{' '}
              <button
                type='button'
                onClick={() => {
                  setMode('signup');
                  setError(null);
                  setSuccessMessage(null);
                }}
                className='font-semibold text-primary hover:underline cursor-pointer'
              >
                Sign up
              </button>
            </span>
          ) : (
            <span>
              Already have an account?{' '}
              <button
                type='button'
                onClick={() => {
                  setMode('login');
                  setError(null);
                  setSuccessMessage(null);
                }}
                className='font-semibold text-primary hover:underline cursor-pointer'
              >
                Sign in
              </button>
            </span>
          )}
        </div>
      </form>
    </div>
  );
}

