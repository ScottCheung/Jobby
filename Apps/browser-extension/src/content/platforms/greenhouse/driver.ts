/** @format */

import type { FormScope } from "../../dom/form-inspector";
import type { ProviderDriverOverride } from "../platform-definition";

export const greenhouseDriverOverride: ProviderDriverOverride = {
  isComboboxCommitted: (
    element: HTMLInputElement,
    scope: FormScope,
  ): boolean => {
    const root = element.getRootNode();
    const searchScope =
      root instanceof Document || root instanceof ShadowRoot ? root : scope;
    return Boolean(
      (
        searchScope.querySelector(
          "#job_application_location_id, input[name*='location_id']",
        ) as HTMLInputElement
      )?.value,
    );
  },
};
