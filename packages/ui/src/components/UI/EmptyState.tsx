'use client';
/** @format */

import { EmptyPlaceHolder, type EmptyPlaceHolderProps } from './EmptyPlaceHolder';

export interface EmptyStateProps extends EmptyPlaceHolderProps {
  title: string;
}

export function EmptyState(props: EmptyStateProps) {
  return <EmptyPlaceHolder {...props} />;
}
