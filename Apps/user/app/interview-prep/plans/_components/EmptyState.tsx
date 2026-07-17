import React from 'react';
import { Calendar } from 'lucide-react';

export function EmptyState() {
  return (
    <div className="p-12 flex flex-col items-center justify-center text-center border border-border/40 rounded-xl bg-panel">
      <Calendar className="w-12 h-12 text-ink-secondary opacity-50 mb-4" />
      <h3 className="text-lg font-medium text-ink-primary mb-1">No active plans</h3>
      <p className="text-sm text-ink-secondary max-w-sm">
        Create a practice plan to organize your interview preparation and stay on track with daily tasks.
      </p>
    </div>
  );
}
