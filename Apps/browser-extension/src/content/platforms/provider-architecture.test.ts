// @vitest-environment happy-dom

import { describe, expect, it } from 'vitest';

import {
  atsJobPlatforms,
  dedicatedPlatforms,
} from '../../shared/contracts/platform';
import {
  getProviderDefinition,
  providerDefinitions,
} from './registry';
import {
  isAtsJobConfig,
  isDedicatedJobReader,
} from './platform-definition';
import { fillFormField, findFormElement } from '../dom/form-driver';
import { inspectVisibleFormFields } from '../dom/form-inspector';

describe('Provider Strategy & Plugin Architecture', () => {
  it('declares valid detection and platform identifier for every provider', () => {
    expect(providerDefinitions.length).toBe(dedicatedPlatforms.length);

    for (const provider of providerDefinitions) {
      expect(provider.platform).toBeDefined();
      expect(provider.detection).toBeDefined();
      expect(provider.detection.host).toBeInstanceOf(RegExp);
    }
  });

  it('declares dedicated job readers with readiness strategies for board platforms', () => {
    const seek = getProviderDefinition('seek');
    expect(isDedicatedJobReader(seek.job)).toBe(true);
    if (isDedicatedJobReader(seek.job)) {
      expect(typeof seek.job.read).toBe('function');
      expect(seek.job.readiness).toBeDefined();
      expect(typeof seek.job.readiness?.readinessWaitUntilAttempt).toBe('function');
    }

    const indeed = getProviderDefinition('indeed');
    expect(isDedicatedJobReader(indeed.job)).toBe(true);
    if (isDedicatedJobReader(indeed.job)) {
      expect(typeof indeed.job.read).toBe('function');
      expect(indeed.job.readiness).toBeDefined();
      expect(typeof indeed.job.readiness?.readWhenReady).toBe('function');
    }

    const linkedin = getProviderDefinition('linkedin');
    expect(isDedicatedJobReader(linkedin.job)).toBe(true);
    if (isDedicatedJobReader(linkedin.job)) {
      expect(typeof linkedin.job.read).toBe('function');
      expect(linkedin.job.readiness).toBeDefined();
      expect(typeof linkedin.job.readiness?.readWhenReady).toBe('function');
    }
  });

  it('declares ATS job configurations with valid selector arrays for all ATS providers', () => {
    for (const platform of atsJobPlatforms) {
      const provider = getProviderDefinition(platform);
      expect(isAtsJobConfig(provider.job)).toBe(true);
      if (isAtsJobConfig(provider.job)) {
        expect(provider.job.roots.length).toBeGreaterThan(0);
        expect(provider.job.title.length).toBeGreaterThan(0);
        expect(provider.job.description.length).toBeGreaterThan(0);
      }
    }
  });

  it('declares dedicated form readers for platforms with custom form architectures', () => {
    const seek = getProviderDefinition('seek');
    expect(seek.form).toBeDefined();
    expect(typeof seek.form?.read).toBe('function');
    expect(typeof seek.form?.scope).toBe('function');

    const linkedin = getProviderDefinition('linkedin');
    expect(linkedin.form).toBeDefined();
    expect(typeof linkedin.form?.read).toBe('function');
    expect(typeof linkedin.form?.scope).toBe('function');
  });

  it('declares driver capability overrides for Ashby choice-groups', async () => {
    const ashby = getProviderDefinition('ashby');
    expect(ashby.driver).toBeDefined();
    expect(typeof ashby.driver?.fillField).toBe('function');
    expect(typeof ashby.driver?.focusField).toBe('function');

    // Test Ashby driver override with a simulated container
    document.body.innerHTML = `
      <div class="ashby-application-form-field-entry">
        <label class="ashby-application-form-question-title">Work Authorization</label>
        <div class="ashby-application-form-input-radio-group">
          <label><input type="radio" name="auth" value="yes" /> Yes</label>
          <label><input type="radio" name="auth" value="no" /> No</label>
        </div>
      </div>
    `;

    const res = await ashby.driver!.fillField!(
      {
        type: 'content.fill-field',
        commandId: 'test-ashby-driver',
        source: 'backend',
        target: {
          key: 'auth-key',
          type: 'radio',
          label: 'Work Authorization',
        },
        value: 'yes',
      },
      document,
    );

    expect(res).toBeDefined();
    expect(res?.status).toBe('filled');
    const radio = document.querySelector<HTMLInputElement>("input[value='yes']");
    expect(radio?.checked).toBe(true);
  });

  it('declares driver capability overrides for Greenhouse combobox commit check', () => {
    const greenhouse = getProviderDefinition('greenhouse');
    expect(greenhouse.driver).toBeDefined();
    expect(typeof greenhouse.driver?.isComboboxCommitted).toBe('function');

    document.body.innerHTML = `
      <div id="grnhse_app">
        <input id="loc" role="combobox" />
        <input type="hidden" id="job_application_location_id" value="" />
      </div>
    `;
    const locInput = document.getElementById('loc') as HTMLInputElement;
    const hiddenId = document.getElementById('job_application_location_id') as HTMLInputElement;

    expect(greenhouse.driver!.isComboboxCommitted!(locInput, document)).toBe(false);

    hiddenId.value = '12345';
    expect(greenhouse.driver!.isComboboxCommitted!(locInput, document)).toBe(true);
  });

  it('declares structured autofill and autofill policies on expected providers', () => {
    const workday = getProviderDefinition('workday');
    expect(workday.structuredAutofill?.enabled).toBe(true);
    expect(workday.structuredAutofill?.summaryFeature).toBe('workday-structured-summary');

    const ashby = getProviderDefinition('ashby');
    expect(ashby.autofill).toBeDefined();
    expect(ashby.autofill?.mode).toBe('sequential');
  });

  it('declares pageObserver, jobSelection, and applicationNavigation capabilities', () => {
    const seek = getProviderDefinition('seek');
    expect(seek.pageObserver).toBeDefined();
    expect(typeof seek.pageObserver?.observe).toBe('function');
    expect(seek.jobSelection).toBeDefined();
    expect(typeof seek.jobSelection?.autoSelectFirstJob).toBe('function');
    expect(seek.applicationNavigation).toBeDefined();
    expect(typeof seek.applicationNavigation?.clickAction).toBe('function');

    const indeed = getProviderDefinition('indeed');
    expect(indeed.pageObserver).toBeDefined();
    expect(typeof indeed.pageObserver?.observe).toBe('function');
    expect(indeed.jobSelection).toBeDefined();
    expect(typeof indeed.jobSelection?.autoSelectFirstJob).toBe('function');

    const linkedin = getProviderDefinition('linkedin');
    expect(linkedin.jobSelection).toBeDefined();
    expect(typeof linkedin.jobSelection?.autoSelectFirstJob).toBe('function');
    expect(linkedin.applicationNavigation).toBeDefined();
    expect(typeof linkedin.applicationNavigation?.clickAction).toBe('function');

    const boards = ['glassdoor', 'jora', 'ziprecruiter', 'adzuna', 'wellfound', 'dice', 'simplyhired'] as const;
    for (const board of boards) {
      const def = getProviderDefinition(board);
      expect(def.jobSelection, `Expected ${board} to have jobSelection`).toBeDefined();
      expect(typeof def.jobSelection?.findFirstJobCard).toBe('function');
    }
  });

  it('SEEK URL classification strictly adheres to positive listing routes and rejects non-listing routes', () => {
    const seek = getProviderDefinition('seek');
    const isListing = seek.jobSelection!.isListingPage!;

    // Expected listing pages
    expect(isListing('https://www.seek.com.au/software-engineer-jobs')).toBe(true);
    expect(isListing('https://www.seek.com.au/software-engineer-jobs/in-All-Sydney-NSW')).toBe(true);
    expect(isListing('https://www.seek.com.au/jobs?keywords=Developer')).toBe(true);
    expect(isListing('https://www.seek.com.au/jobs/in-Melbourne-VIC')).toBe(true);
    expect(isListing('https://www.seek.com.au/jobs-in-information-communication-technology')).toBe(true);

    // Expected NOT listing pages
    expect(isListing('https://www.seek.com.au/job/93941097')).toBe(false);
    expect(isListing('https://www.seek.com.au/job/78912345/apply')).toBe(false);
    expect(isListing('https://www.seek.com.au/apply/78912345')).toBe(false);
    expect(isListing('https://www.seek.com.au/profile')).toBe(false);
    expect(isListing('https://www.seek.com.au/saved-jobs')).toBe(false);
    expect(isListing('https://www.seek.com.au/applied-jobs')).toBe(false);
    expect(isListing('https://www.seek.com.au/login')).toBe(false);
    expect(isListing('https://www.seek.com.au/account')).toBe(false);
    expect(isListing('https://www.seek.com.au/settings')).toBe(false);
    expect(isListing('https://www.seek.com.au/')).toBe(false);

    // Unknown routes default to false without DOM evidence
    expect(isListing('https://www.seek.com.au/unknown-path-123')).toBe(false);

    // Unknown routes return true WITH reliable DOM evidence
    const docWithCard = document.createElement('div');
    docWithCard.innerHTML = '<article data-automation="normalJob">Job</article>';
    expect(isListing('https://www.seek.com.au/unknown-path-123', docWithCard)).toBe(true);
  });

  it('bootstrap.ts does not directly import concrete platforms', async () => {
    const { default: content } = await import('../bootstrap.ts?raw');

    expect(content).not.toMatch(/from\s+['"].*\/platforms\/seek\//);
    expect(content).not.toMatch(/from\s+['"].*\/platforms\/indeed\//);
    expect(content).not.toMatch(/from\s+['"].*\/platforms\/linkedin\//);
    expect(content).not.toMatch(/observeSeekJobDom/);
    expect(content).not.toMatch(/observeIndeedJobDom/);
  });

  it('keeps background orchestration independent of concrete provider modules', () => {
    const sources = import.meta.glob('../../background/**/*.ts', {
      eager: true,
      query: '?raw',
      import: 'default',
    }) as Record<string, string>;

    const providerNames = [...providerDefinitions.map(({ platform }) => platform), 'jobadder'].join('|');
    const providerImport = new RegExp(
      `from\\s+['"][^'"]*platforms\\/(?:${providerNames})\\/`,
    );
    for (const [path, source] of Object.entries(sources)) {
      if (path.endsWith('.test.ts')) continue;
      expect(source, path).not.toMatch(providerImport);
    }
  });

  it('keeps shared page and form modules free of concrete provider dependencies', async () => {
    const pageReader = await import('../page-reader.ts?raw');
    const formDriver = await import('../dom/form-driver.ts?raw');
    const formDriverSources = import.meta.glob('../dom/form-driver/**/*.ts', {
      eager: true,
      query: '?raw',
      import: 'default',
    }) as Record<string, string>;
    const inspector = await import('../dom/form-inspector.ts?raw');
    const inspectorSources = import.meta.glob('../dom/form-inspector/**/*.ts', {
      eager: true,
      query: '?raw',
      import: 'default',
    }) as Record<string, string>;
    const sources = [
      pageReader.default,
      formDriver.default,
      inspector.default,
      ...Object.values(formDriverSources),
      ...Object.values(inspectorSources),
    ];

    const providerNames = [...providerDefinitions.map(({ platform }) => platform), 'jobadder'].join('|');
    const providerImport = new RegExp(
      `from\\s+['"][^'"]*platforms\\/(?:${providerNames})\\/`,
    );
    const providerBranch = new RegExp(`\\b(?:${providerNames})\\b`, 'i');

    expect(pageReader.default).not.toMatch(/linkedin\/api-client|LinkedInJobApiData/);
    expect(formDriver.default).toMatch(/activeProviderDriver/);
    expect(formDriver.default).not.toMatch(/providerDefinitions/);
    for (const source of sources) {
      expect(source).not.toMatch(providerImport);
      expect(source).not.toMatch(providerBranch);
    }
  });

  it('job selection is isolated so platform cards are only selected by their own providers', () => {
    const seek = getProviderDefinition('seek');
    const indeed = getProviderDefinition('indeed');
    const linkedin = getProviderDefinition('linkedin');

    const container = document.createElement('div');
    container.innerHTML = `
      <article data-automation="normalJob" id="seek-card">SEEK</article>
      <div class="job_seen_beacon" id="indeed-card">Indeed</div>
      <div class="job-card-container" id="linkedin-card">LinkedIn</div>
    `;

    // SEEK card finder only finds SEEK card
    expect(seek.jobSelection!.findFirstJobCard!(container)?.id).toBe('seek-card');

    // Indeed card finder only finds Indeed card
    expect(indeed.jobSelection!.findFirstJobCard!(container)?.id).toBe('indeed-card');

    // LinkedIn card finder only finds LinkedIn card
    expect(linkedin.jobSelection!.findFirstJobCard!(container)?.id).toBe('linkedin-card');
  });

  it('authentication safety invariant: inspection and status checks never trigger interactive login UI', async () => {
    let launchWebAuthFlowCalls = 0;
    const originalChrome = globalThis.chrome;
    (globalThis as any).chrome = {
      ...originalChrome,
      identity: {
        launchWebAuthFlow: () => {
          launchWebAuthFlowCalls += 1;
          return Promise.resolve('');
        },
        getRedirectURL: () => 'https://mock.redirect',
      },
      storage: {
        local: {
          get: () => Promise.resolve({}),
          set: () => Promise.resolve(),
          remove: () => Promise.resolve(),
        },
      },
    };

    try {
      const { getAuthStatus } = await import('../../background/auth-service');
      const status = await getAuthStatus();
      expect(status.connected).toBe(false);
      expect(launchWebAuthFlowCalls).toBe(0);
    } finally {
      (globalThis as any).chrome = originalChrome;
    }
  });

  it('preserves public export contracts for form-inspector and form-driver', () => {
    expect(typeof inspectVisibleFormFields).toBe('function');
    expect(typeof findFormElement).toBe('function');
    expect(typeof fillFormField).toBe('function');
  });
});
