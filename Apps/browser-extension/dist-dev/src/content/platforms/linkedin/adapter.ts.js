const SELECTORS = {
  title: [
    ".job-details-jobs-unified-top-card__job-title-link",
    ".job-details-jobs-unified-top-card__job-title",
    ".jobs-unified-top-card__job-title-link",
    ".jobs-unified-top-card__job-title",
    ".jobs-details__main-content h1",
    "[data-testid='job-title']",
    "main h1 a[href*='/jobs/view/']",
    "main h1",
    "h1.t-24",
    ".jobs-details__main-content p",
    "[data-display-contents='true'] p",
    "[data-display-contents='true']"
  ],
  company: [
    ".job-details-jobs-unified-top-card__company-name a",
    ".job-details-jobs-unified-top-card__company-name",
    ".jobs-unified-top-card__company-name a",
    ".jobs-unified-top-card__company-name",
    "a[href*='/company/']",
    "[aria-label^='Company,']"
  ],
  location: [
    ".job-details-jobs-unified-top-card__primary-description-container",
    ".jobs-unified-top-card__primary-description-container",
    ".job-details-jobs-unified-top-card__bullet"
  ],
  description: [
    ".jobs-description__content .jobs-box__html-content",
    ".jobs-description__container .jobs-box__html-content",
    ".jobs-description__container .jobs-description-content__text",
    ".jobs-description__container",
    ".jobs-description",
    ".jobs-description-content__text",
    ".jobs-description__content",
    "[data-test-id='job-details-description']",
    "[data-testid='job-details-description']",
    "[data-testid='expandable-text-box']"
  ],
  easyApply: [
    "button.jobs-apply-button",
    ".jobs-apply-button button",
    ".jobs-apply-button",
    "button.jobs-apply-button--top-card",
    ".jobs-apply-button--top-card button",
    "button.jobs-s-apply",
    "button[aria-label*='Easy Apply']",
    "button[aria-label*='Easy apply']",
    "button[aria-label*='简单申请']",
    "button[aria-label*='轻松应聘']",
    "a[aria-label*='Easy Apply']",
    "[data-live-test-job-apply]",
    "a[href*='/jobs/view/'][href*='/apply']"
  ],
  applicationRoot: [
    ".jobs-easy-apply-modal",
    ".jobs-easy-apply-content",
    "#artdeco-modal-outlet .artdeco-modal",
    "#artdeco-modal-outlet [role='dialog']",
    ".artdeco-modal[role='dialog']",
    "[role='dialog'][aria-label*='Apply']",
    "[role='dialog'][aria-label*='申请']",
    "[role='dialog'][aria-label*='应聘']",
    "div[role='dialog']",
    "form.jobs-easy-apply-form",
    "#artdeco-modal-outlet [data-test-modal]",
    "#artdeco-modal-outlet [data-test-modal-container]",
    "[data-test-modal]"
  ],
  nextAction: [
    "button[aria-label*='Continue']",
    "button[aria-label*='Next']",
    "button[aria-label*='Review']",
    "button[aria-label*='继续']",
    "button[aria-label*='下一步']",
    ".jobs-easy-apply-modal footer button.artdeco-button--primary",
    "#artdeco-modal-outlet footer button.artdeco-button--primary",
    "[role='dialog'] footer button.artdeco-button--primary",
    "[role='dialog'] button.artdeco-button--primary"
  ],
  previousAction: [
    "button[aria-label*='Back']",
    "button[aria-label*='Previous']",
    "button[aria-label*='返回']",
    "button[aria-label*='上一步']",
    "button[aria-label*='back']",
    "button[aria-label*='previous']"
  ],
  submitAction: [
    "[data-live-test-easy-apply-submit-button]",
    "button[aria-label*='Submit application']",
    "button[aria-label*='Submit']",
    "button[aria-label*='提交应用']",
    "button[aria-label*='提交申请']",
    "button[aria-label*='提交']"
  ]
};
const APPLICATION_FIELD_SELECTOR = "input:not([type='hidden']), select, textarea";
const APPLICATION_ROOT_SELECTOR = [
  ...SELECTORS.applicationRoot,
  "#artdeco-modal-outlet .artdeco-modal",
  "#artdeco-modal-outlet [role='dialog']",
  "#artdeco-modal-outlet [data-test-modal]",
  "#artdeco-modal-outlet [data-test-modal-container]",
  "[role='dialog']",
  "[data-test-modal]"
].filter((selector, index, selectors) => selectors.indexOf(selector) === index);
const TITLE_METADATA = /* @__PURE__ */ new Set([
  "easy apply",
  "full-time",
  "hybrid",
  "internship",
  "linkedin",
  "no response insights available yet",
  "on-site",
  "part-time",
  "remote",
  "save",
  "temporary",
  "contract",
  "jobs",
  "job",
  "job details",
  "show all",
  "show more",
  "show less",
  "see all",
  "see more",
  "view all",
  "read more"
]);
const INVALID_TITLE_PATTERNS = [
  /\b\d+\s+(?:connections?|alumni|school|employees?|reactions?|comments?|shares?|likes?|views?|reposts?)\b/i,
  /\b(?:connections?|alumni|reactions?|comments?|shares?|likes?|reposts?)\b/i,
  /\b(?:about\s+the\s+job|job\s+description|job\s+details|hiring\s+team)\b/i,
  /\b(?:people\s+also\s+viewed|similar\s+jobs|response\s+insights)\b/i,
  /\b(?:easy\s+apply|apply\s+now|apply\s+on\s+company)\b/i,
  /\b(?:company\s+logo|promoted|posted)\b/i,
  /\b(?:show\s+(?:all|more|less)|see\s+(?:all|more)|view\s+(?:all|more)|read\s+more)\b/i
];
function cleanText(value) {
  return (value || "").replace(/\s+/g, " ").trim();
}
function extractCleanElementText(element) {
  const clone = element.cloneNode(true);
  const noisyNodes = clone.querySelectorAll(
    "button, script, style, svg, [role='img'], a[aria-label*='Verified'], .visually-hidden, .sr-only, [aria-hidden='true']"
  );
  noisyNodes.forEach((node) => node.remove());
  const rawText = cleanText(clone.textContent);
  return rawText.replace(
    /\b(?:show\s+(?:all|more|less)|see\s+(?:all|more)|view\s+(?:all|more)|read\s+more)\b/gi,
    ""
  ).trim();
}
function isVisible(element) {
  const style = window.getComputedStyle(element);
  const rect = element.getBoundingClientRect();
  return style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0;
}
function isEnabled(element) {
  return !(element instanceof HTMLButtonElement && element.disabled) && element.getAttribute("aria-disabled") !== "true";
}
function deepElements(root) {
  const result = [];
  const visited = /* @__PURE__ */ new Set();
  const visit = (scope) => {
    if (visited.has(scope)) return;
    visited.add(scope);
    Array.from(scope.querySelectorAll("*")).forEach((element) => {
      result.push(element);
      if (element.shadowRoot) visit(element.shadowRoot);
    });
  };
  visit(root);
  return result;
}
function deepQueryAll(root, selector) {
  return deepElements(root).filter((element) => element.matches(selector));
}
function deepFirst(root, selector) {
  return deepQueryAll(root, selector)[0] || null;
}
function firstText(root, selectors) {
  for (const selector of selectors) {
    const element = deepFirst(root, selector);
    if (!element) continue;
    const text = extractCleanElementText(element);
    if (text) return text;
  }
  return "";
}
function descriptionText(element) {
  const clone = element.cloneNode(true);
  clone.querySelectorAll("button, script, style, svg, [role='img'], .visually-hidden, .sr-only").forEach((node) => node.remove());
  return cleanText(clone.innerText || clone.textContent);
}
function firstDescriptionText(root, selectors) {
  for (const selector of selectors) {
    const element = deepFirst(root, selector);
    if (!element) continue;
    const text = descriptionText(element);
    if (text) return text;
  }
  return "";
}
function descriptionFromHeading(root) {
  const heading = deepElements(root).find((element) => {
    const text2 = cleanText(element.textContent);
    if (text2.length > 80) return false;
    return /^(?:about\s+the\s+job|job\s+description|job\s+details|职位描述|工作描述)$/i.test(text2);
  });
  if (!heading) return "";
  const container = heading.closest(
    "section, article, .jobs-description, .jobs-description__container, [data-test-id*='description' i], [data-testid*='description' i]"
  ) || heading.parentElement;
  if (!container) return "";
  const text = descriptionText(container);
  const headingText = cleanText(heading.textContent);
  const body = cleanText(text.replace(headingText, ""));
  return body.length >= 40 ? body : "";
}
function findVisible(root, selectors, predicate = () => true) {
  const elements = deepElements(root);
  for (const selector of selectors) {
    const element = elements.find(
      (candidate) => candidate.matches(selector) && predicate(candidate) && isVisible(candidate) && isEnabled(candidate)
    );
    if (element) return element;
  }
  return null;
}
function normalized(value) {
  return cleanText(value).toLowerCase();
}
function getJobDetailRoot() {
  const root = document.querySelector(
    ".jobs-search__job-details, .jobs-details__main-content, .job-details-jobs-unified-top-card, main"
  );
  return root || document;
}
const JOB_ROLE_KEYWORDS = /\b(?:engineer|developer|architect|lead|principal|senior|junior|mid|staff|manager|director|consultant|analyst|specialist|designer|administrator|coordinator|officer|executive|head|vp|intern|graduate|associate|agent|advisor|operator|technician|contractor)\b/i;
function isLikelyTitle(value, company) {
  const text = cleanText(value);
  if (!text || text.length < 2 || text.length > 180) return false;
  if (TITLE_METADATA.has(text.toLowerCase())) return false;
  if (INVALID_TITLE_PATTERNS.some((pattern) => pattern.test(text))) return false;
  if (isPureLocation(text)) return false;
  if (/[·•]/.test(text) || /\b(?:ago|applicants?)\b/i.test(text)) return false;
  if (company) {
    const normText = normalized(text);
    const normComp = normalized(company);
    if (normText === normComp) return false;
    if (!JOB_ROLE_KEYWORDS.test(text) && normComp.length > 3 && (normComp.includes(normText) || normText.includes(normComp))) {
      return false;
    }
  }
  return true;
}
function isPureLocation(value) {
  const text = cleanText(value);
  if (!text) return false;
  if (JOB_ROLE_KEYWORDS.test(text)) return false;
  return /^[A-Za-z\s.-]+,\s*(?:NSW|VIC|QLD|WA|SA|TAS|ACT|NT|Australia|New South Wales|Victoria|Queensland|Western Australia|South Australia|Tasmania|Australian Capital Territory|Northern Territory)(?:,\s*Australia)?$/i.test(text);
}
function titleFromMain(company) {
  const root = getJobDetailRoot();
  const companyName = company || firstText(root, SELECTORS.company) || firstText(document, SELECTORS.company);
  if (!companyName) return "";
  const paragraphs = Array.from(root.querySelectorAll("p")).map((element) => cleanText(element.textContent)).filter(Boolean);
  const companyIndex = paragraphs.findIndex((text) => text === companyName);
  if (companyIndex < 0) return "";
  return paragraphs.slice(companyIndex + 1, companyIndex + 5).find((t) => isLikelyTitle(t, companyName)) || "";
}
function titleFromDocument(jobId, company) {
  if (!jobId) return "";
  const rawTitle = cleanText(document.title);
  const parts = rawTitle.split(/\s*\|\s*/);
  for (const part of parts) {
    const cleanedPart = part.replace(/\s*-\s*LinkedIn$/i, "").replace(/\b(?:LinkedIn|Search|Jobs?)\b/gi, "").trim();
    const candidate = cleanedPart.split(/\s+hiring\s+/i)[1] || cleanedPart.split(/\s+is\s+hiring\s+/i)[1] || cleanedPart;
    const titleOnly = candidate.split(/\s+in\s+[^|-]+$/i)[0]?.trim() || candidate;
    if (isLikelyTitle(titleOnly, company)) return titleOnly;
  }
  return "";
}
function titleFromJobLink(jobId, company) {
  const links = Array.from(document.querySelectorAll("a[href*='/jobs/view/']"));
  for (const link of links) {
    const href = link.getAttribute("href") || "";
    if (!new RegExp(`/jobs/view/${jobId}(?:/|\\?|$)`, "i").test(href)) continue;
    const text = extractCleanElementText(link);
    if (isLikelyTitle(text, company)) return text;
  }
  return "";
}
function titleFromPage(jobId, company) {
  const jobLinkTitle = titleFromJobLink(jobId, company);
  if (jobLinkTitle) return jobLinkTitle;
  const root = getJobDetailRoot();
  const selectedTitle = firstText(root, SELECTORS.title);
  if (isLikelyTitle(selectedTitle, company)) return selectedTitle;
  const documentTitle = titleFromDocument(jobId, company);
  return documentTitle || titleFromMain(company);
}
function locationFromPage() {
  const root = getJobDetailRoot();
  const selected = firstText(root, SELECTORS.location) || firstText(document, SELECTORS.location);
  if (selected) return selected.split(/\s*[·•]\s*/)[0] || void 0;
  const metadata = Array.from(root.querySelectorAll("p")).map((element) => cleanText(element.textContent)).find((text) => /\s*[·•]\s*/.test(text) && /\b(?:ago|applicants?)\b/i.test(text));
  return metadata?.split(/\s*[·•]\s*/)[0] || void 0;
}
function datePostedFromPage() {
  const root = getJobDetailRoot();
  const timeEl = root.querySelector("time[datetime]") || document.querySelector(
    ".job-details-jobs-unified-top-card__primary-description-container time[datetime], .jobs-unified-top-card__primary-description time[datetime], main time[datetime]"
  );
  if (timeEl) {
    const dt = timeEl.getAttribute("datetime");
    if (dt) return cleanText(dt);
    const text = cleanText(timeEl.textContent);
    if (text) return text;
  }
  const primaryDesc = firstText(root, [
    ".job-details-jobs-unified-top-card__primary-description-container",
    ".jobs-unified-top-card__primary-description-container",
    ".job-details-jobs-unified-top-card__bullet"
  ]) || firstText(document, [
    ".job-details-jobs-unified-top-card__primary-description-container",
    ".jobs-unified-top-card__primary-description-container"
  ]);
  if (primaryDesc) {
    const segments = primaryDesc.split(/\s*[·•]\s*/).map((s) => cleanText(s)).filter(Boolean);
    for (const seg of segments) {
      if (/\b(\d+\s*\+?\s*(?:minute|hour|day|week|month|year)s?\s+ago|today|yesterday|just\s+now|reposted)\b/i.test(seg)) {
        return seg;
      }
    }
  }
  return void 0;
}
export class LinkedInAdapter {
  platformName = "linkedin";
  applicationRootCache;
  applicationActionCache = /* @__PURE__ */ new Map();
  jobIdFromUrl(url) {
    const match = url.match(/\/jobs\/view\/(\d+)/i);
    if (match?.[1]) return match[1];
    try {
      const currentJobId = new URL(url).searchParams.get("currentJobId");
      return currentJobId && /^\d+$/.test(currentJobId) ? currentJobId : "";
    } catch {
      return "";
    }
  }
  isJobPageUrl(url) {
    return Boolean(this.jobIdFromUrl(url));
  }
  readJob(url) {
    const externalId = this.jobIdFromUrl(url);
    if (!externalId) return null;
    if (!this.hasCurrentJobReference(externalId)) return null;
    const root = getJobDetailRoot();
    const company = firstText(root, SELECTORS.company) || firstText(document, SELECTORS.company) || "Unknown company";
    const title = titleFromPage(externalId, company);
    if (!title) return null;
    const description = firstDescriptionText(root, SELECTORS.description) || firstDescriptionText(document, SELECTORS.description) || descriptionFromHeading(root) || descriptionFromHeading(document);
    return {
      externalId,
      title,
      company,
      location: locationFromPage(),
      datePosted: datePostedFromPage(),
      description: description || void 0,
      easyApply: Boolean(this.findEasyApplyTrigger())
    };
  }
  getApplicationRoot() {
    if (this.applicationRootCache && this.applicationRootCache.isConnected && isVisible(this.applicationRootCache)) {
      return this.applicationRootCache;
    }
    this.applicationRootCache = void 0;
    const candidates = this.applicationRootCandidates();
    const activeRoot = candidates.find(
      (candidate) => this.isEasyApplyRoot(candidate) && this.isExplicitlyActiveModal(candidate)
    );
    if (activeRoot) {
      this.applicationRootCache = activeRoot;
      return activeRoot;
    }
    const modalRoot = candidates.find(
      (candidate) => this.isEasyApplyRoot(candidate) && isVisible(candidate) && isEnabled(candidate) && !this.hasHiddenModalAncestor(candidate)
    ) || null;
    if (modalRoot) {
      this.applicationRootCache = modalRoot;
      return modalRoot;
    }
    this.applicationRootCache = this.findApplicationRootFromHeading() || this.findFullPageApplicationRoot();
    return this.applicationRootCache;
  }
  invalidateApplicationRootCache() {
    this.applicationRootCache = void 0;
    this.applicationActionCache.clear();
  }
  invalidateApplicationActionCache() {
    this.applicationActionCache.clear();
  }
  getCachedApplicationRoot() {
    return this.applicationRootCache;
  }
  hasEasyApplyAction() {
    return Boolean(this.findEasyApplyTrigger());
  }
  isFullPageApplicationFlow() {
    try {
      const value = new URL(window.location.href).searchParams.get("openSDUIApplyFlow");
      return value === "true" || value === "1";
    } catch {
      return false;
    }
  }
  applicationFormDiagnostic() {
    const containers = Array.from(
      document.querySelectorAll(
        "#artdeco-modal-outlet [data-test-modal-container]"
      )
    );
    const candidates = this.applicationRootCandidates();
    const visibleCandidates = candidates.filter(
      (candidate) => isVisible(candidate) && !this.hasHiddenModalAncestor(candidate)
    );
    const easyApplyModals = document.querySelectorAll(
      ".jobs-easy-apply-modal"
    ).length;
    const activeContainers = containers.filter(
      (container) => container.getAttribute("aria-hidden") !== "true"
    ).length;
    const root = this.getApplicationRoot();
    const modalOutlet = document.querySelector("#artdeco-modal-outlet");
    const fieldScope = root || modalOutlet || document;
    const allFields = Array.from(
      fieldScope.querySelectorAll(APPLICATION_FIELD_SELECTOR)
    );
    const visibleFields = allFields.filter((field) => isVisible(field));
    const rootClasses = root && typeof root.className === "string" ? root.className.trim().split(/\s+/).filter(Boolean).slice(0, 3).join(".") : "";
    const rootDescription = root ? `${root.tagName.toLowerCase()}${rootClasses ? `.${rootClasses}` : ""}` : "none";
    const fieldScopeDescription = root ? "application root" : modalOutlet ? "modal outlet fallback" : "document fallback";
    return `诊断：modal outlet ${modalOutlet ? 1 : 0}；SDUI 全页流 ${this.isFullPageApplicationFlow() ? 1 : 0}；候选 dialog ${visibleCandidates.length}/${candidates.length}；活动 modal 容器 ${activeContainers}/${containers.length}；Easy Apply class ${easyApplyModals}；application root ${rootDescription}；表单字段 ${visibleFields.length}/${allFields.length}（scope: ${fieldScopeDescription}）。`;
  }
  getEasyApplyUrl() {
    const trigger = this.findEasyApplyTrigger();
    if (!(trigger instanceof HTMLAnchorElement)) return void 0;
    return trigger.href || void 0;
  }
  getCurrentApplicationAction(action) {
    const cached = this.applicationActionCache.get(action);
    if (cached && cached.isConnected && isVisible(cached) && isEnabled(cached)) {
      return cached;
    }
    this.applicationActionCache.delete(action);
    const root = this.getApplicationRoot();
    if (!root) {
      return null;
    }
    let result = null;
    if (action === "submit") {
      result = findVisible(root, SELECTORS.submitAction) || findVisible(
        root,
        [
          "button.artdeco-button--primary",
          'button[type="submit"]',
          "footer button.artdeco-button--primary",
          "footer button",
          "button",
          '[role="button"]'
        ],
        (candidate) => {
          const label = cleanText(
            candidate.textContent || candidate.getAttribute("aria-label")
          );
          return /(?:submit|提交|应聘|申请)/i.test(label);
        }
      );
    } else if (action === "previous") {
      result = findVisible(root, SELECTORS.previousAction) || findVisible(root, ["button", "footer button"], (candidate) => {
        const label = cleanText(
          candidate.textContent || candidate.getAttribute("aria-label")
        );
        return /(?:back|previous|上一步|返回)/i.test(label);
      }) || findVisible(
        document,
        [
          "button[aria-label*='Back to previous step']",
          "button[aria-label*='Back']",
          "button[aria-label*='Previous']"
        ],
        (candidate) => /(?:back|previous|上一步|返回)/i.test(
          cleanText(candidate.textContent || candidate.getAttribute("aria-label"))
        )
      );
    } else {
      const submitBtn = this.getCurrentApplicationAction("submit");
      result = findVisible(root, SELECTORS.nextAction, (candidate) => {
        if (candidate === submitBtn) return false;
        const label = cleanText(
          candidate.textContent || candidate.getAttribute("aria-label")
        );
        if (/(?:submit|提交|应聘|申请)/i.test(label)) return false;
        return true;
      });
      if (!result) {
        result = findVisible(
          root,
          ["button", '[role="button"]'],
          (candidate) => {
            if (candidate === submitBtn) return false;
            const label = cleanText(
              candidate.textContent || candidate.getAttribute("aria-label")
            );
            return /(?:continue|next|review|继续|下一步|审核|检查)/i.test(label) && !/(?:submit|提交|应聘|申请)/i.test(label);
          }
        );
      }
    }
    this.applicationActionCache.set(action, result);
    return result;
  }
  getCurrentApplicationActionLabel() {
    const submit = this.getCurrentApplicationAction("submit");
    const next = this.getCurrentApplicationAction("next");
    const previous = this.getCurrentApplicationAction("previous");
    const action = submit || next || previous;
    if (!action) return void 0;
    return cleanText(action.textContent || action.getAttribute("aria-label")) || void 0;
  }
  getCurrentApplicationActionKind() {
    const submit = this.getCurrentApplicationAction("submit");
    if (submit) {
      return "submit";
    }
    if (this.getCurrentApplicationAction("next")) return "next";
    return void 0;
  }
  async openApplication() {
    const currentUrl = window.location.href;
    if (this.getApplicationRoot()) {
      return {
        status: "already_open",
        message: "LinkedIn Easy Apply is already open.",
        url: currentUrl
      };
    }
    let trigger = this.findEasyApplyTrigger();
    if (!trigger) {
      trigger = await this.waitForEasyApplyTrigger();
    }
    if (!trigger) {
      return {
        status: "unavailable",
        message: "LinkedIn Easy Apply is not available on this page.",
        url: currentUrl
      };
    }
    try {
      trigger.scrollIntoView({ block: "center", inline: "nearest" });
    } catch {
    }
    trigger.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true }));
    trigger.dispatchEvent(new MouseEvent("mouseup", { bubbles: true, cancelable: true }));
    trigger.click();
    if (await this.waitForApplicationRoot()) {
      return {
        status: "opened",
        message: "LinkedIn Easy Apply form is open.",
        url: window.location.href
      };
    }
    return {
      status: "clicked",
      message: "LinkedIn Easy Apply click was dispatched; waiting for the application form.",
      url: window.location.href
    };
  }
  async clickApplicationAction(action) {
    const currentUrl = window.location.href;
    const root = this.getApplicationRoot();
    const documentSubmit = action === "submit" ? findVisible(
      document,
      [
        ...SELECTORS.submitAction,
        "button[type='submit']"
      ],
      (candidate) => /(?:submit|提交|应聘|申请)/i.test(
        cleanText(candidate.textContent || candidate.getAttribute("aria-label"))
      )
    ) : null;
    if (!root && !documentSubmit) {
      return {
        status: "not_open",
        message: "Open the LinkedIn Easy Apply form first.",
        url: currentUrl
      };
    }
    this.invalidateApplicationActionCache();
    const button = this.getCurrentApplicationAction(action) || documentSubmit;
    if (!button) {
      return {
        status: "unavailable",
        message: action === "submit" ? "The LinkedIn submit action is not available yet." : action === "previous" ? "The LinkedIn previous action is not available." : "The LinkedIn next action is not available yet.",
        url: currentUrl
      };
    }
    const actionLabel = cleanText(button.textContent || button.getAttribute("aria-label")) || void 0;
    try {
      button.scrollIntoView({ block: "center", inline: "nearest" });
    } catch {
    }
    button.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true }));
    button.dispatchEvent(new MouseEvent("mouseup", { bubbles: true, cancelable: true }));
    button.click();
    if (action === "submit" && !await this.waitForSubmissionConfirmation()) {
      return {
        status: "unavailable",
        message: "LinkedIn did not confirm the submission; review the application form before retrying.",
        url: currentUrl,
        ...actionLabel ? { actionLabel } : {}
      };
    }
    const message = action === "submit" ? "LinkedIn application submitted." : action === "previous" ? "LinkedIn application moved to the previous step." : "LinkedIn application moved to the next step.";
    return {
      status: "clicked",
      message,
      url: currentUrl,
      ...actionLabel ? { actionLabel } : {}
    };
  }
  findEasyApplyTrigger() {
    return findVisible(document, SELECTORS.easyApply, (element) => {
      const label = cleanText(
        element.getAttribute("aria-label") || element.textContent
      );
      const href = element.getAttribute("href") || "";
      const classList = typeof element.className === "string" ? element.className : "";
      const isExternal = /apply\s+on\s+company|continue\s+to\s+company|external/i.test(label);
      if (isExternal) return false;
      const isEasyApplyText = /(?:easy\s*apply|简单申请|輕鬆應聘|轻松应聘|一键应聘|一键申请)/i.test(
        label
      );
      const isEasyApplyUrl = /\/jobs\/view\/\d+\/apply(?:[/?#]|$)/i.test(href);
      const isApplyButtonClass = classList.includes("jobs-apply-button") || classList.includes("jobs-s-apply") || Boolean(element.closest(".jobs-apply-button"));
      const hasEasyApplyTestHook = element.hasAttribute("data-live-test-job-apply");
      return isEasyApplyText || isEasyApplyUrl || isApplyButtonClass && hasEasyApplyTestHook;
    });
  }
  isEasyApplyRoot(element) {
    const className = typeof element.className === "string" ? element.className : "";
    if (/jobs-easy-apply-(?:modal|content|form)/i.test(className)) return true;
    const label = cleanText(
      `${element.getAttribute("aria-label") || ""} ${deepFirst(element, 'h1, h2, [role="heading"]')?.textContent || ""}`
    );
    if (/(?:easy\s*apply|简单申请|輕鬆應聘|轻松应聘|一键应聘|一键申请)/i.test(label)) {
      return true;
    }
    const hasApplicationField = Boolean(deepFirst(element, APPLICATION_FIELD_SELECTOR));
    if (/(?:apply\s+to|申请(?:职位|工作)?|应聘)/i.test(label) && hasApplicationField) {
      return true;
    }
    const hasApplicationAction = Boolean(deepFirst(
      element,
      'form.jobs-easy-apply-form, [data-live-test-easy-apply-submit-button], [data-live-test-easy-apply-next-button], button[aria-label*="Continue"], button[aria-label*="Next"], button[aria-label*="Review"], button[aria-label*="Submit"]'
    ));
    const isModalLike = element.matches(
      '[role="dialog"], .artdeco-modal, [data-test-modal], [data-test-modal-container], .jobs-easy-apply-content, form.jobs-easy-apply-form'
    );
    return isModalLike && (hasApplicationField || hasApplicationAction);
  }
  applicationRootCandidates() {
    const seen = /* @__PURE__ */ new Set();
    const candidates = [];
    const elements = deepElements(document);
    for (const selector of APPLICATION_ROOT_SELECTOR) {
      elements.filter((element) => element.matches(selector)).forEach((candidate) => {
        if (seen.has(candidate)) return;
        seen.add(candidate);
        candidates.push(candidate);
      });
    }
    return candidates;
  }
  findFullPageApplicationRoot() {
    if (!this.isFullPageApplicationFlow()) return null;
    const seen = /* @__PURE__ */ new Set();
    const candidates = [];
    const elements = deepElements(document);
    const addCandidates = (selector) => {
      elements.filter((element) => element.matches(selector)).forEach((candidate) => {
        if (seen.has(candidate)) return;
        seen.add(candidate);
        candidates.push(candidate);
      });
    };
    addCandidates("form");
    addCandidates("[data-testid*='application'], [data-test*='application']");
    addCandidates("main");
    return candidates.find(
      (candidate) => isVisible(candidate) && !this.hasHiddenModalAncestor(candidate) && (this.hasVisibleApplicationField(candidate) || this.hasApplicationAction(candidate))
    ) || null;
  }
  findApplicationRootFromHeading() {
    const heading = deepElements(document).find((element) => {
      if (!isVisible(element)) return false;
      const text = cleanText(element.textContent);
      return /^apply\s+to\s+.+/i.test(text) || /^申请(?:职位|工作)?\s*.+/.test(text);
    });
    if (!heading) return null;
    let candidate = heading;
    for (let depth = 0; candidate && depth < 9; depth += 1) {
      if (isVisible(candidate) && this.hasVisibleApplicationField(candidate) && this.hasApplicationAction(candidate)) {
        return candidate;
      }
      const currentRoot = candidate.getRootNode();
      const shadowHost = currentRoot instanceof ShadowRoot && currentRoot.host instanceof HTMLElement ? currentRoot.host : null;
      candidate = candidate.parentElement || shadowHost;
    }
    return null;
  }
  hasVisibleApplicationField(root) {
    return deepQueryAll(root, APPLICATION_FIELD_SELECTOR).some((field) => isVisible(field));
  }
  hasApplicationAction(root) {
    return deepQueryAll(root, 'button, [role="button"]').some((button) => {
      const label = cleanText(
        button.textContent || button.getAttribute("aria-label")
      );
      return isVisible(button) && /(?:continue|next|review|submit|申请|提交|继续|下一步|审核|检查)/i.test(label);
    });
  }
  hasHiddenModalAncestor(element) {
    let current = element;
    while (current) {
      if (current.getAttribute("aria-hidden") === "true") return true;
      current = current.parentElement;
    }
    return false;
  }
  isExplicitlyActiveModal(element) {
    if (this.hasHiddenModalAncestor(element)) return false;
    const container = element.closest(
      "[data-test-modal-container], [data-test-modal]"
    );
    if (!container) return false;
    const ariaHidden = container.getAttribute("aria-hidden");
    return ariaHidden === "false" || ariaHidden === null && isVisible(container);
  }
  async waitForApplicationRoot() {
    for (let attempt = 0; attempt < 30; attempt += 1) {
      const root = this.getApplicationRoot();
      if (root) return root;
      await new Promise((resolve) => window.setTimeout(resolve, 100));
    }
    return this.getApplicationRoot();
  }
  async waitForEasyApplyTrigger() {
    for (let attempt = 0; attempt < 20; attempt += 1) {
      const trigger = this.findEasyApplyTrigger();
      if (trigger) return trigger;
      await new Promise((resolve) => window.setTimeout(resolve, 150));
    }
    return this.findEasyApplyTrigger();
  }
  hasCurrentJobReference(jobId) {
    if (!jobId) return false;
    const currentUrl = window.location.href;
    const jobPattern = new RegExp(`/jobs/view/${jobId}(?:/|\\?|$)`, "i");
    if (jobPattern.test(currentUrl) || new URLSearchParams(window.location.search).get("currentJobId") === jobId) {
      return true;
    }
    const titleLink = document.querySelector(
      "main h1 a[href*='/jobs/view/'], main [role='heading'][aria-level='1'] a[href*='/jobs/view/']"
    );
    if (titleLink) return jobPattern.test(titleLink.getAttribute("href") || "");
    const links = Array.from(
      document.querySelectorAll("a[href*='/jobs/view/']")
    );
    if (!links.length) return true;
    return links.some(
      (link) => jobPattern.test(link.getAttribute("href") || "")
    );
  }
  async waitForSubmissionConfirmation() {
    for (let attempt = 0; attempt < 10; attempt += 1) {
      if (this.hasSubmissionConfirmation()) return true;
      if (attempt > 0 && !this.getApplicationRoot()) return true;
      await new Promise((resolve) => window.setTimeout(resolve, 100));
    }
    return !this.getApplicationRoot() || this.hasSubmissionConfirmation();
  }
  hasSubmissionConfirmation() {
    const bodyText = cleanText(document.body?.textContent);
    return /application (?:was )?sent|application submitted|you(?:'|’)ve applied/i.test(
      bodyText
    );
  }
}
export const linkedinAdapter = new LinkedInAdapter();
