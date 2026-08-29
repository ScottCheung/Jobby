/** @format */
'use client';
import React, { useState } from 'react';
import { Button } from '@jobby/ui';
import { api } from '@/lib/api';
import type { JobRecommendationImport } from '@/lib/types';

function parse(input: string): JobRecommendationImport[] {
  const lines = input.trim().split(/\r?\n/).map((line) => line.trim()).filter((line) => line && !/^```(?:tsv)?$/i.test(line));
  if (lines.length < 2) return [];
  const headers = lines[0].split('\t').map((v) => v.trim());
  const at = (name: string) => headers.indexOf(name);
  if (at('platform') < 0 || at('title') < 0 || at('match_score') < 0) return [];
  return lines.slice(1).flatMap((line) => {
    const cells = line.split('\t'); const get = (name: string) => cells[at(name)]?.trim(); const title = get('title');
    return title ? [{ job_id: get('job_id'), platform: get('platform') || 'generic', title, company: get('company'), work_location: get('work_location'), work_style: get('work_style'), job_link: get('job_link'), match_score: Number(get('match_score')) || 0, recommendation_reason: get('recommend_reason') || get('recommendation_reason') }] : [];
  });
}

export function RecommendationImportModal({ onClose, onImported }: { onClose: () => void; onImported: () => Promise<void> }) {
  const [input, setInput] = useState(''); const [rows, setRows] = useState<JobRecommendationImport[]>([]); const [saving, setSaving] = useState(false); const [error, setError] = useState<string | null>(null);
  const preview = (value = input) => setRows(parse(value));
  const edit = (index: number, key: keyof JobRecommendationImport, value: string) => setRows((items) => items.map((row, i) => i === index ? { ...row, [key]: key === 'match_score' ? Number(value) || 0 : value } : row));
  const save = async () => { setSaving(true); setError(null); try { await api.importRecommendations(rows); await onImported(); onClose(); } catch (cause) { setError(cause instanceof Error ? cause.message : 'Import failed.'); } finally { setSaving(false); } };
  return <div className='panel-xl flex max-h-[88vh] w-full max-w-6xl flex-col overflow-hidden'><div className='header'><h2 className='text-lg font-bold text-ink-primary'>Import AI recommendations</h2><Button type='button' variant='ghost' onClick={onClose}>Close</Button></div><div className='body'>{error && <div className='mb-3 rounded-xl bg-red-500/10 p-3 text-xs font-medium text-red-600'>{error}</div>}{rows.length === 0 ? <><textarea value={input} onChange={(e) => setInput(e.target.value)} onPaste={(event) => { const value = event.clipboardData.getData('text'); if (value) { event.preventDefault(); setInput(value); preview(value); } }} placeholder='Paste TSV with platform, title, and match_score' className='min-h-56 w-full rounded-xl bg-background-secondary p-4 text-sm outline-none' /><div className='mt-3 flex justify-end'><Button type='button' disabled={!input.trim()} onClick={() => preview()}>Preview</Button></div></> : <div className='overflow-auto'><table className='w-full min-w-[900px] text-left text-xs'><thead className='text-ink-secondary'><tr><th className='p-2'>Title</th><th className='p-2'>Company</th><th className='p-2'>Location</th><th className='p-2'>Score</th><th className='p-2'>Reason</th></tr></thead><tbody>{rows.map((row, i) => <tr key={`${row.platform}-${row.job_id}-${i}`} className='border-t border-ink-primary/5'><td className='p-2'><input value={row.title} onChange={(e) => edit(i, 'title', e.target.value)} className='w-full bg-transparent outline-none' /></td><td className='p-2'><input value={row.company || ''} onChange={(e) => edit(i, 'company', e.target.value)} className='w-full bg-transparent outline-none' /></td><td className='p-2'><input value={row.work_location || ''} onChange={(e) => edit(i, 'work_location', e.target.value)} className='w-full bg-transparent outline-none' /></td><td className='p-2'><input type='number' value={row.match_score} onChange={(e) => edit(i, 'match_score', e.target.value)} className='w-12 bg-transparent outline-none' /></td><td className='p-2'><input value={row.recommendation_reason || ''} onChange={(e) => edit(i, 'recommendation_reason', e.target.value)} className='w-full bg-transparent outline-none' /></td></tr>)}</tbody></table></div>}</div>{rows.length > 0 && <div className='footer'><Button type='button' variant='ghost' onClick={() => setRows([])}>Back</Button><Button type='button' disabled={saving} onClick={save}>{saving ? 'Importing…' : `Import ${rows.length} jobs`}</Button></div>}</div>;
}
