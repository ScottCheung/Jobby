/** @format */

import {
  CheckCircle2,
  Eye,
  MessageSquare,
  Award,
  Clock,
  AlertTriangle,
  XCircle,
  LogOut,
} from 'lucide-react';

export const stageConfig: Record<
  string,
  {
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    colorClass: string;
    bgColorClass: string;
    borderClass: string;
  }
> = {
  applied: {
    label: 'Applied',
    icon: CheckCircle2,
    colorClass: 'text-white',
    bgColorClass: 'bg-gradient-to-br from-blue-500 to-cyan-500',
    borderClass: 'border-blue-500/20',
  },
  screening: {
    label: 'Screening',
    icon: Eye,
    colorClass: 'text-white',
    bgColorClass: 'bg-gradient-to-br from-amber-500 to-yellow-500',
    borderClass: 'border-amber-500/20',
  },
  interviewing: {
    label: 'Interviewing',
    icon: MessageSquare,
    colorClass: 'text-white',
    bgColorClass: 'bg-gradient-to-br from-purple-500 to-pink-500',
    borderClass: 'border-purple-500/20',
  },
  offer: {
    label: 'Offer',
    icon: Award,
    colorClass: 'text-white',
    bgColorClass: 'bg-gradient-to-br from-emerald-500 to-teal-500',
    borderClass: 'border-emerald-500/20',
  },
  skipped: {
    label: 'Skipped',
    icon: Clock,
    colorClass: 'text-white',
    bgColorClass: 'bg-gradient-to-br from-zinc-500 to-slate-500',
    borderClass: 'border-primary',
  },
  processing: {
    label: 'Processing',
    icon: Clock,
    colorClass: 'text-white',
    bgColorClass: 'bg-gradient-to-br from-sky-500 to-indigo-500',
    borderClass: 'border-sky-500/20',
  },
  interrupted: {
    label: 'Needs Review',
    icon: AlertTriangle,
    colorClass: 'text-white',
    bgColorClass: 'bg-gradient-to-br from-orange-500 to-red-500',
    borderClass: 'border-orange-500/20',
  },
  cancelled: {
    label: 'Cancelled',
    icon: XCircle,
    colorClass: 'text-white',
    bgColorClass: 'bg-gradient-to-br from-rose-500 to-pink-500',
    borderClass: 'border-rose-500/20',
  },
  rejected: {
    label: 'Rejected',
    icon: XCircle,
    colorClass: 'text-white',
    bgColorClass: 'bg-gradient-to-br from-red-500 to-rose-500',
    borderClass: 'border-red-500/20',
  },
  withdrawn: {
    label: 'Withdrawn',
    icon: LogOut,
    colorClass: 'text-white',
    bgColorClass: 'bg-gradient-to-br from-amber-500 to-yellow-600',
    borderClass: 'border-primary',
  },
};
