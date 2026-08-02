/** @format */

interface HeaderProps {
  phase: string;
}

export function Header(_props: HeaderProps) {
  return (
    <header className='panel-header'>
      {/* <div>
        <div className="header-eyebrow-row">
          <p className="eyebrow">JOBBY</p>
          <span className="version-badge">v0.2.4</span>
        </div>
        <h1>Automation</h1>
      </div>
      <span className="phase" data-phase={phase} aria-live="polite">
        {phase.replaceAll("_", " ")}
      </span> */}
    </header>
  );
}
