// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest';

import { fillFormField } from './form-driver';
import { inspectVisibleFormFields, labelFor } from './form-inspector';

function visibleRect(): DOMRect {
  return { x: 0, y: 0, width: 240, height: 40, top: 0, right: 240, bottom: 40, left: 0, toJSON: () => ({}) } as DOMRect;
}

describe('form inspector labels', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    Object.defineProperty(HTMLElement.prototype, 'offsetWidth', { configurable: true, get: () => 240 });
    Object.defineProperty(HTMLElement.prototype, 'offsetHeight', { configurable: true, get: () => 40 });
    HTMLElement.prototype.getBoundingClientRect = visibleRect;
  });

  it('removes live validation copy from an explicit label', () => {
    document.body.innerHTML = `
      <label for="first-name">First name <span aria-live="polite">This field is required</span></label>
      <input id="first-name" />
    `;
    const input = document.querySelector<HTMLInputElement>('input');
    expect(input && labelFor(input, document)).toBe('First name');
  });

  it('uses a question rather than preceding helper copy for a select', () => {
    document.body.innerHTML = `
      <div class="form-field">
        <p>Please select the answer that best describes you.</p>
        <span class="question">Do you require visa sponsorship?</span>
        <select id="sponsorship"><option value="">Choose</option><option>Yes</option></select>
      </div>
    `;
    expect(inspectVisibleFormFields(document)).toEqual(expect.arrayContaining([
      expect.objectContaining({ label: 'Do you require visa sponsorship?' }),
    ]));
  });
  it('detects hidden file input with custom upload trigger button', () => {
    document.body.innerHTML = `
      <div class="resume-upload-section">
        <button type="button" class="btn btn-primary">Upload your resume</button>
        <input type="file" id="resume-file" style="display:none" accept=".pdf,.doc,.docx" />
      </div>
    `;
    const fields = inspectVisibleFormFields(document);
    expect(fields).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: 'file', label: 'Resume' }),
    ]));
  });

  it('detects cover note file input with proper label', () => {
    document.body.innerHTML = `
      <div class="form-group">
        <label>Cover note</label>
        <div class="file-wrapper">
          <input type="file" id="cover-file" />
        </div>
      </div>
    `;
    const fields = inspectVisibleFormFields(document);
    expect(fields).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: 'file', label: 'Cover Letter' }),
    ]));
  });

  it('ignores dropdown search filter inputs such as iti__search-input', () => {
    document.body.innerHTML = `
      <label for="first-name">First name</label>
      <input id="first-name" />
      <div class="iti__dropdown-content">
        <input class="iti__search-input" placeholder="Search country" />
      </div>
    `;
    const fields = inspectVisibleFormFields(document);
    expect(fields).toHaveLength(1);
    expect(fields[0]?.label).toBe('First name');
  });

  it('ignores unlabelled alternate apply and autofill controls', () => {
    document.body.innerHTML = `
      <label for="email">Email</label><input id="email" type="email" />
      <input id="ApplyLaterEmail" name="ApplyLaterEmail" type="email" />
      <input id="autofill-profile" name="autofill_profile" type="text" />
    `;

    expect(inspectVisibleFormFields(document)).toEqual([
      expect.objectContaining({ id: 'email', label: 'Email' }),
    ]);
  });

  it('suppresses a control whose only semantic label is an auxiliary action', () => {
    document.body.innerHTML = `
      <label for="candidate-email">Email</label><input id="candidate-email" type="email" />
      <input id="temporary-control" aria-label="Autofill" />
    `;

    expect(inspectVisibleFormFields(document)).toEqual([
      expect.objectContaining({ id: 'candidate-email', label: 'Email' }),
    ]);
  });

  it('recognises JobAdder phone fields and ignores Select2 implementation inputs', () => {
    document.body.innerHTML = `
      <form>
        <div class="form-field two-cols">
          <div class="col"><label for="CandidateFirstName">First name</label><input id="CandidateFirstName" /></div>
          <div class="col"><label for="CandidateLastName">Last name</label><input id="CandidateLastName" /></div>
        </div>
        <div class="form-field">
          <label for="CandidatePhone">Phone</label>
          <div class="form-field"><div class="phone-number"><div class="flex-row">
            <div class="select2-container country-list">
              <input class="select2-focusser select2-offscreen" id="s2id_autogen2" role="button" />
              <div class="select2-search"><input class="select2-input" id="s2id_autogen2_search" role="combobox" /></div>
            </div>
            <input class="country-list" style="display:none" />
            <input id="CandidatePhone_FormattedNumber" name="CandidatePhone.FormattedNumber" data-val-phone="true" />
            <input id="CandidatePhone_CountryCode" name="CandidatePhone.CountryCode" type="hidden" />
          </div></div></div>
          <ul class="phone-number-country-list" style="display:none">
            <li>{ "id": "AU", "text": "Australia (+61)"}</li>
            <li>{ "id": "NZ", "text": "New Zealand (+64)"}</li>
          </ul>
        </div>
        <div class="form-field"><div class="phone-number"><div class="flex-row">
          <div class="select2-container country-list"><input class="select2-focusser select2-offscreen" id="s2id_autogen4" role="button" /></div>
          <input class="country-list" style="display:none" />
          <input id="CandidateMobile_FormattedNumber" name="CandidateMobile.FormattedNumber" data-val-phone="true" required />
          <input id="CandidateMobile_CountryCode" name="CandidateMobile.CountryCode" type="hidden" />
        </div></div></div>
      </form>
    `;

    const fields = inspectVisibleFormFields(document);
    expect(fields).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'CandidatePhone_FormattedNumber', label: 'Phone', type: 'tel' }),
      expect.objectContaining({ id: 'CandidateMobile_FormattedNumber', label: 'Mobile', type: 'tel', required: true }),
      expect.objectContaining({ id: 'CandidatePhone_CountryCode', label: 'Phone country code', type: 'select' }),
      expect.objectContaining({ id: 'CandidateMobile_CountryCode', label: 'Mobile country code', type: 'select', required: true }),
    ]));
    expect(fields.some((field) => field.id?.startsWith('s2id_autogen'))).toBe(false);
  });

  it('fills a JobAdder formatted phone number through its semantic target', async () => {
    document.body.innerHTML = `
      <form><div class="form-field"><div class="phone-number"><div class="flex-row">
        <input id="CandidateMobile_FormattedNumber" name="CandidateMobile.FormattedNumber" data-val-phone="true" required />
      </div></div></div></form>
    `;

    const result = await fillFormField({
      type: 'content.fill-field',
      commandId: 'jobadder-mobile',
      source: 'backend',
      target: {
        key: 'CandidateMobile_FormattedNumber',
        id: 'CandidateMobile_FormattedNumber',
        name: 'CandidateMobile.FormattedNumber',
        type: 'tel',
        label: 'Mobile',
      },
      value: '0434344292',
    });

    expect(result.status).toBe('filled');
    expect(document.querySelector<HTMLInputElement>('#CandidateMobile_FormattedNumber')?.value).toBe('0434344292');
  });

  it('fills the JobAdder phone country before its number', async () => {
    document.body.innerHTML = `
      <form><div class="form-field"><ul class="phone-number-country-list" style="display:none">
        <li>{ "id": "AU", "text": "Australia (+61)"}</li>
      </ul><div class="phone-number"><div class="flex-row">
        <input class="country-list" style="display:none" />
        <input id="CandidateMobile_FormattedNumber" name="CandidateMobile.FormattedNumber" data-val-phone="true" />
        <input id="CandidateMobile_CountryCode" name="CandidateMobile.CountryCode" type="hidden" />
      </div></div></div></form>
    `;

    const result = await fillFormField({
      type: 'content.fill-field',
      commandId: 'jobadder-mobile-country',
      source: 'backend',
      target: {
        key: 'CandidateMobile_CountryCode',
        id: 'CandidateMobile_CountryCode',
        name: 'CandidateMobile.CountryCode',
        type: 'select',
        label: 'Mobile country code',
      },
      value: 'AU',
    });

    expect(result.status).toBe('filled');
    expect(document.querySelector<HTMLInputElement>('#CandidateMobile_CountryCode')?.value).toBe('AU');
    expect(document.querySelector<HTMLInputElement>('input.country-list')?.value).toBe('AU');
  });
});
