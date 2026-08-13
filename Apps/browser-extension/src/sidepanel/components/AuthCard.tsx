import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import type { AuthStatus } from '../../shared/contracts/auth';

interface AuthCardProps {
  authStatus: AuthStatus;
  authError?: string;
  onSignIn: () => void;
  onDisconnect: () => void;
  isSigningIn?: boolean;
}

export function AuthCard({
  authStatus,
  authError,
  onSignIn,
  onDisconnect,
  isSigningIn = false,
}: AuthCardProps) {
  const [isConfirming, setIsConfirming] = useState(false);
  const [isMerging, setIsMerging] = useState(false);

  const handleDisconnectClick = () => {
    if (isConfirming) {
      onDisconnect();
      setIsConfirming(false);
      setIsMerging(false);
    } else {
      setIsConfirming(true);
      setIsMerging(false);
    }
  };

  const handleCancel = () => {
    if (isMerging) return;
    setIsMerging(true);
    setTimeout(() => {
      setIsConfirming(false);
      setIsMerging(false);
    }, 300);
  };

  return (
    <div className='account-control' aria-label='Jobby account'>
      {authStatus.connected ? (
        <div 
          className='flex items-center gap-1 min-h-[28px]'
          onMouseLeave={() => {
            if (isConfirming && !isMerging) {
              handleCancel();
            }
          }}
        >
          {isConfirming ? (
            <>
              <button
                type='button'
                className={`account-state border-destructive/30 bg-destructive/10 text-destructive hover:bg-destructive/20 hover:border-destructive/50 transition-colors ${
                  isMerging ? 'animate-bubble-merge-left' : 'animate-bubble-left'
                }`}
                onClick={handleDisconnectClick}
              >
                Sign Out
              </button>
              <button
                type='button'
                className={`account-state hover:bg-muted/25 hover:border-border/80 transition-colors ${
                  isMerging ? 'animate-bubble-merge-right' : 'animate-bubble-right'
                }`}
                onClick={handleCancel}
              >
                Cancel
              </button>
            </>
          ) : (
            <button
              type='button'
              className='account-state is-connected animate-bubble-pop hover:bg-primary/20 hover:border-primary/60 transition-colors'
              onClick={handleDisconnectClick}
              title='Sign out of Jobby account'
            >
              <span className='account-dot' />
              <span>{authStatus.user?.email.split('@')[0]}</span>
            </button>
          )}
        </div>
      ) : (
        <button 
          type='button' 
          className={`account-state animate-bubble-pop hover:bg-muted/25 hover:border-border/80 transition-colors ${isSigningIn ? 'is-loading' : ''}`} 
          onClick={onSignIn}
          disabled={isSigningIn}
        >
          {isSigningIn ? (
            <>
              <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />
              <span>Connecting...</span>
            </>
          ) : (
            <span>Connect account</span>
          )}
        </button>
      )}
      {authError && <p className='account-error'>{authError}</p>}
    </div>
  );
}

