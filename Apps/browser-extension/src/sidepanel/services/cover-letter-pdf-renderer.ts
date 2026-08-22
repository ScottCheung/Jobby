/** @format */

import type { MasterResumeData } from '@jobby/ui/components/UI/Resume/types';

type RenderResponse =
  | { ok: true; buffer: ArrayBuffer; pages: number }
  | { ok: false; error: string };

export function renderCoverLetterPdfInWorker(
  coverLetter: string,
  candidateData?: MasterResumeData,
  company?: string,
  jobTitle?: string,
): Promise<{ blob: Blob; pages: number }> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(
      new URL('../workers/cover-letter-pdf.worker.ts', import.meta.url),
      { type: 'module', name: 'jobby-cover-letter-pdf' },
    );
    const timeoutId = globalThis.setTimeout(() => {
      worker.terminate();
      reject(new Error('Cover letter preview timed out. Please try again.'));
    }, 30_000);

    const finish = () => {
      globalThis.clearTimeout(timeoutId);
      worker.terminate();
    };

    worker.onmessage = (event: MessageEvent<RenderResponse>) => {
      finish();
      if (!event.data.ok) {
        reject(new Error(event.data.error));
        return;
      }
      resolve({
        blob: new Blob([event.data.buffer], { type: 'application/pdf' }),
        pages: event.data.pages,
      });
    };
    worker.onerror = (event) => {
      finish();
      reject(
        new Error(
          event.message || 'Could not generate the cover letter PDF.',
        ),
      );
    };
    worker.onmessageerror = () => {
      finish();
      reject(new Error('Could not read the generated cover letter PDF.'));
    };

    worker.postMessage({ coverLetter, candidateData, company, jobTitle });
  });
}
