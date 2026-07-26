'use client';

import { useState, type DragEvent } from 'react';
import { GripVertical, Plus, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Input } from '@/components/UI/input';

type TagInputProps = {
  values: string[];
  onChange: (values: string[]) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  maxTags?: number;
};

function normalizeValues(values: string[]) {
  return values.reduce<string[]>((result, raw) => {
    const value = raw.trim();
    if (value && !result.some((item) => item.toLowerCase() === value.toLowerCase())) result.push(value);
    return result;
  }, []);
}

export function TagInput({ values, onChange, placeholder = 'Add a tag', className, disabled = false, maxTags }: TagInputProps) {
  const [draft, setDraft] = useState('');
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const canAdd = !disabled && (!maxTags || values.length < maxTags);

  const addTags = () => {
    if (!canAdd) return;
    const additions = draft.split(',').map((value) => value.trim()).filter(Boolean);
    if (!additions.length) return;
    onChange(normalizeValues([...values, ...additions]).slice(0, maxTags));
    setDraft('');
  };

  const reorderTag = (fromIndex: number, toIndex: number) => {
    if (disabled || fromIndex === toIndex) return;
    const nextValues = [...values];
    const [movedValue] = nextValues.splice(fromIndex, 1);
    nextValues.splice(toIndex, 0, movedValue);
    onChange(nextValues);
  };

  const handleDragStart = (event: DragEvent<HTMLSpanElement>, index: number) => {
    if (disabled) return;
    setDraggedIndex(index);
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', values[index]);
  };

  const handleDrop = (event: DragEvent<HTMLSpanElement>, index: number) => {
    event.preventDefault();
    if (draggedIndex !== null) reorderTag(draggedIndex, index);
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const resetDragState = () => {
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  return (
    <div className={cn('border border-border bg-background-secondary p-2', className)}>
      {values.length > 0 && <div className='mb-2 flex flex-wrap gap-1.5'>
        {values.map((value, index) => <span
          key={value}
          draggable={!disabled}
          onDragStart={(event) => handleDragStart(event, index)}
          onDragEnter={() => !disabled && setDragOverIndex(index)}
          onDragOver={(event) => {
            if (!disabled) {
              event.preventDefault();
              event.dataTransfer.dropEffect = 'move';
            }
          }}
          onDrop={(event) => handleDrop(event, index)}
          onDragEnd={resetDragState}
          className={cn(
            'inline-flex max-w-full items-center gap-1 rounded-md bg-panel px-2 py-1 text-sm text-ink-primary transition',
            !disabled && 'cursor-grab active:cursor-grabbing',
            draggedIndex === index && 'opacity-50',
            dragOverIndex === index && draggedIndex !== index && 'ring-1 ring-primary',
          )}
        >
          <GripVertical className='size-3.5 shrink-0 text-ink-secondary' aria-hidden='true' />
          <span className='truncate'>{value}</span>
          <button type='button' title={`Remove ${value}`} aria-label={`Remove ${value}`} disabled={disabled} onClick={() => onChange(values.filter((item) => item !== value))} className='shrink-0 text-ink-secondary hover:text-red-500 disabled:cursor-not-allowed disabled:opacity-50'>
            <X className='size-3.5' />
          </button>
        </span>)}
      </div>}
      <div className='flex items-center gap-2'>
        <Input value={draft} disabled={!canAdd} placeholder={maxTags && values.length >= maxTags ? `Maximum ${maxTags} tags` : placeholder} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ',') { event.preventDefault(); addTags(); }
        }} />
        <button type='button' title='Add tag' aria-label='Add tag' disabled={!canAdd || !draft.trim()} onClick={addTags} className='flex size-9 shrink-0 items-center justify-center border border-border text-ink-secondary hover:bg-panel hover:text-primary disabled:cursor-not-allowed disabled:opacity-50'>
          <Plus className='size-4' />
        </button>
      </div>
    </div>
  );
}
