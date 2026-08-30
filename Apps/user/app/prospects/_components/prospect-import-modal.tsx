/** @format */

'use client';

import React, { useState } from 'react';
import {
  ArrowLeft,
  Check,
  Clipboard,
  FileSpreadsheet,
  X,
} from 'lucide-react';
import { Button } from '@jobby/ui';
import { api } from '@/lib/api';
import type { Prospect, ProspectMatchLevel, ProspectRoleType } from '@/lib/types';

type ProspectImportRow = Partial<Prospect> & {
  name: string;
  title: string;
  company: string;
  role_type: ProspectRoleType;
  priority_score: number;
  match_level: ProspectMatchLevel;
  recommendation_reason: string;
  has_active_job: boolean;
};

const HEADER_ALIASES: Record<string, string> = {
  linkedin: 'linkedin_url',
  linkedin_profile: 'linkedin_url',
  role: 'role_type',
  role_category: 'role_type',
  location: 'location',
  active_job: 'has_active_job',
  active_job_exists: 'has_active_job',
  active_job_name: 'active_job_title',
  priority: 'priority_score',
  score: 'priority_score',
  recommend_reason: 'recommendation_reason',
  rationale: 'recommendation_reason',
};

const normalizeHeader = (value: string) => {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[`"']/g, '')
    .replace(/[\s-]+/g, '_');
  return HEADER_ALIASES[normalized] || normalized;
};

const parseBoolean = (value: string | undefined) =>
  ['true', 'yes', '1', 'y'].includes((value || '').trim().toLowerCase());

const parseScore = (value: string | undefined, fallback: number) => {
  const score = Number(value);
  if (!Number.isFinite(score)) return fallback;
  return Math.max(1, Math.min(100, Math.round(score)));
};

function parse(input: string): ProspectImportRow[] {
  const lines = input
    .trim()
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !/^```(?:tsv|text)?$/i.test(line));
  if (lines.length < 2) return [];

  const headers = lines[0].split('\t').map(normalizeHeader);
  const index = (name: string) => headers.indexOf(name);
  const getCell = (cells: string[], name: string) => {
    const position = index(name);
    return position >= 0 ? cells[position]?.trim() : undefined;
  };

  if (index('name') < 0 || index('title') < 0 || index('company') < 0) {
    return [];
  }

  return lines.slice(1).flatMap((line) => {
    const cells = line.split('\t');
    const name = getCell(cells, 'name');
    const title = getCell(cells, 'title');
    const company = getCell(cells, 'company');
    if (!name || !title || !company) return [];

    const role = getCell(cells, 'role_type');
    const roleType: ProspectRoleType =
      role === 'recruiter' ||
      role === 'engineering_manager' ||
      role === 'hiring_manager' ?
        role
      : 'hiring_manager';
    const priorityScore = parseScore(getCell(cells, 'priority_score'), 80);
    const matchLevel = getCell(cells, 'match_level');

    return [
      {
        name,
        title,
        company,
        role_type: roleType,
        linkedin_url: getCell(cells, 'linkedin_url') || undefined,
        location: getCell(cells, 'location') || undefined,
        has_active_job: parseBoolean(getCell(cells, 'has_active_job')),
        active_job_title: getCell(cells, 'active_job_title') || undefined,
        active_job_url: getCell(cells, 'active_job_url') || undefined,
        priority_score: priorityScore,
        score_breakdown: {
          hiring_power: parseScore(getCell(cells, 'hiring_power'), priorityScore),
          reply_probability: parseScore(getCell(cells, 'reply_probability'), priorityScore),
          company_match: parseScore(getCell(cells, 'company_match'), priorityScore),
          experience_match: parseScore(getCell(cells, 'experience_match'), priorityScore),
          overall: parseScore(getCell(cells, 'overall'), priorityScore),
        },
        match_level:
          matchLevel === 'low' || matchLevel === 'medium' ? matchLevel : 'high',
        recommendation_reason: getCell(cells, 'recommendation_reason') || '',
        notes: getCell(cells, 'notes') || undefined,
      },
    ];
  });
}

export function ProspectImportModal({
  onClose,
  onImported,
}: {
  onClose: () => void;
  onImported: () => Promise<void>;
}) {
  const [input, setInput] = useState('');
  const [rows, setRows] = useState<ProspectImportRow[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const preview = (value = input) => {
    const parsed = parse(value);
    setRows(parsed);
    setError(parsed.length ? null : 'No valid contact rows found. Check the TSV headers and try again.');
  };

  const handlePasteClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        setInput(text);
        preview(text);
      }
    } catch {
      setError('Clipboard access denied. Please paste directly into the text box below.');
    }
  };

  const edit = (index: number, key: keyof ProspectImportRow, value: string) => {
    setRows((items) =>
      items.map((row, rowIndex) =>
        rowIndex === index ?
          {
            ...row,
            [key]:
              key === 'priority_score' ? parseScore(value, row.priority_score)
              : key === 'has_active_job' ? parseBoolean(value)
              : value,
          }
        : row,
      ),
    );
  };

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      await api.createProspectsBatch(rows);
      await onImported();
      onClose();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Import failed.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className='flex max-h-[88vh] w-full max-w-6xl flex-col overflow-hidden'>
      <div className='header'>
        <div className='flex items-center gap-3'>
          <div className='flex size-10 items-center justify-center rounded-xl bg-primary-gradient text-white shadow-xs'>
            <FileSpreadsheet className='size-5' />
          </div>
          <div>
            <h2 className='text-lg font-bold text-ink-primary'>Import Contacts</h2>
            <p className='text-xs text-ink-secondary'>Paste AI results as TSV, review them, then add them to your pipeline.</p>
          </div>
        </div>
        <div className='flex items-center gap-2'>
          <Button type='button' Icon={Clipboard} onClick={handlePasteClipboard}>Paste</Button>
          <button type='button' onClick={onClose} aria-label='Close' className='cursor-pointer rounded-full p-2 text-ink-secondary transition-colors hover:bg-background-secondary hover:text-ink-primary'>
            <X className='size-5' />
          </button>
        </div>
      </div>

      <div className='body space-y-3 overflow-y-auto'>
        {error && <div className='rounded-xl bg-red-500/10 p-3 text-xs font-medium text-red-600 dark:text-red-400'>{error}</div>}
        {rows.length === 0 ? (
          <div className='space-y-3'>
            <textarea
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onPaste={(event) => {
                const value = event.clipboardData.getData('text');
                if (value) {
                  event.preventDefault();
                  setInput(value);
                  preview(value);
                }
              }}
              placeholder='Paste TSV with headers: name, title, company, role_type, location, linkedin_url, has_active_job, active_job_title, active_job_url, priority_score, hiring_power, reply_probability, company_match, experience_match, overall, match_level, recommendation_reason, notes'
              className='min-h-64 w-full rounded-2xl border border-border/40 bg-background-secondary/40 p-4 font-mono text-xs text-ink-primary outline-none focus:border-primary/50 custom-scrollbar'
            />
            <div className='flex items-center justify-between'>
              <span className='text-xs text-ink-secondary'>Paste the copied TSV, then preview before importing.</span>
              <Button type='button' disabled={!input.trim()} onClick={() => preview()}>Preview</Button>
            </div>
          </div>
        ) : (
          <div className='overflow-auto rounded-2xl border border-border/40'>
            <table className='w-full min-w-[1000px] text-left text-xs'>
              <thead className='bg-background-secondary/50 text-ink-secondary'>
                <tr><th className='p-3'>Name</th><th className='p-3'>Title</th><th className='p-3'>Company</th><th className='p-3'>Role</th><th className='p-3'>Location</th><th className='p-3'>Score</th><th className='p-3'>Reason</th></tr>
              </thead>
              <tbody className='divide-y divide-border/20'>
                {rows.map((row, index) => (
                  <tr key={`${row.linkedin_url || row.name}-${index}`}>
                    <td className='p-3'><input value={row.name} onChange={(event) => edit(index, 'name', event.target.value)} className='w-40 bg-transparent font-medium text-ink-primary outline-none' /></td>
                    <td className='p-3'><input value={row.title} onChange={(event) => edit(index, 'title', event.target.value)} className='w-48 bg-transparent text-ink-primary outline-none' /></td>
                    <td className='p-3'><input value={row.company} onChange={(event) => edit(index, 'company', event.target.value)} className='w-36 bg-transparent text-ink-secondary outline-none' /></td>
                    <td className='p-3'><select value={row.role_type} onChange={(event) => edit(index, 'role_type', event.target.value)} className='bg-transparent text-ink-secondary outline-none'><option value='hiring_manager'>Hiring manager</option><option value='engineering_manager'>Engineering manager</option><option value='recruiter'>Recruiter</option></select></td>
                    <td className='p-3'><input value={row.location || ''} onChange={(event) => edit(index, 'location', event.target.value)} className='w-32 bg-transparent text-ink-secondary outline-none' /></td>
                    <td className='p-3'><input type='number' value={row.priority_score} onChange={(event) => edit(index, 'priority_score', event.target.value)} className='w-16 rounded-lg bg-background-secondary/60 px-2 py-1 font-bold text-primary outline-none' /></td>
                    <td className='p-3'><input value={row.recommendation_reason} onChange={(event) => edit(index, 'recommendation_reason', event.target.value)} className='w-72 bg-transparent text-ink-secondary outline-none' /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {rows.length > 0 && (
        <div className='footer'>
          <Button type='button' variant='ghost' Icon={ArrowLeft} onClick={() => setRows([])}>Back</Button>
          <Button type='button' Icon={Check} disabled={saving} onClick={save}>{saving ? 'Importing…' : `Import ${rows.length} contacts`}</Button>
        </div>
      )}
    </div>
  );
}
