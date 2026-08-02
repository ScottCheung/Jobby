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
    <section className=' hidden' aria-label='Backend connection'>
      <div className='section-heading'>
        <h2>Jobby account</h2>
        <span
          className='connection-status'
          data-connected={authStatus.connected ? 'true' : 'false'}
        >
          {authStatus.connected ? authStatus.user?.email : 'Disconnected'}
        </span>
      </div>

      {!authStatus.connected && (
        <div className='auth-sign-in'>
          <p>Sign in through the same Jobby page used by the web app.</p>
          <button type='button' onClick={onSignIn}>
            Sign in with Jobby
          </button>
        </div>
      )}

      {authStatus.connected && (
        <button type='button' className='quiet' onClick={onDisconnect}>
          Disconnect
        </button>
      )}

      {authError && <p className='message'>{authError}</p>}
    </section>
  );
}
