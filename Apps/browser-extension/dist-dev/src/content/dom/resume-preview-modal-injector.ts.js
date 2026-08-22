import {
  formatResumeFilename
} from "/vendor/fs-Users-xianzhezhang-Projects-Jobby-Jobby-packages-ui-src-components-UI-Resume-index.ts.js";
const MODAL_ROOT_ID = "jobby-in-page-resume-modal-root";
const LIBRARY_ROOT_ID = "jobby-in-page-resume-library-root";
let activeEscListener = null;
let activePdfBlobUrl = null;
function createPagePdfBlobUrl(pdfDataUrl) {
  const requestId = `jobby-pdf-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  let blobUrl = null;
  const onResponse = (event) => {
    if (!(event instanceof CustomEvent)) return;
    const detail = event.detail;
    if (detail.requestId === requestId && detail.ok === true && typeof detail.blobUrl === "string")
      blobUrl = detail.blobUrl;
  };
  document.addEventListener("jobby.combobox-response", onResponse, true);
  document.dispatchEvent(
    new CustomEvent("jobby.combobox-request", {
      detail: { requestId, action: "create-pdf-blob-url", dataUrl: pdfDataUrl }
    })
  );
  document.removeEventListener("jobby.combobox-response", onResponse, true);
  return blobUrl;
}
export function closeInPageResumeLibraryModal() {
  document.getElementById(LIBRARY_ROOT_ID)?.remove();
}
export function showInPageResumeLibraryModal({
  resumes,
  selectedId
}) {
  closeInPageResumeLibraryModal();
  const container = document.createElement("div");
  container.id = LIBRARY_ROOT_ID;
  container.style.cssText = "position:fixed!important;inset:0!important;z-index:2147483647!important;";
  const shadow = container.attachShadow({ mode: "open" });
  const escapeHtml = (value) => value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
  const companies = Array.from(new Set(resumes.map((item) => item.company?.trim()).filter(Boolean)));
  const cards = resumes.map((item) => `<article class="resume-card ${item.id === selectedId ? "selected" : ""}" data-id="${escapeHtml(item.id)}"><span class="role">${escapeHtml(item.job_title || "Tailored Resume")}</span><span class="company">${escapeHtml(item.company || "Job application")}</span><span class="meta">${escapeHtml(new Date(item.created_at).toLocaleDateString())}</span><div class="actions"><button data-document="resume">Preview CV</button>${item.cover_letter ? '<button class="secondary" data-document="cover_letter">Preview CL</button>' : ""}</div></article>`).join("");
  shadow.innerHTML = `<style>
    *{box-sizing:border-box;font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif}
    .backdrop{position:fixed;inset:0;background:rgba(15,23,42,.68);backdrop-filter:blur(8px);padding:24px;display:flex;align-items:center;justify-content:center}
    .library{width:min(1240px,94vw);height:min(820px,92vh);display:flex;flex-direction:column;overflow:hidden;border-radius:20px;background:#fff;color:#0f172a;box-shadow:0 30px 80px rgba(0,0,0,.4)}
    header{padding:18px 22px;border-bottom:1px solid #e2e8f0;display:flex;justify-content:space-between;align-items:center}.eyebrow{margin:0;color:#7c3aed;font-size:11px;font-weight:800;letter-spacing:.12em;text-transform:uppercase}.title{margin:3px 0 0;font-size:20px}.close{border:0;background:#f1f5f9;color:#475569;border-radius:9px;font-size:21px;line-height:1;padding:8px 11px;cursor:pointer}
    .body{display:grid;grid-template-columns:340px minmax(0,1fr);min-height:0;flex:1}.sidebar{border-right:1px solid #e2e8f0;background:#f8fafc;display:flex;min-height:0;flex-direction:column}.filters{padding:16px;border-bottom:1px solid #e2e8f0;display:grid;gap:9px}input,select{width:100%;border:1px solid #cbd5e1;border-radius:10px;background:#fff;padding:10px 11px;color:#0f172a;outline:none}input:focus,select:focus{border-color:#8b5cf6;box-shadow:0 0 0 3px rgba(139,92,246,.14)}.count{font-size:12px;color:#64748b}.list{overflow:auto;padding:10px}.resume-card{display:grid;width:100%;gap:4px;margin-bottom:8px;padding:12px;border:1px solid #e2e8f0;border-radius:12px;background:#fff;text-align:left}.resume-card:hover,.resume-card.selected{border-color:#8b5cf6;background:#f5f3ff}.role{font-size:14px;font-weight:750;color:#1e1b4b}.company{font-size:12px;font-weight:600;color:#475569}.meta{font-size:11px;color:#94a3b8}.actions{display:flex;gap:7px;margin-top:6px}.actions button{border:0;border-radius:7px;background:#7c3aed;color:#fff;padding:6px 8px;font-size:11px;font-weight:700;cursor:pointer}.actions button.secondary{background:#ede9fe;color:#6d28d9}.preview{display:flex;align-items:center;justify-content:center;padding:40px;background:linear-gradient(135deg,#f8fafc,#eef2ff);text-align:center}.preview-card{max-width:430px}.preview-icon{margin:auto auto 16px;display:grid;width:58px;height:72px;place-items:center;border-radius:9px;background:#fff;color:#7c3aed;font-size:22px;box-shadow:0 8px 24px rgba(79,70,229,.14)}.preview h2{margin:0;font-size:22px}.preview p{color:#64748b;line-height:1.55}.preview button{border:0;border-radius:10px;background:#7c3aed;color:#fff;padding:11px 15px;font-weight:700;cursor:pointer}
    @media(max-width:720px){.backdrop{padding:10px}.library{width:100%;height:100%;border-radius:0}.body{grid-template-columns:1fr}.sidebar{border-right:0}.preview{display:none}}
  </style><div class="backdrop"><section class="library"><header><div><p class="eyebrow">Resume library</p><h1 class="title">Browse tailored resumes</h1></div><button class="close" aria-label="Close">×</button></header><div class="body"><aside class="sidebar"><div class="filters"><input placeholder="Search role, company or skills" aria-label="Search resumes"><select aria-label="Filter by company"><option value="">All companies</option>${companies.map((company) => `<option value="${escapeHtml(company)}">${escapeHtml(company)}</option>`).join("")}</select><span class="count">${resumes.length} tailored resumes</span></div><div class="list">${cards || '<p class="count">No saved resumes.</p>'}</div></aside><main class="preview"><div class="preview-card"><div class="preview-icon">PDF</div><h2>Preview a tailored resume</h2><p>Choose a saved version to open the full PDF preview on this page.</p></div></main></div></section></div>`;
  const search = shadow.querySelector("input");
  const companyFilter = shadow.querySelector("select");
  const list = shadow.querySelector(".list");
  const updateList = () => {
    const query = search.value.trim().toLocaleLowerCase();
    const company = companyFilter.value;
    list.querySelectorAll(".resume-card").forEach((card) => {
      const item = resumes.find((resume) => resume.id === card.dataset.id);
      const text = [item?.job_title, item?.company, item?.job_description, ...item?.core_competencies || []].filter(Boolean).join(" ").toLocaleLowerCase();
      card.hidden = Boolean(company && item?.company !== company || query && !text.includes(query));
    });
  };
  search.addEventListener("input", updateList);
  companyFilter.addEventListener("change", updateList);
  shadow.querySelector(".close")?.addEventListener("click", closeInPageResumeLibraryModal);
  shadow.querySelector(".backdrop")?.addEventListener("click", (event) => {
    if (event.target === event.currentTarget) closeInPageResumeLibraryModal();
  });
  shadow.querySelectorAll(".actions button").forEach((button) => button.addEventListener("click", () => {
    const item = button.closest(".resume-card");
    const documentType = button.dataset.document;
    if (!item?.dataset.id || documentType !== "resume" && documentType !== "cover_letter") return;
    closeInPageResumeLibraryModal();
    void chrome.runtime.sendMessage({
      type: "tailor.preview-library-document",
      id: item.dataset.id,
      documentType
    });
  }));
  document.documentElement.appendChild(container);
}
export function closeInPageResumePreviewModal() {
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
function formatBytes(bytes) {
  if (!bytes || bytes <= 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}
function formatTime(date) {
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}
const THEME_COLOR_MAP = {
  purple: {
    primary: "#8b5cf6",
    primaryDark: "#a78bfa"
  },
  blue: {
    primary: "#3b82f6",
    primaryDark: "#60a5fa"
  },
  green: {
    primary: "#10b981",
    primaryDark: "#34d399"
  },
  orange: {
    primary: "#f97316",
    primaryDark: "#fb923c"
  },
  rose: {
    primary: "#f43f5e",
    primaryDark: "#fb7185"
  }
};
export async function showInPageResumePreviewModal(options) {
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
    editUrl
  } = options;
  let color = themeColor || "purple";
  let isDarkMode = typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches;
  if (typeof chrome !== "undefined" && chrome.storage?.local) {
    try {
      const stored = await new Promise((resolve) => {
        chrome.storage.local.get(
          ["auto-job-ui-theme-color", "auto-job-ui-theme"],
          (res) => resolve(res || {})
        );
      });
      if (typeof stored["auto-job-ui-theme-color"] === "string" && stored["auto-job-ui-theme-color"]) {
        color = stored["auto-job-ui-theme-color"];
      }
      if (stored["auto-job-ui-theme"] === "dark") isDarkMode = true;
      if (stored["auto-job-ui-theme"] === "light") isDarkMode = false;
    } catch {
    }
  }
  const defaultTheme = THEME_COLOR_MAP.purple;
  const theme = THEME_COLOR_MAP[color] ?? defaultTheme;
  const primaryColor = isDarkMode ? theme.primaryDark : theme.primary;
  const rawFilename = filename || formatResumeFilename(data, company, jobTitle);
  const downloadFilename = `${rawFilename.replace(/\.pdf$/i, "") || "resume"}.pdf`;
  let localPdfBlobUrl = null;
  if (pdfDataUrl) {
    try {
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
  container.style.cssText = "position: fixed !important; inset: 0 !important; z-index: 2147483647 !important; pointer-events: auto !important; width: 0 !important; height: 0 !important; border: none !important; margin: 0 !important; padding: 0 !important; overflow: visible !important;";
  const shadow = container.attachShadow({ mode: "open" });
  const escapeHtml = (str) => {
    return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
  };
  const formattedTime = generatedAt ? formatTime(new Date(generatedAt)) : formatTime(/* @__PURE__ */ new Date());
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
            ${editUrl ? `
              <button type="button" class="btn-edit" id="jobby-btn-edit">
                Edit Resume
              </button>
            ` : ""}
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
          ${localPdfBlobUrl ? `
            <iframe
              title="Resume PDF preview"
              src="${localPdfBlobUrl}"
              class="pdf-iframe"
            ></iframe>
          ` : `
            <div class="loading-state">
              <div class="spinner"></div>
              <p>Loading PDF engine...</p>
            </div>
          `}
        </div>
      </div>
    </div>
  `;
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
  activeEscListener = (e) => {
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
