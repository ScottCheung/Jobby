/** @format */

import type { DiagnosticEntry } from '../../shared/contracts/execution';

interface DiagnosticsCardProps {
  diagnostics: DiagnosticEntry[];
  errorMessage: string;
  onClearLogs: () => void;
}

const LEVEL_BADGES: Record<string, string> = {
  info: 'bg-primary/10 text-primary border-primary/25',
  warn: 'bg-warning/15 text-warning border-warning/30',
  error: 'bg-destructive/15 text-destructive border-destructive/30',
  debug: 'bg-muted/40 text-muted-foreground border-primary/50',
};

export function DiagnosticsCard({
  diagnostics,
  errorMessage,
  onClearLogs,
}: DiagnosticsCardProps) {
  return (
    <details className='diagnostics' aria-label='Diagnostics'>
      <summary>Diagnostic Logs</summary>
      <div className='diagnostics-content'>
        <div className='section-heading'>
          <p>Recent Events</p>
          <button type='button' className='quiet' onClick={onClearLogs}>
            Clear
          </button>
        </div>
        {errorMessage && (
          <p className='message' aria-live='polite'>
            {errorMessage}
          </p>
        )}
        <ol className='log-list'>
          {diagnostics
            .slice()
            .reverse()
            .map((entry, idx) => {
              const badgeClass =
                LEVEL_BADGES[entry.level] || LEVEL_BADGES.debug;
              return (
                <li
                  key={idx}
                  className={`log-entry level-${entry.level} !grid gap-1`}
                >
                  <div className='flex items-center gap-1.5 flex-wrap'>
                    <span
                      className={`px-1 rounded-[3px] text-[8px] font-extrabold uppercase leading-normal border ${badgeClass}`}
                    >
                      {entry.level}
                    </span>
                    <span className='text-[9px] text-muted-foreground/80 font-mono'>
                      {new Date(entry.timestamp).toLocaleTimeString()}
                    </span>
                    <span
                      className='text-[9px] font-bold text-foreground/80 bg-muted/40 px-1 rounded truncate max-w-[120px]'
                      title={entry.scope}
                    >
                      {entry.scope}
                    </span>
                  </div>
                  <span className='text-[11px] text-foreground/90 leading-normal'>
                    {entry.message}
                  </span>
                </li>
              );
            })}
        </ol>
      </div>
    </details>
  );
}
