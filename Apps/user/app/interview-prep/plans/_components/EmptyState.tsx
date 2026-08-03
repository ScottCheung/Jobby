import React from 'react';
import { Calendar } from 'lucide-react';
import { EmptyPlaceHolder } from '@/components/UI/EmptyPlaceHolder';

export function EmptyState() {
  return (
    <EmptyPlaceHolder
      icon={Calendar}
      title="No active plans"
      description="Create a practice plan to organize your interview preparation and stay on track with daily tasks."
    />
  );
}
