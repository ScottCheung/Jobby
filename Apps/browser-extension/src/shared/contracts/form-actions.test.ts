import { describe, expect, it } from "vitest";

import { formAutofillInstructionsResponseSchema } from "./form-actions";

describe("form autofill instruction contract", () => {
  it("accepts every attribution source emitted by the backend", () => {
    for (const source of [
      "backend",
      "intent_classifier",
      "system_rule",
      "user_rule",
      "phone_country_inference",
    ]) {
      expect(
        formAutofillInstructionsResponseSchema.safeParse({
          instructions: [{
            type: "content.fill-field",
            commandId: "ashby-batch-field",
            source,
            target: {
              key: "email",
              type: "email",
              label: "Email",
            },
            value: "candidate@example.com",
          }],
          unanswered_fields: [],
          traces: [],
        }).success,
      ).toBe(true);
    }
  });
});
