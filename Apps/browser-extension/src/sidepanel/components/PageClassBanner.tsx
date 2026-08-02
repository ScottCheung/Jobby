/** @format */

import type { PageInspection } from '../../shared/contracts/page-inspection';

interface PageClassBannerProps {
  latestInspection: PageInspection | null;
  isInspecting: boolean;
}

/**
 * Diagnostic banner shown at the very top of the side panel.
 *
 * Renders the result of the lightweight page-classifier so the user can see at
 * a glance whether Jobby recognises the current page as a job listing — and
 * why. The banner is intentionally compact: a colour-coded pill for status and
 * an expandable detail row for the full reason text.
 */
export function PageClassBanner({ latestInspection, isInspecting }: PageClassBannerProps) {
  if (isInspecting) {
    return (
      <div className='page-class-banner page-class-banner--checking' role='status' aria-live='polite'>
        <span className='page-class-banner__icon'>⟳</span>
        <span className='page-class-banner__label'>正在检测页面类型…</span>
      </div>
    );
  }

  if (!latestInspection) {
    return (
      <div className='page-class-banner page-class-banner--idle' role='status'>
        <span className='page-class-banner__icon'>○</span>
        <span className='page-class-banner__label'>等待检测…</span>
      </div>
    );
  }

  if (latestInspection.kind === 'job') {
    const { platform, title, company } = latestInspection.snapshot;
    return (
      <div className='page-class-banner page-class-banner--job' role='status'>
        <span className='page-class-banner__icon'>✓</span>
        <span className='page-class-banner__label'>
          <strong>已识别职位页面</strong>
          <span className='page-class-banner__sub'>
            [{platform}] {title} · {company}
          </span>
        </span>
      </div>
    );
  }

  // not_job_page or unsupported_page
  const reason =
    latestInspection.kind === 'not_job_page' || latestInspection.kind === 'unsupported_page'
      ? latestInspection.reason
      : '未知原因';

  // Distinguish "classifier said no" from "parser couldn't extract enough info"
  const isClassifierRejection =
    reason.includes('没有任何求职信号') || reason.includes('置信度不足');

  return (
    <details className={`page-class-banner page-class-banner--no-job${isClassifierRejection ? ' page-class-banner--skip' : ''}`}>
      <summary className='page-class-banner__summary' role='status'>
        <span className='page-class-banner__icon'>{isClassifierRejection ? '✗' : '!'}</span>
        <span className='page-class-banner__label'>
          {isClassifierRejection ? (
            <>
              <strong>非求职页面</strong>
              <span className='page-class-banner__sub'>已跳过解析</span>
            </>
          ) : (
            <>
              <strong>页面内容不足</strong>
              <span className='page-class-banner__sub'>无法提取职位信息</span>
            </>
          )}
        </span>
        <span className='page-class-banner__expand-hint'>▾ 展开原因</span>
      </summary>
      <p className='page-class-banner__reason'>{reason}</p>
    </details>
  );
}
