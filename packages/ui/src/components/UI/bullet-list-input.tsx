/** @format */

'use client';

import { useState, useRef, useEffect } from 'react';
import { Reorder, useDragControls } from 'framer-motion';
import { GripVertical, Plus, Trash2 } from '@jobby/ui/components/icons';
import { cn } from '@/lib/utils';
import { Button } from './Button';

type BulletListInputProps = {
  values: string[];
  onChange: (values: string[]) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
};

type ItemWrapper = {
  id: string;
  val: string;
};

const BULLET_PREFIX_REGEX =
  /^[\s\t]*([•·*○●▪▫◆◇➢▶✓✔\-–—]+|\d+、|[一二三四五六七八九十]+[、\.]|\d+[\.\)\]](?:\s+|$)|(?:\([0-9a-zA-Z]+\)|\[[0-9a-zA-Z]+\])\s*|[a-zA-Z][\.\)\]](?:\s+|$)|[a-zA-Z]、)\s*/;

export function cleanBulletText(text: string): string {
  let cleaned = text.trim();
  let prev = '';
  while (cleaned && cleaned !== prev) {
    prev = cleaned;
    cleaned = cleaned.replace(BULLET_PREFIX_REGEX, '').trim();
  }
  return cleaned;
}

function splitInlineBullets(text: string): string[] {
  const trimmed = text.trim();
  if (!trimmed) return [];

  if (/[•·○●▪▫◆◇➢▶✓✔]/.test(trimmed)) {
    const segments = trimmed
      .split(/(?:^|\s+)[•·○●▪▫◆◇➢▶✓✔]\s*/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (segments.length > 1) {
      return segments;
    }
  }

  const numberedMatches = trimmed.match(
    /(?:^|\s+)(?:\d+[\.\)\]、]|\([0-9a-zA-Z]+\)|\[[0-9a-zA-Z]+\])\s+/g,
  );
  if (numberedMatches && numberedMatches.length >= 2) {
    const segments = trimmed
      .split(/(?:^|\s+)(?:\d+[\.\)\]、]|\([0-9a-zA-Z]+\)|\[[0-9a-zA-Z]+\])\s+/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (segments.length > 1) {
      return segments;
    }
  }

  const letteredMatches = trimmed.match(/(?:^|\s+)[a-zA-Z][\.\)\]、]\s+/g);
  if (letteredMatches && letteredMatches.length >= 2) {
    const segments = trimmed
      .split(/(?:^|\s+)[a-zA-Z][\.\)\]、]\s+/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (segments.length > 1) {
      return segments;
    }
  }

  if (/^[-–—]\s+/.test(trimmed) && /\s+[-–—]\s+/.test(trimmed)) {
    const segments = trimmed
      .split(/(?:^|\s+)[-–—]\s+/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (segments.length > 1) {
      return segments;
    }
  }

  return [trimmed];
}

export function parseBulletPoints(rawText: string): string[] {
  if (!rawText || !rawText.trim()) return [];

  const normalized = rawText.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();

  if (normalized.includes('\n')) {
    const rawLines = normalized.split('\n');
    const isBulletStart = (line: string) => BULLET_PREFIX_REGEX.test(line.trim());
    const hasAnyBulletMarker = rawLines.some(
      (l) => l.trim() && isBulletStart(l),
    );

    if (hasAnyBulletMarker) {
      const points: string[] = [];
      let current = '';

      for (const line of rawLines) {
        const trimmed = line.trim();
        if (!trimmed) continue;

        if (isBulletStart(trimmed)) {
          if (current) {
            points.push(...splitInlineBullets(current));
          }
          current = trimmed;
        } else {
          if (current) {
            current += ' ' + trimmed;
          } else {
            current = trimmed;
          }
        }
      }

      if (current) {
        points.push(...splitInlineBullets(current));
      }

      const result = points.map(cleanBulletText).filter(Boolean);
      if (result.length > 0) return result;
    } else {
      const points: string[] = [];
      for (const line of rawLines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        points.push(...splitInlineBullets(trimmed));
      }
      const result = points.map(cleanBulletText).filter(Boolean);
      if (result.length > 0) return result;
    }
  }

  const inlinePoints = splitInlineBullets(normalized);
  return inlinePoints.map(cleanBulletText).filter(Boolean);
}

function AutoResizeTextarea({
  value,
  onChange,
  onKeyDown,
  onPaste,
  onBlur,
  placeholder,
  disabled,
  className,
}: {
  value: string;
  onChange: (val: string) => void;
  onKeyDown?: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  onPaste?: (e: React.ClipboardEvent<HTMLTextAreaElement>) => void;
  onBlur?: (e: React.FocusEvent<HTMLTextAreaElement>) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const adjustHeight = () => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.max(38, el.scrollHeight)}px`;
  };

  useEffect(() => {
    adjustHeight();
  }, [value]);

  return (
    <textarea
      ref={textareaRef}
      value={value}
      disabled={disabled}
      placeholder={placeholder}
      rows={1}
      onChange={(e) => {
        onChange(e.target.value);
        adjustHeight();
      }}
      onKeyDown={onKeyDown}
      onPaste={onPaste}
      onBlur={onBlur}
      onPointerDown={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
      className={cn(
        'w-full h-auto resize-none outline-none mt-0! min-h-[38px] text-sm text-ink-primary bg-transparent',
        className,
      )}
    />
  );
}

function ReorderableBulletItem({
  item,
  index,
  disabled,
  onUpdate,
  onRemove,
  onPasteMulti,
}: {
  item: ItemWrapper;
  index: number;
  disabled?: boolean;
  onUpdate: (val: string) => void;
  onRemove: () => void;
  onPasteMulti?: (points: string[]) => void;
}) {
  const dragControls = useDragControls();

  const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const text = e.clipboardData.getData('text');
    const parsed = parseBulletPoints(text);
    if (parsed.length > 1) {
      e.preventDefault();
      onPasteMulti?.(parsed);
    } else if (parsed.length === 1 && parsed[0] !== text.trim()) {
      const target = e.currentTarget;
      if (
        target.selectionStart === 0 &&
        target.selectionEnd === target.value.length
      ) {
        e.preventDefault();
        onUpdate(parsed[0]);
      }
    }
  };

  const handleBlur = () => {
    const cleaned = cleanBulletText(item.val);
    if (cleaned !== item.val) {
      onUpdate(cleaned);
    }
  };

  return (
    <Reorder.Item
      value={item}
      id={item.id}
      dragListener={false}
      dragControls={dragControls}
      transition={{ type: 'spring', stiffness: 500, damping: 35 }}
      animate={{
        scale: 1,
        boxShadow: '0 0 0 0 rgba(0, 0, 0, 0)',
        zIndex: 1,
      }}
      whileDrag={{
        scale: 1.02,
        boxShadow:
          '0 10px 25px -5px rgba(0, 0, 0, 0.15), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
        zIndex: 50,
      }}
      style={{ transition: 'none' }}
      className={cn(
        'group flex items-start gap-2 rounded-xl bg-panel shadow-xs p-2 relative select-none',
        !disabled && 'hover:bg-panel/90',
      )}
    >
      <div className='flex flex-col items-center gap-1 shrink-0 select-none pt-1'>
        <span className='inline-flex h-5 min-w-5 items-center justify-center rounded-md bg-primary/10 px-1.5 text-[11px] font-bold text-primary shrink-0'>
          {index + 1}
        </span>
        <div
          className={cn(
            'flex h-6 w-4 shrink-0 items-center justify-center text-ink-secondary/60 group-hover:text-ink-primary touch-none',
            !disabled && 'cursor-grab active:cursor-grabbing',
          )}
          title='Drag to reorder'
          onPointerDown={(e) => {
            if (!disabled) dragControls.start(e);
          }}
        >
          <GripVertical className='size-4' />
        </div>
      </div>

      <AutoResizeTextarea
        value={item.val}
        disabled={disabled}
        onChange={onUpdate}
        onPaste={handlePaste}
        onBlur={handleBlur}
        placeholder='Point details...'
      />

      <button
        type='button'
        title='Remove point'
        aria-label='Remove point'
        disabled={disabled}
        onClick={onRemove}
        onPointerDown={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
        className='mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-ink-secondary hover:bg-rose-500/10 hover:text-rose-500 disabled:opacity-50 cursor-pointer'
      >
        <Trash2 className='size-3.5' />
      </button>
    </Reorder.Item>
  );
}

export function BulletListInput({
  values,
  onChange,
  placeholder = 'Add an achievement point...',
  className,
  disabled = false,
}: BulletListInputProps) {
  const [newPoint, setNewPoint] = useState('');

  // Internal state for stable item objects { id, val }
  const [items, setItems] = useState<ItemWrapper[]>(() =>
    values.map((val) => ({
      id: `bullet-${Math.random().toString(36).substring(2, 9)}`,
      val,
    })),
  );

  const isDraggingRef = useRef(false);

  // Sync internal items with values prop when values prop changes externally
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
            `bullet-${Math.random().toString(36).substring(2, 9)}`,
          val,
        })),
      );
    }
  }, [values]);

  const handleAdd = () => {
    const trimmed = newPoint.trim();
    if (!trimmed || disabled) return;
    const parsed = parseBulletPoints(trimmed);
    if (!parsed.length) return;
    const newItems = parsed.map((val) => ({
      id: `bullet-${Math.random().toString(36).substring(2, 9)}`,
      val,
    }));
    const nextItems = [...items, ...newItems];
    setItems(nextItems);
    onChange(nextItems.map((i) => i.val));
    setNewPoint('');
  };

  const handleNewPointPaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const text = e.clipboardData.getData('text');
    const parsed = parseBulletPoints(text);
    if (parsed.length > 1) {
      e.preventDefault();
      const newItems = parsed.map((val) => ({
        id: `bullet-${Math.random().toString(36).substring(2, 9)}`,
        val,
      }));
      const nextItems = [...items, ...newItems];
      setItems(nextItems);
      onChange(nextItems.map((i) => i.val));
      setNewPoint('');
    } else if (parsed.length === 1 && parsed[0] !== text.trim()) {
      if (!newPoint.trim()) {
        e.preventDefault();
        setNewPoint(parsed[0]);
      }
    }
  };

  const handlePasteMultiAt = (index: number, newPoints: string[]) => {
    if (!newPoints.length) return;
    const next = [...items];
    next[index] = { ...next[index], val: newPoints[0] };
    const additional = newPoints.slice(1).map((val) => ({
      id: `bullet-${Math.random().toString(36).substring(2, 9)}`,
      val,
    }));
    next.splice(index + 1, 0, ...additional);
    setItems(next);
    onChange(next.map((i) => i.val));
  };

  const handleUpdate = (index: number, val: string) => {
    const next = [...items];
    const current = next[index];
    if (current) {
      next[index] = { ...current, val };
      setItems(next);
      onChange(next.map((i) => i.val));
    }
  };

  const handleRemove = (index: number) => {
    const next = items.filter((_, i) => i !== index);
    setItems(next);
    onChange(next.map((i) => i.val));
  };

  const handleReorder = (newItems: ItemWrapper[]) => {
    isDraggingRef.current = true;
    setItems(newItems);
    onChange(newItems.map((i) => i.val));
    setTimeout(() => {
      isDraggingRef.current = false;
    }, 100);
  };

  return (
    <div
      className={cn(
        'bg-background-secondary p-2.5 rounded-xl space-y-2',
        className,
      )}
    >
      {items.length > 0 && (
        <Reorder.Group
          axis='y'
          values={items}
          onReorder={handleReorder}
          className='space-y-2.5'
        >
          {items.map((item, index) => (
            <ReorderableBulletItem
              key={item.id}
              item={item}
              index={index}
              disabled={disabled}
              onUpdate={(val) => handleUpdate(index, val)}
              onRemove={() => handleRemove(index)}
              onPasteMulti={(newPoints) =>
                handlePasteMultiAt(index, newPoints)
              }
            />
          ))}
        </Reorder.Group>
      )}

      <div className='flex relative items-center gap-2 '>
        <div className='flex-1 relative'>
          <AutoResizeTextarea
            value={newPoint}
            disabled={disabled}
            placeholder={placeholder}
            onChange={(val) => setNewPoint(val)}
            onPaste={handleNewPointPaste}
            onKeyDown={(e) => {
              if (
                (e.key === 'Enter' && !e.shiftKey) ||
                (e.key === 'Enter' && (e.metaKey || e.ctrlKey))
              ) {
                e.preventDefault();
                handleAdd();
              }
            }}
            className='bg-panel shadow-2xs rounded-xl pr-11 py-2 px-3.5'
          />
          <Button
            variant='icon'
            type='button'
            title='Add item'
            Icon={Plus}
            aria-label='Add item'
            disabled={disabled || !newPoint.trim()}
            onClick={handleAdd}
            className={cn(
              'absolute right-1.5 top-1.5',
              !(disabled || !newPoint.trim()) &&
                'bg-primary-gradient text-primary-foreground',
            )}
          />
        </div>
      </div>
    </div>
  );
}
