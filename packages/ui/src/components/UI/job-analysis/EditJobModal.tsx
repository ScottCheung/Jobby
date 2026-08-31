/** @format */

'use client';

import { useEffect, useRef, useState } from 'react';
import { Check, X } from 'lucide-react';
import { Button } from '../Button';
import { Input } from '../input';
import { Modal } from '../../layout/modal';
import { Textarea } from '../textarea';
import type { JobAnalysisSnapshot } from './types';

interface EditJobModalProps {
  isOpen: boolean;
  onClose: () => void;
  snapshot: JobAnalysisSnapshot;
  onSave: (updates: Partial<JobAnalysisSnapshot>) => void;
}

export function EditJobModal({
  isOpen,
  onClose,
  snapshot,
  onSave,
}: EditJobModalProps) {
  const [title, setTitle] = useState(snapshot.title || '');
  const [company, setCompany] = useState(snapshot.company || '');
  const [location, setLocation] = useState(snapshot.location || '');
  const [technologiesInput, setTechnologiesInput] = useState(
    (snapshot.technologies || []).join(', '),
  );
  const [description, setDescription] = useState(snapshot.description || '');
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (isOpen) {
      setTitle(snapshot.title || '');
      setCompany(snapshot.company || '');
      setLocation(snapshot.location || '');
      setTechnologiesInput((snapshot.technologies || []).join(', '));
      setDescription(snapshot.description || '');
    }
  }, [isOpen, snapshot]);

  useEffect(() => {
    if (!isOpen) return;
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, [description, isOpen]);

  if (!isOpen) return null;

  const handleSave = () => {
    const trimmedTitle = title.trim();
    const trimmedCompany = company.trim();
    if (!trimmedTitle || !trimmedCompany) return;

    const parsedTechnologies = technologiesInput
      .split(/[,，\n]+/)
      .map((tech) => tech.trim())
      .filter(Boolean);

    onSave({
      title: trimmedTitle,
      company: trimmedCompany,
      location: location.trim() || undefined,
      technologies: parsedTechnologies,
      description: description.trim() || undefined,
    });
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      className='max-h-[88vh] w-[94vw] max-w-xl rounded-2xl text-ink-primary'
    >
      <div
        className='flex min-h-0 flex-1 flex-col'
        role='dialog'
        aria-modal='true'
        aria-labelledby='edit-job-modal-title'
      >
        <div className='header'>
          <div>
            <span className='modal-badge bg-primary text-primary-foreground'>
              Job Details
            </span>
            <h3 id='edit-job-modal-title' className='text-sm font-bold text-foreground mt-1'>
              Edit Extracted Job
            </h3>
          </div>
          <button
            type='button'
            className='close-btn'
            aria-label='Close'
            onClick={onClose}
          >
            <X className='w-4 h-4' />
          </button>
        </div>

        <div className='body'>
          <p className='text-[11px] text-muted-foreground leading-relaxed'>
            Review or edit the job details before tailoring documents or recording the application.
          </p>

          <div className='space-y-1'>
            <label className='text-[10px] font-semibold text-muted-foreground uppercase tracking-wider'>
              Job Title <span className='text-destructive'>*</span>
            </label>
            <Input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder='Job title'
              aria-label='Job title'
              className='!h-10 !border-0 !bg-muted/50 !px-3 text-xs focus:!ring-0'
            />
          </div>

          <div className='space-y-1'>
            <label className='text-[10px] font-semibold text-muted-foreground uppercase tracking-wider'>
              Company <span className='text-destructive'>*</span>
            </label>
            <Input
              value={company}
              onChange={(event) => setCompany(event.target.value)}
              placeholder='Company'
              aria-label='Company'
              className='!h-10 !border-0 !bg-muted/50 !px-3 text-xs focus:!ring-0'
            />
          </div>

          <div className='space-y-1'>
            <label className='text-[10px] font-semibold text-muted-foreground uppercase tracking-wider'>
              Location
            </label>
            <Input
              value={location}
              onChange={(event) => setLocation(event.target.value)}
              placeholder='Location (e.g. Sydney NSW, Remote)'
              aria-label='Location'
              className='!h-10 !border-0 !bg-muted/50 !px-3 text-xs focus:!ring-0'
            />
          </div>

          <div className='space-y-1'>
            <label className='text-[10px] font-semibold text-muted-foreground uppercase tracking-wider'>
              Technologies / Skills
            </label>
            <Input
              value={technologiesInput}
              onChange={(event) => setTechnologiesInput(event.target.value)}
              placeholder='React, TypeScript, Node.js (comma separated)'
              aria-label='Technologies'
              className='!h-10 !border-0 !bg-muted/50 !px-3 text-xs focus:!ring-0'
            />
          </div>

          <div className='space-y-1'>
            <label className='text-[10px] font-semibold text-muted-foreground uppercase tracking-wider'>
              Job Description
            </label>
            <Textarea
              ref={textareaRef}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder='Job description'
              aria-label='Job description'
              minHeight={160}
              showClearButton={false}
              className='!min-h-36 !rounded-xl !border-0 !bg-muted/50 !p-3 text-xs leading-relaxed focus:!ring-0 !overflow-hidden !resize-none [field-sizing:content]'
            />
          </div>
        </div>

        <div className='footer'>
          <Button
            variant='ghost'
            size='sm'
            onClick={onClose}
          >
            Cancel
          </Button>
          <Button
            size='sm'
            Icon={Check}
            onClick={handleSave}
            disabled={!title.trim() || !company.trim()}
          >
            Save Changes
          </Button>
        </div>
      </div>
    </Modal>
  );
}
