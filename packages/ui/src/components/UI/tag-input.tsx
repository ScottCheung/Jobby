/** @format */

'use client';

import { useState, useRef, useEffect, type DragEvent } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { GripVertical, Plus, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Input } from './input';
import { Button } from './Button';

type TagInputProps = {
  values: string[];
  onChange: (values: string[]) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  maxTags?: number;
};

type TagItemWrapper = {
  id: string;
  val: string;
};

function normalizeValues(values: string[]) {
  return values.reduce<string[]>((result, raw) => {
    const value = raw.trim();
    if (
      value &&
      !result.some((item) => item.toLowerCase() === value.toLowerCase())
    )
      result.push(value);
    return result;
  }, []);
}

function computeNewOrder<T>(
  list: T[],
  fromIndex: number,
  toIndex: number,
  position: 'before' | 'after',
): T[] {
  const result = [...list];
  const [item] = result.splice(fromIndex, 1);
  if (!item) return list;

  let insertAt = toIndex;
  if (fromIndex < toIndex) {
    insertAt = position === 'after' ? toIndex : toIndex - 1;
  } else {
    insertAt = position === 'after' ? toIndex + 1 : toIndex;
  }

  insertAt = Math.max(0, Math.min(result.length, insertAt));
  result.splice(insertAt, 0, item);
  return result;
}

export function TagInput({
  values,
  onChange,
  placeholder = 'Add a tag',
  className,
  disabled = false,
  maxTags,
}: TagInputProps) {
  const [draft, setDraft] = useState('');
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [dropPosition, setDropPosition] = useState<'before' | 'after'>('before');
  const canAdd = !disabled && (!maxTags || values.length < maxTags);

  const [items, setItems] = useState<TagItemWrapper[]>(() =>
    values.map((val) => ({
      id: `tag-${Math.random().toString(36).substring(2, 9)}`,
      val,
    })),
  );

  const isDraggingRef = useRef(false);

  useEffect(() => {
    if (isDraggingRef.current) return;

    const currentVals = items.map((i) => i.val);
    if (
      values.length !== currentVals.length ||
      values.some((v, i) => v !== currentVals[i])
    ) {
      setItems(
        values.map((val, idx) => ({
          id:
            items[idx]?.id ||
            `tag-${Math.random().toString(36).substring(2, 9)}`,
          val,
        })),
      );
    }
  }, [values]);

  const addTags = () => {
    if (!canAdd) return;
    const additions = draft
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean);
    if (!additions.length) return;
    const normalized = normalizeValues([...values, ...additions]).slice(
      0,
      maxTags,
    );
    const newItems = normalized.map(
      (val) =>
        items.find((i) => i.val === val) || {
          id: `tag-${Math.random().toString(36).substring(2, 9)}`,
          val,
        },
    );
    setItems(newItems);
    onChange(normalized);
    setDraft('');
  };

  const handleDragStart = (e: DragEvent<HTMLSpanElement>, index: number) => {
    if (disabled) return;
    isDraggingRef.current = true;
    setDraggedIndex(index);
    setDragOverIndex(index);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', String(index));
  };

  const handleDragOver = (e: DragEvent<HTMLSpanElement>, index: number) => {
    if (disabled || draggedIndex === null) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';

    const rect = e.currentTarget.getBoundingClientRect();
    const isAfter = e.clientX > rect.left + rect.width / 2;
    const pos = isAfter ? 'after' : 'before';

    if (dragOverIndex !== index || dropPosition !== pos) {
      setDragOverIndex(index);
      setDropPosition(pos);
    }
  };

  const resetDragState = () => {
    setDraggedIndex(null);
    setDragOverIndex(null);
    setDropPosition('before');
    setTimeout(() => {
      isDraggingRef.current = false;
    }, 100);
  };

  const handleDrop = (e: DragEvent<HTMLSpanElement>) => {
    e.preventDefault();
    if (draggedIndex !== null && dragOverIndex !== null) {
      const nextItems = computeNewOrder(
        items,
        draggedIndex,
        dragOverIndex,
        dropPosition,
      );
      setItems(nextItems);
      onChange(nextItems.map((item) => item.val));
    }
    resetDragState();
  };

  const handleRemove = (index: number) => {
    const next = items.filter((_, i) => i !== index);
    setItems(next);
    onChange(next.map((i) => i.val));
  };

  return (
    <div
      className={cn(
        'border border-border bg-background-secondary p-4 rounded-lg',
        className,
      )}
    >
      {items.length > 0 && (
        <div className='mb-3 flex flex-wrap gap-1.5 items-center'>
          <AnimatePresence>
            {items.map((item, index) => {
              const isDragged = draggedIndex === index;
              const isTarget = dragOverIndex === index && !isDragged;

              return (
                <motion.span
                  key={item.id}
                  layout
                  transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                  draggable={!disabled}
                  onDragStart={(e) => handleDragStart(e as unknown as DragEvent<HTMLSpanElement>, index)}
                  onDragOver={(e) => handleDragOver(e as unknown as DragEvent<HTMLSpanElement>, index)}
                  onDrop={handleDrop}
                  onDragEnd={resetDragState}
                  style={{ transition: 'none' }}
                  className={cn(
                    'inline-flex max-w-full items-center gap-1.5 rounded-md px-2 py-1 text-sm text-ink-primary relative select-none border border-border/60 bg-panel transition-all',
                    !disabled &&
                      'cursor-grab active:cursor-grabbing hover:border-border',
                    isDragged && 'opacity-40 scale-95 border-dashed border-primary/50',
                    isTarget &&
                      dropPosition === 'before' &&
                      'border-l-4 border-l-primary shadow-sm',
                    isTarget &&
                      dropPosition === 'after' &&
                      'border-r-4 border-r-primary shadow-sm',
                  )}
                >
                  <GripVertical
                    className='size-3.5 shrink-0 opacity-70 touch-none'
                    aria-hidden='true'
                  />
                  <span className='truncate'>{item.val}</span>
                  <button
                    type='button'
                    title={`Remove ${item.val}`}
                    aria-label={`Remove ${item.val}`}
                    disabled={disabled}
                    onPointerDown={(e) => e.stopPropagation()}
                    onMouseDown={(e) => e.stopPropagation()}
                    onClick={() => handleRemove(index)}
                    className='shrink-0 opacity-70 hover:opacity-100 hover:text-red-500 disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer'
                  >
                    <X className='size-3.5' />
                  </button>
                </motion.span>
              );
            })}
          </AnimatePresence>
        </div>
      )}
      <div className='flex relative items-center gap-2'>
        <Input
          value={draft}
          disabled={!canAdd}
          placeholder={
            maxTags && values.length >= maxTags ?
              `Maximum ${maxTags} tags`
            : placeholder
          }
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ',') {
              event.preventDefault();
              addTags();
            }
          }}
        />
        <Button
          variant='icon'
          type='button'
          title='Add tag'
          Icon={Plus}
          aria-label='Add tag'
          disabled={!canAdd || !draft.trim()}
          onClick={addTags}
          className={cn(
            'absolute right-1.5',
            !(!canAdd || !draft.trim()) &&
              'bg-primary-gradient text-primary-foreground',
          )}
        ></Button>
      </div>
    </div>
  );
}
