/** @format */

import {
  parseDescriptionBlocks,
  cleanDescription,
} from '@jobby/ui/lib/job-description';

const MODAL_ROOT_ID = 'jobby-in-page-job-description-modal-root';

export interface ShowJobDescriptionModalOptions {
  title?: string;
  company?: string;
  location?: string;
  datePosted?: string;
  description: string;
  platform?: string;
  themeColor?: string;
}

function isExtensionContextValid(): boolean {
  try {
    return typeof chrome !== 'undefined' && Boolean(chrome.runtime?.id);
  } catch {
    return false;
  }
}

let activeEscListener: ((e: KeyboardEvent) => void) | null = null;

const THEME_COLOR_MAP: Record<
  string,
  { primary: string; primaryDark: string }
> = {
  purple: {
    primary: '#8b5cf6',
    primaryDark: '#a78bfa',
  },
  blue: {
    primary: '#3b82f6',
    primaryDark: '#60a5fa',
  },
  green: {
    primary: '#10b981',
    primaryDark: '#34d399',
  },
  orange: {
    primary: '#f97316',
    primaryDark: '#fb923c',
  },
  rose: {
    primary: '#f43f5e',
    primaryDark: '#fb7185',
  },
};

export function closeInPageJobDescriptionModal(): void {
  if (activeEscListener) {
    window.removeEventListener('keydown', activeEscListener, true);
    activeEscListener = null;
  }
  const existing = document.getElementById(MODAL_ROOT_ID);
  if (existing) {
    existing.remove();
  }
}

export async function showInPageJobDescriptionModal(
  options: ShowJobDescriptionModalOptions,
): Promise<void> {
  closeInPageJobDescriptionModal();

  const {
    title,
    company,
    location,
    datePosted,
    description,
    platform,
    themeColor,
  } = options;

  if (!description) return;

  let color = themeColor || 'purple';
  let isDarkMode =
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-color-scheme: dark)').matches;

  if (isExtensionContextValid() && chrome.storage?.local) {
    try {
      const stored = await new Promise<Record<string, unknown>>((resolve) => {
        chrome.storage.local.get(
          ['auto-job-ui-theme-color', 'auto-job-ui-theme'],
          (res) => resolve((res as Record<string, unknown>) || {}),
        );
      });
      if (
        typeof stored['auto-job-ui-theme-color'] === 'string' &&
        stored['auto-job-ui-theme-color']
      ) {
        color = stored['auto-job-ui-theme-color'];
      }
      if (stored['auto-job-ui-theme'] === 'dark') isDarkMode = true;
      if (stored['auto-job-ui-theme'] === 'light') isDarkMode = false;
    } catch {
      // Fall back to default
    }
  }

  const defaultTheme = THEME_COLOR_MAP.purple!;
  const theme = THEME_COLOR_MAP[color] ?? defaultTheme;
  const primaryColor = isDarkMode ? theme.primaryDark : theme.primary;

  const container = document.createElement('div');
  container.id = MODAL_ROOT_ID;
  container.style.cssText =
    'position: fixed !important; inset: 0 !important; z-index: 2147483647 !important; pointer-events: auto !important; width: 0 !important; height: 0 !important; border: none !important; margin: 0 !important; padding: 0 !important; overflow: visible !important;';
  const shadow = container.attachShadow({ mode: 'open' });

  const escapeHtml = (str: string): string => {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  };

  const blocks = parseDescriptionBlocks(description);

  const renderedBlocksHtml = blocks
    .map((block) => {
      if (block.type === 'header') {
        return `<div class="jd-section-header"><h4 class="jd-heading">${escapeHtml(block.text)}</h4></div>`;
      }
      if (block.type === 'list') {
        const items = block.items
          .map(
            (item) =>
              `<li class="jd-list-item"><span class="jd-bullet"></span><span class="jd-item-text">${escapeHtml(item)}</span></li>`,
          )
          .join('');
        return `<ul class="jd-list">${items}</ul>`;
      }
      return `<p class="jd-paragraph">${escapeHtml(block.text)}</p>`;
    })
    .join('');

  const displayTitle = title || 'Job Description';
  const displayCompany = company || '';

  const metaItems: string[] = [];
  if (displayCompany) metaItems.push(escapeHtml(displayCompany));
  if (location) metaItems.push(escapeHtml(location));
  if (datePosted) metaItems.push(escapeHtml(datePosted));
  if (platform) metaItems.push(escapeHtml(platform));

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
      *, *::before, *::after, button, span, p, div, h1, h2, h3, h4, ul, li {
        font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
        box-sizing: border-box;
      }
      * {
        scrollbar-width: thin;
        scrollbar-color: ${isDarkMode ? 'rgba(255, 255, 255, 0.2)' : 'rgba(100, 116, 139, 0.25)'} transparent;
      }
      *::-webkit-scrollbar {
        width: 6px;
        height: 6px;
      }
      *::-webkit-scrollbar-track {
        background: transparent;
      }
      *::-webkit-scrollbar-thumb {
        background-color: ${isDarkMode ? 'rgba(255, 255, 255, 0.2)' : 'rgba(100, 116, 139, 0.25)'};
        border-radius: 9999px;
        border: 1px solid transparent;
        background-clip: content-box;
      }
      *::-webkit-scrollbar-thumb:hover {
        background-color: ${isDarkMode ? 'rgba(255, 255, 255, 0.35)' : 'rgba(100, 116, 139, 0.45)'};
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
        padding: 24px;
        box-sizing: border-box;
        animation: fadeIn 0.15s cubic-bezier(0.16, 1, 0.3, 1);
      }
      .modal-card {
        width: 88vw;
        max-width: 860px;
        height: 88vh;
        max-height: 860px;
        background: ${isDarkMode ? '#0f172a' : '#ffffff'};
        border-radius: 16px;
        box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.45), 0 0 0 1px ${isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(15, 23, 42, 0.08)'};
        border: 1px solid ${isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(15, 23, 42, 0.08)'};
        display: flex;
        flex-direction: column;
        overflow: hidden;
        animation: slideUp 0.18s cubic-bezier(0.16, 1, 0.3, 1);
      }
      .modal-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 16px 20px;
        border-bottom: 1px solid ${isDarkMode ? 'rgba(255, 255, 255, 0.08)' : 'rgba(15, 23, 42, 0.08)'};
        background: ${isDarkMode ? 'rgba(30, 41, 59, 0.85)' : 'rgba(255, 255, 255, 0.85)'};
        backdrop-filter: blur(12px);
        -webkit-backdrop-filter: blur(12px);
        flex-shrink: 0;
      }
      .header-title-group {
        display: flex;
        flex-direction: column;
        gap: 2px;
        min-width: 0;
      }
      .header-title {
        font-size: 15px;
        font-weight: 700;
        color: ${isDarkMode ? '#f8fafc' : '#0f172a'};
        margin: 0;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        max-width: 580px;
        line-height: 1.3;
      }
      .header-meta {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 6px;
        font-size: 11px;
        color: ${isDarkMode ? '#94a3b8' : '#64748b'};
        line-height: 1.2;
      }
      .header-meta span:not(:last-child)::after {
        content: '•';
        margin-left: 6px;
        opacity: 0.6;
      }
      .header-actions {
        display: flex;
        align-items: center;
        gap: 8px;
        flex-shrink: 0;
      }
      .btn-copy {
        background: transparent;
        color: ${isDarkMode ? '#e2e8f0' : '#334155'};
        border: 1px solid ${isDarkMode ? 'rgba(255, 255, 255, 0.15)' : 'rgba(15, 23, 42, 0.15)'};
        padding: 6px 12px;
        border-radius: 8px;
        font-size: 12px;
        font-weight: 600;
        cursor: pointer;
        display: flex;
        align-items: center;
        gap: 6px;
        transition: all 0.15s ease;
      }
      .btn-copy:hover {
        background: ${isDarkMode ? 'rgba(255, 255, 255, 0.08)' : 'rgba(15, 23, 42, 0.06)'};
        color: ${primaryColor};
        border-color: ${primaryColor};
      }
      .btn-copy.copied {
        background: color-mix(in srgb, ${primaryColor} 12%, transparent);
        color: ${primaryColor};
        border-color: ${primaryColor};
      }
      .btn-close {
        background: transparent;
        border: none;
        color: ${isDarkMode ? '#94a3b8' : '#64748b'};
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
        background: ${isDarkMode ? 'rgba(255, 255, 255, 0.08)' : 'rgba(15, 23, 42, 0.06)'};
        color: ${isDarkMode ? '#f8fafc' : '#0f172a'};
      }

      .modal-body {
        flex: 1;
        overflow-y: auto;
        padding: 24px 28px;
        background: ${isDarkMode ? '#090d16' : '#ffffff'};
        color: ${isDarkMode ? '#e2e8f0' : '#334155'};
        line-height: 1.6;
        user-select: text;
        -webkit-user-select: text;
      }

      .jd-section-header {
        border-bottom: 1px solid ${isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(15, 23, 42, 0.08)'};
        padding-top: 16px;
        padding-bottom: 6px;
        margin-top: 18px;
        margin-bottom: 8px;
      }
      .jd-section-header:first-child {
        padding-top: 0;
        margin-top: 0;
      }
      .jd-heading {
        font-size: 13px;
        font-weight: 700;
        color: ${isDarkMode ? '#f8fafc' : '#0f172a'};
        margin: 0;
        text-transform: capitalize;
        letter-spacing: -0.01em;
      }
      .jd-list {
        list-style: none;
        margin: 8px 0;
        padding-left: 4px;
        display: flex;
        flex-direction: column;
        gap: 6px;
      }
      .jd-list-item {
        display: flex;
        align-items: flex-start;
        gap: 8px;
        font-size: 13px;
        line-height: 1.55;
        color: ${isDarkMode ? '#cbd5e1' : '#475569'};
      }
      .jd-bullet {
        width: 5px;
        height: 5px;
        border-radius: 50%;
        background-color: ${primaryColor};
        margin-top: 8px;
        flex-shrink: 0;
      }
      .jd-item-text {
        flex: 1;
        min-width: 0;
      }
      .jd-paragraph {
        font-size: 13px;
        line-height: 1.6;
        color: ${isDarkMode ? '#cbd5e1' : '#475569'};
        margin: 8px 0;
        white-space: pre-wrap;
      }

      @keyframes fadeIn {
        from { opacity: 0; }
        to { opacity: 1; }
      }
      @keyframes slideUp {
        from { transform: translateY(12px) scale(0.99); opacity: 0; }
        to { transform: translateY(0) scale(1); opacity: 1; }
      }
    </style>

    <div class="modal-backdrop" id="jobby-jd-backdrop">
      <div class="modal-card" id="jobby-jd-card">
        <header class="modal-header">
          <div class="header-title-group">
            <h3 class="header-title">${escapeHtml(displayTitle)}</h3>
            ${
              metaItems.length > 0
                ? `<div class="header-meta">${metaItems.map((m) => `<span>${m}</span>`).join('')}</div>`
                : ''
            }
          </div>

          <div class="header-actions">
            <button type="button" class="btn-copy" id="jobby-btn-copy" aria-label="Copy description">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
              </svg>
              <span id="jobby-copy-text">Copy</span>
            </button>
            <button type="button" class="btn-close" id="jobby-btn-close" aria-label="Close modal">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          </div>
        </header>

        <div class="modal-body">
          ${renderedBlocksHtml}
        </div>
      </div>
    </div>
  `;

  const backdrop = shadow.getElementById('jobby-jd-backdrop');
  const card = shadow.getElementById('jobby-jd-card');
  const closeBtn = shadow.getElementById('jobby-btn-close');
  const copyBtn = shadow.getElementById('jobby-btn-copy');
  const copyText = shadow.getElementById('jobby-copy-text');

  backdrop?.addEventListener('click', (e) => {
    if (e.target === backdrop) closeInPageJobDescriptionModal();
  });
  card?.addEventListener('click', (e) => e.stopPropagation());
  closeBtn?.addEventListener('click', closeInPageJobDescriptionModal);

  copyBtn?.addEventListener('click', async () => {
    try {
      const textToCopy = cleanDescription(description) || description;
      await navigator.clipboard.writeText(textToCopy);
      if (copyBtn && copyText) {
        copyBtn.classList.add('copied');
        copyText.textContent = 'Copied!';
        setTimeout(() => {
          copyBtn.classList.remove('copied');
          copyText.textContent = 'Copy';
        }, 2000);
      }
    } catch {
      // Fallback
    }
  });

  activeEscListener = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      closeInPageJobDescriptionModal();
    }
  };
  window.addEventListener('keydown', activeEscListener, true);

  const parent = document.documentElement || document.body;
  parent.appendChild(container);
}
