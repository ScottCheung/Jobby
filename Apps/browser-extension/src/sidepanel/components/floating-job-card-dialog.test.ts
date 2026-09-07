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
    isCheckingAuth: false,
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

    expect(postedMessages).toContainEqual(
      expect.objectContaining({
        source: 'jobby-dialog',
        type: 'jobby.dialog-close',
      }),
    );
    expect(container!.querySelector('[data-testid="job-score-card"]')).toBeNull();
  });

  it('aligns the loading bubble with a bottom-positioned ball', () => {
    window.history.replaceState(
      null,
      '',
      '?floatingDialog=true&edge=right&pos=bottom',
    );

    const root = createRoot(container!);
    flushSync(() => {
      root.render(createElement(FloatingJobCardDialog));
    });

    expect(container!.querySelector('.items-end')).not.toBeNull();
    expect(document.documentElement.classList).toContain('is-floating-dialog');
    expect(document.body.classList).toContain('is-floating-dialog');
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

    await new Promise((r) => setTimeout(r, 650));

    expect(postedMessages).toContainEqual(
      expect.objectContaining({
        source: 'jobby-dialog',
        type: 'jobby.dialog-resize',
        mode: 'expanded',
      }),
    );
    expect(container!.querySelector('[data-testid="job-score-card"]')).not.toBeNull();
  });

  it('keeps compact loading state and does not open card while score is still evaluating on a job page', async () => {
    mockLatestInspection = {
      kind: 'job',
      snapshot: {
        platform: 'linkedin',
        externalId: '4463198532',
        url: 'https://www.linkedin.com/jobs/view/4463198532',
        title: 'Software Engineer',
        company: 'TheDriveGroup',
      },
    };
    mockIsInspectingPage = false;
    // Score has not finished loading
    mockEvaluation = null;

    const root = createRoot(container!);
    flushSync(() => {
      root.render(createElement(FloatingJobCardDialog));
    });

    // Wait past the min loading delay
    await new Promise((r) => setTimeout(r, 500));

    // Must NOT have sent expanded resize
    expect(postedMessages).not.toContainEqual(
      expect.objectContaining({
        type: 'jobby.dialog-resize',
        mode: 'expanded',
      }),
    );
    // Card should NOT be rendered
    expect(container!.querySelector('[data-testid="job-score-card"]')).toBeNull();

    // Loading bubble with colorful AI glow should be rendered
    expect(container!.querySelector('.jobby-ai-glow-container')).not.toBeNull();
    expect(container!.querySelector('.jobby-ai-glow-halo')).not.toBeNull();
    expect(container!.querySelector('.jobby-ai-glow-border')).not.toBeNull();
  });
});

