/** @format */

'use client';

import React, { useState, useEffect } from 'react';
import { Button, SectionHeading } from '@jobby/ui';
import { coverLetterBody } from '@jobby/ui/components/UI/Resume/cover-letter-content';

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
  const [content, setContent] = useState(coverLetterBody(coverLetter || ''));
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setContent(coverLetterBody(coverLetter || ''));
  }, [coverLetter]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const body = coverLetterBody(content);
      setContent(body);
      await onSave(body);
    } finally {
      setIsSaving(false);
    }
  };

  const hasChanges = content !== coverLetterBody(coverLetter || '');

  if (!coverLetter && !isGenerating) {
    return (
      <div className='rounded-2xl border border-border/70 bg-panel/70 p-6 text-center flex flex-col items-center justify-center gap-3'>
        <h3 className='text-sm font-bold text-ink-primary'>
          No Cover Letter
        </h3>
        {onGenerateCoverLetter && (
          <Button
            size='sm'
            variant='default'
            onClick={onGenerateCoverLetter}
          >
            Generate Cover Letter
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className='rounded-2xl border border-border/70 bg-panel/70 p-5 space-y-3 shadow-2xs'>
      <div className='flex flex-wrap items-center justify-between gap-3 border-b border-border/50 pb-3'>
        <SectionHeading className='text-sm font-bold text-ink-primary'>
          Cover Letter Body
        </SectionHeading>

        <div className='flex items-center gap-3'>
          <span className='text-xs text-ink-secondary'>
            {content.length.toLocaleString()} chars
          </span>
          <Button
            size='sm'
            variant='default'
            isLoading={isSaving}
            disabled={!hasChanges && Boolean(coverLetter)}
            onClick={() => void handleSave()}
            className='!h-8 !px-3.5 text-xs font-semibold'
          >
            Save
          </Button>
        </div>
      </div>

      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        rows={16}
        className='w-full rounded-xl border border-border/70 bg-background/80 p-3 font-sans text-xs leading-relaxed text-ink-primary placeholder:text-ink-secondary/50 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/30 resize-y transition-all'
        placeholder='Write or edit the cover letter here...'
      />
    </div>
  );
}
