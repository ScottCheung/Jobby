const WORKPLACE_TYPE_MAP = {
  "urn:li:fs_workplaceType:1": "onsite",
  "urn:li:fs_workplaceType:2": "remote",
  "urn:li:fs_workplaceType:3": "hybrid"
};
function getCsrfToken() {
  const match = document.cookie.match(/JSESSIONID="?([^";]+)"?/);
  return match?.[1] ?? "";
}
function msToIsoDate(ms) {
  if (!ms || typeof ms !== "number" || ms <= 0) return void 0;
  try {
    return new Date(ms).toISOString().split("T")[0];
  } catch {
    return void 0;
  }
}
function resolveWorkType(urns) {
  if (!Array.isArray(urns) || urns.length === 0) return void 0;
  for (const urn of urns) {
    const mapped = WORKPLACE_TYPE_MAP[urn];
    if (mapped) return mapped;
  }
  return void 0;
}
export async function fetchLinkedInJobPosting(jobId) {
  if (!jobId || !/^\d+$/.test(jobId)) return null;
  const csrfToken = getCsrfToken();
  if (!csrfToken) return null;
  try {
    const response = await fetch(`/voyager/api/jobs/jobPostings/${jobId}`, {
      method: "GET",
      credentials: "include",
      headers: {
        "csrf-token": csrfToken,
        "x-restli-protocol-version": "2.0.0",
        accept: "application/vnd.linkedin.normalized+json+2.1",
        "x-li-lang": document.documentElement.lang || "en_US"
      }
    });
    if (!response.ok) return null;
    const json = await response.json();
    const data = json.data ?? json;
    const listedAtMs = data.listedAt;
    const originalListedAtMs = data.originalListedAt;
    const bestMs = originalListedAtMs && originalListedAtMs < (listedAtMs ?? Infinity) ? originalListedAtMs : listedAtMs;
    const listedAt = msToIsoDate(bestMs);
    const workplaceTypes = data.workplaceTypes;
    const workRemoteAllowed = data.workRemoteAllowed;
    let workType = resolveWorkType(workplaceTypes);
    if (!workType && workRemoteAllowed === true) workType = "remote";
    if (!workType && workRemoteAllowed === false) workType = "onsite";
    const rawLevel = data.formattedExperienceLevel;
    const experienceLevel = rawLevel && rawLevel.trim() ? rawLevel.trim() : void 0;
    const location = data.formattedLocation?.trim() || void 0;
    const formattedIndustries = data.formattedIndustries;
    const industries = Array.isArray(formattedIndustries) && formattedIndustries.length > 0 ? formattedIndustries : void 0;
    const companyDescObj = data.companyDescription;
    const companyDescription = companyDescObj?.text?.trim() || void 0;
    const applyMethod = data.applyMethod;
    const easyApply = applyMethod?.$type === "com.linkedin.voyager.jobs.ComplexOnsiteApply";
    return {
      listedAt,
      workType,
      experienceLevel,
      location,
      industries,
      companyDescription,
      easyApply
    };
  } catch {
    return null;
  }
}
