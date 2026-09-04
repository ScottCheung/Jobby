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

  it('preserves public export contracts for form-inspector and form-driver', () => {
    expect(typeof inspectVisibleFormFields).toBe('function');
    expect(typeof findFormElement).toBe('function');
    expect(typeof fillFormField).toBe('function');
  });
});
