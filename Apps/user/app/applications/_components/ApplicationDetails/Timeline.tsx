/** @format */

import React from 'react';
import { createPortal } from 'react-dom';
import { Check, Edit3, Plus, Tag, Trash2, Calendar } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatRelativeDate, formatDate } from '@/components/ConsoleUtils';
import { type ApplicationTimelineEntry } from '@/lib/types';
import { stageConfig } from './constants';
import { toInputDateTime, fromInputDateTime } from './FormControls';
import { motion, AnimatePresence } from 'framer-motion';

interface TimelineProps {
  timeline: ApplicationTimelineEntry[];
  isEditingTimeline: boolean;
  setIsEditingTimeline: (val: boolean) => void;
  addTimelineStage: (stage: string) => void;
  handleTimelineEntryChange: (
    index: number,
    key: keyof ApplicationTimelineEntry,
    val: string,
  ) => void;
  deleteTimelineEntry: (index: number) => void;
}

export function Timeline({
  timeline,
  isEditingTimeline,
  setIsEditingTimeline,
  addTimelineStage,
  handleTimelineEntryChange,
  deleteTimelineEntry,
}: TimelineProps) {
  const [mounted, setMounted] = React.useState(false);
  const [editingIndex, setEditingIndex] = React.useState<number | null>(null);
  const rootRef = React.useRef<HTMLDivElement>(null);
  const prevLengthRef = React.useRef(timeline.length);

  React.useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  React.useEffect(() => {
    if (timeline.length > prevLengthRef.current) {
      setEditingIndex(timeline.length - 1);
      setTimeout(() => {
        const scrollContainer = rootRef.current?.closest('.overflow-y-auto');
        if (scrollContainer) {
          scrollContainer.scrollTo({
            top: scrollContainer.scrollHeight,
            behavior: 'smooth',
          });
        }
      }, 50);
    }
    prevLengthRef.current = timeline.length;
  }, [timeline.length]);
  return (
    <div ref={rootRef} className='-mt-6'>
      <div className='sticky -top-6 z-20 -mx-6 px-6 pt-6 py-3 from-background to-transparent bg-linear-to-b  h-[100px] flex items-start justify-between mb-4'>
        <div className='h-[50px] top-0 from-background to-transparent bg-linear-to-b  absolute left-0 right-0 -z-10' />
        <div className='h-[30px] top-0 from-background to-transparent bg-linear-to-b  absolute left-0 right-0 -z-10' />
        <div className='flex gap-2 items-center'>
          <h3 className='label-overline'>Timeline Stages</h3>
          <div
            className={cn(
              'body-md flex gap-2 items-baseline capitalize text-transparent bg-clip-text',
              stageConfig[timeline[timeline.length - 1].stage].bgColorClass,
            )}
            style={{
              filter:
                'drop-shadow(1.5px 0 0 var(--background-raw)) drop-shadow(-1.5px 0 0 var(--background-raw)) drop-shadow(0 1.5px 0 var(--background-raw)) drop-shadow(0 -1.5px 0 var(--background-raw))',
            }}
          >
            ({timeline[timeline.length - 1].stage})
          </div>
        </div>
        <button
          onClick={() => setIsEditingTimeline(!isEditingTimeline)}
          className={cn(
            'label-sm inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl transition-all border cursor-pointer border-primary text-primary hover:bg-primary/10 bg-background/60',
          )}
        >
          {isEditingTimeline ?
            <>
              <Check className='w-3.5 h-3.5' />
              Done Adding
            </>
          : <>
              <Plus className='w-3.5 h-3.5' />
              Add Stage
            </>
          }
        </button>
      </div>

      {/* Log Timeline List */}
      {timeline.length === 0 ?
        <div className='text-center py-8 border border-dashed border-border rounded-2xl text-ink-secondary mt-4'>
          No timeline entries log recorded. Click "+ Add Stage" to add entries.
        </div>
      : <div className='relative pl-8 space-y-6 pt-2 mt-4 pb-[30vh]'>
          {/* Vertical Timeline bar */}
          <div className='absolute left-[22px] top-3 bottom-3 w-2 rounded-full bg-primary/5' />

          {timeline.map((entry, index) => {
            const cfg = stageConfig[entry.stage] || {
              label: entry.stage,
              icon: Tag,
              colorClass: 'text-ink-secondary',
              bgColorClass: 'bg-glass',
              borderClass: 'border-border',
            };
            const Icon = cfg.icon;
            const isRelative =
              entry.timestamp &&
              Date.now() - new Date(entry.timestamp).getTime() <
                14 * 24 * 60 * 60 * 1000;
            const isEditingEntry = editingIndex === index;

            return (
              <motion.div
                layout='position'
                key={index}
                transition={{
                  type: 'tween',
                  ease: [0.22, 1, 0.36, 1],
                  duration: 0.3,
                }}
                className='relative flex flex-col'
              >
                {/* Timeline Stage Circle Icon */}
                <div
                  className={cn(
                    'absolute left-[-30px] w-12 h-12 rounded-full bg-linear-to-br flex items-center justify-center  z-0',
                    cfg.colorClass,
                    cfg.bgColorClass,
                    cfg.borderClass,
                  )}
                >
                  <Icon className='w-5 h-5' />
                </div>
                <div className='flex ml-[35px] justify-between items-center h-8'>
                  <span
                    className={cn(
                      'body-md flex gap-2 items-baseline capitalize text-transparent bg-clip-text',
                      cfg.bgColorClass,
                    )}
                    style={{
                      filter:
                        'drop-shadow(1.5px 0 0 var(--background-raw)) drop-shadow(-1.5px 0 0 var(--background-raw)) drop-shadow(0 1.5px 0 var(--background-raw)) drop-shadow(0 -1.5px 0 var(--background-raw))',
                    }}
                  >
                    {cfg.label}
                    <div className='flex items-center gap-2 flex-wrap min-w-0'>
                      <span
                        className={cn(
                          'text-[10px] whitespace-nowrap font-medium',
                          isRelative ?
                            'text-primary font-bold'
                          : 'text-ink-secondary',
                        )}
                      >
                        ({formatRelativeDate(entry.timestamp)})
                      </span>
                    </div>
                  </span>

                  <div className='flex items-center gap-1.5'>
                    {isEditingEntry ?
                      <>
                        <button
                          onClick={() => {
                            deleteTimelineEntry(index);
                            setEditingIndex(null);
                          }}
                          className='p-1.5 rounded-lg text-ink-secondary hover:text-red-500 hover:bg-red-500/10 border border-transparent hover:border-red-500/20 transition-all cursor-pointer shrink-0'
                          title='Delete timeline stage'
                        >
                          <Trash2 className='w-4 h-4 text-red-500' />
                        </button>
                        <button
                          onClick={() => setEditingIndex(null)}
                          className='label-sm inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-success/10 text-success border border-success/20 hover:bg-success/20 transition-all cursor-pointer active:scale-95'
                          title='Done editing'
                        >
                          <Check className='w-3.5 h-3.5' />
                          Done
                        </button>
                      </>
                    : <>
                        {entry.timestamp && (
                          <span className='text-[10px] text-ink-secondary hidden sm:inline font-mono mr-1.5'>
                            {formatDate(entry.timestamp)}
                          </span>
                        )}
                        <button
                          onClick={() => setEditingIndex(index)}
                          className='p-1.5 rounded-lg text-ink-secondary hover:text-primary hover:bg-primary/10 border border-transparent hover:border-border/40 transition-all cursor-pointer'
                          title='Edit stage details'
                        >
                          <Edit3 className='w-4 h-4' />
                        </button>
                      </>
                    }
                  </div>
                </div>

                {/* Timeline Entry Card - Diffuse Rounded Corners Style */}
                <motion.div
                  layout='position'
                  transition={{
                    type: 'tween',
                    ease: [0.22, 1, 0.36, 1],
                    duration: 0.3,
                  }}
                  className={cn('panel-lg  ml-[25px] mt-1 overflow-hidden')}
                >
                  {/* Card Body - View Mode or Edit Mode */}
                  <AnimatePresence initial={false} mode='wait'>
                    {!isEditingEntry ?
                      entry.notes && (
                        <motion.p
                          key='view-notes'
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          transition={{
                            type: 'tween',
                            ease: [0.22, 1, 0.36, 1],
                            duration: 0.3,
                          }}
                          className='body-sm text-ink-secondary bg-glass/60 whitespace-pre-wrap overflow-hidden'
                        >
                          {entry.notes}
                        </motion.p>
                      )
                    : /* Editing Log Fields Container */
                      <motion.div
                        key='edit-form'
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{
                          type: 'tween',
                          ease: [0.22, 1, 0.36, 1],
                          duration: 0.3,
                        }}
                        className='grid grid-cols-1 gap-4 mt-1.5 overflow-hidden'
                      >
                        {/* DateTime input */}
                        <div className='flex flex-col gap-1.5'>
                          <span className='text-[9px] font-bold text-ink-secondary uppercase tracking-wider'>
                            Event Time
                          </span>
                          <div className='relative'>
                            <Calendar className='absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-secondary pointer-events-none' />
                            <input
                              type='datetime-local'
                              value={toInputDateTime(entry.timestamp)}
                              onChange={(e) =>
                                handleTimelineEntryChange(
                                  index,
                                  'timestamp',
                                  e.target.value ?
                                    fromInputDateTime(e.target.value)
                                  : new Date().toISOString(),
                                )
                              }
                              className='body-sm pl-9 pr-3 py-2 bg-glass border border-border/40 text-ink-primary rounded-xl w-full focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all'
                            />
                          </div>
                        </div>

                        {/* Notes input */}
                        <div className='flex flex-col gap-1.5'>
                          <span className='text-[9px] font-bold text-ink-secondary uppercase tracking-wider'>
                            Quick log notes
                          </span>
                          <input
                            type='text'
                            value={entry.notes ?? ''}
                            placeholder='Enter notes about this stage...'
                            onChange={(e) =>
                              handleTimelineEntryChange(
                                index,
                                'notes',
                                e.target.value,
                              )
                            }
                            className='body-sm px-3 py-2 bg-glass border border-border/40 text-ink-primary rounded-xl w-full focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all'
                          />
                        </div>
                      </motion.div>
                    }
                  </AnimatePresence>
                </motion.div>
              </motion.div>
            );
          })}
        </div>
      }

      {/* Fast Transition Stage Selector - Only show when editing */}
      {mounted &&
        createPortal(
          <AnimatePresence>
            {isEditingTimeline && (
              <motion.div
                key='stage-selector'
                className={cn(
                  'fixed z-60 p-4 rounded-2xl backdrop-blur-[20px] overflow-hidden border border-border bg-background/20 shadow-2xl shadow-primary/20',
                  'lg:right-[660px] lg:top-[180px] lg:w-[200px] lg:flex-col lg:bottom-auto lg:left-auto',
                  'max-lg:bottom-6 max-lg:left-6 max-lg:right-6 max-lg:w-auto max-lg:flex-col',
                )}
                initial={{ opacity: 0, x: 1000, scale: 0 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                exit={{ opacity: 0, x: 1000, scale: 0 }}
                transition={{ ease: [0.22, 1, 0.36, 1], duration: 0.6 }}
              >
                <p className='label-overline mb-2.5'>Add Timeline Stage:</p>
                <div className='flex lg:flex-col max-lg:flex-row max-lg:flex-wrap gap-2 max-h-[70vh] overflow-y-auto custom-scrollbar-primary'>
                  {Object.entries(stageConfig).map(([key, cfg]) => {
                    const Icon = cfg.icon;
                    return (
                      <button
                        key={key}
                        onClick={() => {
                          addTimelineStage(key);
                          setIsEditingTimeline(false);
                        }}
                        className={cn(
                          'label-sm inline-flex items-center gap-2 px-3 py-2 rounded-xl transition-all cursor-pointer active:scale-95 border hover:opacity-90 lg:w-full justify-start',
                          cfg.bgColorClass,
                          cfg.colorClass,
                          cfg.borderClass,
                        )}
                      >
                        <Icon className='w-4 h-4' />
                        <span>{cfg.label}</span>
                      </button>
                    );
                  })}
                </div>
              </motion.div>
            )}
          </AnimatePresence>,
          document.body,
        )}
    </div>
  );
}
