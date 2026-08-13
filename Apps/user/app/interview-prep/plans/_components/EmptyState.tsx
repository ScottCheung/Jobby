import { EmptyPlaceHolder } from '@jobby/ui';
import React from 'react';
import { Calendar } from 'lucide-react';


export function EmptyState() {
  return (
    <EmptyPlaceHolder
      icon={Calendar}
      title="No active plans"
      description="Create a practice plan to organize your interview preparation and stay on track with daily tasks."
    />
  );
}
