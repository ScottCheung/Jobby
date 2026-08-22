/** @format */

type DocumentPictureInPictureApi = {
  requestWindow: (options: { width: number; height: number }) => Promise<Window>;
};

export type FloatingResumePreview = {
  setPdf: (blob: Blob, filename: string) => void;
  showError: (message: string) => void;
};

export type StandaloneResumePreview = {
  setPdf: (blob: Blob, filename: string) => Promise<void>;
  showError: (message: string) => void;
};

const WINDOW_WIDTH = 900;
const WINDOW_HEIGHT = 760;
let activePictureInPictureWindow: Window | null = null;
let activeStandaloneWindow: Window | null = null;
let activeStandalonePreviewKey: string | null = null;

function getDocumentPictureInPicture(): DocumentPictureInPictureApi | null {
  return (
    window as Window & {
      documentPictureInPicture?: DocumentPictureInPictureApi;
    }
  ).documentPictureInPicture ?? null;
}

export async function openFloatingResumePreview(): Promise<FloatingResumePreview> {
  closeFloatingResumePreview();
  const api = getDocumentPictureInPicture();
  if (!api) throw new Error('Document Picture-in-Picture is unavailable.');

  // This must be the first awaited action after the user's click.
  const previewWindow = await api.requestWindow({
    width: WINDOW_WIDTH,
    height: WINDOW_HEIGHT,
  });
  activePictureInPictureWindow = previewWindow;
  const previewDocument = previewWindow.document;
  let pdfUrl: string | null = null;

  previewDocument.title = 'Jobby Resume Preview';
  previewDocument.head.innerHTML = `
    <style>
      :root { color-scheme: light; font-family: Inter, ui-sans-serif, system-ui, sans-serif; }
      * { box-sizing: border-box; }
      body { margin: 0; min-height: 100vh; background: #e2e8f0; color: #0f172a; }
      .preview { display: flex; min-height: 100vh; flex-direction: column; }
      header { display: flex; align-items: center; justify-content: space-between; gap: 12px; min-height: 58px; padding: 10px 16px; background: #fff; border-bottom: 1px solid #e2e8f0; }
      h1 { overflow: hidden; margin: 0; font-size: 13px; font-weight: 700; text-overflow: ellipsis; white-space: nowrap; }
      p { margin: 3px 0 0; color: #0f766e; font-size: 11px; font-weight: 700; }
      a { border-radius: 8px; padding: 8px 11px; background: #0f766e; color: #fff; font-size: 12px; font-weight: 700; text-decoration: none; white-space: nowrap; }
      main { display: grid; flex: 1; min-height: 0; place-items: center; }
      iframe { width: 100%; height: 100%; border: 0; background: #fff; }
      .status { padding: 24px; color: #475569; font-size: 13px; font-weight: 600; text-align: center; }
      .error { color: #b91c1c; }
    </style>
  `;

  const root = previewDocument.createElement('div');
  root.className = 'preview';
  const header = previewDocument.createElement('header');
  const title = previewDocument.createElement('div');
  const heading = previewDocument.createElement('h1');
  heading.textContent = 'Preparing tailored resume…';
  const detail = previewDocument.createElement('p');
  detail.textContent = 'Always on top';
  title.append(heading, detail);
  const download = previewDocument.createElement('a');
  download.textContent = 'Download PDF';
  download.hidden = true;
  header.append(title, download);
  const body = previewDocument.createElement('main');
  const status = previewDocument.createElement('div');
  status.className = 'status';
  status.textContent = 'Generating your PDF preview…';
  body.append(status);
  root.append(header, body);
  previewDocument.body.replaceChildren(root);

  previewWindow.addEventListener(
    'pagehide',
    () => {
      if (pdfUrl) URL.revokeObjectURL(pdfUrl);
      if (activePictureInPictureWindow === previewWindow) {
        activePictureInPictureWindow = null;
      }
    },
    { once: true },
  );

  return {
    setPdf(blob, filename) {
      if (previewWindow.closed) return;
      pdfUrl = URL.createObjectURL(blob);
      heading.textContent = filename;
      download.href = pdfUrl;
      download.download = filename;
      download.hidden = false;
      const frame = previewDocument.createElement('iframe');
      frame.title = 'Resume PDF preview';
      frame.src = pdfUrl;
      body.replaceChildren(frame);
    },
    showError(message) {
      if (previewWindow.closed) return;
      status.className = 'status error';
      status.textContent = message;
      body.replaceChildren(status);
    },
  };
}

async function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

export function openStandaloneResumePreview(
  editUrl?: string,
): StandaloneResumePreview {
  closeFloatingResumePreview();
  const previewId = crypto.randomUUID();
  const previewKey = `jobby.resume-preview.${previewId}`;
  const previewWindow = window.open(
    chrome.runtime.getURL(
      `src/sidepanel/index.html?resumePreview=${encodeURIComponent(previewId)}`,
    ),
    'jobby-resume-preview',
    `popup=yes,width=${WINDOW_WIDTH},height=${WINDOW_HEIGHT}`,
  );
  if (!previewWindow) {
    throw new Error('Your browser blocked the standalone preview window.');
  }
  activeStandaloneWindow = previewWindow;
  activeStandalonePreviewKey = previewKey;
  previewWindow.addEventListener('beforeunload', () => {
    if (activeStandaloneWindow === previewWindow) {
      activeStandaloneWindow = null;
      activeStandalonePreviewKey = null;
    }
    void chrome.storage.session.remove(previewKey);
  });

  return {
    async setPdf(blob, filename) {
      await chrome.storage.session.set({
        [previewKey]: {
          filename,
          pdfDataUrl: await blobToDataUrl(blob),
          editUrl,
        },
      });
    },
    showError(message) {
      if (!previewWindow.closed) {
        previewWindow.document.body.textContent = message;
      }
    },
  };
}

export function closeFloatingResumePreview(): void {
  if (activePictureInPictureWindow && !activePictureInPictureWindow.closed) {
    activePictureInPictureWindow.close();
  }
  activePictureInPictureWindow = null;

  if (activeStandaloneWindow && !activeStandaloneWindow.closed) {
    activeStandaloneWindow.close();
  }
  activeStandaloneWindow = null;
  if (activeStandalonePreviewKey) {
    void chrome.storage.session.remove(activeStandalonePreviewKey);
    activeStandalonePreviewKey = null;
  }
}
