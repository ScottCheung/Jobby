/** @format */

import type { MasterResumeData } from "../../shared/contracts/tailored-resume";
import { createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { formatResumeFilename } from "@jobby/ui/components/UI/Resume";
import { Input } from "@jobby/ui/components/UI/input";
import type { TailoredResume } from "../../shared/contracts/tailored-resume";
import { formatRelativeTime } from "../../shared/utils/date-formatter";

const MODAL_ROOT_ID = "jobby-in-page-resume-modal-root";
const LIBRARY_ROOT_ID = "jobby-in-page-resume-library-root";

export interface ShowResumePreviewOptions {
  data: MasterResumeData;
  coreCompetencies?: string[];
  keyQualifications?: string[];
  company?: string;
  jobTitle?: string;
  filename?: string;
  pdfDataUrl?: string;
  pages?: number;
  fileSize?: number;
  pdfScale?: number;
  generatedAt?: string;
  themeColor?: string;
  editUrl?: string;
}

let activeEscListener: ((e: KeyboardEvent) => void) | null = null;
let activePdfBlobUrl: string | null = null;
let activeLibraryInputRoot: Root | null = null;
let activeLibraryThemeListener:
  | ((
      changes: { [key: string]: chrome.storage.StorageChange },
      area: string,
    ) => void)
  | null = null;

function createPagePdfBlobUrl(pdfDataUrl: string): string | null {
  const requestId = `jobby-pdf-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  let blobUrl: string | null = null;
  const onResponse = (event: Event) => {
    if (!(event instanceof CustomEvent)) return;
    const detail = event.detail as {
      requestId?: unknown;
      ok?: unknown;
      blobUrl?: unknown;
    };
    if (
      detail.requestId === requestId &&
      detail.ok === true &&
      typeof detail.blobUrl === "string"
    )
      blobUrl = detail.blobUrl;
  };
  document.addEventListener("jobby.combobox-response", onResponse, true);
  document.dispatchEvent(
    new CustomEvent("jobby.combobox-request", {
      detail: { requestId, action: "create-pdf-blob-url", dataUrl: pdfDataUrl },
    }),
  );
  document.removeEventListener("jobby.combobox-response", onResponse, true);
  return blobUrl;
}

export interface ShowResumeLibraryOptions {
  resumes: TailoredResume[];
  selectedId?: string;
}

export function closeInPageResumeLibraryModal(): void {
  activeLibraryInputRoot?.unmount();
  activeLibraryInputRoot = null;
  if (activeLibraryThemeListener && chrome.storage?.onChanged) {
    chrome.storage.onChanged.removeListener(activeLibraryThemeListener);
    activeLibraryThemeListener = null;
  }
  document.getElementById(LIBRARY_ROOT_ID)?.remove();
}

function applyLibraryTheme(container: HTMLElement): void {
  const updateTheme = (stored: Record<string, unknown>) => {
    const color =
      typeof stored["auto-job-ui-theme-color"] === "string"
        ? stored["auto-job-ui-theme-color"]
        : "green";
    const storedMode = stored["auto-job-ui-theme"];
    const isDark =
      storedMode === "dark" ||
      (storedMode !== "light" &&
        window.matchMedia("(prefers-color-scheme: dark)").matches);
    const theme = THEME_COLOR_MAP[color] ?? THEME_COLOR_MAP.green!;
    container.style.setProperty(
      "--jobby-library-primary",
      isDark ? theme.primaryDark : theme.primary,
    );
    container.style.setProperty("--jobby-library-primary-foreground", "#fff");
  };

  if (!chrome.storage?.local) {
    updateTheme({});
    return;
  }
  chrome.storage.local.get(
    ["auto-job-ui-theme-color", "auto-job-ui-theme"],
    (stored) => updateTheme((stored as Record<string, unknown>) || {}),
  );
  activeLibraryThemeListener = (changes, area) => {
    if (
      area === "local" &&
      (changes["auto-job-ui-theme-color"] || changes["auto-job-ui-theme"])
    ) {
      chrome.storage.local.get(
        ["auto-job-ui-theme-color", "auto-job-ui-theme"],
        (stored) => updateTheme((stored as Record<string, unknown>) || {}),
      );
    }
  };
  chrome.storage.onChanged.addListener(activeLibraryThemeListener);
}

export function showInPageResumeLibraryModal({
  resumes,
  selectedId,
}: ShowResumeLibraryOptions): void {
  closeInPageResumeLibraryModal();
  const container = document.createElement("div");
  container.id = LIBRARY_ROOT_ID;
  container.style.cssText =
    "position:fixed!important;inset:0!important;z-index:2147483647!important;";
  const shadow = container.attachShadow({ mode: "open" });
  applyLibraryTheme(container);
  const escapeHtml = (value: string) =>
    value
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  const companies = Array.from(
    new Set(resumes.map((item) => item.company?.trim()).filter(Boolean)),
  ) as string[];
  const cards = resumes
    .map((item) => {
      const searchText = [
        item.job_title,
        item.company,
        item.job_description,
        ...(item.core_competencies || []),
        ...(item.key_qualifications || []),
      ]
        .filter(Boolean)
        .join(" ")
        .toLocaleLowerCase();
      return `<article class="resume-card ${item.id === selectedId ? "selected" : ""}" data-id="${escapeHtml(item.id)}" data-company="${escapeHtml(item.company?.trim() || "")}" data-search="${escapeHtml(searchText)}"><div class="card-top"><span class="role">${escapeHtml(item.job_title || "Tailored Resume")}</span><span class="date">${escapeHtml(formatRelativeTime(item.created_at))}</span></div><span class="company">${escapeHtml(item.company || "Job application")}</span><div class="actions"><button data-document="resume">CV</button>${item.cover_letter ? '<button class="secondary" data-document="cover_letter">CL</button>' : ""}<button class="delete" data-action="delete" aria-label="Delete this tailored resume">Delete</button></div></article>`;
    })
    .join("");
  shadow.innerHTML = `<style>
    :host{--library-primary:var(--primary,267 75% 53%);--library-primary-foreground:var(--primary-foreground,0 0% 100%);--library-background:var(--background,0 0% 100%);--library-foreground:var(--foreground,222 47% 11%);--library-muted:var(--muted,220 14% 96%);--library-muted-foreground:var(--muted-foreground,215 16% 47%);--library-border:var(--border,214 32% 91%)}
    *{box-sizing:border-box;font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif}
    .backdrop{position:fixed;inset:0;background:hsl(222 47% 11% / .68);backdrop-filter:blur(8px);padding:24px;display:flex;align-items:center;justify-content:center}
    .library{width:min(1440px,96vw);height:min(880px,94vh);display:flex;flex-direction:column;overflow:hidden;border:1px solid hsl(var(--library-border));border-radius:20px;background:hsl(var(--library-background));color:hsl(var(--library-foreground));box-shadow:0 30px 80px hsl(222 47% 11% / .4)}
    header{padding:18px 22px;border-bottom:1px solid hsl(var(--library-border));display:flex;justify-content:space-between;align-items:center}.eyebrow{margin:0;color:hsl(var(--library-primary));font-size:11px;font-weight:800;letter-spacing:.12em;text-transform:uppercase}.title{margin:3px 0 0;font-size:20px}.close{border:0;background:hsl(var(--library-muted));color:hsl(var(--library-muted-foreground));border-radius:9px;font-size:21px;line-height:1;padding:8px 11px;cursor:pointer}
    .library-content{min-height:0;flex:1;overflow:auto}.filters{position:sticky;top:0;z-index:1;display:grid;grid-template-columns:minmax(220px,1fr) minmax(180px,260px) auto;align-items:center;gap:10px;padding:14px 22px;border-bottom:1px solid hsl(var(--library-border));background:hsl(var(--library-background) / .96);backdrop-filter:blur(12px)}input,select{width:100%;border:1px solid hsl(var(--library-border));border-radius:9px;background:hsl(var(--library-background));padding:10px 11px;color:hsl(var(--library-foreground));outline:none}input:focus,select:focus{border-color:hsl(var(--library-primary));box-shadow:0 0 0 3px hsl(var(--library-primary) / .14)}.count{font-size:12px;font-weight:650;color:hsl(var(--library-muted-foreground));white-space:nowrap}.waterfall{columns:4 220px;column-gap:14px;padding:18px 22px 28px}.resume-card{display:flex;break-inside:avoid;flex-direction:column;gap:7px;margin:0 0 14px;padding:14px;border:1px solid hsl(var(--library-border));border-radius:12px;background:hsl(var(--library-background));box-shadow:0 1px 2px hsl(var(--library-foreground) / .04);transition:border-color .16s,box-shadow .16s,transform .16s}.resume-card[hidden]{display:none!important}.resume-card:hover,.resume-card.selected{border-color:hsl(var(--library-primary));box-shadow:0 8px 20px hsl(var(--library-primary) / .12)}.resume-card:hover{transform:translateY(-1px)}.card-top{display:flex;align-items:flex-start;gap:10px;justify-content:space-between}.role{font-size:14px;font-weight:750;line-height:1.35;color:hsl(var(--library-foreground))}.company{font-size:12px;font-weight:650;color:hsl(var(--library-muted-foreground))}.date{flex:0 0 auto;font-size:10px;font-weight:650;color:hsl(var(--library-muted-foreground));white-space:nowrap}.actions{display:flex;gap:6px;margin-top:3px}.actions button{border:0;border-radius:7px;background:hsl(var(--library-primary));color:hsl(var(--library-primary-foreground));padding:6px 10px;font-size:11px;font-weight:750;cursor:pointer}.actions button.secondary{background:hsl(var(--library-primary) / .12);color:hsl(var(--library-primary))}.actions button.delete{margin-left:auto;background:transparent;color:hsl(var(--library-muted-foreground));padding-inline:4px}.actions button.delete:hover{color:hsl(var(--library-primary))}.empty{padding:32px 22px;color:hsl(var(--library-muted-foreground));text-align:center}
    :host{--library-primary:var(--jobby-library-primary,var(--primary,#10b981));--library-primary-foreground:var(--jobby-library-primary-foreground,var(--primary-foreground,#fff))}.eyebrow{color:var(--library-primary)}input:focus,select:focus{border-color:var(--library-primary);box-shadow:0 0 0 3px color-mix(in srgb,var(--library-primary) 14%,transparent)}.resume-card:hover,.resume-card.selected{border-color:var(--library-primary);box-shadow:0 8px 20px color-mix(in srgb,var(--library-primary) 12%,transparent)}.actions button{background:var(--library-primary);color:var(--library-primary-foreground)}.actions button.secondary{background:color-mix(in srgb,var(--library-primary) 12%,transparent);color:var(--library-primary)}.actions button.delete{background:transparent;color:hsl(var(--library-muted-foreground))}.actions button.delete:hover{color:var(--library-primary)}
    @media(max-width:720px){.backdrop{padding:10px}.library{width:100%;height:100%;border-radius:0}.filters{grid-template-columns:1fr}.waterfall{columns:1;padding:14px}.count{white-space:normal}}
  </style><div class="backdrop"><section class="library"><header><div><p class="eyebrow">Resume library</p><h1 class="title">Browse tailored resumes</h1></div><button class="close" aria-label="Close">×</button></header><div class="library-content"><div class="filters"><input placeholder="Search role, company or skills" aria-label="Search resumes"><select aria-label="Filter by company"><option value="">All companies</option>${companies.map((company) => `<option value="${escapeHtml(company)}">${escapeHtml(company)}</option>`).join("")}</select><span class="count">${resumes.length} tailored resumes</span></div><main class="waterfall">${cards || '<p class="empty">No saved resumes.</p>'}</main></div></section></div>`;
  const nativeSearch = shadow.querySelector("input") as HTMLInputElement;
  const searchRoot = document.createElement("div");
  searchRoot.className = "search-input-root";
  nativeSearch.replaceWith(searchRoot);
  let search: HTMLInputElement | null = null;
  const companyFilter = shadow.querySelector("select") as HTMLSelectElement;
  const count = shadow.querySelector(".count") as HTMLSpanElement;
  const updateList = () => {
    const query = search?.value.trim().toLocaleLowerCase() || "";
    const company = companyFilter.value;
    let visible = 0;
    shadow.querySelectorAll<HTMLElement>(".resume-card").forEach((card) => {
      const isHidden = Boolean(
        (company && card.dataset.company !== company) ||
        (query && !card.dataset.search?.includes(query)),
      );
      card.hidden = isHidden;
      if (!isHidden) visible += 1;
    });
    count.textContent = `${visible} tailored resume${visible === 1 ? "" : "s"}`;
  };
  activeLibraryInputRoot = createRoot(searchRoot);
  activeLibraryInputRoot.render(
    createElement(Input, {
      ref: (node: HTMLInputElement | null) => {
        search = node;
      },
      className: "library-input",
      placeholder: "Search role, company or skills",
      "aria-label": "Search resumes",
      onInput: updateList,
      onChange: updateList,
    }),
  );
  companyFilter.addEventListener("change", updateList);
  shadow
    .querySelector(".close")
    ?.addEventListener("click", closeInPageResumeLibraryModal);
  shadow.querySelector(".backdrop")?.addEventListener("click", (event) => {
    if (event.target === event.currentTarget) closeInPageResumeLibraryModal();
  });
  shadow
    .querySelectorAll<HTMLButtonElement>(".actions button[data-document]")
    .forEach((button) =>
      button.addEventListener("click", () => {
        const item = button.closest<HTMLElement>(".resume-card");
        const documentType = button.dataset.document;
        if (
          !item?.dataset.id ||
          (documentType !== "resume" && documentType !== "cover_letter")
        )
          return;
        shadow
          .querySelectorAll(".resume-card.selected")
          .forEach((card) => card.classList.remove("selected"));
        item.classList.add("selected");
        // Rendering @react-pdf in a content script fails because its WASM runtime
        // cannot be instantiated there. The side panel owns PDF generation; keep
        // this library open underneath the document preview for a quick return.
        void chrome.runtime.sendMessage({
          type: "tailor.preview-library-document",
          id: item.dataset.id,
          documentType,
        });
      }),
    );
  shadow
    .querySelectorAll<HTMLButtonElement>(".actions button[data-action=delete]")
    .forEach((button) =>
      button.addEventListener("click", () => {
        const item = button.closest<HTMLElement>(".resume-card");
        if (!item?.dataset.id) return;
        if (
          !window.confirm("Delete this tailored resume? This cannot be undone.")
        )
          return;
        button.disabled = true;
        void chrome.runtime
          .sendMessage({
            type: "tailor.delete-library-resume",
            id: item.dataset.id,
          })
          .then((response: { ok?: boolean } | undefined) => {
            if (response?.ok) {
              item.remove();
              updateList();
              return;
            }
            button.disabled = false;
          })
          .catch(() => {
            button.disabled = false;
          });
      }),
    );
  document.documentElement.appendChild(container);
}

export function closeInPageResumePreviewModal(): void {
  if (activeEscListener) {
    window.removeEventListener("keydown", activeEscListener, true);
    activeEscListener = null;
  }
  if (activePdfBlobUrl) {
    URL.revokeObjectURL(activePdfBlobUrl);
    activePdfBlobUrl = null;
  }
  const existing = document.getElementById(MODAL_ROOT_ID);
  if (existing) {
    existing.remove();
  }
}

function formatBytes(bytes?: number): string {
  if (!bytes || bytes <= 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

const THEME_COLOR_MAP: Record<
  string,
  { primary: string; primaryDark: string }
> = {
  purple: {
    primary: "#8b5cf6",
    primaryDark: "#a78bfa",
  },
  blue: {
    primary: "#3b82f6",
    primaryDark: "#60a5fa",
  },
  green: {
    primary: "#10b981",
    primaryDark: "#34d399",
  },
  orange: {
    primary: "#f97316",
    primaryDark: "#fb923c",
  },
  rose: {
    primary: "#f43f5e",
    primaryDark: "#fb7185",
  },
};

export async function showInPageResumePreviewModal(
  options: ShowResumePreviewOptions,
): Promise<void> {
  closeInPageResumePreviewModal();

  const {
    data,
    company,
    jobTitle,
    filename,
    pdfDataUrl,
    pages = 1,
    fileSize = 0,
    generatedAt,
    themeColor,
    editUrl,
  } = options;

  let color = themeColor || "purple";
  let isDarkMode =
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-color-scheme: dark)").matches;

  if (typeof chrome !== "undefined" && chrome.storage?.local) {
    try {
      const stored = await new Promise<Record<string, unknown>>((resolve) => {
        chrome.storage.local.get(
          ["auto-job-ui-theme-color", "auto-job-ui-theme"],
          (res) => resolve((res as Record<string, unknown>) || {}),
        );
      });
      if (
        typeof stored["auto-job-ui-theme-color"] === "string" &&
        stored["auto-job-ui-theme-color"]
      ) {
        color = stored["auto-job-ui-theme-color"];
      }
      if (stored["auto-job-ui-theme"] === "dark") isDarkMode = true;
      if (stored["auto-job-ui-theme"] === "light") isDarkMode = false;
    } catch {
      // Use defaults
    }
  }

  const defaultTheme = THEME_COLOR_MAP.purple!;
  const theme = THEME_COLOR_MAP[color] ?? defaultTheme;
  const primaryColor = isDarkMode ? theme.primaryDark : theme.primary;

  const rawFilename = filename || formatResumeFilename(data, company, jobTitle);
  const downloadFilename = `${rawFilename.replace(/\.pdf$/i, "") || "resume"}.pdf`;

  // Create real PDF Blob URL from passed base64 Data URL
  let localPdfBlobUrl: string | null = null;
  if (pdfDataUrl) {
    try {
      // Chrome's built-in PDF viewer cannot always read a Blob URL created in
      // an extension isolated world. Prefer a page-world URL for the iframe.
      localPdfBlobUrl = createPagePdfBlobUrl(pdfDataUrl);
      if (!localPdfBlobUrl) {
        const parts = pdfDataUrl.split(",");
        const base64Str = parts[1] ?? parts[0] ?? "";
        const byteString = atob(base64Str);
        const ab = new ArrayBuffer(byteString.length);
        const ia = new Uint8Array(ab);
        for (let i = 0; i < byteString.length; i++) {
          ia[i] = byteString.charCodeAt(i);
        }
        const blob = new Blob([ab], { type: "application/pdf" });
        localPdfBlobUrl = URL.createObjectURL(blob);
      }
      activePdfBlobUrl = localPdfBlobUrl;
    } catch (e) {
      console.warn("Could not parse PDF Data URL:", e);
    }
  }

  const container = document.createElement("div");
  container.id = MODAL_ROOT_ID;
  container.style.cssText =
    "position: fixed !important; inset: 0 !important; z-index: 2147483647 !important; pointer-events: auto !important; width: 0 !important; height: 0 !important; border: none !important; margin: 0 !important; padding: 0 !important; overflow: visible !important;";
  const shadow = container.attachShadow({ mode: "open" });

  const escapeHtml = (str: string): string => {
    return str
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  };

  const formattedTime = generatedAt
    ? formatTime(new Date(generatedAt))
    : formatTime(new Date());

  shadow.innerHTML = `
    <style>
      :host {
        all: initial !important;
        position: fixed !important;
        inset: 0 !important;
        z-index: 2147483647 !important;
        pointer-events: none !important;
        width: 100vw !important;
        height: 100vh !important;
        overflow: visible !important;
        font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
      }
      *, *::before, *::after, button, input, select, textarea, span, p, div, h1, h2, h3 {
        font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
        box-sizing: border-box;
      }
      * {
        scrollbar-width: thin;
        scrollbar-color: ${isDarkMode ? "rgba(255, 255, 255, 0.2)" : "rgba(100, 116, 139, 0.25)"} transparent;
      }
      *::-webkit-scrollbar {
        width: 6px;
        height: 6px;
      }
      *::-webkit-scrollbar-track {
        background: transparent;
      }
      *::-webkit-scrollbar-thumb {
        background-color: ${isDarkMode ? "rgba(255, 255, 255, 0.2)" : "rgba(100, 116, 139, 0.25)"};
        border-radius: 9999px;
        border: 1px solid transparent;
        background-clip: content-box;
      }
      *::-webkit-scrollbar-thumb:hover {
        background-color: ${isDarkMode ? "rgba(255, 255, 255, 0.35)" : "rgba(100, 116, 139, 0.45)"};
      }
      .modal-backdrop {
        position: fixed !important;
        inset: 0 !important;
        width: 100vw !important;
        height: 100vh !important;
        z-index: 2147483647 !important;
        pointer-events: auto !important;
        background: rgba(0, 0, 0, 0.65);
        backdrop-filter: blur(8px);
        -webkit-backdrop-filter: blur(8px);
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 20px;
        box-sizing: border-box;
        animation: fadeIn 0.15s cubic-bezier(0.16, 1, 0.3, 1);
      }
      .modal-card {
        width: 88vw;
        max-width: 1152px;
        height: 90vh;
        background: ${isDarkMode ? "#0f172a" : "#ffffff"};
        border-radius: 16px;
        box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.45), 0 0 0 1px ${isDarkMode ? "rgba(255, 255, 255, 0.1)" : "rgba(15, 23, 42, 0.08)"};
        border: 1px solid ${isDarkMode ? "rgba(255, 255, 255, 0.1)" : "rgba(15, 23, 42, 0.08)"};
        display: flex;
        flex-direction: column;
        overflow: hidden;
        animation: slideUp 0.18s cubic-bezier(0.16, 1, 0.3, 1);
      }
      .modal-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 14px 14px;
        border-bottom: 1px solid ${isDarkMode ? "rgba(255, 255, 255, 0.08)" : "rgba(15, 23, 42, 0.08)"};
        background: ${isDarkMode ? "rgba(30, 41, 59, 0.85)" : "rgba(255, 255, 255, 0.85)"};
        backdrop-filter: blur(12px);
        -webkit-backdrop-filter: blur(12px);
        flex-shrink: 0;
      }
      .header-title-group {
        display: flex;
        align-items: center;
        gap: 12px;
        min-width: 0;
      }
      .header-icon {
        width: 36px;
        height: 36px;
        border-radius: 8px;
        background: color-mix(in srgb, ${primaryColor} 12%, transparent);
        color: ${primaryColor};
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
      }
      .header-icon-text {
        font-size: 11px;
        font-weight: 700;
        line-height: 1;
      }
      .header-info {
        min-width: 0;
      }
      .header-filename-row {
        display: flex;
        align-items: center;
        gap: 8px;
      }
      .header-filename {
        font-size: 13.5px;
        font-weight: 600;
        color: ${isDarkMode ? "#f8fafc" : "#0f172a"};
        margin: 0;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        max-width: 520px;
        line-height: 1.3;
      }
      .header-meta {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 4px;
        font-size: 10px;
        color: ${isDarkMode ? "#94a3b8" : "#64748b"};
        margin-top: 1px;
        line-height: 1.2;
      }
      .header-actions {
        display: flex;
        align-items: center;
        gap: 8px;
        flex-shrink: 0;
      }
      .btn-download {
        background: ${primaryColor};
        color: #ffffff;
        border: none;
        padding: 7px 14px;
        border-radius: 8px;
        font-size: 12px;
        font-weight: 600;
        cursor: pointer;
        display: flex;
        align-items: center;
        gap: 6px;
        transition: opacity 0.15s ease, transform 0.15s ease;
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
      }
      .btn-download:hover {
        opacity: 0.92;
        transform: scale(1.02);
      }
      .btn-download:active {
        transform: scale(0.98);
      }
      .btn-edit {
        background: transparent;
        color: ${primaryColor};
        border: 1px solid ${primaryColor};
        padding: 7px 14px;
        border-radius: 8px;
        font-size: 12px;
        font-weight: 600;
        cursor: pointer;
        transition: background 0.15s ease, color 0.15s ease;
      }
      .btn-edit:hover {
        background: ${primaryColor};
        color: #ffffff;
      }
      .btn-close {
        background: transparent;
        border: none;
        color: ${isDarkMode ? "#94a3b8" : "#64748b"};
        width: 32px;
        height: 32px;
        border-radius: 8px;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: background 0.15s ease, color 0.15s ease;
      }
      .btn-close:hover {
        background: ${isDarkMode ? "rgba(255, 255, 255, 0.08)" : "rgba(15, 23, 42, 0.06)"};
        color: ${isDarkMode ? "#f8fafc" : "#0f172a"};
      }

      /* Modal Body with true PDF iframe */
      .modal-body {
        flex: 1;
        overflow: hidden;
        background: ${isDarkMode ? "#090d16" : "#f1f5f9"};
        display: flex;
        align-items: stretch;
        justify-content: center;
        position: relative;
      }
      .pdf-iframe {
        width: 100%;
        height: 100%;
        border: 0;
        background: transparent;
      }
      .loading-state {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 8px;
        color: ${isDarkMode ? "#94a3b8" : "#64748b"};
        font-size: 12px;
        font-weight: 500;
      }
      .spinner {
        width: 24px;
        height: 24px;
        border: 2.5px solid color-mix(in srgb, ${primaryColor} 25%, transparent);
        border-top-color: ${primaryColor};
        border-radius: 50%;
        animation: spin 0.8s linear infinite;
      }

      @keyframes spin {
        to { transform: rotate(360deg); }
      }
      @keyframes fadeIn {
        from { opacity: 0; }
        to { opacity: 1; }
      }
      @keyframes slideUp {
        from { transform: translateY(14px) scale(0.99); opacity: 0; }
        to { transform: translateY(0) scale(1); opacity: 1; }
      }
    </style>

    <div class="modal-backdrop" id="jobby-modal-backdrop">
      <div class="modal-card" id="jobby-modal-card">
        <header class="modal-header">
          <div class="header-title-group">
            <div class="header-icon">
              <div class="header-icon-text">PDF</div>
            </div>
            <div class="header-info">
              <div class="header-filename-row">
                <p class="header-filename">${escapeHtml(downloadFilename)}</p>
              </div>
              <div class="header-meta">
                <span>${pages ?? 1} page${pages === 1 ? "" : "s"}</span>
                ${fileSize ? `<span>•</span><span>${formatBytes(fileSize)}</span>` : ""}
                <span>•</span><span>${formattedTime} Generated</span>
              </div>
            </div>
          </div>

          <div class="header-actions">
            ${
              editUrl
                ? `
              <button type="button" class="btn-edit" id="jobby-btn-edit">
                Edit Resume
              </button>
            `
                : ""
            }
            <button type="button" class="btn-download" id="jobby-btn-download">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                <polyline points="7 10 12 15 17 10"></polyline>
                <line x1="12" y1="15" x2="12" y2="3"></line>
              </svg>
              <span>Download PDF</span>
            </button>
            <button type="button" class="btn-close" id="jobby-btn-close" aria-label="Close preview">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          </div>
        </header>

        <div class="modal-body">
          ${
            localPdfBlobUrl
              ? `
            <iframe
              title="Resume PDF preview"
              src="${localPdfBlobUrl}"
              class="pdf-iframe"
            ></iframe>
          `
              : `
            <div class="loading-state">
              <div class="spinner"></div>
              <p>Loading PDF engine...</p>
            </div>
          `
          }
        </div>
      </div>
    </div>
  `;

  // Attach event listeners
  const backdrop = shadow.getElementById("jobby-modal-backdrop");
  const card = shadow.getElementById("jobby-modal-card");
  const closeBtn = shadow.getElementById("jobby-btn-close");
  const downloadBtn = shadow.getElementById("jobby-btn-download");
  const editBtn = shadow.getElementById("jobby-btn-edit");

  backdrop?.addEventListener("click", (e) => {
    if (e.target === backdrop) closeInPageResumePreviewModal();
  });
  card?.addEventListener("click", (e) => e.stopPropagation());
  closeBtn?.addEventListener("click", closeInPageResumePreviewModal);

  downloadBtn?.addEventListener("click", () => {
    if (!localPdfBlobUrl) return;
    const link = document.createElement("a");
    link.href = localPdfBlobUrl;
    link.download = downloadFilename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  });

  editBtn?.addEventListener("click", () => {
    if (editUrl) window.open(editUrl, "_blank", "noopener");
  });

  activeEscListener = (e: KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      closeInPageResumePreviewModal();
    }
  };
  window.addEventListener("keydown", activeEscListener, true);

  const parent = document.documentElement || document.body;
  parent.appendChild(container);
}
