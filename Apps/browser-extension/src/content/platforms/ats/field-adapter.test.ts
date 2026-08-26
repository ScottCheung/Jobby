import { describe, expect, it } from 'vitest';

import { adaptAtsFormFields } from './field-adapter';

const unnamedWorkRightsField = {
  key: 'work_authorization',
  name: 'work_authorization',
  type: 'radio' as const,
  label: 'Unnamed field',
  required: true,
  filled: false,
  sensitive: false,
  options: [
    { label: 'Yes', value: 'yes' },
    { label: 'Yes', value: 'yes' },
    { label: 'No', value: 'no' },
  ],
};

describe('ATS field adapter', () => {
  it('repairs an unusable Workday label from a known control identifier', () => {
    expect(adaptAtsFormFields('workday', [unnamedWorkRightsField])[0]).toMatchObject({
      label: 'Work authorization',
      options: [{ label: 'Yes', value: 'yes' }, { label: 'No', value: 'no' }],
    });
  });

  it('does not replace a visible question with an identifier guess', () => {
    const field = { ...unnamedWorkRightsField, label: 'Are you eligible to work in Australia?' };
    expect(adaptAtsFormFields('greenhouse', [field])[0]?.label).toBe(field.label);
  });

  it('leaves unknown sites entirely on the generic path', () => {
    expect(adaptAtsFormFields('generic', [unnamedWorkRightsField])[0]).toBe(unnamedWorkRightsField);
  });
});
