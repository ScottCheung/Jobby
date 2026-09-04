import type {
  AtsJobPlatform,
  DedicatedPlatform,
} from "../../shared/contracts/platform";
import type {
  FormFieldObservation,
  FormInspection,
} from "../../shared/contracts/form-inspection";
import type { PageInspection } from "../../shared/contracts/page-inspection";
import type {
  FieldFillInstruction,
  FieldFillResult,
  FormFieldTarget,
  FormFocusResult,
} from "../../shared/contracts/form-actions";
import type { MasterResumeData } from "../../shared/contracts/tailored-resume";

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

export type ProviderJobReadiness = {
  readinessWaitUntilAttempt?:
    | number
    | ((location: Pick<Location, "pathname">) => number);
  postingDateWaitUntilAttempt?: number;
  readWhenReady?: () => Promise<PageInspection>;
};

export type ProviderJobReader = {
  read: (apiData?: unknown) => PageInspection;
  readiness?: ProviderJobReadiness;
  fallback?: boolean;
};

export type ProviderFormReader = {
  read: () => FormInspection;
  scope?: () => ProviderFormRoot | null;
};

export type ProviderAutofillPolicy = {
  mode?: "sequential";
  refreshAfterFieldMs?: number;
  settleBetweenFieldsMs?: number;
  treatsAllFileInputsAsResume?: boolean;
};

export type ProviderStructuredFill = {
  enabled: boolean;
  summaryFeature?: string;
  fill?: (
    resume: MasterResumeData,
    runId: string,
    skills?: string[],
    isCancelled?: () => boolean,
  ) => Promise<FieldFillResult[]>;
  cancel?: (runId: string) => Promise<void> | void;
};

export type ProviderDriverOverride = {
  fillField?: (
    instruction: FieldFillInstruction,
    scope: FormScope,
  ) => Promise<FieldFillResult | null | undefined>;
  focusField?: (
    target: FormFieldTarget,
    scope: FormScope,
  ) => FormFocusResult | null | undefined;
  isComboboxCommitted?: (
    element: HTMLInputElement,
    scope: FormScope,
  ) => boolean;
  selectCombobox?: (
    target: FormFieldTarget,
    value: FieldFillInstruction["value"],
    commandId: string,
  ) => Promise<FieldFillResult | null>;
};

export function isAtsJobConfig(
  job: AtsJobConfig | ProviderJobReader | undefined,
): job is AtsJobConfig {
  return Boolean(job && "roots" in job && Array.isArray(job.roots));
}

export function isDedicatedJobReader(
  job: AtsJobConfig | ProviderJobReader | undefined,
): job is ProviderJobReader {
  return Boolean(job && "read" in job && typeof job.read === "function");
}

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
  job?: AtsJobConfig | ProviderJobReader;
  form?: ProviderFormReader;
  autofill?: ProviderAutofillPolicy;
  structuredAutofill?: ProviderStructuredFill;
  driver?: ProviderDriverOverride;
};

export type AtsProviderDefinition<
  TPlatform extends AtsJobPlatform = AtsJobPlatform,
> = ProviderDefinition<TPlatform> & {
  job: AtsJobConfig;
  applicationRoots: readonly string[];
};
