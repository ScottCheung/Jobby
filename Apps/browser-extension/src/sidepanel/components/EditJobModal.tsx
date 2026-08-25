/** @format */

import { useEffect, useRef, useState } from 'react';
import { Check, X } from 'lucide-react';
import { Button } from '@jobby/ui/components/UI/Button';
import { Input } from '@jobby/ui/components/UI/input';
import { Textarea } from '@jobby/ui/components/UI/textarea';
import type { JobSnapshot } from '../../shared/contracts/page-inspection';

interface EditJobModalProps {
  isOpen: boolean;
  onClose: () => void;
  snapshot: JobSnapshot;
  onSave: (updates: Partial<JobSnapshot>) => void;
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
    <div
      className='modal-backdrop'
      onClick={onClose}
    >
      <div
        className='modal-card max-w-[520px] !border-0'
        onClick={(event) => event.stopPropagation()}
        role='dialog'
        aria-modal='true'
        aria-labelledby='edit-job-modal-title'
      >
        <div className='modal-header !border-0 flex items-center justify-between'>
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

        <div className='modal-body flex flex-col gap-3 max-h-[70vh] overflow-y-auto pr-1'>
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

        <div className='modal-footer !border-0 flex items-center justify-end gap-2 pt-2'>
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
    </div>
  );
}
