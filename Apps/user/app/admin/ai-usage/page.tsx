/** @format */

'use client';

import { useEffect, useMemo, useState } from 'react';
import { useConsole } from '@/components/ConsoleContext';
import { renderPagination } from '@/components/ConsoleUtils';
import { api, type AdminAiUsageCall, type AdminAiUsageSummary } from '@/lib/api';
import { formatTokenCount } from '@/lib/format-token-count';

const PAGE_SIZE = 20;

type Metric = 'cost_usd' | 'total_tokens' | 'calls';

function formatCost(value: number | null | undefined) {
  return value == null ? '—' : `$${value.toFixed(2)}`;
}

function formatDuration(value: number) {
  return value >= 1000 ? `${(value / 1000).toFixed(1)}s` : `${value}ms`;
}

function thinkingLabel(reasoningEffort: string | null | undefined) {
  if (!reasoningEffort) return '—';
  if (reasoningEffort === 'none') return 'Off';
  return reasoningEffort[0].toUpperCase() + reasoningEffort.slice(1);
}

function operationLabel(operation: string) {
  if (operation === 'resume_tailor') return 'Resume Tailor';
  if (operation === 'resume_and_cover_letter') return 'Resume + Cover Letter';
  if (operation === 'cover_letter') return 'Cover Letter';
  return operation.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export default function AiUsageAdminPage() {
  const { user } = useConsole();
  const [range, setRange] = useState('7d');
  const [metric, setMetric] = useState<Metric>('cost_usd');
  const [summary, setSummary] = useState<AdminAiUsageSummary | null>(null);
  const [calls, setCalls] = useState<AdminAiUsageCall[]>([]);
  const [totalCalls, setTotalCalls] = useState(0);
  const [page, setPage] = useState(1);
  const [selectedCall, setSelectedCall] = useState<AdminAiUsageCall | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingCalls, setLoadingCalls] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (user?.role !== 'admin') return;
    let cancelled = false;
    setLoading(true);
    setError('');
    api.adminAiUsageSummary(range)
      .then((nextSummary) => {
        if (cancelled) return;
        setSummary(nextSummary);
      })
      .catch((loadError) => {
        if (!cancelled) setError(loadError instanceof Error ? loadError.message : 'Could not load AI usage.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [range, user?.role]);

  useEffect(() => {
    if (user?.role !== 'admin') return;
    let cancelled = false;
    setLoadingCalls(true);
    api.adminAiUsageCalls({
      range,
      limit: PAGE_SIZE,
      offset: (page - 1) * PAGE_SIZE,
    })
      .then((nextCalls) => {
        if (cancelled) return;
        setCalls(nextCalls.items);
        setTotalCalls(nextCalls.total);
      })
      .catch((loadError) => {
        if (!cancelled) setError(loadError instanceof Error ? loadError.message : 'Could not load AI usage calls.');
      })
      .finally(() => {
        if (!cancelled) setLoadingCalls(false);
      });
    return () => {
      cancelled = true;
    };
  }, [range, page, user?.role]);

  const selectedMetricLabel = useMemo(
    () => ({ cost_usd: 'Cost', total_tokens: 'Tokens', calls: 'Calls' })[metric],
    [metric],
  );
  const trend = useMemo(() => {
    const values = summary?.daily.map((item) => Number(item[metric] ?? 0)) ?? [];
    const maxValue = values.length ? Math.max(...values) : null;
    const max = Math.max(maxValue ?? 0, 1);
    return {
      max,
      maxValue,
      points: values.map((value, index) => ({
        date: summary?.daily[index]?.date ?? '',
        value,
        x: values.length <= 1 ? 50 : (index / (values.length - 1)) * 100,
        y: 94 - (value / max) * 82,
      })),
    };
  }, [metric, summary]);

  const formatTrendValue = (value: number) => {
    if (metric === 'cost_usd') return formatCost(value);
    if (metric === 'total_tokens') return formatTokenCount(value);
    return value.toLocaleString();
  };

  if (!user || user.role !== 'admin') {
    return <div className='p-8 text-center text-ink-secondary'>Admin access required</div>;
  }
  if (loading && !summary) return <div className='p-6 text-ink-secondary'>Loading AI usage...</div>;
  if (error && !summary) return <div className='p-6 text-rose-600'>{error}</div>;
  if (!summary) return null;

  return (
    <div className='mx-auto flex max-w-6xl flex-col gap-5 pb-10'>
      <header className='flex items-center justify-between gap-4 border-b border-primary/60 pb-5'>
        <h1 className='title-section'>AI Usage</h1>
        <select
          value={range}
          onChange={(event) => {
            setRange(event.target.value);
            setPage(1);
          }}
          className='input h-9 w-auto'
        >
          <option value='1d'>24 hours</option>
          <option value='7d'>7 days</option>
          <option value='30d'>30 days</option>
        </select>
      </header>

      <div className='grid gap-3 sm:grid-cols-2 lg:grid-cols-4'>
        {[
          ['Estimated cost', formatCost(summary.cost_usd)],
          ['AI calls', summary.calls.toLocaleString()],
          ['Tokens', formatTokenCount(summary.total_tokens), summary.reasoning_output_ratio == null ? null : `${Math.round(summary.reasoning_output_ratio * 100)}% reasoning output`],
          ['Avg latency', formatDuration(summary.avg_duration_ms)],
        ].map(([label, value, secondary]) => (
          <div key={label} className='rounded-2xl border border-primary/50 bg-panel/50 p-4'>
            <div className='text-xs text-ink-secondary'>{label}</div>
            <div className='mt-2 text-2xl font-semibold text-ink-primary'>{value}</div>
            {secondary && <div className='mt-1 text-xs text-ink-secondary'>{secondary}</div>}
          </div>
        ))}
      </div>

      <div className='grid gap-5 lg:grid-cols-[minmax(0,1fr)_280px]'>
        <div className='rounded-2xl border border-primary/50 bg-panel/50 p-4'>
          <div className='mb-3 flex items-center justify-between'>
            <h2 className='title-card'>Trend</h2>
            <div className='flex rounded-full border border-primary/50 p-0.5 text-xs'>
              {([
                ['cost_usd', 'Cost'],
                ['total_tokens', 'Tokens'],
                ['calls', 'Calls'],
              ] as const).map(([value, label]) => (
                <button key={value} type='button' onClick={() => setMetric(value)} className={`rounded-full px-3 py-1 ${metric === value ? 'bg-primary/15 text-primary' : 'text-ink-secondary'}`}>
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div className='mb-2 flex justify-between text-xs text-ink-secondary'>
            <span>{selectedMetricLabel}</span>
            <span>{trend.maxValue == null ? '—' : `Max ${formatTrendValue(trend.maxValue)}`}</span>
          </div>
          <svg viewBox='0 0 100 100' className='h-48 w-full overflow-visible' preserveAspectRatio='none'>
            <line x1='0' y1='94' x2='100' y2='94' stroke='currentColor' className='text-primary/30' />
            <polyline fill='none' stroke='currentColor' strokeWidth='1.5' points={trend.points.map((point) => `${point.x},${point.y}`).join(' ') || '0,94 100,94'} className='text-primary' vectorEffect='non-scaling-stroke' />
            {trend.points.map((point) => (
              <circle key={point.date} cx={point.x} cy={point.y} r='1.5' className='fill-primary'>
                <title>{`${point.date} · ${formatTrendValue(point.value)}`}</title>
              </circle>
            ))}
          </svg>
          <div className='flex justify-between text-[10px] text-ink-secondary'>
            <span>{summary.daily[0]?.date ?? '—'}</span>
            <span>{summary.daily.at(-1)?.date ?? '—'}</span>
          </div>
        </div>

        <div className='rounded-2xl border border-primary/50 bg-panel/50 p-4'>
          <h2 className='title-card mb-4'>Spend by feature</h2>
          <div className='flex flex-col gap-3'>
            {summary.by_feature.map((item) => (
              <div key={item.feature} className='flex items-center justify-between gap-3 text-sm'>
                <span className='truncate text-ink-secondary'>{item.feature}</span>
                <span className='shrink-0 font-medium'>{formatCost(item.cost_usd)}</span>
              </div>
            ))}
            {!summary.by_feature.length && <span className='text-sm text-ink-secondary'>No calls</span>}
          </div>
        </div>
      </div>

      <div className='rounded-2xl border border-primary/50 bg-panel/50 p-4'>
        <div className='mb-3 flex items-center justify-between'>
          <h2 className='title-card'>Recent AI calls</h2>
          <span className='text-xs text-ink-secondary'>{totalCalls.toLocaleString()} total</span>
        </div>
        <div className='overflow-x-auto'>
          <table className='w-full min-w-[840px] text-left text-sm'>
            <thead className='border-b border-primary/40 text-xs text-ink-secondary'>
              <tr>{['Feature', 'User', 'Tokens', 'Thinking', 'Cost', 'Duration', 'Model', 'Time'].map((label) => <th key={label} className='px-3 py-2 font-medium'>{label}</th>)}</tr>
            </thead>
            <tbody className={loadingCalls ? 'opacity-50 transition-opacity' : 'transition-opacity'}>
              {calls.map((call) => (
                <tr key={call.id} onClick={() => setSelectedCall(call)} className='cursor-pointer border-b border-primary/20 transition-colors hover:bg-primary/5'>
                  <td className='px-3 py-3'>{operationLabel(call.feature)}</td>
                  <td className='px-3 py-3 text-ink-secondary'>{call.user || '—'}</td>
                  <td className='px-3 py-3'>{formatTokenCount(call.total_tokens)}</td>
                  <td className='px-3 py-3 text-ink-secondary'>{thinkingLabel(call.reasoning_effort)}</td>
                  <td className='px-3 py-3'>{formatCost(call.cost_usd)}</td>
                  <td className='px-3 py-3'>{formatDuration(call.duration_ms)}{call.slow && <span className='ml-1 text-amber-600'>· Slow</span>}</td>
                  <td className='px-3 py-3 text-ink-secondary'>{call.model}</td>
                  <td className='px-3 py-3 text-ink-secondary'>{new Date(call.created_at).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!calls.length && !loadingCalls && <div className='p-6 text-center text-sm text-ink-secondary'>No AI calls in this range.</div>}
        </div>
        {renderPagination(page, totalCalls, PAGE_SIZE, setPage, loadingCalls)}
      </div>

      {selectedCall && (
        <div className='fixed inset-0 z-50 flex justify-end bg-black/20' onClick={() => setSelectedCall(null)}>
          <aside className='h-full w-full max-w-md overflow-y-auto border-l border-primary/60 bg-background p-6 shadow-xl' onClick={(event) => event.stopPropagation()}>
            <div className='mb-6 flex items-center justify-between'>
              <h2 className='title-section'>AI call</h2>
              <button type='button' onClick={() => setSelectedCall(null)} className='text-sm text-ink-secondary'>Close</button>
            </div>
            <div className='grid grid-cols-2 gap-4 text-sm'>
              {[
                ['Feature', selectedCall.feature],
                ['User', selectedCall.user || selectedCall.user_email || '—'],
                ['Status', selectedCall.status],
                ['Model', selectedCall.model],
                ['Input', formatTokenCount(selectedCall.input_tokens)],
                ['Cached', formatTokenCount(selectedCall.cached_input_tokens)],
                ['Output', formatTokenCount(selectedCall.output_tokens)],
                ['Reasoning', selectedCall.reasoning_tokens == null ? '—' : formatTokenCount(selectedCall.reasoning_tokens)],
                ['Answer', selectedCall.answer_tokens == null ? '—' : formatTokenCount(selectedCall.answer_tokens)],
                ['Total', formatTokenCount(selectedCall.total_tokens)],
                ['Thinking', thinkingLabel(selectedCall.reasoning_effort)],
                ['Cost', formatCost(selectedCall.cost_usd)],
                ['Duration', formatDuration(selectedCall.duration_ms)],
                ['Time', new Date(selectedCall.created_at).toLocaleString()],
              ].map(([label, value]) => <div key={label}><div className='text-xs text-ink-secondary'>{label}</div><div className='mt-1 break-all'>{value}</div></div>)}
            </div>
            <div className='mt-6 border-t border-primary/40 pt-4 text-sm'>
              <div className='text-xs text-ink-secondary'>Generation ID</div>
              <div className='mt-1 break-all'>{selectedCall.generation_id}</div>
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}
