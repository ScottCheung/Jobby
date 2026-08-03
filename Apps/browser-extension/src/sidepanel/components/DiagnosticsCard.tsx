import type { DiagnosticEntry } from "../../shared/contracts/execution";

interface DiagnosticsCardProps {
  diagnostics: DiagnosticEntry[];
  errorMessage: string;
  onClearLogs: () => void;
}

export function DiagnosticsCard({ diagnostics, errorMessage, onClearLogs }: DiagnosticsCardProps) {
  return (
    <details className="diagnostics" aria-label="Diagnostics">
      <summary>诊断日志</summary>
      <div className="diagnostics-content">
        <div className="section-heading">
          <p>最近事件</p>
          <button type="button" className="quiet" onClick={onClearLogs}>
            清除
          </button>
        </div>
        {errorMessage && <p className="message" aria-live="polite">{errorMessage}</p>}
        <ol className="log-list">
          {diagnostics.slice().reverse().map((entry, idx) => (
            <li key={idx} className={`log-entry level-${entry.level}`}>
              <span className="log-meta">
                {new Date(entry.timestamp).toLocaleTimeString()} {entry.scope}
              </span>
              <span>{entry.message}</span>
            </li>
          ))}
        </ol>
      </div>
    </details>
  );
}
