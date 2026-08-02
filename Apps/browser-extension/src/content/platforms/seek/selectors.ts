export const SEEK_SELECTORS = {
  title: [
    "h1[data-automation='job-detail-title']",
    "[data-automation='job-detail-title']",
    "[data-testid='job-title']",
    "h1",
  ],
  company: [
    "[data-automation='advertiser-name']",
    "[data-automation='job-detail-company']",
    "a[data-automation='company-link']",
    "[data-testid='job-company']",
  ],
  location: [
    "[data-automation='job-detail-location']",
    "[data-automation='job-location']",
    "[data-testid='job-location']",
  ],
  description: [
    "[data-automation='jobAdDetails']",
    "[data-automation='jobDescription']",
    "[data-testid='job-description']",
  ],
  apply: [
    "a[data-automation='job-detail-apply']",
    "button[data-automation='job-detail-apply']",
    "[data-testid='job-detail-apply']",
  ],
} as const;
