// @vitest-environment happy-dom

import { describe, expect, it, vi } from 'vitest';
import React, { useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import * as messaging from '../services/messaging';
import { useApplicationTools } from './useApplicationTools';
import type { FormInspection } from '../../shared/contracts/form-inspection';

describe('useApplicationTools hook', () => {
  it('exports useApplicationTools function', () => {
    expect(typeof useApplicationTools).toBe('function');
  });

  it('runs autofillDocuments after form autofill succeeds', async () => {
    const mockForm: FormInspection = {
      kind: 'application_form',
      platform: 'greenhouse',
      url: 'https://boards.greenhouse.io/test/jobs/123',
      fields: [
        {
          key: 'resume_upload',
          type: 'file',
          label: 'Attach Resume',
          required: true,
          filled: false,
          sensitive: false,
          options: [],
        },
      ],
    };

    vi.spyOn(messaging, 'send').mockResolvedValue({
      ok: true,
      fillResults: [],
      form: mockForm,
    } as any);

    const inspectForm = vi.fn().mockResolvedValue(mockForm);
    const applyAutofillResults = vi.fn();
    const reportError = vi.fn();
    const autofillDocuments = vi.fn().mockResolvedValue(undefined);

    let triggerAutofill: (() => Promise<void>) | null = null;

    function TestHarness() {
      const tools = useApplicationTools(
        null,
        mockForm,
        inspectForm,
        reportError,
        applyAutofillResults,
        true,
        undefined,
        autofillDocuments,
      );
      useEffect(() => {
        triggerAutofill = tools.autofillForm;
      }, [tools.autofillForm]);
      return null;
    }

    const container = document.createElement('div');
    const root = createRoot(container);
    root.render(React.createElement(TestHarness));

    await new Promise((r) => setTimeout(r, 50));
    expect(triggerAutofill).toBeDefined();

    await triggerAutofill!();

    expect(applyAutofillResults).toHaveBeenCalled();
    expect(autofillDocuments).toHaveBeenCalledWith(mockForm);
    root.unmount();
  });
});
