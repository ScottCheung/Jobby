import type { MasterResumeData } from "../../../shared/contracts/tailored-resume";

export type WorkdaySectionKey =
  | "experience"
  | "education"
  | "certifications"
  | "languages";

export type WorkdayStructuredItem = Record<string, unknown>;

export type WorkdayFieldIdentity = {
  type: string;
  label: string;
  id?: string;
  name?: string;
  automationId?: string;
};

function cleanText(value: unknown): string {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function identifier(value: unknown): string {
  return cleanText(value).toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function fieldIdentifiers(field: WorkdayFieldIdentity): Set<string> {
  return new Set(
    [
      ...(field.automationId || "").split("|"),
      field.name,
      field.id,
      field.label,
    ]
      .map(identifier)
      .filter(Boolean),
  );
}

function matches(field: WorkdayFieldIdentity, aliases: readonly string[]): boolean {
  const identifiers = fieldIdentifiers(field);
  return aliases.some((alias) => identifiers.has(identifier(alias)));
}

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
] as const;

function parsedDate(raw: unknown): { year: string; month: string } | null {
  const value = cleanText(raw);
  const yearFirst = value.match(/^(\d{4})[-/.](\d{1,2})/);
  if (yearFirst) return { year: yearFirst[1]!, month: yearFirst[2]!.padStart(2, "0") };
  const monthFirst = value.match(/^(\d{1,2})[-/.](\d{4})$/);
  if (monthFirst) return { year: monthFirst[2]!, month: monthFirst[1]!.padStart(2, "0") };
  const named = value.match(/^([A-Za-z]+)\s+(\d{4})$|^(\d{4})\s+([A-Za-z]+)$/);
  if (named) {
    const name = (named[1] || named[4] || "").toLowerCase();
    const monthIndex = MONTH_NAMES.findIndex((month) => month.toLowerCase().startsWith(name.slice(0, 3)));
    if (monthIndex >= 0) return { year: named[2] || named[3]!, month: String(monthIndex + 1).padStart(2, "0") };
  }
  const yearOnly = value.match(/^(\d{4})$/);
  return yearOnly ? { year: yearOnly[1]!, month: "01" } : null;
}

function dateValue(raw: unknown, field: WorkdayFieldIdentity): string {
  const value = cleanText(raw);
  const date = parsedDate(value);
  if (!date) return value;
  if (matches(field, ["dateSectionMonth-input", "month", "startMonth", "endMonth"])) {
    return field.type === "select" ? MONTH_NAMES[Number(date.month) - 1]! : date.month;
  }
  if (matches(field, ["dateSectionYear-input", "year", "firstYearAttended", "lastYearAttended", "startYear", "endYear"])) {
    return date.year;
  }
  if (field.type === "date") return `${date.year}-${date.month}-01`;
  return `${date.month}/${date.year}`;
}

function joined(value: unknown): string {
  return Array.isArray(value)
    ? value.map(cleanText).filter(Boolean).join("\n")
    : cleanText(value);
}

export function workdaySectionItems(
  resume: MasterResumeData,
  key: WorkdaySectionKey,
): WorkdayStructuredItem[] {
  if (key === "certifications") {
    return (resume.certifications || []).flatMap(
      (group) => group.certifications || [],
    ) as WorkdayStructuredItem[];
  }
  return (resume[key] || []) as WorkdayStructuredItem[];
}

export function workdaySkills(
  resume: MasterResumeData,
  savedSkills: string[] = [],
): string[] {
  const profileSkills = (resume.skills || []).flatMap((group) => group.skills || []);
  const seen = new Set<string>();
  return [...profileSkills, ...savedSkills]
    .map(cleanText)
    .filter((skill) => {
      const key = skill.toLowerCase();
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

export function valueForWorkdayStructuredField(
  section: WorkdaySectionKey,
  item: WorkdayStructuredItem,
  field: WorkdayFieldIdentity,
): string | boolean | null {
  if (section === "experience") {
    if (matches(field, ["jobTitle", "positionTitle", "Job Title"])) return joined(item.title);
    if (matches(field, ["company", "companyName", "employer", "Company"])) return joined(item.company);
    if (matches(field, ["location", "workLocation", "Location"])) return joined(item.location);
    if (matches(field, ["currentlyWorkHere", "currentJob", "I currently work here"])) {
      return item.is_current === true;
    }
    if (matches(field, ["startDate", "Start Date"])) return dateValue(item.start_date, field);
    if (matches(field, ["endDate", "End Date"])) return dateValue(item.end_date, field);
    if (matches(field, ["roleDescription", "jobDescription", "description", "Role Description"])) {
      return joined(item.description);
    }
  }
  if (section === "education") {
    if (matches(field, ["school", "schoolName", "institution", "School or University"])) return joined(item.institution);
    if (matches(field, ["degree", "degreeName", "Degree"])) return joined(item.degree);
    if (matches(field, ["fieldOfStudy", "major", "Field of Study"])) return joined(item.field_of_study);
    if (matches(field, ["educationLocation", "location", "Location"])) return joined(item.location);
    if (matches(field, ["startDate", "firstYearAttended", "Start Date", "First Year Attended"])) {
      return dateValue(item.start_date, field);
    }
    if (matches(field, ["endDate", "lastYearAttended", "End Date", "Last Year Attended", "Graduation Year"])) {
      return dateValue(item.end_date, field);
    }
  }
  if (section === "certifications") {
    if (matches(field, ["certificationName", "certificateName", "Certification Name"])) return joined(item.name);
    if (matches(field, ["issuer", "issuedBy", "Issuing Organization"])) return joined(item.issuer);
    if (matches(field, ["issueDate", "issuedDate", "Issue Date"])) return dateValue(item.issue_date || item.date, field);
    if (matches(field, ["expirationDate", "expiryDate", "Expiration Date"])) return dateValue(item.expiry_date, field);
    if (matches(field, ["certificationUrl", "credentialUrl", "Credential URL"])) {
      return joined(item.credential_url || item.url);
    }
  }
  if (section === "languages") {
    if (matches(field, ["language", "languageName", "Language"])) return joined(item.name);
    if (matches(field, ["languageProficiency", "proficiency", "Proficiency"])) return joined(item.proficiency);
  }
  return null;
}
