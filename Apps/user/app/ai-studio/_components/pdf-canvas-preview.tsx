'use client';

import { useEffect, useRef, useState } from 'react';
import type {
  PDFDocumentProxy,
  TextItem,
} from 'pdfjs-dist/types/src/display/api';
import { cn } from '@/lib/utils';

export type PdfEditableSectionKey =
  | 'basics'
  | 'summary'
  | 'core_competencies'
  | 'experience'
  | 'skills'
  | 'education'
  | 'projects'
  | 'certifications'
  | 'cover_letter';

type PdfZone = {
  section: PdfEditableSectionKey;
  label: string;
  top: number;
  height: number;
};

type PdfPageDescriptor = {
  pageNumber: number;
  height: number;
  scale: number;
  zones: PdfZone[];
};

type PdfCanvasPreviewProps = {
  url: string;
  documentType: 'resume' | 'cover_letter';
  interactive?: boolean;
  activeSection: PdfEditableSectionKey | null;
  onSectionSelect: (section: PdfEditableSectionKey) => void;
};

const PAGE_WIDTH = 780;

const sectionByHeading: Record<
  string,
  | Exclude<PdfEditableSectionKey, 'basics' | 'cover_letter'>
  | 'uneditable'
> = {
  SUMMARY: 'summary',
  CORECOMPETENCIES: 'core_competencies',
  EXPERIENCE: 'experience',
  EDUCATION: 'education',
  PROJECTS: 'projects',
  SKILLS: 'skills',
  CERTIFICATIONS: 'certifications',
  LANGUAGES: 'uneditable',
  OTHER: 'uneditable',
};

const sectionLabel: Record<PdfEditableSectionKey, string> = {
  basics: 'Contact info',
  summary: 'Professional summary',
  core_competencies: 'Core competencies',
  experience: 'Work experience',
  skills: 'Skills & technologies',
  education: 'Education',
  projects: 'Projects',
  certifications: 'Certifications',
  cover_letter: 'Cover letter',
};

function mergeAdjacentZones(zones: PdfZone[]) {
  return zones.reduce<PdfZone[]>((merged, zone) => {
    const previous = merged.at(-1);
    if (
      previous &&
      previous.section === zone.section &&
      Math.abs(previous.top + previous.height - zone.top) < 2
    ) {
      previous.height += zone.height;
      return merged;
    }
    merged.push({ ...zone });
    return merged;
  }, []);
}

async function describePdfPages(
  pdf: PDFDocumentProxy,
  documentType: PdfCanvasPreviewProps['documentType'],
) {
  const descriptors: PdfPageDescriptor[] = [];
  let carriedSection: PdfEditableSectionKey | 'uneditable' =
    documentType === 'cover_letter' ? 'cover_letter' : 'basics';

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const naturalViewport = page.getViewport({ scale: 1 });
    const scale = PAGE_WIDTH / naturalViewport.width;
    const viewport = page.getViewport({ scale });
    const textContent = await page.getTextContent();
    const textItems = textContent.items
      .filter((item): item is TextItem => 'str' in item)
      .map((item) => {
        const [, baselineY] = viewport.convertToViewportPoint(
          item.transform[4],
          item.transform[5],
        );
        const height = Math.max(1, item.height * scale);
        return {
          text: item.str.trim().replace(/\s+/g, ' ').toUpperCase(),
          top: baselineY - height,
          bottom: baselineY + 3,
        };
      })
      .filter((item) => item.text && !/^PAGE \d+ OF \d+$/.test(item.text));

    const contentTop = Math.max(
      0,
      Math.min(...textItems.map((item) => item.top), viewport.height) - 10,
    );
    const contentBottom = Math.min(
      viewport.height,
      Math.max(...textItems.map((item) => item.bottom), 0) + 12,
    );

    if (documentType === 'cover_letter') {
      const salutation = textItems.find((item) => item.text.startsWith('DEAR '));
      const signoff = textItems.find((item) =>
        /^(?:SINCERELY|BEST REGARDS|KIND REGARDS|WARM REGARDS|REGARDS|RESPECTFULLY|YOURS SINCERELY),?$/.test(
          item.text,
        ),
      );
      const bodyTop = salutation ? salutation.bottom + 6 : contentTop;
      const bodyBottom =
        signoff && signoff.top > bodyTop ? signoff.top - 6 : Math.max(bodyTop + 40, contentBottom);

      descriptors.push({
        pageNumber,
        height: viewport.height,
        scale,
        zones: [
          {
            section: 'cover_letter',
            label: sectionLabel.cover_letter,
            top: bodyTop,
            height: Math.max(40, bodyBottom - bodyTop),
          },
        ],
      });
      continue;
    }

    const headings = textItems
      .map((item) => ({
        ...item,
        section: sectionByHeading[item.text.replace(/\s+/g, '')],
      }))
      .filter(
        (
          item,
        ): item is typeof item & {
          section:
            | Exclude<PdfEditableSectionKey, 'basics' | 'cover_letter'>
            | 'uneditable';
        } => Boolean(item.section),
      )
      .sort((a, b) => a.top - b.top);

    const zones: PdfZone[] = [];
    let cursor = pageNumber === 1 ? 0 : contentTop;
    let currentSection: PdfEditableSectionKey | 'uneditable' = carriedSection;

    for (const heading of headings) {
      const headingTop = Math.max(cursor, heading.top - 7);
      if (headingTop - cursor >= 18 && currentSection !== 'uneditable') {
        zones.push({
          section: currentSection,
          label: sectionLabel[currentSection],
          top: cursor,
          height: headingTop - cursor,
        });
      }
      currentSection = heading.section;
      cursor = headingTop;
    }

    if (contentBottom - cursor >= 18 && currentSection !== 'uneditable') {
      zones.push({
        section: currentSection,
        label: sectionLabel[currentSection],
        top: cursor,
        height: contentBottom - cursor,
      });
    }

    carriedSection = currentSection;
    descriptors.push({
      pageNumber,
      height: viewport.height,
      scale,
      zones: mergeAdjacentZones(zones),
    });
  }

  return descriptors;
}

function PdfCanvasPage({
  pdf,
  descriptor,
  interactive = true,
  activeSection,
  onSectionSelect,
}: {
  pdf: PDFDocumentProxy;
  descriptor: PdfPageDescriptor;
  interactive?: boolean;
  activeSection: PdfEditableSectionKey | null;
  onSectionSelect: PdfCanvasPreviewProps['onSectionSelect'];
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    let renderTask: {
      cancel: () => void;
      promise: Promise<unknown>;
    } | null = null;

    void pdf.getPage(descriptor.pageNumber).then((page) => {
      if (cancelled || !canvasRef.current) return;
      const viewport = page.getViewport({ scale: descriptor.scale });
      const outputScale = Math.min(window.devicePixelRatio || 1, 2);
      const canvas = canvasRef.current;
      const context = canvas.getContext('2d');
      if (!context) return;

      canvas.width = Math.floor(viewport.width * outputScale);
      canvas.height = Math.floor(viewport.height * outputScale);
      canvas.style.width = '100%';
      canvas.style.height = '100%';

      const nextRenderTask = page.render({
        canvasContext: context,
        viewport,
        transform:
          outputScale === 1 ? undefined : [outputScale, 0, 0, outputScale, 0, 0],
      });
      renderTask = nextRenderTask;
      void nextRenderTask.promise.catch(() => undefined);
    });

    return () => {
      cancelled = true;
      renderTask?.cancel();
    };
  }, [descriptor.pageNumber, descriptor.scale, pdf]);

  return (
    <div
      className='relative w-full max-w-[780px] shrink-0 overflow-hidden bg-white shadow-md'
      style={{ aspectRatio: `${PAGE_WIDTH} / ${descriptor.height}` }}
      data-testid={`pdf-page-${descriptor.pageNumber}`}
    >
      <canvas ref={canvasRef} className='absolute inset-0 block h-full w-full bg-white' />

      {interactive &&
        descriptor.zones.map((zone, index) => (
          <button
            key={`${zone.section}-${index}`}
            type='button'
            aria-label={`Edit ${zone.label}`}
            onClick={() => onSectionSelect(zone.section)}
            className={cn(
              'group absolute left-0 z-10 w-full cursor-pointer border border-transparent bg-transparent text-left transition-colors',
              activeSection === zone.section ?
                'border-primary bg-primary/10'
              : 'hover:border-primary/40 hover:bg-primary/[0.03]',
            )}
            style={{
              top: `${(zone.top / descriptor.height) * 100}%`,
              height: `${(zone.height / descriptor.height) * 100}%`,
            }}
          />
        ))}

      <span className='pointer-events-none absolute bottom-4 left-1/2 transform -translate-x-1/2 text-[0.4rem] text-ink-secondary/70'>
{descriptor.pageNumber} 
      </span>
    </div>
  );
}

export function PdfCanvasPreview({
  url,
  documentType,
  interactive = true,
  activeSection,
  onSectionSelect,
}: PdfCanvasPreviewProps) {
  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null);
  const [pages, setPages] = useState<PdfPageDescriptor[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    let loadingTask: ReturnType<(typeof import('pdfjs-dist'))['getDocument']> | null =
      null;
    let loadedPdf: PDFDocumentProxy | null = null;

    setPdf(null);
    setPages([]);
    setError('');

    void (async () => {
      try {
        const pdfjs = await import('pdfjs-dist');
        pdfjs.GlobalWorkerOptions.workerSrc = new URL(
          'pdfjs-dist/build/pdf.worker.min.mjs',
          import.meta.url,
        ).toString();
        const data = new Uint8Array(await (await fetch(url)).arrayBuffer());
        loadingTask = pdfjs.getDocument({ data });
        loadedPdf = await loadingTask.promise;
        const descriptors = await describePdfPages(loadedPdf, documentType);
        if (cancelled) return;
        setPdf(loadedPdf);
        setPages(descriptors);
      } catch (loadError) {
        if (!cancelled) {
          setError(
            loadError instanceof Error ? loadError.message : 'Could not display PDF.',
          );
        }
      }
    })();

    return () => {
      cancelled = true;
      void loadingTask?.destroy();
      if (!loadingTask) void loadedPdf?.destroy();
    };
  }, [documentType, url]);

  if (error) {
    return (
      <div className='flex h-full items-center justify-center p-8 text-center text-xs text-destructive'>
        {error}
      </div>
    );
  }

  if (!pdf || pages.length === 0) {
    return (
      <div className='flex h-full flex-col items-center justify-center gap-2 text-xs text-ink-secondary'>
        Loading PDF...
      </div>
    );
  }

  return (
    <div
      className='h-full w-full overflow-y-auto overflow-x-hidden bg-background-secondary/40 p-4'
      data-testid='pdf-pages-scroll'
    >
      <div className='flex min-h-full flex-col items-center gap-4'>
        {pages.map((descriptor) => (
          <PdfCanvasPage
            key={descriptor.pageNumber}
            pdf={pdf}
            descriptor={descriptor}
            interactive={interactive}
            activeSection={activeSection}
            onSectionSelect={onSectionSelect}
          />
        ))}
      </div>
    </div>
  );
}
