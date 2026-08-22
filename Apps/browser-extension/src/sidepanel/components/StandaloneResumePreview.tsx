/** @format */

import { useEffect, useState } from 'react';
import { Download, ExternalLink, FileText, Loader2 } from 'lucide-react';

type StoredPreview = {
  filename: string;
  pdfDataUrl: string;
  editUrl?: string;
};

const THEME_COLORS: Record<string, string> = {
  green: '#0f766e',
  blue: '#2563eb',
  purple: '#7c3aed',
  orange: '#c2410c',
  rose: '#e11d48',
};

function getPreviewId(): string | null {
  return new URLSearchParams(window.location.search).get('resumePreview');
}

export function StandaloneResumePreview() {
  const [preview, setPreview] = useState<StoredPreview | null>(null);
  const [error, setError] = useState('');
  const [themeColor, setThemeColor] = useState(THEME_COLORS.green);

  useEffect(() => {
    void chrome.storage.local
      .get('auto-job-ui-theme-color')
      .then((stored) => {
        const colorName = stored['auto-job-ui-theme-color'];
        if (typeof colorName === 'string' && THEME_COLORS[colorName]) {
          setThemeColor(THEME_COLORS[colorName]);
        }
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    const previewId = getPreviewId();
    if (!previewId) {
      setError('This preview link is invalid.');
      return;
    }
    const key = `jobby.resume-preview.${previewId}`;
    let cancelled = false;
    const readPreview = async () => {
      // The standalone window is deliberately opened before PDF generation so
      // Chrome preserves the user's click gesture. Wait briefly for its data.
      for (let attempt = 0; attempt < 25; attempt += 1) {
        const stored = await chrome.storage.session.get(key);
        const value = stored[key] as StoredPreview | undefined;
        if (value?.pdfDataUrl && value.filename) {
          if (!cancelled) setPreview(value);
          return;
        }
        await new Promise((resolve) => window.setTimeout(resolve, 100));
      }
      if (!cancelled) setError('This preview has expired. Open it again from Jobby.');
    };
    void readPreview().catch(() => {
      if (!cancelled) setError('Could not load this preview.');
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (error) {
    return (
      <main className='flex min-h-screen items-center justify-center bg-slate-100 p-8 text-center text-sm font-medium text-red-700'>
        {error}
      </main>
    );
  }

  if (!preview) {
    return (
      <main className='flex min-h-screen items-center justify-center gap-2 bg-slate-100 text-sm font-semibold text-slate-600'>
        <Loader2 className='size-4 animate-spin' style={{ color: themeColor }} />
        Preparing resume preview…
      </main>
    );
  }

  return (
    <main className='flex h-screen flex-col overflow-hidden bg-slate-200 text-slate-900'>
      <header className='flex shrink-0 items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-3'>
        <div className='flex min-w-0 items-center gap-2'>
          <FileText className='size-4 shrink-0' style={{ color: themeColor }} />
          <h1 className='truncate text-sm font-bold'>{preview.filename}</h1>
        </div>
        <div className='flex shrink-0 items-center gap-2'>
          {preview.editUrl && (
            <button
              type='button'
              onClick={() => window.open(preview.editUrl, '_blank', 'noopener')}
              className='inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-bold'
              style={{ borderColor: themeColor, color: themeColor }}
            >
              <ExternalLink className='size-3.5' />
              Edit Resume
            </button>
          )}
          <a
            href={preview.pdfDataUrl}
            download={preview.filename}
            className='inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-bold text-white no-underline'
            style={{ backgroundColor: themeColor }}
          >
            <Download className='size-3.5' />
            Download PDF
          </a>
        </div>
      </header>
      <iframe
        title='Resume PDF preview'
        src={preview.pdfDataUrl}
        className='min-h-0 w-full flex-1 border-0 bg-white'
      />
    </main>
  );
}
