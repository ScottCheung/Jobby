/** @format */

'use client';

import type { LLMUsageSummary } from '@/lib/api';
import { cn } from '@/lib/utils';

function formatTokens(value: number) {
  return `${(value / 1000).toFixed(1)}K`;
}

export function AiUsageMeta({
  usage,
  showCost = false,
  className,
}: {
  usage?: LLMUsageSummary | null;
  showCost?: boolean;
  className?: string;
}) {
  if (!usage) return null;
  const cost = usage.estimated_cost_usd == null ? null : Number(usage.estimated_cost_usd);
  const costLabel = showCost && cost != null && Number.isFinite(cost) ? ` · ~$${cost.toFixed(3)}` : '';

  return (
    <details className={cn('text-[10px] text-ink-secondary', className)}>
      <summary className='flex cursor-pointer list-none items-center gap-1 [&::-webkit-details-marker]:hidden'>
        <span>⚡ {(usage.duration_ms / 1000).toFixed(1)}s · {formatTokens(usage.total_tokens)} tokens{costLabel}</span>
        <span className='text-primary'>Usage details</span>
      </summary>
      <div className='mt-1 grid grid-cols-2 gap-x-3 gap-y-0.5 text-[10px] text-ink-secondary'>
        <span>Input {formatTokens(usage.input_tokens)}</span>
        <span>Output {formatTokens(usage.output_tokens)}</span>
        <span>Cached {formatTokens(usage.cached_input_tokens)}</span>
        <span>Model {usage.model || '—'}</span>
        {showCost && cost != null && Number.isFinite(cost) && <span>Cost ${cost.toFixed(3)}</span>}
      </div>
    </details>
  );
}
