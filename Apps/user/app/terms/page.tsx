/** @format */

'use client';

import React from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  FileText,
  CheckCircle2,
  AlertTriangle,
  ShieldCheck,
} from 'lucide-react';
import { motion } from 'framer-motion';

export default function TermsOfServicePage() {
  return (
    <div className='min-h-screen bg-background text-ink-primary overflow-y-auto custom-scrollbar-primary'>
      {/* Top Header */}
      <header className='sticky top-0 z-30 bg-panel/80 backdrop-blur-xl border-b border-primary/60 px-6 py-4 flex items-center justify-between'>
        <div className='flex items-center gap-3'>
          <Link
            href='/login'
            className='inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-surface-secondary hover:bg-surface border border-transparent text-xs font-medium text-ink-secondary hover:text-ink-primary transition-all'
          >
            <ArrowLeft className='w-3.5 h-3.5' />
            <span>Back</span>
          </Link>
          <div className='flex items-center gap-2'>
            <FileText className='w-4 h-4 text-primary' />
            <span className='font-semibold text-sm'>
              Jobby Terms of Service
            </span>
          </div>
        </div>
        <span className='text-xs text-ink-tertiary'>
          Effective Date: August 2026
        </span>
      </header>

      {/* Main Content Area */}
      <main className='max-w-4xl mx-auto px-6 py-12 space-y-10'>
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className='space-y-3'
        >
          <div className='inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-semibold uppercase tracking-wider'>
            Terms of Service
          </div>
          <h1 className='text-3xl sm:text-4xl font-bold font-serif tracking-tight text-ink-primary'>
            Jobby Terms of Service
          </h1>
          <p className='text-ink-secondary text-sm leading-relaxed max-w-2xl'>
            Please read these Terms of Service carefully before using Jobby's
            web applications and browser extensions.
          </p>
        </motion.div>

        {/* Section 1: Acceptance */}
        <section className='p-6 rounded-2xl bg-panel border border-primary/60 shadow-xs space-y-3 text-sm leading-relaxed text-ink-secondary'>
          <h2 className='text-lg font-semibold text-ink-primary'>
            1. Acceptance of Terms
          </h2>
          <p>
            By accessing or using Jobby, you agree to be bound by these Terms of
            Service and our{' '}
            <Link
              href='/privacy'
              className='text-primary hover:underline font-medium'
            >
              Privacy Policy
            </Link>
            . If you do not agree to these terms, do not access or use the
            services.
          </p>
        </section>

        {/* Section 2: Use of Automated Tools */}
        <section className='p-6 rounded-2xl bg-panel border border-primary/60 shadow-xs space-y-3 text-sm leading-relaxed text-ink-secondary'>
          <h2 className='text-lg font-semibold text-ink-primary'>
            2. Automated Application & AI Assistance
          </h2>
          <p>
            Jobby provides intelligent workflow tools, resume tailoring, and
            browser assistance to streamline job hunting. You acknowledge that:
          </p>
          <ul className='list-disc pl-5 space-y-1'>
            <li>
              You remain responsible for the accuracy of all submitted
              information and application answers.
            </li>
            <li>
              You should review tailored resumes and answers before finalizing
              submission to third-party employers.
            </li>
            <li>
              You agree to comply with the acceptable use policies and terms of
              any third-party job boards you interact with.
            </li>
          </ul>
        </section>

        {/* Section 3: Intellectual Property */}
        <section className='p-6 rounded-2xl bg-panel border border-primary/60 shadow-xs space-y-3 text-sm leading-relaxed text-ink-secondary'>
          <h2 className='text-lg font-semibold text-ink-primary'>
            3. User Content & Intellectual Property
          </h2>
          <p>
            You retain full ownership of your uploaded resumes, career records,
            and personal profile information. You grant Jobby a limited,
            non-exclusive license solely to process and format your data to
            provide our services to you.
          </p>
        </section>

        {/* Section 4: Limitation of Liability */}
        <section className='p-6 rounded-2xl bg-panel border border-primary/60 shadow-xs space-y-3 text-sm leading-relaxed text-ink-secondary'>
          <h2 className='text-lg font-semibold text-ink-primary'>
            4. Disclaimers & Limitation of Liability
          </h2>
          <p>
            Jobby provides career optimization tools but does not guarantee
            employment offers, interviews, or hiring decisions. Services are
            provided on an "as is" and "as available" basis without warranties
            of any kind.
          </p>
        </section>

        {/* Footer */}
        <div className='text-center pt-8 border-t border-primary/50 text-xs text-ink-tertiary'>
          © {new Date().getFullYear()} Jobby Inc. All rights reserved.
        </div>
      </main>
    </div>
  );
}
