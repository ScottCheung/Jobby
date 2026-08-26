import type {
  AtsJobPlatform,
  DedicatedPlatform,
  FormPlatform,
  SharedFormPlatform,
} from "../../shared/contracts/platform";
import { ashbyDefinition } from "./ashby/definition";
import { bambooHrDefinition } from "./bamboohr/definition";
import { glassdoorDefinition } from "./glassdoor/definition";
import { greenhouseDefinition } from "./greenhouse/definition";
import { icimsDefinition } from "./icims/definition";
import { indeedDefinition } from "./indeed/definition";
import { leverDefinition } from "./lever/definition";
import { linkedinDefinition } from "./linkedin/definition";
import { oracleDefinition } from "./oracle/definition";
import type {
  AtsProviderDefinition,
  ProviderDefinition,
} from "./platform-definition";
import { seekDefinition } from "./seek/definition";
import { smartRecruitersDefinition } from "./smartrecruiters/definition";
import { successFactorsDefinition } from "./successfactors/definition";
import { taleoDefinition } from "./taleo/definition";
import { workableDefinition } from "./workable/definition";
import { workdayDefinition } from "./workday/definition";

export const atsProviderDefinitions = [
  glassdoorDefinition,
  workdayDefinition,
  greenhouseDefinition,
  leverDefinition,
  ashbyDefinition,
  smartRecruitersDefinition,
  taleoDefinition,
  icimsDefinition,
  successFactorsDefinition,
  oracleDefinition,
  workableDefinition,
  bambooHrDefinition,
] as const satisfies readonly AtsProviderDefinition[];

export const providerDefinitions: readonly ProviderDefinition[] = [
  linkedinDefinition,
  seekDefinition,
  indeedDefinition,
  ...atsProviderDefinitions,
];

export function getAtsProviderDefinition(
  platform: AtsJobPlatform,
): AtsProviderDefinition {
  const definition = atsProviderDefinitions.find(
    (candidate) => candidate.platform === platform,
  );
  if (!definition) throw new Error(`Missing ATS provider definition: ${platform}`);
  return definition;
}

export function getProviderDefinition(
  platform: DedicatedPlatform,
): ProviderDefinition {
  const definition = providerDefinitions.find(
    (candidate) => candidate.platform === platform,
  );
  if (!definition) throw new Error(`Missing provider definition: ${platform}`);
  return definition;
}

export function matchesProviderLocation(
  platform: DedicatedPlatform,
  location: Pick<Location, "hostname" | "pathname">,
): boolean {
  const { detection } = getProviderDefinition(platform);
  return detection.host.test(location.hostname.toLowerCase()) &&
    (!detection.path || detection.path.test(location.pathname.toLowerCase()));
}

export function getApplicationRoots(
  platform: SharedFormPlatform,
): readonly string[] {
  if (platform === "indeed") return indeedDefinition.applicationRoots;
  return getAtsProviderDefinition(platform).applicationRoots;
}

export function isAtsJobPlatform(
  platform: FormPlatform,
): platform is AtsJobPlatform {
  return atsProviderDefinitions.some(
    (definition) => definition.platform === platform,
  );
}
