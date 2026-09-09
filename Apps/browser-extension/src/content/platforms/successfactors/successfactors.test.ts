// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from "vitest";

import { fillFormField } from "../../dom/form-driver";
import { readCurrentForm, readCurrentPage } from "../../page-reader";

function setLocation(url: string): void {
  Object.defineProperty(window, "location", {
    configurable: true,
    writable: true,
    value: new URL(url),
  });
}

function visibleRect(): DOMRect {
  return {
    x: 0,
    y: 0,
    width: 480,
    height: 48,
    top: 0,
    right: 480,
    bottom: 48,
    left: 0,
    toJSON: () => ({}),
  } as DOMRect;
}

describe("SuccessFactors provider", () => {
  beforeEach(() => {
    document.head.innerHTML = "";
    document.body.innerHTML = "";
    Object.defineProperty(HTMLElement.prototype, "offsetWidth", { configurable: true, get: () => 480 });
    Object.defineProperty(HTMLElement.prototype, "offsetHeight", { configurable: true, get: () => 48 });
    HTMLElement.prototype.getBoundingClientRect = visibleRect;
  });

  it("recognises a native RCM application page as the current job", () => {
    setLocation("https://career10.successfactors.com/portalcareer?_s.crb=test");
    document.title = "Career Opportunities: Apply for Associate Software Engineer (108717)";
    document.body.innerHTML = `
      <form id="careerform">
        <div id="rcmJobApplicationCtr">
          <img class="logo" alt="Transport for NSW" />
          <h1>Associate Software Engineer (108717)</h1>
          <button id="283:_submitBtn">Apply</button>
        </div>
      </form>
    `;

    const inspection = readCurrentPage();

    expect(inspection.kind).toBe("job");
    if (inspection.kind !== "job") return;
    expect(inspection.snapshot.platform).toBe("successfactors");
    expect(inspection.snapshot.title).toBe("Associate Software Engineer (108717)");
    expect(inspection.snapshot.company).toBe("Transport for NSW");
    expect(inspection.snapshot.externalId).toBe("108717");
  });

  it("scopes autofill to the native RCM application container", () => {
    setLocation("https://career10.successfactors.com/portalcareer?_s.crb=test");
    document.body.innerHTML = `
      <form id="site-navigation"><label for="search">Search jobs</label><input id="search" /></form>
      <form id="careerform">
        <div id="rcmJobApplicationCtr">
          <label for="67:_txtFld">First Name *</label>
          <input id="67:_txtFld" name="firstName" data-testid="sfTextField" aria-required="true" />
          <button id="283:_submitBtn">Apply</button>
        </div>
      </form>
    `;

    const inspection = readCurrentForm();

    expect(inspection.kind).toBe("application_form");
    if (inspection.kind !== "application_form") return;
    expect(inspection.platform).toBe("successfactors");
    expect(inspection.fields).toEqual([
      expect.objectContaining({ label: "First Name", name: "firstName", required: true }),
    ]);
    expect(inspection.fields.some((field) => field.label === "Search jobs")).toBe(false);
  });

  it("commits a legacy RCM combobox through its option list", async () => {
    setLocation("https://career10.successfactors.com/portalcareer?_s.crb=test");
    document.body.innerHTML = `
      <form id="careerform">
        <div id="rcmJobApplicationCtr">
          <label for="92:_input">Country *</label>
          <input id="92:_input" aria-label="Country" role="combobox" aria-haspopup="listbox" aria-owns="93:_listSelect" aria-expanded="false" placeholder="No Selection" />
          <ul id="93:_listSelect" role="listbox" hidden>
            <li id="93:item1" role="option">Australia</li>
          </ul>
          <button id="283:_submitBtn">Apply</button>
        </div>
      </form>
    `;
    const input = document.querySelector<HTMLInputElement>("input[aria-label='Country']")!;
    const list = document.querySelector<HTMLElement>("ul[role='listbox']")!;
    const option = document.querySelector<HTMLElement>("li[role='option']")!;
    input.addEventListener("click", () => {
      list.hidden = false;
      input.setAttribute("aria-expanded", "true");
    });
    option.addEventListener("click", () => {
      input.value = "Australia";
      input.setAttribute("aria-expanded", "false");
      list.hidden = true;
    });

    const inspection = readCurrentForm();
    expect(inspection.kind).toBe("application_form");
    if (inspection.kind !== "application_form") return;
    const field = inspection.fields.find((candidate) => candidate.label === "Country")!;
    const result = await fillFormField({
      type: "content.fill-field",
      commandId: "successfactors-country",
      source: "backend",
      target: {
        key: field.key,
        id: field.id,
        label: field.label,
        type: "select",
      },
      value: "Australia",
    });

    expect(result.status).toBe("filled");
    expect(input.value).toBe("Australia");
  });
});
