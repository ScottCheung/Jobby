/** @format */

import * as React from 'react';
import { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

import { EmptyPlaceHolder, type EmptyPlaceHolderProps } from '@/components/UI/EmptyPlaceHolder';

export interface EmptyStateProps extends EmptyPlaceHolderProps {
  title: string;
}

export function EmptyState(props: EmptyStateProps) {
  return <EmptyPlaceHolder {...props} />;
}
