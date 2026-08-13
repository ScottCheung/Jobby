import { describe, expect, it, vi } from "vitest";

import type { FormInspection } from "../shared/contracts/form-inspection";
import {
  linkedInFormFingerprint,
  waitForLinkedInStepTransition,
} from "./linkedin-automation-service";

function applicationForm(overrides: Partial<Extract<FormInspection, { kind: "application_form" }>> = {}): Extract<FormInspection, { kind: "application_form" }> {
  return {
    kind: "application_form",
    platform: "linkedin",
    url: "https://www.linkedin.com/jobs/view/123",
    fields: [{
      key: "phone",
      id: "phone",
      type: "tel",
      label: "Phone number",
      required: true,
      filled: true,
      sensitive: false,
      options: [],
      currentValue: "0400000000",
    }],
    hasSubmitAction: false,
    action: "next",
    canGoBack: false,
    ...overrides,
  };
}

function fieldWithIdentity(
  field: Extract<FormInspection, { kind: "application_form" }>['fields'][number],
  key: string,
  id: string,
  label: string,
) {
  return {
    ...field,
    key,
    id,
    label,
    options: field.options,
    type: field.type,
    required: field.required,
    filled: field.filled,
    sensitive: field.sensitive,
  };
}

describe("LinkedIn auto-apply step transition", () => {
  it("waits for a delayed LinkedIn step instead of stopping after a fixed short delay", async () => {
    vi.useFakeTimers();
    const before = applicationForm();
    const next = applicationForm({
      fields: [fieldWithIdentity(before.fields[0]!, "notice-period", "notice-period", "Notice period")],
      canGoBack: true,
    });
    let calls = 0;
    const pending = waitForLinkedInStepTransition(before, async () => {
      calls += 1;
      return calls >= 4 ? next : before;
    }, 2_000, 200);

    await vi.advanceTimersByTimeAsync(600);
    await expect(pending).resolves.toEqual({ form: next, changed: true });
    vi.useRealTimers();
  });

  it("detects a new step even when field values stay the same", () => {
    const before = applicationForm();
    const next = applicationForm({
      fields: [fieldWithIdentity(before.fields[0]!, "mobile", "mobile", "Mobile phone")],
      canGoBack: true,
    });

    expect(linkedInFormFingerprint(next)).not.toBe(linkedInFormFingerprint(before));
  });

  it("reports no transition after the finite timeout for genuine validation failures", async () => {
    vi.useFakeTimers();
    const before = applicationForm();
    const pending = waitForLinkedInStepTransition(before, async () => before, 400, 100);

    await vi.advanceTimersByTimeAsync(500);
    await expect(pending).resolves.toEqual({ form: before, changed: false });
    vi.useRealTimers();
  });
});
