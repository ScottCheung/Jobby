/** @format */

'use client';

import React, { useState, useEffect } from 'react';
import { ExternalLink, X, Check, ArrowRight, FileSpreadsheet } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button, H1, H2, Modal } from '@jobby/ui';

export type AiModelType =
  | 'chatgpt'
  | 'claude'
  | 'gemini'
  | 'deepseek'
  | 'perplexity'
  | 'grok';

export interface AiWorkflowGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetActionName?: string;
  targetActionCallback?: () => void;
}

const AI_PLATFORMS: {
  id: AiModelType;
  name: string;
  url: string;
  domain: string;
}[] = [
  {
    id: 'chatgpt',
    name: 'ChatGPT',
    url: 'https://chatgpt.com',
    domain: 'chatgpt.com',
  },
  {
    id: 'claude',
    name: 'Claude',
    url: 'https://claude.ai',
    domain: 'claude.ai',
  },
  {
    id: 'gemini',
    name: 'Gemini',
    url: 'https://gemini.google.com',
    domain: 'gemini.google.com',
  },
  {
    id: 'deepseek',
    name: 'DeepSeek',
    url: 'https://chat.deepseek.com',
    domain: 'chat.deepseek.com',
  },
  {
    id: 'perplexity',
    name: 'Perplexity',
    url: 'https://www.perplexity.ai',
    domain: 'perplexity.ai',
  },
  {
    id: 'grok',
    name: 'Grok',
    url: 'https://grok.com',
    domain: 'grok.com',
  },
];

const STEPS = [
  { id: 0, label: '1. Paste into AI' },
  { id: 1, label: '2. Copy Output' },
  { id: 2, label: '3. Paste & Import' },
];

const staggerContainerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.05,
      delayChildren: 0.05,
    },
  },
};

const buttonItemVariants = {
  hidden: { opacity: 0, y: -8, scale: 0.94 },
  show: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { type: 'spring', stiffness: 400, damping: 25 },
  },
  transition: { delay: 0.3},
};

export function AiWorkflowGuideModal({
  isOpen,
  onClose,
  targetActionName = 'Create Application Plan',
  targetActionCallback,
}: AiWorkflowGuideModalProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [selectedModel, setSelectedModel] = useState<AiModelType>('chatgpt');

  // Auto loop through steps
  useEffect(() => {
    if (!isOpen) return;
    const interval = setInterval(() => {
      setCurrentStep((prev) => (prev + 1) % STEPS.length);
    }, 2800);
    return () => clearInterval(interval);
  }, [isOpen]);

  const openAi = (url: string) => {
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      className='w-[94vw] max-w-3xl overflow-hidden rounded-3xl border border-border/40 bg-panel p-0 shadow-2xl'
    >
      <div className='flex flex-col'>
        {/* Top Header: AI Quick Launch Bar with Official Favicons & Stagger Animation */}
        <div className='header'>
          <H2>AI Workflow Guide</H2>

          <button
            type='button'
            onClick={onClose}
            aria-label='Close'
            className='cursor-pointer rounded-full p-2 text-ink-secondary transition-colors hover:bg-background-secondary hover:text-ink-primary shrink-0'
          >
            <X className='size-5' />
          </button>
        </div>

        {/* Middle Body: Clean Skeleton Demonstration Area (NO LOGOS) */}
        <div className='body space-y-4'>
          <div className='relative h-[220px] rounded-2xl border border-border/40 bg-black/85 p-5 flex flex-col justify-between overflow-hidden shadow-inner text-white'>
            <AnimatePresence mode='wait'>
              {currentStep === 0 && (
                <motion.div
                  key='step0'
                  initial={{ opacity: 0, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.98 }}
                  transition={{ duration: 0.25 }}
                  className='flex h-full flex-col justify-between'
                >
                  {/* Top Bar Indicator */}
                  <div className='flex items-center justify-between text-xs text-white/50'>
                    <div className='flex items-center gap-1.5'>
                      <div className='size-2 rounded-full bg-red-500/80' />
                      <div className='size-2 rounded-full bg-yellow-500/80' />
                      <div className='size-2 rounded-full bg-green-500/80' />
                    </div>
                    <span className='font-mono text-[10px]'>Prompt Input</span>
                  </div>

                  {/* Skeleton Prompt Box Pasting */}
                  <div className='space-y-2.5 rounded-xl border border-white/15 bg-white/5 p-4'>
                    <motion.div
                      initial={{ width: '20%' }}
                      animate={{ width: ['20%', '85%', '70%'] }}
                      transition={{ duration: 1.2 }}
                      className='h-2.5 rounded-full bg-primary/70'
                    />
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 0.3 }}
                      className='space-y-1.5'
                    >
                      <div className='h-2 w-full rounded-full bg-white/20' />
                      <div className='h-2 w-4/5 rounded-full bg-white/20' />
                      <div className='h-2 w-3/5 rounded-full bg-white/20' />
                    </motion.div>
                  </div>

                  {/* Bottom: Shortcut Pill */}
                  <div className='flex items-center justify-between text-[11px] text-white/50'>
                    <span className='rounded bg-white/10 px-2 py-0.5 font-mono text-[10px] text-white/80'>
                      ⌘V Paste
                    </span>
                    <div className='size-6 rounded-lg bg-primary flex items-center justify-center text-white'>
                      <ArrowRight className='size-3.5' />
                    </div>
                  </div>
                </motion.div>
              )}

              {currentStep === 1 && (
                <motion.div
                  key='step1'
                  initial={{ opacity: 0, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.98 }}
                  transition={{ duration: 0.25 }}
                  className='flex h-full flex-col justify-between'
                >
                  <div className='flex items-center justify-between text-xs text-white/70'>
                    <span className='font-mono font-bold text-white/80'>TSV Output</span>
                    {/* Copy button */}
                    <motion.div
                      animate={{ scale: [1, 1.1, 1] }}
                      transition={{ delay: 1, duration: 0.4 }}
                      className='flex items-center gap-1 rounded-md bg-emerald-500 px-2.5 py-0.5 text-[10px] font-semibold text-white'
                    >
                      <Check className='size-3' />
                      <span>Copied</span>
                    </motion.div>
                  </div>

                  {/* Skeleton Table Rows Output */}
                  <div className='space-y-2 rounded-xl border border-white/15 bg-white/5 p-3.5 font-mono'>
                    <div className='flex items-center gap-2 border-b border-white/10 pb-1.5'>
                      <div className='h-2 w-16 rounded-full bg-white/40' />
                      <div className='h-2 w-24 rounded-full bg-white/40' />
                      <div className='h-2 w-12 rounded-full bg-white/40' />
                    </div>
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ staggerChildren: 0.15 }}
                      className='space-y-2 pt-0.5'
                    >
                      <div className='flex items-center justify-between'>
                        <div className='h-2 w-48 rounded-full bg-white/30' />
                        <div className='h-3 w-8 rounded-full bg-emerald-400/40' />
                      </div>
                      <div className='flex items-center justify-between'>
                        <div className='h-2 w-40 rounded-full bg-white/20' />
                        <div className='h-3 w-8 rounded-full bg-emerald-400/40' />
                      </div>
                      <div className='flex items-center justify-between'>
                        <div className='h-2 w-36 rounded-full bg-white/20' />
                        <div className='h-3 w-8 rounded-full bg-emerald-400/40' />
                      </div>
                    </motion.div>
                  </div>

                  <div className='flex items-center justify-between text-[11px] text-white/50'>
                    <span>Copy generated data table</span>
                    <span className='text-emerald-400 font-semibold'>TSV Format</span>
                  </div>
                </motion.div>
              )}

              {currentStep === 2 && (
                <motion.div
                  key='step2'
                  initial={{ opacity: 0, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.98 }}
                  transition={{ duration: 0.25 }}
                  className='flex h-full flex-col justify-between'
                >
                  <div className='flex items-center justify-between text-xs text-white/70'>
                    <span className='font-semibold text-white'>{targetActionName}</span>
                    <span className='rounded bg-primary/20 px-2 py-0.5 text-[10px] text-primary font-bold'>
                      Ready
                    </span>
                  </div>

                  {/* Skeleton Form & Imported Rows */}
                  <div className='space-y-2 rounded-xl border border-primary/40 bg-white/5 p-3.5'>
                    <div className='flex items-center justify-between border-b border-white/10 pb-1.5'>
                      <div className='h-2.5 w-32 rounded-full bg-white/40' />
                      <div className='h-2.5 w-12 rounded-full bg-primary/60' />
                    </div>
                    <div className='space-y-1.5 pt-0.5'>
                      <div className='flex items-center justify-between'>
                        <div className='h-2 w-40 rounded-full bg-white/30' />
                        <div className='h-2.5 w-6 rounded-full bg-emerald-400/50' />
                      </div>
                      <div className='flex items-center justify-between'>
                        <div className='h-2 w-32 rounded-full bg-white/20' />
                        <div className='h-2.5 w-6 rounded-full bg-emerald-400/50' />
                      </div>
                    </div>
                  </div>

                  {/* Create Button Highlight */}
                  <div className='flex items-center justify-between'>
                    <span className='text-[11px] text-white/50'>Auto parsed & imported</span>
                    <div className='inline-flex items-center gap-1 rounded-lg bg-primary px-3 py-1 text-xs font-bold text-white shadow-xs'>
                      <Check className='size-3' />
                      <span>Import & Create</span>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Step Pill Indicators */}
          <div className='grid grid-cols-3 gap-2.5'>
            {STEPS.map((s, idx) => (
              <button
                key={s.id}
                type='button'
                onClick={() => setCurrentStep(idx)}
                className={`flex items-center justify-center rounded-xl py-2 text-xs font-semibold transition-all cursor-pointer ${
                  currentStep === idx
                    ? 'bg-primary/10 text-primary border border-primary/30 shadow-xs'
                    : 'bg-background-secondary/40 text-ink-secondary hover:text-ink-primary'
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
                             <motion.div
            variants={staggerContainerVariants}
            initial='hidden'
            animate='show'
            className='flex overflow-x-auto items-center gap-2.5 pr-2'
          >
            {AI_PLATFORMS.map((platform) => (
              <motion.button
                key={platform.id}
                variants={buttonItemVariants}
                type='button'
                onClick={() => {
                  setSelectedModel(platform.id);
                  openAi(platform.url);
                }}
                className={`inline-flex min-w-[120px] flex-col items-center gap-2.5 rounded-xl border border-border/50 bg-panel px-4 py-2.5 text-xs md:text-sm font-semibold cursor-pointer shadow-xs  `}
              >
                                <img
                  src={`https://www.google.com/s2/favicons?domain=${platform.domain}&sz=128`}
                  alt={`${platform.name} favicon`}
                  className='size-8 rounded-xs object-contain shrink-0'
                  loading='lazy'
                  onError={(e) => {
                    e.currentTarget.src = `https://icons.duckduckgo.com/ip3/${platform.domain}.ico`;
                  }}
                />
                <div className='flex items-center gap-0.5'>

                <span className='text-ink-primary text-[10px] font-medium'>{platform.name}</span>
                <ExternalLink className='size-3 text-ink-secondary/60 ml-0.5' /></div>
              </motion.button>
            ))}
          </motion.div>

        </div>

        {/* Bottom Footer Actions */}
        <div className='footer'>
          <Button variant='ghost' onClick={onClose}>
            Close
          </Button>

          {targetActionCallback && (
            <Button
              Icon={FileSpreadsheet}
              onClick={() => {
                onClose();
                targetActionCallback();
              }}
            >
              <span>Go to {targetActionName}</span>
              <ArrowRight className='size-3.5 ml-1' />
            </Button>
          )}
        </div>
      </div>
    </Modal>
  );
}
