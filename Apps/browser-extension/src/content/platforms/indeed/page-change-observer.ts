function cleanText(value: string | null | undefined): string {
  return (value || "").replace(/\s+/g, " ").trim();
}

function selectedIndeedCard(root: ParentNode): HTMLElement | null {
  const selectors = [
    "[data-jk][aria-selected='true']",
    "[data-jk][aria-current='true']",
    "[data-jk][data-selected='true']",
    "[data-jk][aria-pressed='true']",
    "[data-jk].resultWithShelf",
    "[data-jk][class~='selected']",
  ];
  for (const selector of selectors) {
    const card = root.querySelector<HTMLElement>(selector);
    if (card) return card.closest<HTMLElement>(".job_seen_beacon") || card;
  }
  return null;
}

export function indeedJobDomSignature(root: ParentNode = document): string {
  const detail = root.querySelector<HTMLElement>(
    ".jobsearch-RightPane, .jobsearch-ViewJobPaneWrapper, #jobsearch-ViewjobPane, #viewJobSSRRoot, .jobsearch-JobComponent, .fastviewjob",
  );
  const selectedCard = selectedIndeedCard(root);
  if (!detail && !selectedCard) return "";

  const title = cleanText(
    detail?.querySelector<HTMLElement>(
      "[data-testid='jobsearch-JobInfoHeader-title'], .jobsearch-JobInfoHeader-title, [class*='jobsearch-JobInfoHeader-title'], h1",
    )?.textContent,
  );
  const company = cleanText(
    detail?.querySelector<HTMLElement>(
      "[data-testid='inlineHeader-companyName'], .jobsearch-InlineCompanyRating-companyHeader, [data-company-name='true'], [class*='companyName']",
    )?.textContent,
  );
  const descriptionLength = cleanText(
    detail?.querySelector<HTMLElement>(
      "#jobDescriptionText, [class*='jobsearch-jobDescriptionText'], [data-testid='jobsearch-jobDescriptionText'], #jobDescriptionSection, [data-testid='jobDescriptionText']",
    )?.textContent,
  ).length;
  const descriptionState =
    descriptionLength === 0 ? "missing" : descriptionLength < 80 ? "partial" : "ready";
  const date = cleanText(
    detail?.querySelector<HTMLElement>(
      "time, [data-testid='jobsearch-JobMetadataFooter-item'], [data-testid='myJobsStateDate'], [class*='jobsearch-HiringInsights-date']",
    )?.textContent,
  );
  const selectedTitle = cleanText(
    selectedCard?.querySelector<HTMLElement>("h2, [id^='jobTitle-'], a")?.textContent,
  );
  const jobKey =
    cleanText(
      selectedCard?.getAttribute("data-jk") ||
      selectedCard?.querySelector<HTMLElement>("[data-jk]")?.getAttribute("data-jk"),
    ) ||
    cleanText(detail?.querySelector<HTMLElement>("[data-jk]")?.getAttribute("data-jk"));

  if (!title && !selectedTitle && !jobKey && descriptionState === "missing") return "";
  return [jobKey, title, selectedTitle, company, descriptionState, date].join("|");
}

export function observeIndeedJobDom(
  onChange: () => void,
  root: Document = document,
): () => void {
  let lastNotifiedSignature = "";
  let checkTimer: number | undefined;
  const check = () => {
    checkTimer = undefined;
    const signature = indeedJobDomSignature(root);
    if (!signature || signature === lastNotifiedSignature) return;
    lastNotifiedSignature = signature;
    onChange();
  };
  const scheduleCheck = () => {
    if (checkTimer !== undefined) window.clearTimeout(checkTimer);
    checkTimer = window.setTimeout(check, 75);
  };
  const observer = new MutationObserver(scheduleCheck);
  observer.observe(root.documentElement, {
    childList: true,
    subtree: true,
    characterData: true,
    attributes: true,
    attributeFilter: ["data-jk", "data-selected", "aria-selected", "aria-current", "aria-pressed", "class", "href"],
  });
  scheduleCheck();

  return () => {
    observer.disconnect();
    if (checkTimer !== undefined) window.clearTimeout(checkTimer);
  };
}
