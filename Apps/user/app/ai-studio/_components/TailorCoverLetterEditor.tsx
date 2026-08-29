/** @format */

'use client';

import React, { useState, useEffect } from 'react';
import { Mail, Sparkles, Save, FileText } from 'lucide-react';
import { Button, SectionHeading } from '@jobby/ui';

interface TailorCoverLetterEditorProps {
  coverLetter: string | null;
  onSave: (nextCoverLetter: string) => Promise<void>;
  onGenerateCoverLetter?: () => void;
  isGenerating?: boolean;
}

export function TailorCoverLetterEditor({
  coverLetter,
  onSave,
  onGenerateCoverLetter,
  isGenerating = false,
}: TailorCoverLetterEditorProps) {
  const [content, setContent] = useState(coverLetter || '');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setContent(coverLetter || '');
  }, [coverLetter]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSave(content);
    } finally {
      setIsSaving(false);
    }
  };

  const hasChanges = content !== (coverLetter || '');

  if (!coverLetter && !isGenerating) {
    return (
      <div className='rounded-2xl border border-dashed border-primary/30 bg-panel/70 p-8 backdrop-blur-md text-center flex flex-col items-center justify-center gap-3'>
        <div className='flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary'>
          <Mail className='h-6 w-6' />
        </div>
        <div>
          <h3 className='text-sm font-bold text-ink-primary'>
            No Cover Letter for this Application
          </h3>
          <p className='text-xs text-ink-secondary mt-1 max-w-md'>
            Generate a tailored cover letter based on this role and your candidate profile.
          </p>
        </div>
        {onGenerateCoverLetter && (
          <Button
            size='sm'
            variant='default'
            Icon={Sparkles}
            onClick={onGenerateCoverLetter}
            className='mt-2'
          >
            Generate Tailored Cover Letter
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className='rounded-2xl border border-primary/20 bg-panel/70 p-6 backdrop-blur-md space-y-4 shadow-sm'>
      <div className='flex flex-wrap items-center justify-between gap-3 border-b border-primary/20 pb-3'>
        <div>
          <SectionHeading className='text-sm font-bold text-ink-primary flex items-center gap-2'>
            <FileText className='w-4 h-4 text-primary' />
            Cover Letter Content & Narrative
          </SectionHeading>
          <span className='text-[11px] text-ink-secondary mt-0.5 block'>
            Edit the tailored cover letter text below. Changes update the live preview above.
          </span>
        </div>

        <div className='flex items-center gap-3'>
          <span className='text-xs text-ink-secondary font-medium'>
            {content.length.toLocaleString()} characters
          </span>
          <Button
            size='sm'
            variant='default'
            Icon={Save}
            isLoading={isSaving}
            disabled={!hasChanges && Boolean(coverLetter)}
            onClick={() => void handleSave()}
            className='!h-8 !px-3.5 text-xs font-semibold'
          >
            Save Cover Letter
          </Button>
        </div>
      </div>

      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        rows={14}
        className='w-full rounded-xl border border-primary/20 bg-background/80 p-4 font-sans text-xs leading-relaxed text-ink-primary placeholder:text-ink-secondary/50 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 resize-y transition-all'
        placeholder='Write or edit the tailored cover letter here...'
      />

      <div className='rounded-xl bg-primary/5 p-3.5 border border-primary/15 text-xs text-ink-secondary leading-relaxed flex items-center gap-2'>
        <Sparkles className='w-4 h-4 text-primary shrink-0' />
        <span>
          <strong>Tailored Letter Tip:</strong> Keep the letter concise and focused on high-impact accomplishments matching the role description.
        </span>
      </div>
    </div>
  );
}
