'use client';

import { useEffect, useRef, useState } from 'react';
import type {
  PDFDocumentProxy,
  TextItem,
} from 'pdfjs-dist/types/src/display/api';
import { cn } from '@/lib/utils';
import type { MasterResumeData } from '@/lib/types';

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
  itemIndex?: number;
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
  activeItemIndex?: number | null;
  onSectionSelect: (section: PdfEditableSectionKey, itemIndex?: number) => void;
  resumeData?: MasterResumeData;
};

const PAGE_WIDTH = 780;

function matchSectionHeading(text: string): {
  section: Exclude<PdfEditableSectionKey, 'basics' | 'cover_letter'> | 'uneditable';
} | null {
  const normalized = text.replace(/[^A-Z&]/g, '');
  if (/^(SUMMARY|PROFESSIONALSUMMARY|ABOUTME|EXECUTIVEPROFILE)$/.test(normalized))
    return { section: 'summary' };
  if (/^(CORECOMPETENCIES|KEYQUALIFICATIONS|COMPETENCIES|AREASOFEXPERTISE)$/.test(normalized))
    return { section: 'core_competencies' };
  if (/^(EXPERIENCE|WORKEXPERIENCE|PROFESSIONALEXPERIENCE|EMPLOYMENTHISTORY|WORKHISTORY)$/.test(normalized))
    return { section: 'experience' };
  if (/^(EDUCATION|ACADEMICBACKGROUND|EDUCATIONANDTRAINING)$/.test(normalized))
    return { section: 'education' };
  if (/^(PROJECTS|KEYPROJECTS|PERSONALPROJECTS|NOTABLEPROJECTS)$/.test(normalized))
    return { section: 'projects' };
  if (/^(SKILLS|TECHNICALSKILLS|SKILLS&TECHNOLOGIES|SKILLSANDTECHNOLOGIES|TOOLSANDTECHNOLOGIES|CORETECHNOLOGIES)$/.test(normalized))
    return { section: 'skills' };
  if (/^(CERTIFICATIONS|CERTIFICATES|LICENSES&CERTIFICATIONS|LICENSESANDCERTIFICATIONS|CERTIFICATION)$/.test(normalized))
    return { section: 'certifications' };
  if (/^(LANGUAGES|OTHER|PUBLICATIONS|AWARDS|VOLUNTEER)$/.test(normalized))
    return { section: 'uneditable' };
  return null;
}

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
      previous.itemIndex === zone.itemIndex &&
      Math.abs(previous.top + previous.height - zone.top) < 2
    ) {
      previous.height += zone.height;
      return merged;
    }
    merged.push({ ...zone });
    return merged;
  }, []);
}

type PdfTextLine = {
  text: string;
  top: number;
  bottom: number;
};

type PageData = {
  pageNumber: number;
  height: number;
  scale: number;
  contentTop: number;
  contentBottom: number;
  lines: PdfTextLine[];
};

function groupTextItemsIntoLines(
  items: { text: string; top: number; bottom: number }[],
): PdfTextLine[] {
  if (items.length === 0) return [];
  const sorted = [...items].sort((a, b) => a.top - b.top);
  const lines: PdfTextLine[] = [];

  for (const item of sorted) {
    const currentLine = lines.find(
      (l) => Math.abs(l.top - item.top) <= 3.5 || Math.abs(l.bottom - item.bottom) <= 3.5,
    );
    if (currentLine) {
      currentLine.text = `${currentLine.text} ${item.text}`.trim();
      currentLine.top = Math.min(currentLine.top, item.top);
      currentLine.bottom = Math.max(currentLine.bottom, item.bottom);
    } else {
      lines.push({ text: item.text, top: item.top, bottom: item.bottom });
    }
  }

  return lines.sort((a, b) => a.top - b.top);
}

type ExperienceItem = NonNullable<MasterResumeData['experience']>[number];
type ProjectItem = NonNullable<MasterResumeData['projects']>[number];
type EducationItem = NonNullable<MasterResumeData['education']>[number];
type SkillGroupItem = NonNullable<MasterResumeData['skills']>[number];

function matchesExperienceEntry(entry: ExperienceItem, lineText: string): boolean {
  const company = entry.company?.trim().toUpperCase();
  const title = entry.title?.trim().toUpperCase();
  const startDate = entry.start_date?.trim().toUpperCase();
  const endDate = entry.end_date?.trim().toUpperCase();

  if (company && company.length >= 2 && lineText.includes(company)) return true;
  if (title && title.length >= 2 && lineText.includes(title)) return true;
  if (company && company.length >= 4) {
    const words: string[] = company.split(/\s+/).filter((w: string) => w.length >= 3);
    if (words.length >= 2 && words.every((w: string) => lineText.includes(w))) return true;
  }
  if (startDate && startDate.length >= 3 && lineText.includes(startDate)) {
    if (endDate && lineText.includes(endDate)) return true;
  }
  return false;
}

function matchesProjectEntry(entry: ProjectItem, lineText: string): boolean {
  const name = entry.name?.trim().toUpperCase();
  if (name && name.length >= 2 && lineText.includes(name)) return true;
  if (name && name.length >= 4) {
    const words: string[] = name.split(/\s+/).filter((w: string) => w.length >= 3);
    if (words.length >= 2 && words.every((w: string) => lineText.includes(w))) return true;
  }
  return false;
}

function matchesEducationEntry(entry: EducationItem, lineText: string): boolean {
  const degree = entry.degree?.trim().toUpperCase();
  const inst = entry.institution?.trim().toUpperCase();
  if (degree && degree.length >= 2 && lineText.includes(degree)) return true;
  if (inst && inst.length >= 2 && lineText.includes(inst)) return true;
  if (inst && inst.length >= 4) {
    const words: string[] = inst.split(/\s+/).filter((w: string) => w.length >= 3);
    if (words.length >= 2 && words.every((w: string) => lineText.includes(w))) return true;
  }
  return false;
}

function matchesSkillGroup(entry: SkillGroupItem, lineText: string): boolean {
  const type = entry.type?.trim().toUpperCase();
  if (type && type.length >= 2 && lineText.includes(type)) return true;
  if (type && type.length >= 4) {
    const words: string[] = type.split(/[\s&/]+/).filter((w: string) => w.length >= 3);
    if (words.length >= 2 && words.every((w: string) => lineText.includes(w))) return true;
  }
  return false;
}

function checkNextItemMatch(
  section: PdfEditableSectionKey,
  currentIndex: number,
  lineText: string,
  resumeData?: MasterResumeData,
): number | null {
  if (!resumeData) return null;
  if (section === 'experience' && resumeData.experience) {
    for (let k = currentIndex + 1; k < resumeData.experience.length; k++) {
      if (matchesExperienceEntry(resumeData.experience[k], lineText)) return k;
    }
  }
  if (section === 'projects' && resumeData.projects) {
    for (let k = currentIndex + 1; k < resumeData.projects.length; k++) {
      if (matchesProjectEntry(resumeData.projects[k], lineText)) return k;
    }
  }
  if (section === 'education' && resumeData.education) {
    for (let k = currentIndex + 1; k < resumeData.education.length; k++) {
      if (matchesEducationEntry(resumeData.education[k], lineText)) return k;
    }
  }
  if (section === 'skills' && resumeData.skills) {
    for (let k = currentIndex + 1; k < resumeData.skills.length; k++) {
      if (matchesSkillGroup(resumeData.skills[k], lineText)) return k;
    }
  }
  return null;
}

function getItemLabel(
  section: PdfEditableSectionKey,
  itemIndex: number | undefined,
  resumeData?: MasterResumeData,
): string {
  if (itemIndex == null || !resumeData) {
    return sectionLabel[section] || section;
  }
  if (section === 'experience') {
    const entry = resumeData.experience?.[itemIndex];
    return entry?.title || entry?.company || `Role #${itemIndex + 1}`;
  }
  if (section === 'projects') {
    const entry = resumeData.projects?.[itemIndex];
    return entry?.name || `Project #${itemIndex + 1}`;
  }
  if (section === 'education') {
    const entry = resumeData.education?.[itemIndex];
    return entry?.degree || entry?.institution || `Education #${itemIndex + 1}`;
  }
  if (section === 'skills') {
    const entry = resumeData.skills?.[itemIndex];
    return entry?.type || `Category #${itemIndex + 1}`;
  }
  return sectionLabel[section] || section;
}

async function describePdfPages(
  pdf: PDFDocumentProxy,
  documentType: PdfCanvasPreviewProps['documentType'],
  resumeData?: MasterResumeData,
) {
  const pageDataList: PageData[] = [];

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

    pageDataList.push({
      pageNumber,
      height: viewport.height,
      scale,
      contentTop,
      contentBottom,
      lines: groupTextItemsIntoLines(textItems),
    });
  }

  if (documentType === 'cover_letter') {
    const descriptors: PdfPageDescriptor[] = [];
    for (const page of pageDataList) {
      const salutation = page.lines.find((item) => item.text.startsWith('DEAR '));
      const signoff = page.lines.find((item) =>
        /^(?:SINCERELY|BEST REGARDS|KIND REGARDS|WARM REGARDS|REGARDS|RESPECTFULLY|YOURS SINCERELY),?$/.test(
          item.text,
        ),
      );
      const bodyTop = salutation ? salutation.bottom + 6 : page.contentTop;
      const bodyBottom =
        signoff && signoff.top > bodyTop ? signoff.top - 6 : Math.max(bodyTop + 40, page.contentBottom);

      descriptors.push({
        pageNumber: page.pageNumber,
        height: page.height,
        scale: page.scale,
        zones: [
          {
            section: 'cover_letter',
            label: sectionLabel.cover_letter,
            top: bodyTop,
            height: Math.max(40, bodyBottom - bodyTop),
          },
        ],
      });
    }
    return descriptors;
  }

  type TaggedLine = {
    top: number;
    bottom: number;
    section: PdfEditableSectionKey | 'uneditable';
    itemIndex?: number;
  };

  const pageTaggedLines: Record<number, TaggedLine[]> = {};
  for (const page of pageDataList) {
    pageTaggedLines[page.pageNumber] = [];
  }

  let currentSection: PdfEditableSectionKey | 'uneditable' = 'basics';
  let currentItemIndex = 0;

  for (const page of pageDataList) {
    for (const line of page.lines) {
      const headingMatch = matchSectionHeading(line.text);
      if (headingMatch) {
        currentSection = headingMatch.section;
        currentItemIndex = 0;
      } else if (currentSection !== 'uneditable') {
        const nextIdx = checkNextItemMatch(currentSection, currentItemIndex, line.text, resumeData);
        if (nextIdx != null) {
          currentItemIndex = nextIdx;
        }
      }

      const isMulti =
        currentSection === 'experience' ||
        currentSection === 'projects' ||
        currentSection === 'education' ||
        currentSection === 'skills';

      pageTaggedLines[page.pageNumber].push({
        top: line.top,
        bottom: line.bottom,
        section: currentSection,
        itemIndex: isMulti ? currentItemIndex : undefined,
      });
    }
  }

  const descriptors: PdfPageDescriptor[] = pageDataList.map((page) => {
    const lines = pageTaggedLines[page.pageNumber] || [];
    const zones: PdfZone[] = [];
    let group: TaggedLine[] = [];

    const flush = () => {
      if (group.length === 0) return;
      const first = group[0];
      if (first.section === 'uneditable') {
        group = [];
        return;
      }
      const top = Math.max(0, Math.min(...group.map((l) => l.top)) - 4);
      const bottom = Math.max(...group.map((l) => l.bottom)) + 4;
      const height = Math.max(16, bottom - top);
      const label = getItemLabel(first.section, first.itemIndex, resumeData);

      zones.push({
        section: first.section,
        itemIndex: first.itemIndex,
        label,
        top,
        height,
      });
      group = [];
    };

    for (const line of lines) {
      const prev = group.at(-1);
      if (prev && (prev.section !== line.section || prev.itemIndex !== line.itemIndex)) {
        flush();
      }
      group.push(line);
    }
    flush();

    return {
      pageNumber: page.pageNumber,
      height: page.height,
      scale: page.scale,
      zones: mergeAdjacentZones(zones),
    };
  });

  return descriptors;
}

function PdfZoneButton({
  zone,
  isActive,
  pageHeight,
  onSelect,
}: {
  zone: PdfZone;
  isActive: boolean;
  pageHeight: number;
  onSelect: () => void;
}) {
  const buttonRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (isActive && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      const inView = rect.top >= 40 && rect.bottom <= (window.innerHeight || 800) - 40;
      if (!inView) {
        buttonRef.current.scrollIntoView({
          behavior: 'smooth',
          block: 'nearest',
        });
      }
    }
  }, [isActive]);

  return (
    <button
      ref={buttonRef}
      type='button'
      aria-label={`Edit ${zone.label}`}
      onClick={onSelect}
      className={cn(
        'group absolute left-0 z-10 w-full cursor-pointer border border-transparent bg-transparent text-left transition-all duration-150',
        isActive ?
          'border-primary bg-primary/10 ring-1 ring-primary/40'
        : 'hover:border-primary/50 hover:bg-primary/[0.04]',
      )}
      style={{
        top: `${(zone.top / pageHeight) * 100}%`,
        height: `${(zone.height / pageHeight) * 100}%`,
      }}
    >
      <span
        className={cn(
          'absolute top-1 right-2 pointer-events-none rounded-md px-1.5 py-0.5 text-[10px] shadow-2xs transition-opacity duration-150 backdrop-blur-xs max-w-[80%] truncate',
          isActive ?
            'opacity-100 bg-primary text-primary-foreground font-semibold'
          : 'opacity-0 group-hover:opacity-100 bg-panel/90 text-ink-primary border border-border/80 font-medium',
        )}
      >
        ✏️ {zone.label}
      </span>
    </button>
  );
}

function PdfCanvasPage({
  pdf,
  descriptor,
  interactive = true,
  activeSection,
  activeItemIndex,
  onSectionSelect,
}: {
  pdf: PDFDocumentProxy;
  descriptor: PdfPageDescriptor;
  interactive?: boolean;
  activeSection: PdfEditableSectionKey | null;
  activeItemIndex?: number | null;
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
        descriptor.zones.map((zone, index) => {
          const isSectionActive = activeSection === zone.section;
          const isMultiItem =
            zone.section === 'experience' ||
            zone.section === 'projects' ||
            zone.section === 'education' ||
            zone.section === 'skills';

          const isActive =
            isSectionActive &&
            (!isMultiItem ||
              (zone.itemIndex != null && zone.itemIndex === (activeItemIndex ?? 0)));

          return (
            <PdfZoneButton
              key={`${zone.section}-${zone.itemIndex ?? 'all'}-${index}`}
              zone={zone}
              isActive={isActive}
              pageHeight={descriptor.height}
              onSelect={() => onSectionSelect(zone.section, zone.itemIndex)}
            />
          );
        })}

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
  activeItemIndex,
  onSectionSelect,
  resumeData,
}: PdfCanvasPreviewProps) {
  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null);
  const [pages, setPages] = useState<PdfPageDescriptor[]>([]);
  const [error, setError] = useState('');
  const resumeDataRef = useRef(resumeData);
  resumeDataRef.current = resumeData;

  useEffect(() => {
    let cancelled = false;
    let loadingTask: ReturnType<(typeof import('pdfjs-dist'))['getDocument']> | null =
      null;
    let loadedPdf: PDFDocumentProxy | null = null;

    setError('');

    void (async () => {
      try {
        const pdfjs = await import('pdfjs-dist');
        pdfjs.GlobalWorkerOptions.workerSrc = new URL(
          'pdfjs-dist/build/pdf.worker.min.mjs',
          import.meta.url,
        ).toString();
        const data = new Uint8Array(await (await fetch(url)).arrayBuffer());
        if (cancelled) return;
        loadingTask = pdfjs.getDocument({ data });
        loadedPdf = await loadingTask.promise;
        if (cancelled) return;
        const descriptors = await describePdfPages(
          loadedPdf,
          documentType,
          resumeDataRef.current,
        );
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

  useEffect(() => {
    if (!pdf) return;
    let cancelled = false;
    void describePdfPages(pdf, documentType, resumeData).then((descriptors) => {
      if (!cancelled) {
        setPages(descriptors);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [resumeData, documentType, pdf]);

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
      className='h-full w-full overflow-y-auto overflow-x-hidden '
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
            activeItemIndex={activeItemIndex}
            onSectionSelect={onSectionSelect}
          />
        ))}
      </div>
    </div>
  );
}
