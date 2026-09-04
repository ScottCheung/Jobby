/** @format */

import { useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Check,
  Download,
  FileText,
  Mail,
  MapPin,
  Maximize2,
  Phone,
  Printer,
  X,
} from 'lucide-react';
import { Button } from '@jobby/ui/components/UI/Button';
import { formatResumeFilename } from '@jobby/ui/components/UI/Resume/helpers';
import type { MasterResumeData } from '../../shared/contracts/tailored-resume';

interface LiveResumePreviewProps {
  data: MasterResumeData;
  coreCompetencies?: string[];
  company?: string;
  jobTitle?: string;
}

export function LiveResumePreview({
  data,
  coreCompetencies = [],
  company = '',
  jobTitle = '',
}: LiveResumePreviewProps) {
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);

  const filename = formatResumeFilename(data, company, jobTitle);
  const basics = data?.basics || {};
  const fullName = [basics.first_name, basics.last_name]
    .filter(Boolean)
    .join(' ');
  const headline = basics.headline || jobTitle || 'Professional';
  const competencies =
    coreCompetencies.length > 0 ?
      coreCompetencies
    : data?.core_competencies || [];

  const handleDownloadPdf = () => {
    // Generate clean printable HTML document
    const printWindow = window.open('', '_blank', 'width=850,height=1100');
    if (!printWindow) return;

    const contactItems = [
      basics.email,
      basics.phone,
      basics.location?.city,
      basics.linkedin_id,
      basics.website,
    ].filter(Boolean);

    const docHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>${filename.replace(/\.pdf$/i, '')}</title>
          <style>
            @page {
              size: A4;
              margin: 14mm 16mm;
            }
            * { box-sizing: border-box; }
            body {
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
              color: #0f172a;
              background: #ffffff;
              line-height: 1.45;
              font-size: 10pt;
              margin: 0;
              padding: 0;
            }
            .header {
              border-bottom: 2px solid #6366f1;
              padding-bottom: 10px;
              margin-bottom: 12px;
            }
            .name {
              font-size: 20pt;
              font-weight: 800;
              color: #0f172a;
              margin: 0;
              letter-spacing: -0.02em;
            }
            .headline {
              font-size: 11pt;
              font-weight: 600;
              color: #6366f1;
              margin: 3px 0 6px 0;
            }
            .contact-row {
              font-size: 8.5pt;
              color: #64748b;
              display: flex;
              flex-wrap: wrap;
              gap: 12px;
            }
            .section {
              margin-top: 12px;
            }
            .section-title {
              font-size: 9.5pt;
              font-weight: 800;
              text-transform: uppercase;
              letter-spacing: 0.08em;
              color: #0f172a;
              border-bottom: 1px solid #e2e8f0;
              padding-bottom: 3px;
              margin-bottom: 6px;
            }
            .summary-text {
              font-size: 9pt;
              color: #334155;
              line-height: 1.5;
            }
            .chips {
              display: flex;
              flex-wrap: wrap;
              gap: 5px;
            }
            .chip {
              background: #f1f5f9;
              color: #334155;
              border: 1px solid #cbd5e1;
              border-radius: 4px;
              padding: 2px 7px;
              font-size: 8pt;
              font-weight: 600;
            }
            .entry {
              margin-bottom: 10px;
            }
            .entry-header {
              display: flex;
              justify-content: space-between;
              font-size: 9.5pt;
              font-weight: 700;
              color: #0f172a;
            }
            .entry-sub {
              display: flex;
              justify-content: space-between;
              font-size: 8.5pt;
              color: #64748b;
              margin-bottom: 4px;
            }
            ul {
              margin: 3px 0 6px 18px;
              padding: 0;
              font-size: 8.5pt;
              color: #334155;
            }
            li {
              margin-bottom: 3px;
            }
          </style>
        </head>
        <body>
          <div class="header">
            <h1 class="name">${fullName || 'Curriculum Vitae'}</h1>
            ${headline ? `<div class="headline">${headline}</div>` : ''}
            ${contactItems.length ? `<div class="contact-row">${contactItems.join(' • ')}</div>` : ''}
          </div>

          ${
            data?.summary ?
              `
            <div class="section">
              <div class="section-title">Professional Summary</div>
              <div class="summary-text">${data.summary}</div>
            </div>
          `
            : ''
          }

          ${
            competencies.length ?
              `
            <div class="section">
              <div class="section-title">Core Competencies & Capabilities</div>
              <div class="chips">
                ${competencies.map((c) => `<span class="chip">${c}</span>`).join('')}
              </div>
            </div>
          `
            : ''
          }

          ${
            data?.experience?.length ?
              `
            <div class="section">
              <div class="section-title">Professional Experience</div>
              ${data.experience
                .map(
                  (exp) => `
                <div class="entry">
                  <div class="entry-header">
                    <span>${exp.title || 'Role'}</span>
                    <span>${[exp.start_date, exp.end_date].filter(Boolean).join(' – ')}</span>
                  </div>
                  <div class="entry-sub">
                    <span>${exp.company || ''}</span>
                    <span>${exp.location || ''}</span>
                  </div>
                  ${
                    exp.description?.length ?
                      `<ul>${exp.description.map((b) => `<li>${b}</li>`).join('')}</ul>`
                    : ''
                  }
                </div>
              `,
                )
                .join('')}
            </div>
          `
            : ''
          }

          ${
            data?.skills?.length ?
              `
            <div class="section">
              <div class="section-title">Skills & Technologies</div>
              ${data.skills
                .map(
                  (sg) => `
                <div style="font-size: 8.5pt; margin-bottom: 3px;">
                  <strong>${sg.type || 'Skills'}:</strong> ${(sg.skills || []).join(', ')}
                </div>
              `,
                )
                .join('')}
            </div>
          `
            : ''
          }

          ${
            data?.projects?.length ?
              `
            <div class="section">
              <div class="section-title">Projects</div>
              ${data.projects
                .map(
                  (proj) => `
                <div class="entry">
                  <div class="entry-header">
                    <span>${proj.name || 'Project'}</span>
                  </div>
                  ${
                    proj.technologies?.length ?
                      `<div class="entry-sub">Tech: ${proj.technologies.join(', ')}</div>`
                    : ''
                  }
                  ${
                    proj.description?.length ?
                      `<ul>${proj.description.map((b) => `<li>${b}</li>`).join('')}</ul>`
                    : ''
                  }
                </div>
              `,
                )
                .join('')}
            </div>
          `
            : ''
          }
        </body>
      </html>
    `;

    printWindow.document.open();
    printWindow.document.write(docHtml);
    printWindow.document.close();
    printWindow.focus();

    // Auto-invoke print dialog after document is ready
    setTimeout(() => {
      printWindow.print();
    }, 250);
  };

  return (
    <div className='w-full flex flex-col gap-2'>
      {/* ── THUMBNAIL CARD WITH HOVER ACTIONS ── */}
      <div
        onClick={() => setIsPreviewModalOpen(true)}
        className='group relative w-full aspect-[816/1056] max-h-48 cursor-zoom-in overflow-hidden rounded-2xl border border-primary/25 bg-white text-slate-900 shadow-sm transition-all hover:shadow-md hover:border-primary/50'
      >
        {/* Scaled Mini HTML Resume Document */}
        <div className='pointer-events-none absolute inset-0 overflow-hidden bg-slate-50/90 flex justify-center p-3 select-none'>
          <div className='origin-top scale-[0.24] transform-gpu w-[580px] bg-white p-6 shadow-sm rounded'>
            <div className='border-b-2 border-indigo-500 pb-2 mb-3'>
              <h2 className='text-xl font-bold text-slate-900'>
                {fullName || 'Curriculum Vitae'}
              </h2>
              <p className='text-xs font-semibold text-indigo-600 mt-0.5'>
                {headline}
              </p>
              <p className='text-[10px] text-slate-500 mt-1'>
                {[basics.email, basics.location?.city]
                  .filter(Boolean)
                  .join(' • ')}
              </p>
            </div>

            {data?.summary && (
              <div className='mb-3'>
                <p className='text-[9px] font-bold uppercase text-slate-700 mb-0.5'>
                  Summary
                </p>
                <p className='text-[8.5px] text-slate-600 line-clamp-3 leading-relaxed'>
                  {data.summary}
                </p>
              </div>
            )}

            {competencies.length > 0 && (
              <div className='mb-3'>
                <p className='text-[9px] font-bold uppercase text-slate-700 mb-1'>
                  Key Competencies
                </p>
                <div className='flex flex-wrap gap-1'>
                  {competencies.slice(0, 6).map((c, i) => (
                    <span
                      key={i}
                      className='bg-slate-100 border border-slate-300 text-[8px] font-semibold px-1.5 py-0.5 rounded text-slate-700'
                    >
                      {c}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {data?.experience?.length ?
              <div>
                <p className='text-[9px] font-bold uppercase text-slate-700 mb-1'>
                  Experience
                </p>
                {data.experience.slice(0, 2).map((exp, i) => (
                  <div key={i} className='mb-1.5'>
                    <div className='flex justify-between text-[8.5px] font-bold text-slate-800'>
                      <span>{exp.title}</span>
                      <span>{exp.company}</span>
                    </div>
                    {exp.description?.[0] && (
                      <p className='text-[8px] text-slate-600 line-clamp-1'>
                        • {exp.description[0]}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            : null}
          </div>
        </div>

        {/* Hover Action Overlay */}
        <div className='absolute inset-0 flex items-center justify-center gap-2.5 bg-slate-900/60 opacity-0 backdrop-blur-[2px] transition-opacity group-hover:opacity-100'>
          <button
            type='button'
            aria-label='Enlarge resume preview'
            onClick={(e) => {
              e.stopPropagation();
              setIsPreviewModalOpen(true);
            }}
            className='flex h-9 w-9 items-center justify-center rounded-xl bg-white/90 text-slate-900 shadow-md hover:bg-white transition cursor-pointer'
            title='Zoom in preview'
          >
            <Maximize2 className='h-4 w-4' />
          </button>

          <button
            type='button'
            aria-label='Download resume PDF'
            onClick={(e) => {
              e.stopPropagation();
              handleDownloadPdf();
            }}
            className='flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-md hover:opacity-90 transition cursor-pointer'
            title={`Download ${filename}`}
          >
            <Download className='h-4 w-4' />
          </button>
        </div>

        {/* Bottom Left Badge */}
        <div className='absolute bottom-2 left-2 flex items-center gap-1.5 rounded-lg bg-slate-900/80 px-2 py-1 text-[10px] font-medium text-white shadow-xs backdrop-blur-xs'>
          <FileText className='h-3 w-3 text-indigo-400' />
          <span>Resume Preview</span>
        </div>
      </div>

      {/* ── ENLARGED FULLSCREEN PREVIEW MODAL ── */}
      {isPreviewModalOpen &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            className='modal-backdrop z-[999]'
            onClick={() => setIsPreviewModalOpen(false)}
          >
            <div
              className='modal-card max-w-[560px] w-[94vw] max-h-[88vh] flex flex-col p-0 overflow-hidden'
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div className='flex items-center justify-between gap-3 p-3.5 border-b border-primary bg-panel shrink-0'>
                <div className='min-w-0 flex items-center gap-2'>
                  <div className='w-7 h-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0'>
                    <FileText className='w-4 h-4' />
                  </div>
                  <div className='min-w-0'>
                    <h3 className='text-xs font-bold text-foreground truncate'>
                      {filename}
                    </h3>
                    <p className='text-[10px] text-muted-foreground'>
                      Click Download to export full styled PDF
                    </p>
                  </div>
                </div>

                <div className='flex items-center gap-2 shrink-0'>
                  <Button
                    size='sm'
                    variant='default'
                    Icon={Download}
                    onClick={handleDownloadPdf}
                    className='!rounded-xl !h-8 !px-3 text-xs font-semibold text-white dark:text-foreground'
                  >
                    Download PDF
                  </Button>

                  <button
                    type='button'
                    onClick={() => setIsPreviewModalOpen(false)}
                    className='w-7 h-7 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/40 transition cursor-pointer'
                    aria-label='Close preview'
                  >
                    <X className='w-4 h-4' />
                  </button>
                </div>
              </div>

              {/* Modal Body: Full Readable Document */}
              <div className='flex-1 overflow-y-auto p-4 bg-muted/20'>
                <div className='bg-white text-slate-900 p-6 rounded-xl shadow-md border border-slate-200'>
                  {/* Header */}
                  <div className='border-b-2 border-indigo-500 pb-3 mb-4'>
                    <h1 className='text-xl font-bold text-slate-900 tracking-tight'>
                      {fullName || 'Curriculum Vitae'}
                    </h1>
                    {headline && (
                      <p className='text-xs font-semibold text-indigo-600 mt-0.5'>
                        {headline}
                      </p>
                    )}
                    <div className='flex flex-wrap items-center gap-3 text-[11px] text-slate-500 mt-2'>
                      {basics.email && (
                        <span className='flex items-center gap-1'>
                          <Mail className='w-3 h-3 text-indigo-500' />
                          {basics.email}
                        </span>
                      )}
                      {basics.phone && (
                        <span className='flex items-center gap-1'>
                          <Phone className='w-3 h-3 text-indigo-500' />
                          {basics.phone}
                        </span>
                      )}
                      {basics.location?.city && (
                        <span className='flex items-center gap-1'>
                          <MapPin className='w-3 h-3 text-indigo-500' />
                          {basics.location.city}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Summary */}
                  {data?.summary && (
                    <div className='mb-4'>
                      <h4 className='text-xs font-bold uppercase tracking-wider text-slate-800 mb-1 border-b border-slate-200 pb-1'>
                        Professional Summary
                      </h4>
                      <p className='text-xs text-slate-700 leading-relaxed'>
                        {data.summary}
                      </p>
                    </div>
                  )}

                  {/* Core Competencies */}
                  {competencies.length > 0 && (
                    <div className='mb-4'>
                      <h4 className='text-xs font-bold uppercase tracking-wider text-slate-800 mb-1.5 border-b border-slate-200 pb-1'>
                        Matched Core Competencies
                      </h4>
                      <div className='flex flex-wrap gap-1.5'>
                        {competencies.map((comp, i) => (
                          <span
                            key={i}
                            className='inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200'
                          >
                            <Check className='w-3 h-3 text-indigo-600' />
                            {comp}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Experience */}
                  {data?.experience?.length ?
                    <div className='mb-4'>
                      <h4 className='text-xs font-bold uppercase tracking-wider text-slate-800 mb-2 border-b border-slate-200 pb-1'>
                        Experience
                      </h4>
                      <div className='flex flex-col gap-3'>
                        {data.experience.map((exp, idx) => (
                          <div key={idx} className='text-xs'>
                            <div className='flex items-center justify-between font-bold text-slate-900'>
                              <span>{exp.title}</span>
                              <span className='text-[10px] text-slate-500 font-normal'>
                                {[exp.start_date, exp.end_date]
                                  .filter(Boolean)
                                  .join(' – ')}
                              </span>
                            </div>
                            <div className='text-[11px] text-indigo-600 font-medium mb-1'>
                              {exp.company}
                              {exp.location ? ` • ${exp.location}` : ''}
                            </div>
                            {exp.description?.length ?
                              <ul className='list-disc list-inside space-y-1 text-slate-700 text-[11px] leading-relaxed'>
                                {exp.description.map((bullet, bIdx) => (
                                  <li key={bIdx}>{bullet}</li>
                                ))}
                              </ul>
                            : null}
                          </div>
                        ))}
                      </div>
                    </div>
                  : null}

                  {/* Skills */}
                  {data?.skills?.length ?
                    <div className='mb-3'>
                      <h4 className='text-xs font-bold uppercase tracking-wider text-slate-800 mb-1.5 border-b border-slate-200 pb-1'>
                        Skills & Technologies
                      </h4>
                      <div className='flex flex-col gap-1 text-xs'>
                        {data.skills.map((sg, idx) => (
                          <div key={idx} className='text-[11px] text-slate-700'>
                            <span className='font-bold text-slate-900'>
                              {sg.type || 'Skills'}:
                            </span>{' '}
                            {(sg.skills || []).join(', ')}
                          </div>
                        ))}
                      </div>
                    </div>
                  : null}
                </div>
              </div>

              {/* Modal Footer */}
              <div className='p-3 border-t border-primary bg-panel flex items-center justify-between gap-2 shrink-0'>
                <span className='text-[11px] text-muted-foreground'>
                  Ready to submit or print
                </span>
                <Button
                  size='sm'
                  variant='default'
                  Icon={Printer}
                  onClick={handleDownloadPdf}
                  className='!rounded-xl !h-8 !px-3.5 text-xs font-semibold text-white dark:text-foreground'
                >
                  Print / Save PDF
                </Button>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
