/** @format */

import { Sparkles, LogIn } from 'lucide-react';
import { Button } from '@jobby/ui/components/UI/Button';
import { cn } from '@jobby/ui/lib/utils';

interface AuthGuardBannerProps {
  onSignIn: () => void;
  isSigningIn?: boolean;
  className?: string;
  title?: string;
  description?: string;
  compact?: boolean;
}

export function AuthGuardBanner({
  onSignIn,
  isSigningIn = false,
  className,
  title = 'Sign In to Unlock Full Features',
  description = 'Connect your Jobby account to get AI match scores, tailored resumes, and 1-click autofill.',
  compact = false,
}: AuthGuardBannerProps) {
  return (
    <div
      className={cn(
        'flex items-center justify-between gap-3 rounded-xl border border-primary/25 bg-gradient-to-r from-primary/15 via-primary/5 to-background-secondary/40 p-2.5 px-3 shadow-xs',
        !compact && 'p-3',
        className,
      )}
    >
      <div className='flex items-center gap-2.5 min-w-0'>
        <div className='flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary/20 text-primary shadow-xs'>
          <Sparkles className='h-3.5 w-3.5' />
        </div>
        <div className='min-w-0'>
          <p className='text-xs font-bold text-foreground truncate'>
            {title}
          </p>
          <p className='text-[10px] text-muted-foreground truncate'>
            {description}
          </p>
        </div>
      </div>
      <Button
        type='button'
        size='sm'
        className='h-7 shrink-0 rounded-full px-3 text-xs font-semibold'
        onClick={onSignIn}
        isLoading={isSigningIn}
      >
        <LogIn className='mr-1 h-3 w-3' />
        Sign In
      </Button>
    </div>
  );
}
