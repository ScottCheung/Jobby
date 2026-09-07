/** @format */

'use client';

import type { LLMUsageSummary } from '@/lib/api';
import { formatTokenCount } from '@/lib/format-token-count';
import { cn } from '@/lib/utils';

function operationLabel(operation?: string | null) {
  if (!operation) return null;
  if (operation === 'resume_tailor') return 'Resume Tailor';
  if (operation === 'resume_and_cover_letter') return 'Resume + Cover Letter';
  if (operation === 'cover_letter') return 'Cover Letter';
  if (operation === 'multiple') return 'Multiple features';
  return operation.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function thinkingLabel(reasoningEffort?: string | null) {
  if (!reasoningEffort) return 'Default';
  if (reasoningEffort === 'none') return 'Off';
  if (reasoningEffort === 'multiple') return 'Multiple';
  return reasoningEffort[0].toUpperCase() + reasoningEffort.slice(1);
}

function modelLabel(model?: string | null) {
  return model === 'deepseek-v4-flash' ? 'V4 Flash' : (model || '—');
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
  const latestGeneration = operationLabel(usage.operation);
  const tokenLabel = (value?: number | null) => value == null ? '—' : formatTokenCount(value);

  return (
    <details className={cn('text-[10px] text-ink-secondary', className)}>
      <summary className='flex cursor-pointer list-none items-center gap-1 [&::-webkit-details-marker]:hidden'>
        <span>⚡ {(usage.duration_ms / 1000).toFixed(1)}s · {formatTokenCount(usage.total_tokens)} tokens · Latest AI generation</span>
        <span className='text-primary'>Usage details</span>
      </summary>
      <div className='mt-1 grid grid-cols-2 gap-x-3 gap-y-0.5 text-[10px] text-ink-secondary'>
        <span>Input {formatTokenCount(usage.input_tokens)}</span>
        <span>Cached {formatTokenCount(usage.cached_input_tokens)}</span>
        <span>Reasoning {tokenLabel(usage.reasoning_tokens)}</span>
        <span>Answer {tokenLabel(usage.answer_tokens)}</span>
        <span>Total {formatTokenCount(usage.total_tokens)}</span>
        <span>Thinking {thinkingLabel(usage.reasoning_effort)}</span>
        <span>Model {modelLabel(usage.model)}</span>
        {latestGeneration && <span>{latestGeneration}</span>}
        {showCost && cost != null && Number.isFinite(cost) && <span>Cost ${cost.toFixed(3)}</span>}
      </div>
    </details>
  );
}
