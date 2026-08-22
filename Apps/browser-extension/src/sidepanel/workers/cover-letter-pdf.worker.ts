/** @format */

import { renderCoverLetterPdfOnce } from '@jobby/ui/components/UI/Resume/cover-letter-pdf-document';
import type { MasterResumeData } from '@jobby/ui/components/UI/Resume/types';

type RenderRequest = {
  coverLetter: string;
  candidateData?: MasterResumeData;
  company?: string;
  jobTitle?: string;
};

type RenderResponse =
  | { ok: true; buffer: ArrayBuffer; pages: number }
  | { ok: false; error: string };

const workerScope = self as unknown as {
  onmessage: ((event: MessageEvent<RenderRequest>) => void) | null;
  postMessage: (message: RenderResponse, transfer?: Transferable[]) => void;
};

workerScope.onmessage = (event) => {
  void (async () => {
    try {
      const { coverLetter, candidateData, company, jobTitle } = event.data;
      const { blob, pages } = await renderCoverLetterPdfOnce(
        coverLetter,
        candidateData,
        company,
        jobTitle,
      );
      const buffer = await blob.arrayBuffer();
      workerScope.postMessage({ ok: true, buffer, pages }, [buffer]);
    } catch (error) {
      workerScope.postMessage({
        ok: false,
        error:
          error instanceof Error ?
            error.message
          : 'Could not generate the cover letter PDF.',
      });
    }
  })();
};
