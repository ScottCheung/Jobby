import type { StatusBannerState, StatusState } from "../hooks/useApplicationPlan";

interface StatusBannerProps {
  status: StatusBannerState;
}

const ICONS: Record<StatusState, string> = {
  idle: "💡",
  running: "⚙️",
  success: "✅",
  warning: "⚠️",
  error: "❌",
};

export function StatusBanner({ status }: StatusBannerProps) {
  return (
    <div className={`action-status-banner ${status.state}`} aria-live="polite">
      <span className="status-icon">{ICONS[status.state]}</span>
      <span className="status-text">{status.message}</span>
    </div>
  );
}
