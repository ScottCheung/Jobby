// @vitest-environment happy-dom
/** @format */

import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';

// Mocks
vi.mock('../hooks/useAuth', () => ({
  useAuth: () => ({
    authStatus: { connected: true },
    refreshAuth: vi.fn(),
    signIn: vi.fn(),
  }),
}));

vi.mock('../hooks/useThemeSync', () => ({
  useThemeSync: vi.fn(),
}));

let mockLatestInspection: any = null;
let mockIsInspectingPage = false;
let mockInspectionError = '';
let mockEvaluation: any = null;

vi.mock('../hooks/useInspection', () => ({
  useInspection: () => ({
    latestInspection: mockLatestInspection,
    setLatestInspection: vi.fn((cb) => {
      mockLatestInspection = typeof cb === 'function' ? cb(mockLatestInspection) : cb;
    }),
    inspectionError: mockInspectionError,
    isInspectingPage: mockIsInspectingPage,
    inspectPage: vi.fn(),
    autoInspectActivePage: vi.fn().mockResolvedValue(false),
    inspectForm: vi.fn(),
    highlightJobRequirement: vi.fn(),
  }),
}));

vi.mock('../hooks/useJobMatch', () => ({
  useJobMatch: () => ({
    evaluation: mockEvaluation,
    error: null,
    isEvaluating: false,
    activeProfile: null,
    profileSkills: [],
    claimSkill: vi.fn(),
    unclaimSkill: vi.fn(),
    retry: vi.fn(),
  }),
}));

vi.mock('../hooks/useTailoredResumeStudio', () => ({
  useTailoredResumeStudio: () => ({
    generationTasks: [],
    jobTitle: '',
    company: '',
    jobDescription: '',
    detectedJob: null,
  }),
}));

vi.mock('@jobby/ui/components/UI/toast/toaster', () => ({
  Toaster: () => null,
}));

vi.mock('@jobby/ui/components/UI/job-analysis', () => ({
  JobAnalysisPanel: () =>
    createElement(
      'div',
      { 'data-testid': 'job-score-card' },
      'JobAnalysisPanel',
    ),
}));

import { FloatingJobCardDialog } from './FloatingJobCardDialog';

describe('FloatingJobCardDialog', () => {
  let postedMessages: any[] = [];
  let container: HTMLDivElement | null = null;

  beforeEach(() => {
    postedMessages = [];
    mockLatestInspection = null;
    mockIsInspectingPage = false;
    mockInspectionError = '';
    mockEvaluation = null;
    container = document.createElement('div');
    document.body.appendChild(container);

    window.parent.postMessage = vi.fn((message) => {
      postedMessages.push(message);
    });

    (globalThis as any).chrome = {
      runtime: {
        getURL: (path: string) => `chrome-extension://test-ext-id/${path}`,
        sendMessage: vi.fn(),
        onMessage: {
          addListener: vi.fn(),
          removeListener: vi.fn(),
        },
      },
      tabs: {
        onActivated: { addListener: vi.fn(), removeListener: vi.fn() },
        onUpdated: { addListener: vi.fn(), removeListener: vi.fn() },
      },
    };
  });

  afterEach(() => {
    if (container) {
      container.remove();
      container = null;
    }
    vi.clearAllMocks();
  });

  it('sends jobby.dialog-close and does not render score card when page is not a job', async () => {
    mockLatestInspection = { kind: 'generic_page' };
    mockIsInspectingPage = false;

    const root = createRoot(container!);
    flushSync(() => {
      root.render(createElement(FloatingJobCardDialog));
    });

    await new Promise((r) => setTimeout(r, 10));

    expect(postedMessages).toContainEqual({
      source: 'jobby-dialog',
      type: 'jobby.dialog-close',
    });
    expect(container!.querySelector('[data-testid="job-score-card"]')).toBeNull();
  });

  it('renders JobScoreCard and resizes to expanded when on a valid job page with evaluated match', async () => {
    mockLatestInspection = {
      kind: 'job',
      snapshot: {
        platform: 'seek',
        externalId: '123',
        url: 'https://seek.com.au/job/123',
        title: 'Software Engineer',
        company: 'Canva',
      },
    };
    mockIsInspectingPage = false;
    mockEvaluation = { score: 0.85 };

    const root = createRoot(container!);
    flushSync(() => {
      root.render(createElement(FloatingJobCardDialog));
    });

    await new Promise((r) => setTimeout(r, 10));

    expect(postedMessages).toContainEqual({
      source: 'jobby-dialog',
      type: 'jobby.dialog-resize',
      mode: 'expanded',
    });
    expect(container!.querySelector('[data-testid="job-score-card"]')).not.toBeNull();
  });
});
