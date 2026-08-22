/** @format */

'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Bug,
  Lightbulb,
  Sparkles,
  MessageSquare,
  Send,
  CheckCircle2,
  AlertCircle,
  Clock,
  Flame,
  Mail,
  RotateCcw,
  Tag,
} from 'lucide-react';
import { Button, notify } from '@jobby/ui';
import { useConsole } from '@/components/ConsoleContext';
import { useRouter } from 'next/navigation';

type FeedbackType = 'feature' | 'bug' | 'ux' | 'other';
type UrgencyLevel = 'low' | 'medium' | 'high';

const QUICK_TAGS = [
  'Autofill accuracy',
  'Extension sidepanel',
  'Resume tailoring',
  'Interview prep',
  'Job tracking',
  'LinkedIn auto-apply',
  'Performance & Speed',
];

export default function FeedbackPage() {
  const router = useRouter();
  const { profile } = useConsole();
  const [feedbackType, setFeedbackType] = useState<FeedbackType>('feature');
  const [urgency, setUrgency] = useState<UrgencyLevel>('medium');
  const [message, setMessage] = useState('');
  const [email, setEmail] = useState(profile?.email || '');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const categories: {
    id: FeedbackType;
    label: string;
    description: string;
    icon: typeof Bug;
  }[] = [
    {
      id: 'feature',
      label: 'Feature Request',
      description: 'Suggest a new capability, workflow, or integration',
      icon: Lightbulb,
    },
    {
      id: 'bug',
      label: 'Bug Report',
      description: 'Report an issue, error, or unexpected behavior',
      icon: Bug,
    },
    {
      id: 'ux',
      label: 'UX & Design',
      description: 'Ideas for visual polish, layouts, or usability',
      icon: Sparkles,
    },
    {
      id: 'other',
      label: 'General Feedback',
      description: 'Share your thoughts, praise, or general suggestions',
      icon: MessageSquare,
    },
  ];

  const urgencyOptions: {
    id: UrgencyLevel;
    label: string;
    description: string;
    icon: typeof Clock;
    activeBorder: string;
    dotColor: string;
  }[] = [
    {
      id: 'low',
      label: 'Low',
      description: 'Minor suggestion, no rush',
      icon: Clock,
      activeBorder:
        'border-emerald-500/60 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
      dotColor: 'bg-emerald-500',
    },
    {
      id: 'medium',
      label: 'Medium',
      description: 'Noticeable friction in daily use',
      icon: AlertCircle,
      activeBorder:
        'border-amber-500/60 bg-amber-500/10 text-amber-600 dark:text-amber-400',
      dotColor: 'bg-amber-500',
    },
    {
      id: 'high',
      label: 'High',
      description: 'Critical blocker or major bug',
      icon: Flame,
      activeBorder:
        'border-rose-500/60 bg-rose-500/10 text-rose-600 dark:text-rose-400',
      dotColor: 'bg-rose-500',
    },
  ];

  const handleAddTag = (tag: string) => {
    setMessage((prev) => {
      const trimmed = prev.trim();
      if (!trimmed) return `[${tag}] `;
      if (trimmed.includes(`[${tag}]`)) return prev;
      return `${trimmed}\n[${tag}] `;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) {
      notify.error('Please describe your feedback details');
      return;
    }

    setIsSubmitting(true);
    try {
      await new Promise((resolve) => setTimeout(resolve, 600));
      setIsSubmitted(true);
      notify.success('Thank you! Your feedback has been submitted.');
    } catch {
      notify.error('Failed to submit feedback. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReset = () => {
    setIsSubmitted(false);
    setMessage('');
  };

  return (
    <div className='w-full max-w-6xl mx-auto py-6 px-4 sm:px-6 lg:px-8'>
      {/* Page Header */}
      <div className='mb-8'>
        <div className='flex items-center gap-2 mb-2'>
          <span className='inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-[11px] font-bold uppercase tracking-wider bg-primary/10 text-primary border border-primary/20'>
            <MessageSquare className='w-3 h-3' />
            Feedback & Support
          </span>
        </div>
        <h1 className='text-3xl font-extrabold text-foreground tracking-tight'>
          Share Your Feedback
        </h1>
        <p className='text-sm text-muted-foreground mt-1 max-w-2xl'>
          Help us build the best automated job application experience. Your
          feedback directly shapes our product roadmap and bug fixes.
        </p>
      </div>

      <AnimatePresence mode='wait'>
        {isSubmitted ?
          <motion.div
            key='success'
            initial={{ opacity: 0, scale: 0.98, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.98, y: -15 }}
            className='rounded-3xl border border-primary/80 bg-panel/90 backdrop-blur-xl p-12 text-center shadow-xl'
          >
            <div className='mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-primary/15 border border-primary/30 text-primary shadow-inner'>
              <CheckCircle2 className='h-10 w-10' />
            </div>
            <h2 className='text-2xl sm:text-3xl font-extrabold text-foreground tracking-tight mb-2'>
              Feedback Received!
            </h2>
            <p className='text-muted-foreground text-sm max-w-md mx-auto mb-8 leading-relaxed'>
              Thank you for taking the time to share your insights. We review
              every submission to continuously improve Jobby.
            </p>
            <div className='flex items-center justify-center gap-4'>
              <Button
                variant='outline'
                onClick={handleReset}
                className='rounded-xl'
              >
                Submit Another Response
              </Button>
              <Button
                onClick={() => router.push('/')}
                className='rounded-xl shadow-md'
              >
                Go to Dashboard
              </Button>
            </div>
          </motion.div>
        : <motion.form
            key='form'
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            onSubmit={handleSubmit}
            className='grid grid-cols-1 lg:grid-cols-12 gap-8'
          >
            {/* Left Column: Metadata & Settings (4 cols on lg) */}
            <div className='lg:col-span-5 space-y-6'>
              {/* 1. Category */}
              <div className='rounded-2xl border border-primary/80 bg-panel/85 backdrop-blur-xl p-5 shadow-xs'>
                <label className='text-xs font-bold uppercase tracking-wider text-muted-foreground block mb-3'>
                  1. Feedback Category
                </label>
                <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-2.5'>
                  {categories.map((cat) => {
                    const Icon = cat.icon;
                    const isSelected = feedbackType === cat.id;
                    return (
                      <button
                        key={cat.id}
                        type='button'
                        onClick={() => setFeedbackType(cat.id)}
                        className={`flex items-start gap-3 p-3 rounded-xl border text-left transition-all duration-150 cursor-pointer ${
                          isSelected ?
                            'border-primary bg-primary/10 text-primary shadow-xs ring-1 ring-primary/40'
                          : 'border-primary/60 bg-background/50 text-muted-foreground hover:bg-background hover:text-foreground hover:border-primary'
                        }`}
                      >
                        <div
                          className={`p-2 rounded-lg shrink-0 mt-0.5 ${
                            isSelected ?
                              'bg-primary text-primary-foreground'
                            : 'bg-muted text-muted-foreground'
                          }`}
                        >
                          <Icon className='w-4 h-4' />
                        </div>
                        <div className='min-w-0'>
                          <p className='text-xs font-bold text-foreground'>
                            {cat.label}
                          </p>
                          <p className='text-[11px] text-muted-foreground leading-snug mt-0.5 line-clamp-2'>
                            {cat.description}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 2. Urgency Level */}
              <div className='rounded-2xl border border-primary/80 bg-panel/85 backdrop-blur-xl p-5 shadow-xs'>
                <label className='text-xs font-bold uppercase tracking-wider text-muted-foreground block mb-3'>
                  2. Urgency Level
                </label>
                <div className='grid grid-cols-3 gap-2'>
                  {urgencyOptions.map((opt) => {
                    const isSelected = urgency === opt.id;
                    return (
                      <button
                        key={opt.id}
                        type='button'
                        onClick={() => setUrgency(opt.id)}
                        className={`flex flex-col items-center justify-center p-3 rounded-xl border text-center transition-all duration-150 cursor-pointer ${
                          isSelected ?
                            opt.activeBorder
                          : 'border-primary/60 bg-background/50 text-muted-foreground hover:bg-background hover:text-foreground hover:border-primary'
                        }`}
                      >
                        <div className='flex items-center gap-1.5 mb-1'>
                          <span
                            className={`h-2 w-2 rounded-full ${
                              isSelected ?
                                opt.dotColor
                              : 'bg-muted-foreground/40'
                            }`}
                          />
                          <span className='text-xs font-bold'>{opt.label}</span>
                        </div>
                        <span className='text-[10px] text-muted-foreground leading-tight'>
                          {opt.description}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 3. Contact Email */}
              <div className='rounded-2xl border border-primary/80 bg-panel/85 backdrop-blur-xl p-5 shadow-xs'>
                <div className='flex items-center justify-between mb-2'>
                  <label
                    htmlFor='feedback-email'
                    className='text-xs font-bold uppercase tracking-wider text-muted-foreground'
                  >
                    3. Contact Email
                  </label>
                  <span className='text-[10px] text-muted-foreground'>
                    Optional
                  </span>
                </div>
                <div className='relative'>
                  <Mail className='absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/60' />
                  <input
                    id='feedback-email'
                    type='email'
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder='your.email@example.com'
                    className='w-full rounded-xl border border-primary/80 bg-background/60 pl-10 pr-3.5 py-2.5 text-xs text-foreground placeholder:text-muted-foreground/50 focus:border-primary focus:bg-background focus:outline-hidden focus:ring-2 focus:ring-primary/20 transition-all'
                  />
                </div>
                <p className='text-[11px] text-muted-foreground mt-2 leading-relaxed'>
                  Leave your email if you would like us to follow up or notify
                  you when this is addressed.
                </p>
              </div>
            </div>

            {/* Right Column: Main Feedback Canvas (7 cols on lg) */}
            <div className='lg:col-span-7 flex flex-col'>
              <div className='rounded-3xl border border-primary/80 bg-panel/85 backdrop-blur-xl p-6 sm:p-7 shadow-xs flex-1 flex flex-col'>
                {/* Header info */}
                <div className='flex items-center justify-between mb-3'>
                  <label
                    htmlFor='feedback-message'
                    className='text-xs font-bold uppercase tracking-wider text-muted-foreground'
                  >
                    Feedback Details <span className='text-primary'>*</span>
                  </label>
                  <span className='text-[11px] text-muted-foreground'>
                    {message.length} characters
                  </span>
                </div>

                {/* Quick topic tags */}
                <div className='mb-3 flex items-center gap-1.5 flex-wrap'>
                  <span className='text-[10px] font-bold text-muted-foreground uppercase mr-1 flex items-center gap-1'>
                    <Tag className='w-3 h-3' />
                    Topics:
                  </span>
                  {QUICK_TAGS.map((tag) => (
                    <button
                      key={tag}
                      type='button'
                      onClick={() => handleAddTag(tag)}
                      className='inline-flex items-center text-[11px] py-1 px-2.5 rounded-lg border border-primary/60 bg-background/50 hover:bg-primary/10 hover:border-primary/40 hover:text-primary transition-all text-muted-foreground cursor-pointer'
                    >
                      +{tag}
                    </button>
                  ))}
                </div>

                {/* Main Textarea */}
                <textarea
                  id='feedback-message'
                  required
                  rows={10}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder={`Describe your thoughts in detail...\n\n- What were you trying to do?\n- What happened vs what did you expect?\n- Any screenshots or context that could help?`}
                  className='w-full flex-1 rounded-2xl border border-primary/80 bg-background/60 p-4 text-xs leading-relaxed text-foreground placeholder:text-muted-foreground/50 focus:border-primary focus:bg-background focus:outline-hidden focus:ring-2 focus:ring-primary/20 transition-all resize-y min-h-[220px]'
                />

                {/* Bottom Actions */}
                <div className='mt-6 pt-4 border-t border-primary/60 flex items-center justify-between'>
                  <button
                    type='button'
                    onClick={() => setMessage('')}
                    className='inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors'
                  >
                    <RotateCcw className='w-3.5 h-3.5' />
                    <span>Clear text</span>
                  </button>

                  <div className='flex items-center gap-3'>
                    <Button
                      type='button'
                      variant='outline'
                      size='sm'
                      onClick={() => router.back()}
                      className='rounded-xl'
                    >
                      Cancel
                    </Button>
                    <Button
                      type='submit'
                      size='sm'
                      disabled={isSubmitting || !message.trim()}
                      className='rounded-xl gap-2 shadow-md'
                    >
                      {isSubmitting ?
                        <span>Submitting...</span>
                      : <>
                          <Send className='w-3.5 h-3.5' />
                          <span>Submit Feedback</span>
                        </>
                      }
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </motion.form>
        }
      </AnimatePresence>
    </div>
  );
}
