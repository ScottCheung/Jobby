/** @format */

'use client';

import { FormEvent, useEffect, useState } from 'react';
import {
  AlertCircle,
  ArrowRight,
  Check,
  FileJson,
  History,
  Loader2,
  Search,
  X,
} from 'lucide-react';
import {
  api,
  type JobReviewPreview,
  type JobReviewResult,
  type TailoredResume,
} from '@/lib/api';
import type { MasterResumeData } from '@/lib/types';
import { Textarea } from '@/components/UI/textarea';
import { ResumePdfPreview } from '@/app/settings/resume/_component/resume-pdf-preview';

export default function JobReviewPage() {
  const [jobDescription, setJobDescription] = useState('');
  const [title, setTitle] = useState('');
  const [company, setCompany] = useState('');
  const [datePosted, setDatePosted] = useState('');
  const [result, setResult] = useState<JobReviewResult | null>(null);
  const [savedResumes, setSavedResumes] = useState<TailoredResume[]>([]);
  const [originalResume, setOriginalResume] = useState<MasterResumeData | null>(
    null,
  );
  const [pendingPayload, setPendingPayload] = useState<{
    job_description: string;
    title?: string;
    company?: string;
    date_posted?: string;
  } | null>(null);
  const [preview, setPreview] = useState<JobReviewPreview | null>(null);
  const [showPayload, setShowPayload] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    void Promise.all([api.careerProfiles(), api.tailoredResumes()])
      .then(([profiles, saved]) => {
        const selected =
          profiles.find((profile) => profile.is_default) ?? profiles[0];
        if (selected?.resume_data) setOriginalResume(selected.resume_data);
        setSavedResumes(saved);
        if (saved[0]) loadSavedResume(saved[0]);
      })
      .catch(() => undefined);
  }, []);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!jobDescription.trim()) return;
    setError('');
    setResult(null);
    const nextPayload = {
      job_description: jobDescription.trim(),
      title: title.trim() || undefined,
      company: company.trim() || undefined,
      date_posted: datePosted.trim() || undefined,
    };
    setPendingPayload(nextPayload);
    setLoading(true);
    try {
      setPreview(await api.previewJobReview(nextPayload));
      setShowPayload(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : '无法预览发送内容');
    } finally {
      setLoading(false);
    }
  }

  async function confirmGenerate() {
    if (!pendingPayload) return;
    setLoading(true);
    setError('');
    setShowPayload(false);
    try {
      const nextResult = await api.reviewJob(pendingPayload);
      setResult(nextResult);
      if (nextResult.tailored_resume) {
        setSavedResumes((current) => [nextResult.tailored_resume!, ...current]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '简历生成失败');
    } finally {
      setLoading(false);
    }
  }

  const aiPayload = preview;

  function loadSavedResume(saved: TailoredResume) {
    setResult({
      resume_data: saved.resume_data,
      core_competencies: saved.core_competencies || saved.key_qualifications,
      key_qualifications: saved.key_qualifications,
      targeted_projects: saved.targeted_projects,
      raw_ai_response: saved.raw_ai_response,
      tailored_resume: saved,
    });
    setJobDescription(saved.job_description);
    setTitle(saved.job_title || '');
    setCompany(saved.company || '');
  }

  return (
    <div className='mx-auto flex w-full flex-col gap-6 p-6 lg:p-10'>
      <header className='app-drag border-b border-border/60 pb-6'>
        <div className='flex items-center gap-2 text-sm font-medium text-primary'>
          <Search className='h-4 w-4' />
          定制简历 Demo
        </div>
        <h1 className='mt-2 text-3xl font-semibold tracking-tight text-ink-primary'>
          按 JD 生成一版更匹配的简历
        </h1>
        <p className='mt-2 text-sm leading-6 text-ink-secondary'>
          粘贴申请流程已经提取好的 JD，系统会直接生成一版定制简历，并把它和
          master resume 放在一起对照。
        </p>
      </header>

      <form
        onSubmit={submit}
        className='rounded-xl border border-border/70 bg-background/70 p-4 shadow-sm'
      >
        <div className='grid gap-3 sm:grid-cols-3'>
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder='职位名称（可选）'
            className='rounded-lg border border-border bg-background px-4 py-3 text-sm text-ink-primary outline-none ring-primary/30 placeholder:text-ink-secondary/60 focus:ring-2'
          />
          <input
            value={company}
            onChange={(event) => setCompany(event.target.value)}
            placeholder='公司（可选）'
            className='rounded-lg border border-border bg-background px-4 py-3 text-sm text-ink-primary outline-none ring-primary/30 placeholder:text-ink-secondary/60 focus:ring-2'
          />
          <input
            value={datePosted}
            onChange={(event) => setDatePosted(event.target.value)}
            placeholder='发布时间（可选）'
            className='rounded-lg border border-border bg-background px-4 py-3 text-sm text-ink-primary outline-none ring-primary/30 placeholder:text-ink-secondary/60 focus:ring-2'
          />
        </div>
        <Textarea
          value={jobDescription}
          onChange={(event) => setJobDescription(event.target.value)}
          placeholder='把已提取的完整 JD 粘贴到这里...'
          minHeight={224}
          className='mt-3 w-full'
          required
        />
        <button
          disabled={loading}
          className='mt-3 inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-5 py-3 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60'
        >
          {loading ?
            <Loader2 className='h-4 w-4 animate-spin' />
          : <ArrowRight className='h-4 w-4' />}
          {loading ? '生成中' : '预览发送内容'}
        </button>
      </form>

      {error && (
        <div className='flex items-start gap-3 rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700'>
          <AlertCircle className='mt-0.5 h-4 w-4 shrink-0' />
          {error}
        </div>
      )}

      {showPayload && aiPayload && (
        <PayloadPreview
          payload={aiPayload}
          onCancel={() => setShowPayload(false)}
          onConfirm={confirmGenerate}
          loading={loading}
        />
      )}
      {savedResumes.length > 0 && (
        <section className='flex flex-wrap items-center gap-3 border-y border-border/60 py-3'>
          <span className='inline-flex items-center gap-2 text-sm font-medium text-ink-primary'>
            <History className='h-4 w-4 text-primary' />
            已保存的定制记录
          </span>
          <select
            value={result?.tailored_resume?.id || ''}
            onChange={(event) => {
              const saved = savedResumes.find(
                (item) => item.id === event.target.value,
              );
              if (saved) loadSavedResume(saved);
            }}
            className='min-w-56 rounded-md border border-border bg-background px-3 py-2 text-sm text-ink-primary'
          >
            <option value='' disabled>
              选择一份记录
            </option>
            {savedResumes.map((item) => (
              <option key={item.id} value={item.id}>
                {[item.job_title || 'Untitled role', item.company]
                  .filter(Boolean)
                  .join(' · ')}{' '}
                · {new Date(item.created_at).toLocaleString()}
              </option>
            ))}
          </select>
        </section>
      )}
      {result?.resume_data && (
        <>
          <ResultInspector result={result} />
          <ResumeComparison
            original={originalResume}
            generated={result.resume_data}
            coreCompetencies={
              result.core_competencies ||
              result.key_qualifications ||
              result.resume_data.core_competencies ||
              result.resume_data.key_qualifications ||
              []
            }
          />
        </>
      )}
    </div>
  );
}

function PayloadPreview({
  payload,
  onCancel,
  onConfirm,
  loading,
}: {
  payload: unknown;
  onCancel: () => void;
  onConfirm: () => void;
  loading: boolean;
}) {
  const messages =
    (
      payload as {
        messages?: Array<{ role?: string; content?: string }>;
      } | null
    )?.messages || [];
  return (
    <div className='fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-5 backdrop-blur-sm'>
      <div className='flex max-h-[90vh] w-full max-w-4xl flex-col rounded-xl border border-border bg-background p-5 shadow-2xl'>
        <div className='flex items-center justify-between'>
          <div>
            <h2 className='text-lg font-semibold text-ink-primary'>
              发送给 AI 的内容
            </h2>
            <p className='mt-1 text-xs text-ink-secondary'>
              逐段检查 system prompt 和 user message 后再发送。
            </p>
          </div>
          <button
            type='button'
            aria-label='关闭预览'
            onClick={onCancel}
            className='rounded-md p-2 text-ink-secondary hover:bg-background-secondary'
          >
            <X className='h-4 w-4' />
          </button>
        </div>
        <div className='mt-4 min-h-0 space-y-4 overflow-y-auto'>
          {messages.map((message, index) => (
            <div
              key={`${message.role || 'message'}-${index}`}
              className='overflow-hidden rounded-lg border border-border/70'
            >
              <div className='border-b border-border/70 bg-background-secondary px-3 py-2 text-xs font-semibold uppercase tracking-wide text-ink-secondary'>
                {message.role || 'message'}
              </div>
              <pre className='max-h-[45vh] overflow-auto whitespace-pre-wrap break-words bg-zinc-950 p-4 text-xs leading-6 text-zinc-200'>
                {prettyMessageContent(message.content)}
              </pre>
            </div>
          ))}
        </div>
        <div className='mt-4 flex justify-end gap-3'>
          <button
            type='button'
            onClick={onCancel}
            className='rounded-lg border border-border px-4 py-2 text-sm text-ink-secondary'
          >
            返回修改
          </button>
          <button
            type='button'
            onClick={onConfirm}
            disabled={loading}
            className='inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white disabled:opacity-60'
          >
            <Check className='h-4 w-4' />
            确认发送
          </button>
        </div>
      </div>
    </div>
  );
}

function prettyMessageContent(content?: string) {
  if (!content) return '';
  try {
    return JSON.stringify(JSON.parse(content), null, 2);
  } catch {
    return content;
  }
}

function ResultInspector({ result }: { result: JobReviewResult }) {
  const saved = result.tailored_resume;
  return (
    <section className='rounded-lg border border-border/70 bg-background/70 p-4'>
      <div className='flex flex-wrap items-center justify-between gap-3'>
        <div>
          <p className='text-sm font-semibold text-ink-primary'>
            已保存的定制结果
          </p>
          <p className='mt-1 text-xs text-ink-secondary'>
            {saved ? `申请草稿已绑定 · ${saved.job_application_id}` : '未保存'}
          </p>
        </div>
        <FileJson className='h-5 w-5 text-primary' />
      </div>
      <details className='mt-3'>
        <summary className='cursor-pointer text-sm font-medium text-primary'>
          查看原始 AI JSON
        </summary>
        <pre className='mt-3 max-h-96 overflow-auto rounded-md bg-zinc-950 p-4 text-xs leading-6 text-zinc-200'>
          {JSON.stringify(result.raw_ai_response || {}, null, 2)}
        </pre>
      </details>
    </section>
  );
}

function ResumeComparison({
  original,
  generated,
  coreCompetencies,
}: {
  original: MasterResumeData | null;
  generated: NonNullable<JobReviewResult['resume_data']>;
  coreCompetencies: string[];
}) {
  const generatedData = (
    original ?
      { ...original, ...generated }
    : generated) as MasterResumeData;
  return (
    <section className='grid gap-5 lg:grid-cols-2'>
      <PdfResumeCard
        label='原始简历 PDF'
        data={original}
        filename='original-resume.pdf'
      />
      <PdfResumeCard
        label='AI 定制版本 PDF'
        data={generatedData}
        filename='tailored-resume.pdf'
        coreCompetencies={coreCompetencies}
      />
    </section>
  );
}

function PdfResumeCard({
  label,
  data,
  filename,
  coreCompetencies = [],
}: {
  label: string;
  data: MasterResumeData | null;
  filename: string;
  coreCompetencies?: string[];
}) {
  if (!data)
    return (
      <section className='rounded-xl border border-dashed border-border p-6 text-sm text-ink-secondary'>
        原始简历尚未加载
      </section>
    );
  return (
    <section className='rounded-xl border border-border/70 bg-background/70 p-5 shadow-sm'>
      <h2 className='text-lg font-semibold text-ink-primary'>{label}</h2>
      <div className='mt-4'>
        <ResumePdfPreview
          data={data}
          filename={filename}
          coreCompetencies={coreCompetencies}
        />
      </div>
    </section>
  );
}
