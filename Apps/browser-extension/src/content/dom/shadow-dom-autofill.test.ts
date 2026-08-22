// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from "vitest";

import { fillFormField } from "./form-driver";
import { inspectVisibleFormFields } from "./form-inspector";

function visibleRect(): DOMRect {
  return {
    x: 0,
    y: 0,
    width: 240,
    height: 40,
    top: 0,
    right: 240,
    bottom: 40,
    left: 0,
    toJSON: () => ({}),
  } as DOMRect;
}

function renderSmartRecruitersLocation(): HTMLInputElement {
  const pageHost = document.createElement("spl-autocomplete");
  pageHost.setAttribute('data-test', 'location-autocomplete');
  pageHost.setAttribute('data-sr-id', 'location-autocomplete-search');
  pageHost.setAttribute('label', 'City');
  pageHost.setAttribute('required', '');
  pageHost.setAttribute('class', 'ng-pristine ng-invalid');
  const pageRoot = pageHost.attachShadow({ mode: "open" });
  document.body.append(pageHost);

  pageRoot.innerHTML = `
    <div data-sr-id="location-autocomplete-search-root">
      <spl-input id="spl-form-element_9" label="City" required></spl-input>
      <div id="menu-spl-form-element_9" role="listbox"></div>
    </div>
  `;
  const host = pageRoot.querySelector<HTMLElement>("spl-input");
  if (!host) throw new Error("Location component was not rendered");
  const inputRoot = host.attachShadow({ mode: "open" });
  inputRoot.innerHTML = `
    <input
      id="spl-form-element_9"
      type="text"
      role="combobox"
      aria-controls="menu-spl-form-element_9"
      aria-autocomplete="list"
      aria-haspopup="listbox"
      aria-expanded="false"
      aria-required="true"
    />
  `;
  const input = inputRoot.querySelector<HTMLInputElement>("input");
  const listbox = pageRoot.querySelector<HTMLElement>("[role='listbox']");
  if (!input || !listbox) throw new Error("Location controls were not rendered");
  // SmartRecruiters keeps the visible label in the custom element's light
  // DOM. Its actual role=option node lives one shadow root deeper and has no
  // own textContent, so matching only the ARIA node misses the city name.
  const option = document.createElement('spl-select-option');
  option.setAttribute('value', 'AU_NSW_CITY_sydney');
  option.textContent = 'Sydney, New South Wales, Australia';
  const optionRoot = option.attachShadow({ mode: 'open' });
  optionRoot.innerHTML = `<div class="c-spl-dropdown-item" role="option" aria-selected="false"><slot></slot></div>`;
  listbox.append(option);
  const optionControl = optionRoot.querySelector<HTMLElement>("[role='option']");
  if (!optionControl) throw new Error('Location option control was not rendered');
  optionControl.addEventListener("click", () => {
    input.value = option.textContent || "";
    input.setAttribute("aria-expanded", "false");
    pageHost.setAttribute('value', '[object Object]');
    pageHost.setAttribute('class', 'ng-touched ng-valid');
  });
  return input;
}

function addSmartRecruitersDropzone(
  parent: HTMLElement,
  dataTest: string,
): HTMLInputElement {
  const dropzone = document.createElement('spl-dropzone');
  dropzone.setAttribute('data-test', dataTest);
  parent.append(dropzone);
  const root = dropzone.attachShadow({ mode: 'open' });
  root.innerHTML = `
    <div role="button">Choose a file or drop it here</div>
    <input tabindex="-1" type="file" id="file-input" accept=".pdf,.doc,.docx" />
  `;
  const input = root.querySelector<HTMLInputElement>('input');
  if (!input) throw new Error('Dropzone input was not rendered');
  return input;
}

function renderSmartRecruitersResumeFields(): void {
  const helper = document.createElement('oc-apply-with-resume');
  document.body.append(helper);
  addSmartRecruitersDropzone(helper, 'apply-with-resume-container');

  const resumeContainer = document.createElement('div');
  resumeContainer.setAttribute('data-test', 'resume-upload-container');
  resumeContainer.innerHTML = `
    <h3 data-test="section-title">Resume <span data-test="section-required-mark">*</span></h3>
  `;
  document.body.append(resumeContainer);
  addSmartRecruitersDropzone(resumeContainer, 'resume-upload');
}

function renderNestedSmartRecruitersResumeFields(): void {
  const easyApply = document.createElement('oc-easy-apply');
  document.body.append(easyApply);
  addSmartRecruitersDropzone(easyApply, 'apply-with-resume-container');

  const resumeContainer = document.createElement('div');
  resumeContainer.setAttribute('data-test', 'resume-upload-container');
  resumeContainer.innerHTML = `<h3 data-test="section-title">Resume <span data-test="section-required-mark">*</span></h3>`;
  easyApply.append(resumeContainer);

  const resumeComponent = document.createElement('oc-resume-upload');
  resumeContainer.append(resumeComponent);
  const resumeRoot = resumeComponent.attachShadow({ mode: 'open' });
  addSmartRecruitersDropzone(resumeRoot as unknown as HTMLElement, 'resume-upload');
}

function renderDelayedLocation(): {
  input: HTMLInputElement;
  pressedKeys: string[];
} {
  const input = document.createElement('input');
  input.id = 'async-city';
  input.type = 'text';
  input.setAttribute('role', 'combobox');
  input.setAttribute('aria-controls', 'async-city-options');
  input.setAttribute('aria-autocomplete', 'list');
  input.setAttribute('aria-expanded', 'false');
  input.setAttribute('aria-label', 'City');
  document.body.append(input);

  const pressedKeys: string[] = [];
  input.addEventListener('keydown', (event) => pressedKeys.push(event.key));
  input.addEventListener('input', () => {
    input.setAttribute('aria-expanded', 'true');
    window.setTimeout(() => {
      const listbox = document.createElement('div');
      listbox.id = 'async-city-options';
      listbox.setAttribute('role', 'listbox');
      const option = document.createElement('button');
      option.type = 'button';
      option.setAttribute('role', 'option');
      option.textContent = 'Sydney, New South Wales, Australia';
      option.addEventListener('click', () => {
        input.value = option.textContent || '';
        input.setAttribute('aria-expanded', 'false');
        listbox.remove();
      });
      listbox.append(option);
      document.body.append(listbox);
    }, 950);
  });

  return { input, pressedKeys };
}

describe("shadow DOM autofill", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
    Object.defineProperty(HTMLElement.prototype, "offsetWidth", {
      configurable: true,
      get: () => 240,
    });
    Object.defineProperty(HTMLElement.prototype, "offsetHeight", {
      configurable: true,
      get: () => 40,
    });
    HTMLElement.prototype.getBoundingClientRect = visibleRect;
  });

  it("recognises and fills a SmartRecruiters shadow-DOM City combobox", async () => {
    const input = renderSmartRecruitersLocation();

    input.value = 'Sydney';
    expect(inspectVisibleFormFields(document)).toEqual(expect.arrayContaining([
      expect.objectContaining({
        label: 'City',
        filled: false,
      }),
    ]));
    input.value = '';

    const fields = inspectVisibleFormFields(document);
    expect(fields).toEqual(expect.arrayContaining([
      expect.objectContaining({
        key: "spl-form-element_9",
        id: "spl-form-element_9",
        label: "City",
        type: "select",
        required: true,
      }),
    ]));

    const result = await fillFormField({
      type: "content.fill-field",
      commandId: "test-shadow-city",
      source: "backend",
      target: {
        key: "spl-form-element_9",
        id: "spl-form-element_9",
        type: "select",
        label: "City",
      },
      value: "Sydney",
    });

    expect(result.status).toBe("filled");
    expect(input.value).toBe("Sydney, New South Wales, Australia");
    expect(inspectVisibleFormFields(document)).toEqual(expect.arrayContaining([
      expect.objectContaining({
        label: 'City',
        filled: true,
        currentValue: 'Sydney, New South Wales, Australia',
      }),
    ]));
  });

  it('waits for async City suggestions and does not move after clicking one', async () => {
    const { input, pressedKeys } = renderDelayedLocation();

    const result = await fillFormField({
      type: 'content.fill-field',
      commandId: 'test-async-city',
      source: 'backend',
      target: {
        key: 'async-city',
        id: 'async-city',
        type: 'select',
        label: 'City',
      },
      value: 'Sydney',
    });

    expect(result.status).toBe('filled');
    expect(input.value).toBe('Sydney, New South Wales, Australia');
    expect(pressedKeys).not.toContain('ArrowDown');
    expect(pressedKeys).not.toContain('Enter');
  });

  it('ignores the resume-autocomplete helper and identifies required Resume', () => {
    renderSmartRecruitersResumeFields();

    const fileFields = inspectVisibleFormFields(document).filter(
      (field) => field.type === 'file',
    );

    expect(fileFields).toEqual([
      expect.objectContaining({
        key: 'file-resume-upload',
        label: 'Resume',
        required: true,
        filled: false,
      }),
    ]);
  });

  it('finds Resume through the nested Shadow DOM used by SmartRecruiters one-click forms', () => {
    renderNestedSmartRecruitersResumeFields();

    const fileFields = inspectVisibleFormFields(document).filter((field) => field.type === 'file');

    expect(fileFields).toEqual([
      expect.objectContaining({
        key: 'file-resume-upload',
        label: 'Resume',
        required: true,
        filled: false,
      }),
    ]);
  });
});
