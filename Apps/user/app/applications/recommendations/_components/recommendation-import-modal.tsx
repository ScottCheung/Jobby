/** @format */

'use client';

import React, { useState } from 'react';
import { Clipboard, FileSpreadsheet, X, Check, ArrowLeft } from 'lucide-react';
import { Button } from '@jobby/ui';
import { api } from '@/lib/api';
import type { JobRecommendationImport } from '@/lib/types';

function parse(input: string): JobRecommendationImport[] {
  const lines = input
    .trim()
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !/^```(?:tsv)?$/i.test(line));
  if (lines.length < 2) return [];
  const headers = lines[0].split('\t').map((v) => v.trim());
  const at = (name: string) => headers.indexOf(name);
  if (at('platform') < 0 || at('title') < 0 || at('match_score') < 0) return [];
  return lines.slice(1).flatMap((line) => {
    const cells = line.split('\t');
    const get = (name: string) => cells[at(name)]?.trim();
    const title = get('title');
    return title
      ? [
          {
            job_id: get('job_id'),
            platform: get('platform') || 'generic',
            title,
            company: get('company'),
            work_location: get('work_location'),
            work_style: get('work_style'),
            job_link: get('job_link'),
            match_score: Number(get('match_score')) || 0,
            recommendation_reason:
              get('recommend_reason') || get('recommendation_reason'),
          },
        ]
      : [];
  });
}

export function RecommendationImportModal({
  onClose,
  onImported,
}: {
  onClose: () => void;
  onImported: () => Promise<void>;
}) {
  const [input, setInput] = useState('');
  const [rows, setRows] = useState<JobRecommendationImport[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const preview = (value = input) => setRows(parse(value));

  const handlePasteClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        setInput(text);
        const parsed = parse(text);
        if (parsed.length > 0) {
          setRows(parsed);
          setError(null);
        } else {
          setError('No valid TSV rows found in clipboard. Check format and try again.');
        }
      }
    } catch {
      setError('Clipboard access denied. Please paste directly into the text box below.');
    }
  };

  const edit = (
    index: number,
    key: keyof JobRecommendationImport,
    value: string,
  ) =>
    setRows((items) =>
      items.map((row, i) =>
        i === index
          ? {
              ...row,
              [key]: key === 'match_score' ? Number(value) || 0 : value,
            }
          : row,
      ),
    );

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      await api.importRecommendations(rows);
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
      {/* Header */}
      <div className='header'>
        <div className='flex items-center gap-3'>
          <div className='flex size-10 items-center justify-center rounded-xl bg-primary-gradient text-white shadow-xs'>
            <FileSpreadsheet className='size-5' />
          </div>
          <div>
            <h2 className='text-lg font-bold text-ink-primary'>Create Application Plan</h2>
            <p className='text-xs text-ink-secondary'>
              Import job recommendations via TSV format
            </p>
          </div>
        </div>

        <div className='flex items-center gap-2'>
          <Button
            type='button'
            Icon={Clipboard}
            onClick={handlePasteClipboard}
          >
            Paste
          </Button>
          <button
            type='button'
            onClick={onClose}
            aria-label='Close'
            className='cursor-pointer rounded-full p-2 text-ink-secondary transition-colors hover:bg-background-secondary hover:text-ink-primary'
          >
            <X className='size-5' />
          </button>
        </div>
      </div>

      {/* Body */}
      <div className='body space-y-3 overflow-y-auto'>
        {error && (
          <div className='rounded-xl bg-red-500/10 p-3 text-xs font-medium text-red-600 dark:text-red-400'>
            {error}
          </div>
        )}

        {rows.length === 0 ? (
          <div className='space-y-3'>
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onPaste={(event) => {
                const value = event.clipboardData.getData('text');
                if (value) {
                  event.preventDefault();
                  setInput(value);
                  preview(value);
                }
              }}
              placeholder='Paste TSV with headers: job_id, platform, title, company, work_location, match_score, recommend_reason'
              className='min-h-64 w-full rounded-2xl border border-border/40 bg-background-secondary/40 p-4 font-mono text-xs text-ink-primary outline-none focus:border-primary/50 custom-scrollbar'
            />
            <div className='flex justify-between items-center'>
              <span className='text-xs text-ink-secondary'>
                Press ⌘V to paste or click the Paste button above
              </span>
              <div className='flex items-center gap-2'>
                <Button
                  type='button'
                  disabled={!input.trim()}
                  onClick={() => preview()}
                >
                  Preview
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <div className='overflow-auto rounded-2xl border border-border/40'>
            <table className='w-full min-w-[900px] text-left text-xs'>
              <thead className='bg-background-secondary/50 text-ink-secondary border-b border-border/30'>
                <tr>
                  <th className='p-3 font-semibold'>Title</th>
                  <th className='p-3 font-semibold'>Company</th>
                  <th className='p-3 font-semibold'>Location</th>
                  <th className='p-3 font-semibold'>Score</th>
                  <th className='p-3 font-semibold'>Reason</th>
                </tr>
              </thead>
              <tbody className='divide-y divide-border/20'>
                {rows.map((row, i) => (
                  <tr
                    key={`${row.platform}-${row.job_id}-${i}`}
                    className='hover:bg-background-secondary/20 transition-colors'
                  >
                    <td className='p-3'>
                      <input
                        value={row.title}
                        onChange={(e) => edit(i, 'title', e.target.value)}
                        className='w-full bg-transparent font-medium text-ink-primary outline-none focus:text-primary'
                      />
                    </td>
                    <td className='p-3'>
                      <input
                        value={row.company || ''}
                        onChange={(e) => edit(i, 'company', e.target.value)}
                        className='w-full bg-transparent text-ink-secondary outline-none'
                      />
                    </td>
                    <td className='p-3'>
                      <input
                        value={row.work_location || ''}
                        onChange={(e) => edit(i, 'work_location', e.target.value)}
                        className='w-full bg-transparent text-ink-secondary outline-none'
                      />
                    </td>
                    <td className='p-3'>
                      <input
                        type='number'
                        value={row.match_score}
                        onChange={(e) => edit(i, 'match_score', e.target.value)}
                        className='w-14 rounded-lg bg-background-secondary/60 px-2 py-1 font-bold text-primary outline-none'
                      />
                    </td>
                    <td className='p-3'>
                      <input
                        value={row.recommendation_reason || ''}
                        onChange={(e) =>
                          edit(i, 'recommendation_reason', e.target.value)
                        }
                        className='w-full bg-transparent text-ink-secondary outline-none'
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Footer */}
      {rows.length > 0 && (
        <div className='footer'>
          <Button
            type='button'
            variant='ghost'
            Icon={ArrowLeft}
            onClick={() => setRows([])}
          >
            Back
          </Button>
          <Button
            type='button'
            Icon={Check}
            disabled={saving}
            onClick={save}
          >
            {saving ? 'Importing…' : `Import ${rows.length} jobs`}
          </Button>
        </div>
      )}
    </div>
  );
}
