/** @format */

import {
  CheckCircle2,
  Eye,
  MessageSquare,
  Award,
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
    borderClass: '',
  },
  screening: {
    label: 'Screening',
    icon: Eye,
    colorClass: 'text-white',
    bgColorClass: 'bg-gradient-to-br from-amber-500 to-yellow-500',
    borderClass: '',
  },
  interviewing: {
    label: 'Interviewing',
    icon: MessageSquare,
    colorClass: 'text-white',
    bgColorClass: 'bg-gradient-to-br from-purple-500 to-pink-500',
    borderClass: '',
  },
  offer: {
    label: 'Offer',
    icon: Award,
    colorClass: 'text-white',
    bgColorClass: 'bg-gradient-to-br from-emerald-500 to-teal-500',
    borderClass: '',
  },
  rejected: {
    label: 'Rejected',
    icon: XCircle,
    colorClass: 'text-white',
    bgColorClass: 'bg-gradient-to-br from-red-500 to-rose-500',
    borderClass: '',
  },
  withdrawn: {
    label: 'Withdrawn',
    icon: LogOut,
    colorClass: 'text-white',
    bgColorClass: 'bg-gradient-to-br from-amber-500 to-yellow-600',
    borderClass: '',
  },
};
