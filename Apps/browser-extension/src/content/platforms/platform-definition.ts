import type {
  AtsJobPlatform,
  DedicatedPlatform,
} from "../../shared/contracts/platform";
import type { FormFieldObservation } from "../../shared/contracts/form-inspection";

export type ProviderFormRoot = Document | HTMLElement | ShadowRoot;

export type ProviderDetection = {
  host: RegExp;
  dom?: string;
  path?: RegExp;
};

export type AtsJobConfig = {
  roots: readonly string[];
  title: readonly string[];
  company: readonly string[];
  location: readonly string[];
  description: readonly string[];
  qualifications?: readonly string[];
  apply: readonly string[];
  id: readonly string[];
  idFromUrl: (url: URL) => string;
  idFromRoot?: (root: ParentNode) => string;
  locationFromRoot?: (root: ParentNode) => string;
  dateFromPage?: (externalId: string) => string | undefined;
  companyFromPage?: (title: string) => string;
  readinessWaitUntilAttempt?: number;
  postingDateWaitUntilAttempt?: number;
};

export type ProviderAutofillPolicy = {
  mode: "sequential";
  refreshAfterFieldMs: number;
  settleBetweenFieldsMs: number;
};

export type ProviderDefinition<
  TPlatform extends DedicatedPlatform = DedicatedPlatform,
> = {
  platform: TPlatform;
  detection: ProviderDetection;
  jobDescriptionRootSelectors?: readonly string[];
  jobDescriptionSelectors?: readonly string[];
  jobDescriptionExpandSelectors?: readonly string[];
  applicationRoots?: readonly string[];
  adaptFormFields?: (
    fields: FormFieldObservation[],
    root: ProviderFormRoot,
  ) => FormFieldObservation[];
  autofill?: ProviderAutofillPolicy;
};

export type AtsProviderDefinition<
  TPlatform extends AtsJobPlatform = AtsJobPlatform,
> = ProviderDefinition<TPlatform> & {
  job: AtsJobConfig;
  applicationRoots: readonly string[];
};
