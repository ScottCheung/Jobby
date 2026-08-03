import template1Json from "./1.json";
import sampleResumeJson from "./sample-resume.json";
import type { MasterResumeData } from "@/lib/types";
import type { ResumeTemplateConfig } from "./types";

export const resumeTemplates = {
  "1": template1Json as ResumeTemplateConfig,
} as const;

export const defaultResumeTemplate = resumeTemplates["1"];
export const sampleResumeData = sampleResumeJson as MasterResumeData;

export type ResumeTemplateId = keyof typeof resumeTemplates;

export function getResumeTemplate(templateId: string) {
  return resumeTemplates[templateId as ResumeTemplateId];
}
