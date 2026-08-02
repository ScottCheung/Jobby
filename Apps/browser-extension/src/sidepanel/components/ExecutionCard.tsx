/** @format */

import type { RuntimeSnapshot } from '../../shared/contracts/execution';
import type { RuntimeMessage } from '../../shared/contracts/messages';

interface ExecutionCardProps {
  snapshot: RuntimeSnapshot;
  onRefresh: () => void;
  onSendCommand: (msg: RuntimeMessage) => void;
}

export function ExecutionCard({
  snapshot,
  onRefresh,
  onSendCommand,
}: ExecutionCardProps) {
  const isIdle = snapshot.phase === 'idle';

  return (
    <div className='hidden'>
      <section className='status' aria-label='Execution status'>
        <dl>
          <div>
            <dt>Run</dt>
            <dd>{snapshot.runId ?? 'None'}</dd>
          </div>
          <div>
            <dt>Updated</dt>
            <dd>{new Date(snapshot.updatedAt).toLocaleString()}</dd>
          </div>
          <div>
            <dt>Reason</dt>
            <dd>{snapshot.reason ?? '-'}</dd>
          </div>
        </dl>
      </section>

      <div className='controls' aria-label='Run controls'>
        <button type='button' onClick={onRefresh}>
          Refresh
        </button>
        <button
          type='button'
          disabled={isIdle || snapshot.phase === 'paused'}
          onClick={() => onSendCommand({ type: 'runtime.pause' })}
        >
          Pause
        </button>
        <button
          type='button'
          disabled={isIdle || snapshot.phase === 'running'}
          onClick={() => onSendCommand({ type: 'runtime.resume' })}
        >
          Resume
        </button>
        <button
          type='button'
          className='danger'
          disabled={isIdle || snapshot.phase === 'stopped'}
          onClick={() => onSendCommand({ type: 'runtime.stop' })}
        >
          Stop
        </button>
      </div>
    </div>
  );
}
