import { notFound } from "next/navigation";
import {
  getResumeTemplate,
  resumeTemplates,
  sampleResumeData,
} from "../templates/registry";
import { TemplateWorkbench } from "./_components/template-workbench";

export function generateStaticParams() {
  return Object.keys(resumeTemplates).map((templateId) => ({ templateId }));
}

export default async function ResumeTemplatePage({
  params,
}: {
  params: Promise<{ templateId: string }>;
}) {
  const { templateId } = await params;
  const config = getResumeTemplate(templateId);
  if (!config) notFound();

  return <TemplateWorkbench config={config} data={sampleResumeData} />;
}
