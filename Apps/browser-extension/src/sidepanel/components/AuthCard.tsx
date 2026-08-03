/** @format */

import type { AuthStatus } from '../../shared/contracts/auth';

interface AuthCardProps {
  authStatus: AuthStatus;
  authError?: string;
  onSignIn: () => void;
  onDisconnect: () => void;
}

export function AuthCard({
  authStatus,
  authError,
  onSignIn,
  onDisconnect,
}: AuthCardProps) {
  return (
    <div className='account-control' aria-label='Jobby account'>
      {authStatus.connected ? (
        <button type='button' className='account-state is-connected' onClick={onDisconnect} title='Disconnect Jobby account'>
          <span className='account-dot' />
          <span>{authStatus.user?.email}</span>
        </button>
      ) : (
        <button type='button' className='account-state' onClick={onSignIn}>
          Connect account
        </button>
      )}
      {authError && <p className='account-error'>{authError}</p>}
    </div>
  );
}
