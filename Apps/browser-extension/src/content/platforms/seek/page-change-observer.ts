function cleanText(value: string | null | undefined): string {
  return (value || "").replace(/\s+/g, " ").trim();
}

function jobIdFromHref(element: Element | null): string {
  return (element?.getAttribute("href") || "").match(/\/job\/(\d+)/i)?.[1] || "";
}

export function seekJobDomSignature(root: ParentNode = document): string {
  const detail = root.querySelector<HTMLElement>(
    "[data-automation='splitViewJobDetailsWrapper'], [data-automation='jobDetails'], [data-automation='jobDetailsPage'], [data-automation='split-view'], [data-automation='job-details'], [data-testid='jobDetails'], #job-details",
  );
  const selectedCard = root.querySelector<HTMLElement>(
    "[data-automation='job-card'][data-selected='true'], [data-automation='job-card'][aria-current='true'], [data-testid='job-card'][aria-selected='true'], [data-testid='job-card'][data-selected='true']",
  );
  if (!detail && !selectedCard) return "";

  const title = cleanText(
    detail?.querySelector<HTMLElement>(
      "[data-automation='job-detail-title'], [data-testid='job-title'], h1",
    )?.textContent,
  );
  const selectedTitle = selectedCard?.querySelector<HTMLElement>(
    "a[data-automation='jobTitle'], a[data-testid='job-card-title']",
  );
  const jobId = cleanText(detail?.getAttribute("data-job-id")) ||
    cleanText(selectedCard?.getAttribute("data-job-id")) ||
    jobIdFromHref(
      detail?.querySelector(
        "a[data-automation='job-detail-apply'][href*='/job/'], a[data-automation*='apply'][href*='/job/']",
      ) || null,
    ) ||
    jobIdFromHref(selectedTitle || null);
  const company = cleanText(
    detail?.querySelector<HTMLElement>(
      "[data-automation='advertiser-name'], [data-automation='job-detail-company'], [data-testid='job-company']",
    )?.textContent,
  );
  const descriptionLength = cleanText(
    detail?.querySelector<HTMLElement>(
      "[data-automation='jobAdDetails'], [data-automation='jobDescription'], [data-testid='job-description']",
    )?.textContent,
  ).length;
  const descriptionState =
    descriptionLength === 0 ? "missing" : descriptionLength < 80 ? "partial" : "ready";
  const date = cleanText(
    detail?.querySelector<HTMLElement>(
      "[data-automation='job-detail-date'], [data-automation='job-posted-date'], [data-automation='jobListingDate'], time",
    )?.textContent ||
      selectedCard?.querySelector<HTMLElement>(
        "[data-automation='jobListingDate'], [data-automation='job-detail-date'], time",
      )?.textContent,
  );

  if (!title && !jobId && descriptionState === "missing") return "";
  return [jobId, title, company, descriptionState, date].join("|");
}

export function observeSeekJobDom(
  onChange: () => void,
  root: Document = document,
): () => void {
  let lastNotifiedSignature = "";
  let checkTimer: number | undefined;
  const check = () => {
    checkTimer = undefined;
    const signature = seekJobDomSignature(root);
    if (!signature || signature === lastNotifiedSignature) return;
    lastNotifiedSignature = signature;
    onChange();
  };
  const scheduleCheck = () => {
    if (checkTimer !== undefined) return;
    checkTimer = window.setTimeout(check, 75);
  };
  const observer = new MutationObserver(scheduleCheck);
  observer.observe(root.documentElement, {
    childList: true,
    subtree: true,
    characterData: true,
    attributes: true,
    attributeFilter: ["data-job-id", "data-selected", "aria-selected", "aria-current", "href"],
  });
  // Covers the race where the detail root mounted between content-script
  // startup and observer installation.
  scheduleCheck();

  return () => {
    observer.disconnect();
    if (checkTimer !== undefined) window.clearTimeout(checkTimer);
  };
}
