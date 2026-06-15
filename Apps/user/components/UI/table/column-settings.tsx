/** @format */

import * as React from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, X } from 'lucide-react';
import { Switch } from '@/components/UI/switch';
import { ColumnDef, VisibilityState } from '@tanstack/react-table';
import { H2, H3, P } from '@/components/UI/text/typography';
import { Button } from '../Button';

function SortableColumnItem({
  id,
  children,
}: {
  id: string;
  children: React.ReactNode;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      className='flex items-center gap-2 p-2 text-sm rounded-full bg-background'
    >
      <div
        ref={setActivatorNodeRef}
        {...listeners}
        className='p-1 -ml-1 transition-colors rounded-full cursor-grab active:cursor-grabbing hover:bg-muted'
      >
        <GripVertical className='text-gray-400 size-4' />
      </div>
      {children}
    </div>
  );
}

interface ColumnSettingsDialogProps<TData> {
  isOpen?: boolean; // Kept for types compatibility but unused
  onClose: () => void;
  columns: ColumnDef<TData>[];
  columnOrder: string[];
  setColumnOrder: (order: string[]) => void;
  columnVisibility: VisibilityState;
  setColumnVisibility: (update: React.SetStateAction<VisibilityState>) => void;
  enableTextTruncationToggle?: boolean;
  isTextExpanded?: boolean;
  onTextExpandedChange?: (expanded: boolean) => void;
}

export function ColumnSettingsDialog<TData>({
  onClose,
  columns,
  columnOrder,
  setColumnOrder,
  columnVisibility,
  setColumnVisibility,
  enableTextTruncationToggle,
  isTextExpanded,
  onTextExpandedChange,
}: ColumnSettingsDialogProps<TData>) {
  // Local state to manage UI updates immediately within the isolated Drawer content
  const [internalColumnOrder, setInternalColumnOrder] =
    React.useState(columnOrder);
  const [internalVisibility, setInternalVisibility] =
    React.useState(columnVisibility);
  const [internalTextExpanded, setInternalTextExpanded] =
    React.useState(isTextExpanded);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (active.id !== over?.id) {
      const newOrder = arrayMove(
        internalColumnOrder,
        internalColumnOrder.indexOf(active.id as string),
        internalColumnOrder.indexOf(over?.id as string),
      );
      setInternalColumnOrder(newOrder);
      setColumnOrder(newOrder);
    }
  };

  const toggleColumnVisibility = (columnId: string, isVisible: boolean) => {
    const newVisibility = {
      ...internalVisibility,
      [columnId]: isVisible,
    };
    setInternalVisibility(newVisibility);
    setColumnVisibility(newVisibility);
  };

  const handleTextExpandedChange = (checked: boolean) => {
    setInternalTextExpanded(checked);
    onTextExpandedChange?.(checked);
  };

  const getColumnLabel = (id: string, def: ColumnDef<TData>) => {
    if (typeof def.header === 'string') return def.header;
    return id;
  };

  return (
    <div className='flex flex-col h-full bg-panel'>
      <div className='flex items-center justify-between p-6 pb-0'>
        <div>
          <H2 className='text-primary'>View Settings</H2>
          <P className='text-sm text-ink-secondary'>
            Customize column visibility and order.
          </P>
        </div>

        <Button Icon={X} onClick={onClose} variant='ghost' />
      </div>

      <div className='p-6 space-y-6'>
        {enableTextTruncationToggle && onTextExpandedChange && (
          <div className='flex items-center justify-between p-3 border rounded-full bg-background border-border'>
            <span className='text-sm font-medium text-ink-primary'>
              Wrap Text
            </span>
            <Switch
              checked={!!internalTextExpanded}
              onCheckedChange={handleTextExpandedChange}
            />
          </div>
        )}

        <div className='space-y-4'>
          <H3 className='text-sm font-medium text-ink-primary'>
            Visible Columns
          </H3>
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={internalColumnOrder}
              strategy={verticalListSortingStrategy}
            >
              <div className='space-y-2 max-h-[60vh] overflow-y-auto overflow-visible pr-2 custom-scrollbar'>
                {internalColumnOrder.map((columnId) => {
                  const columnDef = columns.find(
                    (c) =>
                      c.id === columnId || (c as any).accessorKey === columnId,
                  );
                  if (!columnDef || columnDef.id === 'select') return null;

                  const isVisible = internalVisibility[columnId] !== false;

                  return (
                    <SortableColumnItem key={columnId} id={columnId}>
                      <div className='flex items-center justify-between flex-1'>
                        <span className='font-medium text-ink-primary'>
                          {getColumnLabel(columnId, columnDef)}
                        </span>
                        <Switch
                          checked={isVisible}
                          onCheckedChange={(value) =>
                            toggleColumnVisibility(columnId, value)
                          }
                        />
                      </div>
                    </SortableColumnItem>
                  );
                })}
              </div>
            </SortableContext>
          </DndContext>
        </div>
      </div>
    </div>
  );
}
