/** @format */

'use client';

import React from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Shield,
  Lock,
  Eye,
  FileText,
  Database,
  Server,
  RefreshCw,
} from 'lucide-react';
import { motion } from 'framer-motion';

export default function PrivacyPolicyPage() {
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
            <Shield className='w-4 h-4 text-primary' />
            <span className='font-semibold text-sm'>
              Jobby Privacy & Data Protection Policy
            </span>
          </div>
        </div>
        <span className='text-xs text-ink-tertiary'>
          Effective Date: August 2026
        </span>
      </header>

      {/* Main Content Area */}
      <main className='max-w-4xl mx-auto px-6 py-12 space-y-10'>
        {/* Title */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className='space-y-3'
        >
          <div className='inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-semibold uppercase tracking-wider'>
            Legal & Compliance
          </div>
          <h1 className='text-3xl sm:text-4xl font-bold font-serif tracking-tight text-ink-primary'>
            Privacy Policy & Data Processing Notice
          </h1>
          <p className='text-ink-secondary text-sm leading-relaxed max-w-2xl'>
            Jobby ("we", "us", or "our") is dedicated to protecting your
            personal information and respecting your privacy. This Privacy
            Policy explains how we collect, process, store, and safeguard your
            data when using our web platform and browser extension.
          </p>
        </motion.div>

        {/* Section 1: Information We Collect */}
        <section className='p-6 rounded-2xl bg-panel border border-primary/60 shadow-xs space-y-4'>
          <div className='flex items-center gap-2.5 text-primary font-semibold text-lg'>
            <Database className='w-5 h-5' />
            <h2>1. Information We Collect</h2>
          </div>
          <div className='text-sm text-ink-secondary space-y-3 leading-relaxed'>
            <p>
              To provide AI-assisted job applications, resume tailoring, and
              interview preparation, we collect the following categories of
              data:
            </p>
            <ul className='list-disc pl-5 space-y-1.5 text-ink-secondary'>
              <li>
                <strong className='text-ink-primary'>
                  Account & Profile Information:
                </strong>{' '}
                Your name, email address, contact information, career profiles,
                and account authentication credentials provided via Supabase or
                Google OAuth.
              </li>
              <li>
                <strong className='text-ink-primary'>
                  Resume & Professional Background:
                </strong>{' '}
                Master resume files, uploaded PDF documents, work experience,
                education history, skills, and portfolio links.
              </li>
              <li>
                <strong className='text-ink-primary'>
                  Job Application & Interaction Data:
                </strong>{' '}
                Job posts you inspect, tailored resume drafts, application
                status records, questionnaire answers, and question cache
                mappings.
              </li>
              <li>
                <strong className='text-ink-primary'>
                  Browser Extension & Automation Logs:
                </strong>{' '}
                Locally inspected job page structures, form field selectors, and
                automation telemetry necessary to complete application workflows
                on job boards (such as LinkedIn, SEEK, Indeed).
              </li>
            </ul>
          </div>
        </section>

        {/* Section 2: How We Use Your Data */}
        <section className='p-6 rounded-2xl bg-panel border border-primary/60 shadow-xs space-y-4'>
          <div className='flex items-center gap-2.5 text-primary font-semibold text-lg'>
            <Server className='w-5 h-5' />
            <h2>2. How We Process & Use Your Information</h2>
          </div>
          <div className='text-sm text-ink-secondary space-y-3 leading-relaxed'>
            <p>
              We process your data strictly to deliver and improve Jobby
              services, including:
            </p>
            <ul className='list-disc pl-5 space-y-1.5 text-ink-secondary'>
              <li>
                Parsing your resume to identify core competencies, key
                qualifications, and project achievements.
              </li>
              <li>
                Generating contextually tailored resumes and match evaluation
                scores aligned with target job postings.
              </li>
              <li>
                Facilitating autofill and browser-assisted job submission
                through the Jobby Browser Extension.
              </li>
              <li>
                Providing personalized interview question recommendations and
                community discussion insights.
              </li>
              <li>
                Preventing abuse, maintaining platform security, and ensuring
                compliance with applicable laws.
              </li>
            </ul>
          </div>
        </section>

        {/* Section 3: AI Models & Third-Party Processing */}
        <section className='p-6 rounded-2xl bg-panel border border-primary/60 shadow-xs space-y-4'>
          <div className='flex items-center gap-2.5 text-primary font-semibold text-lg'>
            <RefreshCw className='w-5 h-5' />
            <h2>3. AI Processing & Third-Party Services</h2>
          </div>
          <div className='text-sm text-ink-secondary space-y-3 leading-relaxed'>
            <p>
              Jobby leverages enterprise-grade Large Language Models (LLMs, such
              as OpenAI, Anthropic, or Google Cloud Vertex AI) to parse job
              descriptions and craft tailored resume drafts.
            </p>
            <p className='p-3.5 rounded-xl bg-surface-secondary border border-primary/50 text-xs'>
              <strong className='text-ink-primary'>
                Important Commitment:
              </strong>{' '}
              We do NOT sell your personal data. Data transmitted to AI
              providers via enterprise APIs is subject to strict zero-retention
              or non-training agreements where your data is not used to train
              public foundation models without your consent.
            </p>
          </div>
        </section>

        {/* Section 4: Security & Retention */}
        <section className='p-6 rounded-2xl bg-panel border border-primary/60 shadow-xs space-y-4'>
          <div className='flex items-center gap-2.5 text-primary font-semibold text-lg'>
            <Lock className='w-5 h-5' />
            <h2>4. Data Storage, Security & Retention</h2>
          </div>
          <div className='text-sm text-ink-secondary space-y-3 leading-relaxed'>
            <p>
              Your data is encrypted in transit (TLS 1.3) and at rest (AES-256).
              Authentication tokens are securely managed via Supabase and stored
              in secure cookies or browser storage with expiration controls.
            </p>
            <p>
              We retain your data as long as your account remains active. You
              may request permanent deletion of your resumes, profile, and
              application history at any time through your Profile Settings.
            </p>
          </div>
        </section>

        {/* Section 5: Your Rights & Contact */}
        <section className='p-6 rounded-2xl bg-panel border border-primary/60 shadow-xs space-y-4'>
          <div className='flex items-center gap-2.5 text-primary font-semibold text-lg'>
            <Eye className='w-5 h-5' />
            <h2>5. Your Privacy Rights (GDPR & CCPA)</h2>
          </div>
          <div className='text-sm text-ink-secondary space-y-3 leading-relaxed'>
            <p>Depending on your location, you have the right to:</p>
            <ul className='list-disc pl-5 space-y-1 text-ink-secondary'>
              <li>
                Access and export your personal data stored on our servers.
              </li>
              <li>
                Request correction of inaccurate information or deletion of your
                account.
              </li>
              <li>
                Withdraw consent for AI-assisted processing or automated
                autofill at any time.
              </li>
            </ul>
            <p className='pt-2'>
              For any privacy inquiries or data removal requests, please contact
              our Data Protection Team at{' '}
              <a
                href='mailto:privacy@jobby.ai'
                className='text-primary hover:underline font-medium'
              >
                privacy@jobby.ai
              </a>
              .
            </p>
          </div>
        </section>

        {/* Footer */}
        <div className='text-center pt-8 border-t border-primary/50 text-xs text-ink-tertiary'>
          © {new Date().getFullYear()} Jobby Inc. All rights reserved.
        </div>
      </main>
    </div>
  );
}
