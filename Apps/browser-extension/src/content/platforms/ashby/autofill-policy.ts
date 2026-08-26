import type { ProviderAutofillPolicy } from "../platform-definition";

export const ashbyAutofillPolicy = {
  mode: "sequential",
  refreshAfterFieldMs: 120,
  settleBetweenFieldsMs: 180,
} satisfies ProviderAutofillPolicy;
