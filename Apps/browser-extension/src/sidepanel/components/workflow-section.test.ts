import { describe, expect, it, vi } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { WorkflowSection } from './WorkflowSection';
import type { FormInspection } from '../../shared/contracts/form-inspection';

describe('WorkflowSection component', () => {
  const mockForm: FormInspection = {
    kind: 'application_form',
    platform: 'greenhouse',
    url: 'https://boards.greenhouse.io/test/jobs/123',
    fields: [
      {
        key: 'first_name',
        type: 'text',
        label: 'First Name',
        required: true,
        filled: false,
        sensitive: false,
        options: [],
      },
    ],
  };

  it('renders Autofill Form and Clear All buttons in autofillOnly mode', () => {
    const html = renderToStaticMarkup(
      createElement(WorkflowSection, {
        latestForm: mockForm,
        loadingButton: null,
        isClearingForm: false,
        onAutofill: vi.fn(),
        onCancelAutofill: vi.fn(),
        onClearAll: vi.fn(),
        autofillOnly: true,
      }),
    );

    expect(html).not.toContain('Tailor CV');
    expect(html).not.toContain('Tailor CL');
    expect(html).toContain('Autofill Form');
    expect(html).toContain('Clear All');
  });

  it('shows progress percentage when some fields are filled', () => {
    const partiallyFilledForm: FormInspection = {
      ...mockForm,
      fields: [
        { ...mockForm.fields[0]!, filled: true },
        { ...mockForm.fields[0]!, key: 'last_name', label: 'Last Name', filled: false },
      ],
    };

    const html = renderToStaticMarkup(
      createElement(WorkflowSection, {
        latestForm: partiallyFilledForm,
        loadingButton: null,
        isClearingForm: false,
        onAutofill: vi.fn(),
        onCancelAutofill: vi.fn(),
        onClearAll: vi.fn(),
        autofillOnly: true,
      }),
    );

    expect(html).toContain('Autofill Form 1/2 (50%)');
  });
});
