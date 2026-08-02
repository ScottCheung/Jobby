import type { DiagnosticEntry } from "../../shared/contracts/execution";

interface DiagnosticsCardProps {
  diagnostics: DiagnosticEntry[];
  errorMessage: string;
  onClearLogs: () => void;
}

export function DiagnosticsCard({ diagnostics, errorMessage, onClearLogs }: DiagnosticsCardProps) {
  return (
    <section className="diagnostics" aria-label="Diagnostics">
      <div className="section-heading">
        <h2>Diagnostics</h2>
        <button type="button" className="quiet" onClick={onClearLogs}>
          Clear
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
    </section>
  );
}
