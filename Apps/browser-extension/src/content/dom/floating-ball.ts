/** @format */

import { classifyCurrentPage } from '../page-classifier';

const BALL_CONTAINER_ID = 'jobby-floating-ball-root';
const IFRAME_CONTAINER_ID = 'jobby-in-page-sidepanel-root';
const DISMISS_KEY = 'jobby-floating-ball-dismissed';
const DISABLED_DOMAINS_KEY = 'jobby_disabled_domains';
const DISABLE_ALL_PAGES_KEY = 'jobby_disabled_all_pages';
const AUTO_SHOW_JOB_DIALOG_KEY = 'jobby_auto_show_job_dialog';
const PANEL_WIDTH = 380;
const PANEL_TRANSITION_MS = 800;
const PANEL_TRANSITION_EASING = 'cubic-bezier(0.16, 1, 0.3, 1)';
const PANEL_TRANSITION = `${PANEL_TRANSITION_MS}ms ${PANEL_TRANSITION_EASING}`;
const FIXED_PANEL_HOST_STYLE =
  'position: fixed !important; top: 0 !important; right: 0 !important; width: 0 !important; height: 0 !important; border: none !important; margin: 0 !important; padding: 0 !important; z-index: 2147483647 !important; pointer-events: none !important; overflow: visible !important; transform: none !important; filter: none !important;';

// ─── State ────────────────────────────────────────────────────────────────────

/**
 * Single source of truth for the panel mode.
 *   'idle'   – nothing open, ball visible (if not dismissed)
 *   'native' – Chrome native side panel is open (ball hidden)
 *   'iframe' – in-page iframe panel is visible (ball hidden)
 */
type PanelState = 'idle' | 'native' | 'iframe';

let panelState: PanelState = 'idle';
let openIframeAfterNativeClose = false;

let ballRoot: HTMLDivElement | null = null;
let iframeRoot: HTMLDivElement | null = null;
let dialogIframeWrapper: HTMLDivElement | null = null;
let isDialogVisible = false;
let autoShowJobDialog = true;
let disabledDomains: string[] = [];
let disableAllPages: boolean = false;
let currentDocumentClickHandler: ((e: MouseEvent) => void) | null = null;

function isExtensionContextValid(): boolean {
  try {
    return typeof chrome !== 'undefined' && Boolean(chrome.runtime?.id);
  } catch {
    return false;
  }
}

// Keep extension UI in body. Adding arbitrary elements to <html> is invalid
// document structure and can interfere with sites that manage their own root.
function mountOverlay(element: HTMLElement): void {
  const parent = document.body;
  if (!parent) return;
  // Only append if not already in the correct parent.
  // Do NOT re-append just because it's not the last child — that would pull
  // ballRoot on top of iframeRoot whenever the iframe is mounted after the ball.
  if (element.parentElement !== parent) {
    parent.appendChild(element);
  }
}

// Whether this window can host the native Chrome side panel.
// Heuristic: if window.opener is set, Chrome typically disallows native side
// panels in that popup window, so we fall back to the iframe mode immediately.
// The background will authoratively correct this value after its round-trip.
const likelyPopup = window.opener !== null;
let windowCanHostSidepanel = !likelyPopup;

function isLinkedInPage(): boolean {
  const hostname = window.location.hostname.toLowerCase();
  return hostname === 'linkedin.com' || hostname.endsWith('.linkedin.com');
}

// ─── Theme Sync ───────────────────────────────────────────────────────────────

let currentThemeMode: 'light' | 'dark' | 'system' = 'system';
let currentThemeColor: string = 'green';

// Maps theme color names to their light/dark shadow RGBA values and primary colors
const THEME_SHADOW_MAP: Record<
  string,
  {
    light: string;
    dark: string;
    glow: string;
    glowDark: string;
    primary: string;
    primaryDark: string;
  }
> = {
  green: {
    light: 'rgba(13, 148, 136, 0.32)',
    dark: 'rgba(20, 184, 166, 0.4)',
    glow: 'rgba(20, 184, 166, 0.55)',
    glowDark: 'rgba(45, 212, 191, 0.65)',
    primary: '#0d9488',
    primaryDark: '#14b8a6',
  },
  blue: {
    light: 'rgba(37, 99, 235, 0.3)',
    dark: 'rgba(96, 165, 250, 0.4)',
    glow: 'rgba(59, 130, 246, 0.55)',
    glowDark: 'rgba(147, 197, 253, 0.65)',
    primary: '#2563eb',
    primaryDark: '#60a5fa',
  },
  purple: {
    light: 'rgba(109, 40, 217, 0.3)',
    dark: 'rgba(167, 139, 250, 0.4)',
    glow: 'rgba(139, 92, 246, 0.55)',
    glowDark: 'rgba(196, 181, 253, 0.65)',
    primary: '#7c3aed',
    primaryDark: '#a78bfa',
  },
  orange: {
    light: 'rgba(194, 65, 12, 0.28)',
    dark: 'rgba(251, 146, 60, 0.4)',
    glow: 'rgba(249, 115, 22, 0.55)',
    glowDark: 'rgba(253, 186, 116, 0.65)',
    primary: '#ea580c',
    primaryDark: '#fb923c',
  },
  rose: {
    light: 'rgba(190, 18, 60, 0.28)',
    dark: 'rgba(251, 113, 133, 0.4)',
    glow: 'rgba(244, 63, 94, 0.55)',
    glowDark: 'rgba(253, 164, 175, 0.65)',
    primary: '#e11d48',
    primaryDark: '#fb7185',
  },
};

function applyThemeShadowVars(root: ShadowRoot | null) {
  if (!root) return;
  const isDark =
    currentThemeMode === 'dark' ||
    (currentThemeMode === 'system' &&
      window.matchMedia('(prefers-color-scheme: dark)').matches);
  const colors =
    THEME_SHADOW_MAP[currentThemeColor] ?? THEME_SHADOW_MAP['green']!;
  const host = root.host as HTMLElement;
  host.style.setProperty(
    '--primary-shadow',
    isDark ? colors.dark : colors.light,
  );
  host.style.setProperty(
    '--primary-glow',
    isDark ? colors.glowDark : colors.glow,
  );
  host.style.setProperty('--panel-shadow', isDark ? colors.dark : colors.light);
  host.style.setProperty(
    '--panel-glow',
    isDark ? colors.glowDark : colors.glow,
  );
  host.style.setProperty(
    '--primary-color',
    isDark ? colors.primaryDark : colors.primary,
  );
}

function updateThemeShadows() {
  applyThemeShadowVars(ballRoot?.shadowRoot ?? null);
  applyThemeShadowVars(iframeRoot?.shadowRoot ?? null);
}

function updateThemeClasses() {
  const isDark =
    currentThemeMode === 'dark' ||
    (currentThemeMode === 'system' &&
      window.matchMedia('(prefers-color-scheme: dark)').matches);
  if (iframeRoot) {
    if (isDark) iframeRoot.classList.add('dark');
    else iframeRoot.classList.remove('dark');
  }
  if (ballRoot) {
    if (isDark) ballRoot.classList.add('dark');
    else ballRoot.classList.remove('dark');
  }
  updateThemeShadows();
}

// ─── Floating Ball ────────────────────────────────────────────────────────────

const POSITION_KEY = 'jobby-floating-ball-position';

interface BallPosition {
  edge: 'left' | 'right';
  top: number;
}

function getSavedBallPosition(): BallPosition {
  try {
    const data = sessionStorage.getItem(POSITION_KEY);
    if (data) {
      const parsed = JSON.parse(data);
      if (
        (parsed.edge === 'left' || parsed.edge === 'right') &&
        typeof parsed.top === 'number' &&
        !isNaN(parsed.top) &&
        isFinite(parsed.top)
      ) {
        return parsed;
      }
    }
  } catch (e) {
    // ignore
  }
  const vh = window.innerHeight > 0 ? window.innerHeight : 800;
  return {
    edge: 'right',
    top: Math.max(20, vh - 80 - 60),
  };
}

function saveBallPosition(pos: BallPosition) {
  try {
    sessionStorage.setItem(POSITION_KEY, JSON.stringify(pos));
  } catch (e) {
    // ignore
  }
}

function isDismissed() {
  return sessionStorage.getItem(DISMISS_KEY) === 'true';
}

function isDomainDisabled(): boolean {
  if (!disabledDomains || !disabledDomains.length) return false;
  const currentHost = window.location.hostname.toLowerCase();
  return disabledDomains.some((domain) => {
    const d = domain.toLowerCase();
    return currentHost === d || currentHost.endsWith('.' + d);
  });
}

function shouldShowBall(): boolean {
  if (isDismissed()) return false;
  if (disableAllPages) return false;
  if (isDomainDisabled()) return false;
  // Keep the in-page entry point available while the native panel is open so
  // the user can switch modes without first hunting for Chrome's close button.
  return panelState === 'idle' || panelState === 'native';
}

function updateBallVisibility() {
  if (shouldShowBall()) {
    createFloatingBall();
  } else {
    removeFloatingBall();
  }
}

function removeFloatingBall() {
  if (currentDocumentClickHandler) {
    window.removeEventListener('click', currentDocumentClickHandler, true);
    currentDocumentClickHandler = null;
  }
  hideFloatingDialog();
  dialogIframeWrapper = null;
  if (ballRoot) {
    ballRoot.remove();
    ballRoot = null;
  }
  const existing = document.getElementById(BALL_CONTAINER_ID);
  if (existing) {
    existing.remove();
  }
}

function showFloatingDialog() {
  if (panelState !== 'idle' || isDialogVisible || !dialogIframeWrapper) return;
  isDialogVisible = true;
  dialogIframeWrapper.classList.add('is-visible');
}

function hideFloatingDialog() {
  if (!isDialogVisible && !dialogIframeWrapper?.classList.contains('is-visible')) return;
  isDialogVisible = false;
  dialogIframeWrapper?.classList.remove('is-visible');
}

export function runJobDetectionForBall(_showDialog = true): void {
  if (!isExtensionContextValid() || panelState !== 'idle') return;
  if (!autoShowJobDialog) {
    hideFloatingDialog();
    return;
  }
  const pageClass = classifyCurrentPage();
  if (pageClass.isJobPage) {
    dialogIframeWrapper?.classList.add('is-compact');
    dialogIframeWrapper?.classList.remove('is-expanded');
    showFloatingDialog();
  } else {
    hideFloatingDialog();
  }
}

function createFloatingBall() {
  if (!isExtensionContextValid()) return;
  if (ballRoot?.isConnected) return;
  // SPA navigations and development HMR can replace the page body without
  // updating our module-level reference. Drop that stale reference so the
  // in-page entry point can mount again.
  ballRoot = null;
  const existing = document.getElementById(BALL_CONTAINER_ID);
  if (existing) {
    existing.remove();
  }

  const SIZE = 60;
  const EDGE_MARGIN = 20;
  const DRAG_THRESHOLD = 6;

  const initialPos = getSavedBallPosition();
  const vh = window.innerHeight > 0 ? window.innerHeight : 800;
  const boundedTop = Math.max(
    EDGE_MARGIN,
    Math.min(vh - SIZE - EDGE_MARGIN, initialPos.top),
  );
  const initialVertical =
    boundedTop < vh * 0.35 ? 'top' : boundedTop > vh * 0.65 ? 'bottom' : 'middle';

  let logoUrl = '';
  let dialogIframeSrc = '';
  try {
    logoUrl = chrome.runtime.getURL('favicon.svg');
    dialogIframeSrc = `${chrome.runtime.getURL('src/sidepanel/index.html?floatingDialog=true')}&edge=${initialPos.edge}&pos=${initialVertical}`;
  } catch {
    return;
  }

  ballRoot = document.createElement('div');
  ballRoot.id = BALL_CONTAINER_ID;
  ballRoot.style.cssText =
    'position: fixed !important; top: 0 !important; left: 0 !important; width: 0 !important; height: 0 !important; border: none !important; margin: 0 !important; padding: 0 !important; z-index: 2147483647 !important; pointer-events: none !important; overflow: visible !important; transform: none !important; filter: none !important;';

  const shadow = ballRoot.attachShadow({ mode: 'open' });
  updateThemeClasses();

  const style = document.createElement('style');
  style.textContent = `
    :host {
      all: initial !important;
      position: fixed !important;
      top: 0 !important;
      left: 0 !important;
      z-index: 2147483647 !important;
      pointer-events: none !important;
      width: 0 !important;
      height: 0 !important;
      overflow: visible !important;
      --primary-shadow: rgba(13, 148, 136, 0.32);
      --primary-glow: rgba(20, 184, 166, 0.55);
      --primary-color: #0d9488;
    }
    :host(.dark) {
      --primary-shadow: rgba(20, 184, 166, 0.42);
      --primary-glow: rgba(45, 212, 191, 0.65);
      --primary-color: #14b8a6;
    }
    #jobby-ball-wrapper {
      position: fixed !important;
      ${initialPos.edge === 'right' ? `right: ${EDGE_MARGIN}px; left: auto;` : `left: ${EDGE_MARGIN}px; right: auto;`}
      top: ${boundedTop}px;
      width: ${SIZE}px !important;
      height: ${SIZE}px !important;
      z-index: 2147483647 !important;
      pointer-events: auto !important;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: grab;
      border-radius: 9999px;
      background: transparent;
      box-sizing: border-box;
      /* Transition for snap animation (disabled during drag) */
      transition: filter 0.2s ease, transform 0.2s ease, left 0.25s cubic-bezier(0.34, 1.56, 0.64, 1), right 0.25s cubic-bezier(0.34, 1.56, 0.64, 1), top 0.25s cubic-bezier(0.34, 1.56, 0.64, 1);
      user-select: none;
      -webkit-user-drag: none;
    }
    #jobby-ball-wrapper.is-dragging {
      cursor: grabbing;
      transition: none;
    }
    /* Atmospheric Diffusion Glow for Floating Ball */
    #jobby-ball-wrapper::before {
      content: '';
      position: absolute;
      inset: 0px;
      border-radius: 9999px;
      background: linear-gradient(
        90deg,
        rgba(16, 185, 129, 0.85),
        rgba(6, 182, 212, 0.85),
        rgba(139, 92, 246, 0.85),
        rgba(236, 72, 153, 0.75),
        rgba(245, 158, 11, 0.85),
        rgba(16, 185, 129, 0.85)
      );
      background-size: 300% 100%;
      animation: aiFlow 6s linear infinite, aiDiffuse 3.6s ease-in-out infinite alternate;
      filter: blur(12px);
      z-index: 0;
      pointer-events: none;
      opacity: 0;
      transform: scale(0.9);
      transition: opacity 0.3s cubic-bezier(0.16, 1, 0.3, 1), transform 0.3s cubic-bezier(0.16, 1, 0.3, 1);
    }
    #jobby-ball-wrapper:not(.is-dragging):hover::before {
      opacity: 1;
      transform: scale(1.15);
    }
    #jobby-ball-wrapper:not(.is-dragging):active::before {
      transform: scale(0.95);
    }
    #jobby-ball-wrapper:not(.is-dragging):hover .jobby-logo-img {
      filter: drop-shadow(0 0 14px rgba(6, 182, 212, 0.4)) drop-shadow(0 4px 14px var(--primary-shadow));
      transform: scale(1.12);
    }
    #jobby-ball-wrapper:not(.is-dragging):active .jobby-logo-img {
      transform: scale(0.92);
    }
    .jobby-logo-img {
      position: relative;
      z-index: 1;
      width: 85%;
      height: 85%;
      object-fit: contain;
      user-select: none;
      pointer-events: none;
      filter: drop-shadow(0 4px 14px var(--primary-shadow)) drop-shadow(0 2px 6px rgba(0, 0, 0, 0.2));
      transition: filter 0.2s ease, transform 0.2s ease;
      -webkit-user-drag: none;
    }
    @keyframes aiFlow {
      0% { background-position: 0% 50%; }
      100% { background-position: 300% 50%; }
    }
    @keyframes aiDiffuse {
      0% {
        filter: blur(10px);
      }
      100% {
        filter: blur(16px);
      }
    }
    #close-btn {
      position: absolute;
      top: -2px;
      right: -2px;
      width: 20px;
      height: 20px;
      border-radius: 9999px;
      background: rgba(15, 23, 42, 0.85);
      color: #f8fafc;
      border: 1px solid rgba(255, 255, 255, 0.2);
      font-size: 11px;
      font-family: system-ui, -apple-system, sans-serif;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      opacity: 0;
      transition: opacity 0.2s ease, background 0.2s ease;
      box-shadow: 0 1px 4px rgba(0, 0, 0, 0.3);
      padding: 0;
      line-height: 1;
      z-index: 2;
    }
    #jobby-ball-wrapper:hover #close-btn,
    #jobby-ball-wrapper.menu-open #close-btn {
      opacity: 1;
    }
    #close-btn:hover {
      background: #dc2626;
    }
    /* Dismiss Menu Popover */
    #jobby-dismiss-menu {
      position: absolute;
      background: #ffffff;
      color: #0f172a;
      border: 1px solid rgba(15, 23, 42, 0.12);
      border-radius: 12px;
      box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.15), 0 8px 10px -6px rgba(0, 0, 0, 0.1);
      padding: 6px;
      display: flex;
      flex-direction: column;
      gap: 2px;
      z-index: 2147483647;
      min-width: 195px;
      white-space: nowrap;
      opacity: 0;
      pointer-events: none;
      transition: opacity 0.18s cubic-bezier(0.16, 1, 0.3, 1), transform 0.18s cubic-bezier(0.16, 1, 0.3, 1);
      box-sizing: border-box;
    }
    :host(.dark) #jobby-dismiss-menu {
      background: #1e293b;
      color: #f8fafc;
      border-color: rgba(255, 255, 255, 0.15);
      box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.5);
    }
    #jobby-ball-wrapper.edge-right #jobby-dismiss-menu {
      right: calc(100% + 10px);
      left: auto;
      top: 50%;
      transform: translateY(-50%) scale(0.92);
      transform-origin: right center;
    }
    #jobby-ball-wrapper.edge-right #jobby-dismiss-menu.is-open {
      opacity: 1;
      transform: translateY(-50%) scale(1);
      pointer-events: auto;
    }
    #jobby-ball-wrapper.edge-left #jobby-dismiss-menu {
      left: calc(100% + 10px);
      right: auto;
      top: 50%;
      transform: translateY(-50%) scale(0.92);
      transform-origin: left center;
    }
    #jobby-ball-wrapper.edge-left #jobby-dismiss-menu.is-open {
      opacity: 1;
      transform: translateY(-50%) scale(1);
      pointer-events: auto;
    }
    .jobby-menu-item {
      display: flex;
      align-items: center;
      width: 100%;
      padding: 9px 12px;
      border: none;
      background: transparent;
      color: inherit;
      font-family: Inter, system-ui, -apple-system, sans-serif;
      font-size: 13.5px;
      font-weight: 500;
      border-radius: 8px;
      cursor: pointer;
      text-align: left;
      transition: background 0.12s ease;
      box-sizing: border-box;
      user-select: none;
    }
    .jobby-menu-item:hover {
      background: rgba(15, 23, 42, 0.06);
    }
    :host(.dark) .jobby-menu-item:hover {
      background: rgba(255, 255, 255, 0.1);
    }
    .jobby-menu-item:active {
      background: rgba(15, 23, 42, 0.12);
    }
    .jobby-menu-divider {
      height: 1px;
      background: rgba(15, 23, 42, 0.08);
      margin: 3px 0;
    }
    :host(.dark) .jobby-menu-divider {
      background: rgba(255, 255, 255, 0.08);
    }
    .jobby-menu-toggle-item {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      width: 100%;
      padding: 8px 12px;
      border: none;
      background: transparent;
      color: inherit;
      font-family: Inter, system-ui, -apple-system, sans-serif;
      font-size: 13px;
      font-weight: 500;
      border-radius: 8px;
      cursor: pointer;
      text-align: left;
      transition: background 0.12s ease;
      box-sizing: border-box;
      user-select: none;
    }
    .jobby-menu-toggle-item:hover {
      background: rgba(15, 23, 42, 0.06);
    }
    :host(.dark) .jobby-menu-toggle-item:hover {
      background: rgba(255, 255, 255, 0.1);
    }
    .jobby-switch-track {
      width: 30px;
      height: 17px;
      border-radius: 9999px;
      background: rgba(15, 23, 42, 0.18);
      position: relative;
      transition: background 0.2s ease, box-shadow 0.2s ease;
      flex-shrink: 0;
    }
    :host(.dark) .jobby-switch-track {
      background: rgba(255, 255, 255, 0.22);
    }
    .jobby-switch-thumb {
      width: 13px;
      height: 13px;
      border-radius: 50%;
      background: #ffffff;
      position: absolute;
      top: 2px;
      left: 2px;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.25);
      transition: transform 0.2s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.2s ease;
    }
    .jobby-menu-toggle-item.is-active .jobby-switch-track {
      background: var(--primary-color, #0d9488);
      box-shadow: 0 0 8px var(--primary-shadow);
    }
    .jobby-menu-toggle-item.is-active .jobby-switch-thumb {
      transform: translateX(13px);
      box-shadow: 0 1px 3px var(--primary-shadow);
    }

    /* ─── Floating Dialog Iframe Container ───────────────────────── */
    #jobby-dialog-iframe-wrapper {
      position: absolute !important;
      width: 376px !important;
      height: 600px !important;
      max-height: calc(100vh - 40px) !important;
      max-width: calc(100vw - 80px) !important;
      z-index: 2147483646 !important;
      overflow: visible !important;
      background: transparent !important;
      border: none !important;
      box-shadow: none !important;
      opacity: 0 !important;
      visibility: hidden !important;
      pointer-events: none !important;
      transform: scale(0.96) !important;
      transition: opacity 0.16s ease, transform 0.16s ease, visibility 0.16s ease !important;
    }

    /* Horizontal: Right edge vs Left edge */
    #jobby-ball-wrapper.edge-right #jobby-dialog-iframe-wrapper {
      right: calc(100% + 10px) !important;
      left: auto !important;
    }
    #jobby-ball-wrapper.edge-left #jobby-dialog-iframe-wrapper {
      left: calc(100% + 10px) !important;
      right: auto !important;
    }

    /* Vertical: Top half vs Bottom half vs Middle */
    #jobby-ball-wrapper.pos-top #jobby-dialog-iframe-wrapper {
      top: 0 !important;
      bottom: auto !important;
      transform: scale(0.96) !important;
      transform-origin: top right !important;
    }
    #jobby-ball-wrapper.edge-left.pos-top #jobby-dialog-iframe-wrapper {
      transform-origin: top left !important;
    }
    #jobby-ball-wrapper.pos-top #jobby-dialog-iframe-wrapper.is-visible {
      opacity: 1 !important;
      visibility: visible !important;
      pointer-events: auto !important;
      transform: scale(1) !important;
    }

    #jobby-ball-wrapper.pos-bottom #jobby-dialog-iframe-wrapper {
      bottom: 0 !important;
      top: auto !important;
      transform: scale(0.96) !important;
      transform-origin: bottom right !important;
    }
    #jobby-ball-wrapper.edge-left.pos-bottom #jobby-dialog-iframe-wrapper {
      transform-origin: bottom left !important;
    }
    #jobby-ball-wrapper.pos-bottom #jobby-dialog-iframe-wrapper.is-visible {
      opacity: 1 !important;
      visibility: visible !important;
      pointer-events: auto !important;
      transform: scale(1) !important;
    }

    #jobby-ball-wrapper.pos-middle #jobby-dialog-iframe-wrapper {
      top: 50% !important;
      bottom: auto !important;
      transform: translateY(-50%) scale(0.96) !important;
      transform-origin: center right !important;
    }
    #jobby-ball-wrapper.edge-left.pos-middle #jobby-dialog-iframe-wrapper {
      transform-origin: center left !important;
    }
    #jobby-ball-wrapper.pos-middle #jobby-dialog-iframe-wrapper.is-visible {
      opacity: 1 !important;
      visibility: visible !important;
      pointer-events: auto !important;
      transform: translateY(-50%) scale(1) !important;
    }

    .jobby-dialog-iframe {
      width: 100% !important;
      height: 100% !important;
      border: none !important;
      background: transparent !important;
      display: block !important;
      pointer-events: auto !important;
    }
  `;

  const wrapper = document.createElement('div');
  wrapper.id = 'jobby-ball-wrapper';
  wrapper.classList.add(
    initialPos.edge === 'right' ? 'edge-right' : 'edge-left',
  );

  const logo = document.createElement('img');
  logo.src = logoUrl;
  logo.className = 'jobby-logo-img';
  logo.alt = 'Jobby logo';
  logo.draggable = false;

  const closeBtn = document.createElement('button');
  closeBtn.id = 'close-btn';
  closeBtn.innerHTML = '&#10005;';
  closeBtn.title = 'Close options';

  const dismissMenu = document.createElement('div');
  dismissMenu.id = 'jobby-dismiss-menu';

  const handleDismissAction = (action: 'session' | 'domain' | 'all') => {
    dismissMenu.classList.remove('is-open');
    wrapper.classList.remove('menu-open');
    hideFloatingDialog();

    if (!isExtensionContextValid()) {
      removeFloatingBall();
      return;
    }

    if (action === 'session') {
      sessionStorage.setItem(DISMISS_KEY, 'true');
      removeFloatingBall();
    } else if (action === 'domain') {
      const host = window.location.hostname;
      if (host && chrome.storage?.local) {
        try {
          chrome.storage.local.get([DISABLED_DOMAINS_KEY], (res) => {
            const list: string[] =
              Array.isArray(res[DISABLED_DOMAINS_KEY]) ?
                res[DISABLED_DOMAINS_KEY]
              : [];
            if (!list.includes(host)) {
              list.push(host);
              chrome.storage.local.set({ [DISABLED_DOMAINS_KEY]: list }, () => {
                disabledDomains = list;
                removeFloatingBall();
              });
            } else {
              removeFloatingBall();
            }
          });
        } catch {
          removeFloatingBall();
        }
      } else {
        removeFloatingBall();
      }
    } else if (action === 'all') {
      if (chrome.storage?.local) {
        try {
          chrome.storage.local.set({ [DISABLE_ALL_PAGES_KEY]: true }, () => {
            disableAllPages = true;
            removeFloatingBall();
          });
        } catch {
          removeFloatingBall();
        }
      } else {
        removeFloatingBall();
      }
    }
  };

  const toggleBtn = document.createElement('button');
  toggleBtn.type = 'button';
  toggleBtn.className = `jobby-menu-toggle-item ${autoShowJobDialog ? 'is-active' : ''}`;
  toggleBtn.innerHTML = `
    <span>Auto-show Recognition Results</span>
    <span class="jobby-switch-track">
      <span class="jobby-switch-thumb"></span>
    </span>
  `;
  toggleBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    e.preventDefault();
    autoShowJobDialog = !autoShowJobDialog;
    if (autoShowJobDialog) {
      toggleBtn.classList.add('is-active');
      runJobDetectionForBall(true);
    } else {
      toggleBtn.classList.remove('is-active');
      hideFloatingDialog();
    }
    if (isExtensionContextValid() && chrome.storage?.local) {
      try {
        chrome.storage.local.set({ [AUTO_SHOW_JOB_DIALOG_KEY]: autoShowJobDialog });
      } catch {
        // Ignore
      }
    }
  });

  const divider = document.createElement('div');
  divider.className = 'jobby-menu-divider';

  dismissMenu.appendChild(toggleBtn);
  dismissMenu.appendChild(divider);

  const options: Array<{
    label: string;
    action: 'session' | 'domain' | 'all';
  }> = [
    { label: 'Hide until next visit', action: 'session' },
    { label: 'Disable on this domain', action: 'domain' },
    { label: 'Disable on all pages', action: 'all' },
  ];

  options.forEach((opt) => {
    const btn = document.createElement('button');
    btn.className = 'jobby-menu-item';
    btn.textContent = opt.label;
    btn.type = 'button';
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      e.preventDefault();
      handleDismissAction(opt.action);
    });
    dismissMenu.appendChild(btn);
  });

  const toggleDismissMenu = () => {
    const isOpen = dismissMenu.classList.contains('is-open');
    if (isOpen) {
      dismissMenu.classList.remove('is-open');
      wrapper.classList.remove('menu-open');
    } else {
      hideFloatingDialog();
      dismissMenu.classList.add('is-open');
      wrapper.classList.add('menu-open');
    }
  };

  closeBtn.addEventListener('pointerdown', (e) => {
    e.stopPropagation();
  });

  closeBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    e.preventDefault();
    toggleDismissMenu();
  });

  dismissMenu.addEventListener('pointerdown', (e) => {
    e.stopPropagation();
  });

  dialogIframeWrapper = document.createElement('div');
  dialogIframeWrapper.id = 'jobby-dialog-iframe-wrapper';
  dialogIframeWrapper.classList.add('is-compact');
  dialogIframeWrapper.addEventListener('pointerdown', (e) => {
    e.stopPropagation();
  });

  const dialogIframe = document.createElement('iframe');
  dialogIframe.src = dialogIframeSrc;
  dialogIframe.className = 'jobby-dialog-iframe';
  dialogIframeWrapper.appendChild(dialogIframe);

  currentDocumentClickHandler = (e: MouseEvent) => {
    const path = e.composedPath();
    if (dismissMenu.classList.contains('is-open')) {
      if (!path.includes(dismissMenu) && !path.includes(closeBtn)) {
        dismissMenu.classList.remove('is-open');
        wrapper.classList.remove('menu-open');
      }
    }
    if (isDialogVisible && dialogIframeWrapper) {
      if (
        !path.includes(dialogIframeWrapper) &&
        !path.includes(wrapper)
      ) {
        hideFloatingDialog();
      }
    }
  };
  window.addEventListener('click', currentDocumentClickHandler, true);

  const onWindowMessage = (event: MessageEvent) => {
    if (event.data?.source === 'jobby-dialog') {
      if (event.data?.type === 'jobby.dialog-resize') {
        if (event.data.mode === 'compact') {
          dialogIframeWrapper?.classList.add('is-compact');
          dialogIframeWrapper?.classList.remove('is-expanded');
        } else if (event.data.mode === 'expanded') {
          dialogIframeWrapper?.classList.add('is-expanded');
          dialogIframeWrapper?.classList.remove('is-compact');
        }
      } else if (event.data?.type === 'jobby.dialog-close') {
        hideFloatingDialog();
      } else if (event.data?.type === 'jobby.dialog-open-sidepanel') {
        hideFloatingDialog();
        showSidepanelIframe();
      } else if (event.data?.type === 'jobby.dialog-trigger-tailor') {
        hideFloatingDialog();
        showSidepanelIframe();
        const docType = event.data?.docType;
        const draft = event.data?.draft;
        window.setTimeout(() => {
          try {
            if (isExtensionContextValid() && chrome.runtime?.sendMessage) {
              chrome.runtime
                .sendMessage({
                  type: 'sidepanel.trigger-tailor',
                  docType,
                  draft,
                })
                .catch(() => undefined);
            }
          } catch {}
        }, 200);
      }
    }
  };
  window.addEventListener('message', onWindowMessage);

  wrapper.appendChild(logo);
  wrapper.appendChild(closeBtn);
  wrapper.appendChild(dismissMenu);
  wrapper.appendChild(dialogIframeWrapper);

  // ── Drag logic (pointer events, edge-snapping) ──────────────────────────
  let isDragging = false;
  let dragStartX = 0;
  let dragStartY = 0;
  let startLeft = 0;
  let startTop = 0;
  let currentEdge: 'left' | 'right' = initialPos.edge;
  let snapTimer: number | null = null;

  let posLeft = 0;
  let posTop = boundedTop;

  function updateVerticalPositionClass() {
    const vh = window.innerHeight > 0 ? window.innerHeight : 800;
    wrapper.classList.remove('pos-top', 'pos-middle', 'pos-bottom');
    let pos: 'top' | 'middle' | 'bottom' = 'middle';
    if (posTop < vh * 0.35) {
      pos = 'top';
      wrapper.classList.add('pos-top');
    } else if (posTop > vh * 0.65) {
      pos = 'bottom';
      wrapper.classList.add('pos-bottom');
    } else {
      wrapper.classList.add('pos-middle');
    }
    try {
      dialogIframe?.contentWindow?.postMessage(
        {
          source: 'jobby-ball',
          type: 'jobby.ball-position',
          edge: currentEdge,
          pos,
        },
        '*',
      );
    } catch {}
  }

  updateVerticalPositionClass();

  function snapToEdge() {
    if (snapTimer) clearTimeout(snapTimer);
    const viewportWidth = document.documentElement.clientWidth;
    const mid = viewportWidth / 2;
    posTop = Math.max(
      EDGE_MARGIN,
      Math.min(window.innerHeight - SIZE - EDGE_MARGIN, posTop),
    );

    if (posLeft + SIZE / 2 > mid) {
      currentEdge = 'right';
      wrapper.classList.add('edge-right');
      wrapper.classList.remove('edge-left');
      const targetLeft = viewportWidth - SIZE - EDGE_MARGIN;
      wrapper.style.left = `${targetLeft}px`;
      wrapper.style.top = `${posTop}px`;
      snapTimer = window.setTimeout(() => {
        if (currentEdge === 'right' && !isDragging) {
          wrapper.style.left = 'auto';
          wrapper.style.right = `${EDGE_MARGIN}px`;
        }
      }, 260);
    } else {
      currentEdge = 'left';
      wrapper.classList.add('edge-left');
      wrapper.classList.remove('edge-right');
      wrapper.style.left = `${EDGE_MARGIN}px`;
      wrapper.style.right = 'auto';
      wrapper.style.top = `${posTop}px`;
    }
    updateVerticalPositionClass();
    saveBallPosition({ edge: currentEdge, top: posTop });
  }

  const handleWindowResize = () => {
    if (isDragging) return;
    if (currentEdge === 'right') {
      wrapper.style.left = 'auto';
      wrapper.style.right = `${EDGE_MARGIN}px`;
    } else {
      wrapper.style.left = `${EDGE_MARGIN}px`;
      wrapper.style.right = 'auto';
    }
    posTop = Math.max(
      EDGE_MARGIN,
      Math.min(window.innerHeight - SIZE - EDGE_MARGIN, posTop),
    );
    wrapper.style.top = `${posTop}px`;
    updateVerticalPositionClass();
    saveBallPosition({ edge: currentEdge, top: posTop });
  };
  window.addEventListener('resize', handleWindowResize);

  wrapper.addEventListener('pointerdown', (e: PointerEvent) => {
    const target = e.target as HTMLElement | null;
    if (
      target?.closest('#close-btn') ||
      target?.closest('#jobby-dismiss-menu') ||
      target?.closest('#jobby-dialog-iframe-wrapper')
    )
      return;
    dismissMenu.classList.remove('is-open');
    wrapper.classList.remove('menu-open');
    hideFloatingDialog();
    if (snapTimer) clearTimeout(snapTimer);
    isDragging = false;
    const rect = wrapper.getBoundingClientRect();
    posLeft = rect.left;
    posTop = rect.top;
    wrapper.style.right = 'auto';
    wrapper.style.left = `${posLeft}px`;
    wrapper.style.top = `${posTop}px`;
    dragStartX = e.clientX;
    dragStartY = e.clientY;
    startLeft = posLeft;
    startTop = posTop;
    wrapper.setPointerCapture(e.pointerId);
    e.preventDefault();
  });

  wrapper.addEventListener('pointermove', (e: PointerEvent) => {
    if (!wrapper.hasPointerCapture(e.pointerId)) return;
    const dx = e.clientX - dragStartX;
    const dy = e.clientY - dragStartY;
    // Use total displacement (not per-frame accumulation) for reliable threshold.
    if (!isDragging && Math.hypot(dx, dy) > DRAG_THRESHOLD) {
      isDragging = true;
      wrapper.classList.add('is-dragging');
      hideFloatingDialog();
    }
    if (isDragging) {
      const viewportWidth = document.documentElement.clientWidth;
      posLeft = Math.max(
        EDGE_MARGIN,
        Math.min(viewportWidth - SIZE - EDGE_MARGIN, startLeft + dx),
      );
      posTop = Math.max(
        EDGE_MARGIN,
        Math.min(window.innerHeight - SIZE - EDGE_MARGIN, startTop + dy),
      );
      wrapper.style.left = `${posLeft}px`;
      wrapper.style.top = `${posTop}px`;
    }
  });

  wrapper.addEventListener('pointerup', (e: PointerEvent) => {
    if (!wrapper.hasPointerCapture(e.pointerId)) return;
    wrapper.releasePointerCapture(e.pointerId);
    if (isDragging) {
      wrapper.classList.remove('is-dragging');
      isDragging = false;
      // Wait one frame so the transition is re-enabled before we animate to snapped position.
      requestAnimationFrame(() => snapToEdge());
    } else {
      handleBallClick();
    }
  });

  shadow.appendChild(style);
  shadow.appendChild(wrapper);
  mountOverlay(ballRoot);

  // Trigger detection check after DOM is mounted
  window.setTimeout(() => {
    try {
      if (isExtensionContextValid() && classifyCurrentPage().isJobPage) {
        runJobDetectionForBall(true);
      }
    } catch {}
  }, 400);
}

// ─── Ball click handler ───────────────────────────────────────────────────────

function handleBallClick() {
  if (!isExtensionContextValid()) return;
  hideFloatingDialog();
  if (panelState === 'iframe') return;

  if (panelState === 'native') {
    // Switching from Chrome's Side Panel to the page-embedded panel is a
    // two-step operation: request native close, then wait for its authoritative
    // close broadcast before showing the iframe. This prevents any overlap.
    if (openIframeAfterNativeClose) return;
    openIframeAfterNativeClose = true;
    try {
      chrome.runtime.sendMessage({ type: 'sidepanel.close' }, (response) => {
        if (chrome.runtime.lastError || response?.ok === false) {
          openIframeAfterNativeClose = false;
        }
      });
    } catch {
      openIframeAfterNativeClose = false;
    }
    return;
  }

  // The floating ball and the toolbar icon are deliberately different entry
  // points: the ball opens the 380px in-page panel, while Chrome's toolbar
  // action opens the native Side Panel.  The native panel's state broadcast
  // below tears this iframe down when the user switches entry points.
  showSidepanelIframe();
}

// ─── Iframe sidepanel ─────────────────────────────────────────────────────────

/**
 * Pre-inject the iframe into the DOM but keep it translated off-screen.
 * The React bundle starts loading immediately so the first click can show
 * the panel with just a CSS transition (zero extra load time).
 */
function preloadSidepanelIframe() {
  if (!isExtensionContextValid()) return;
  if (iframeRoot || document.getElementById(IFRAME_CONTAINER_ID)) return;

  iframeRoot = document.createElement('div');
  iframeRoot.id = IFRAME_CONTAINER_ID;
  iframeRoot.style.cssText = FIXED_PANEL_HOST_STYLE;

  const shadow = iframeRoot.attachShadow({ mode: 'open' });
  updateThemeClasses();

  const style = document.createElement('style');
  style.textContent = `
    :host {
      all: initial !important;
      position: fixed !important;
      top: 0 !important;
      right: 0 !important;
      z-index: 2147483647 !important;
      pointer-events: none !important;
      width: 0 !important;
      height: 0 !important;
      overflow: visible !important;
      --panel-bg: #f8fafc;
      --tab-x: #94a3b8;
      --tab-x-hover: #334155;
      --tab-x-bg-hover: rgba(15, 23, 42, 0.08);
      --tab-x-bg-active: rgba(15, 23, 42, 0.16);
      --panel-shadow: rgba(13, 148, 136, 0.32);
      --panel-glow: rgba(20, 184, 166, 0.5);
    }
    :host(.dark) {
      --panel-bg: #0f172a;
      --tab-x: #64748b;
      --tab-x-hover: #f1f5f9;
      --tab-x-bg-hover: rgba(255, 255, 255, 0.12);
      --tab-x-bg-active: rgba(255, 255, 255, 0.22);
      --panel-shadow: rgba(20, 184, 166, 0.4);
      --panel-glow: rgba(45, 212, 191, 0.6);
    }
    #jobby-iframe-wrapper {
      position: fixed !important;
      right: 0 !important;
      top: 0 !important;
      width: ${PANEL_WIDTH}px !important;
      height: 100vh !important;
      z-index: 2147483647 !important;
      pointer-events: auto !important;
      border-radius: 20px 0 0 20px !important;
      overflow: visible !important;
      box-shadow: -10px 0 36px var(--panel-shadow), -2px 0 12px rgba(0, 0, 0, 0.1) !important;
      border: none !important;
      /* Transition both transform AND opacity so shadow fully fades out when hidden */
      transition: transform ${PANEL_TRANSITION}, opacity ${PANEL_TRANSITION} !important;
      display: flex !important;
      flex-direction: column !important;
      /* Off-screen + invisible by default — React loads silently here */
      transform: translateX(100%);
      opacity: 0;
      background-color: var(--panel-bg) !important;
    }
    #jobby-iframe-wrapper.is-visible {
      transform: translateX(0) !important;
      opacity: 1 !important;
    }
    iframe {
      width: 100% !important;
      height: 100% !important;
      border: none !important;
      flex: 1 !important;
      border-radius: 20px 0 0 20px !important;
      overflow: hidden !important;
      background-color: transparent !important;
    }
    #close-tab {
      position: absolute !important;
      left: -80px !important;
      top: 50% !important;
      transform: translateY(-50%) !important;
      width: 80px !important;
      height: 120px !important;
      visibility: hidden !important;
      cursor: pointer !important;
      display: block !important;
      background: none !important;
      border: none !important;
      padding: 0 !important;
      z-index: 2147483647 !important;
      pointer-events: auto !important;
      /* Clip shadow bleed on the right edge so it seamlessly joins the iframe container */
      clip-path: inset(-30px 0px -30px -40px) !important;
    }
    #jobby-iframe-wrapper.is-visible #close-tab {
      visibility: visible !important;
    }
    #close-tab .tab-bg-svg {
      position: absolute !important;
      inset: 0 !important;
      width: 100% !important;
      height: 100% !important;
      display: block !important;
      pointer-events: none !important;
      filter: drop-shadow(-8px 0 16px var(--panel-shadow));
      contain: paint !important;
    }
    #close-tab .tab-icon-wrapper {
      position: absolute !important;
      left: 24px !important;
      top: 36px !important;
      width: 48px !important;
      height: 48px !important;
      border-radius: 16px !important;
      overflow: hidden !important;
      display: flex !important;
      align-items: center !important;
      justify-content: center !important;
      pointer-events: none !important;
      transform: translateZ(0) !important;
    }
    #close-tab .tab-logo {
      position: absolute !important;
      width: 44px !important;
      height: 44px !important;
      object-fit: contain !important;
      opacity: 1 !important;
      transform: scale(1) translateZ(0) !important;
      transform-origin: center center !important;
      will-change: opacity, transform !important;
      transition: opacity 0.22s cubic-bezier(0.16, 1, 0.3, 1), transform 0.22s cubic-bezier(0.16, 1, 0.3, 1) !important;
    }
    #close-tab:hover .tab-logo {
      opacity: 0 !important;
      transform: scale(0.75) translateZ(0) !important;
    }
    #close-tab .tab-arrow-box {
      position: absolute !important;
      inset: 0 !important;
      border-radius: 16px !important;
      display: flex !important;
      align-items: center !important;
      justify-content: center !important;
      background-color: var(--tab-x-bg-hover) !important;
      color: var(--tab-x-hover) !important;
      opacity: 0 !important;
      transform: scale(0.75) translateZ(0) !important;
      transform-origin: center center !important;
      will-change: opacity, transform !important;
      transition: opacity 0.22s cubic-bezier(0.16, 1, 0.3, 1), transform 0.22s cubic-bezier(0.16, 1, 0.3, 1), background-color 0.15s ease !important;
    }
    #close-tab:hover .tab-arrow-box {
      opacity: 1 !important;
      transform: scale(1) translateZ(0) !important;
    }
    #close-tab:active .tab-arrow-box {
      background-color: var(--tab-x-bg-active) !important;
    }
    #close-tab .tab-arrow-svg {
      width: 22px !important;
      height: 22px !important;
      display: block !important;
    }
  `;

  let logoUrl = '';
  let iframeSrc = '';
  try {
    logoUrl = chrome.runtime.getURL('favicon.svg');
    iframeSrc = chrome.runtime.getURL('src/sidepanel/index.html');
  } catch {
    return;
  }

  const wrapper = document.createElement('div');
  wrapper.id = 'jobby-iframe-wrapper';

  const closeTab = document.createElement('button');
  closeTab.id = 'close-tab';
  closeTab.title = 'Close Jobby Panel';
  closeTab.setAttribute('aria-label', 'Close Jobby Panel');
  // Concentric R24/rx16 squircle geometry ensures visually and mathematically uniform 8px gap
  // from every point of the inner SVG logo / close button to the outer border.
  closeTab.innerHTML = `
<svg class="tab-bg-svg" viewBox="0 0 80 120" xmlns="http://www.w3.org/2000/svg">
  <path style="fill: var(--panel-bg);" d="
    M 80 0
    C 80 14, 66 28, 52 28
    L 40 28
    A 24 24 0 0 0 16 52
    L 16 68
    A 24 24 0 0 0 40 92
    L 52 92
    C 66 92, 80 106, 80 120
    L 80 0
    Z
  " />
</svg>
<div class="tab-icon-wrapper">
  <img class="tab-logo" src="${logoUrl}" alt="Jobby" />
  <div class="tab-arrow-box">
    <svg class="tab-arrow-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round">
      <polyline points="7 17 12 12 7 7"></polyline>
      <polyline points="13 17 18 12 13 7"></polyline>
    </svg>
  </div>
</div>
  `;
  closeTab.addEventListener('click', hideSidepanelIframe);

  const iframe = document.createElement('iframe');
  iframe.src = iframeSrc;

  wrapper.appendChild(closeTab);
  wrapper.appendChild(iframe);
  shadow.appendChild(style);
  shadow.appendChild(wrapper);
  mountOverlay(iframeRoot);

  // Apply the current theme immediately
  updateThemeClasses();
}

// ─── Page padding (reserves room without shifting the viewport) ──────────────
const PAGE_SHRINK_STYLE_ID = 'jobby-page-shrink-style';
const PAGE_SHRINK_OPEN_CLASS = 'jobby-panel-open';
let pageShrinkCleanupTimer: number | null = null;

function clearPageShrinkCleanupTimer() {
  if (pageShrinkCleanupTimer !== null) {
    window.clearTimeout(pageShrinkCleanupTimer);
    pageShrinkCleanupTimer = null;
  }
}

function pushBodyRight() {
  clearPageShrinkCleanupTimer();

  if (!document.getElementById(PAGE_SHRINK_STYLE_ID)) {
    const linkedInRootRule = isLinkedInPage() ? `
      /* LinkedIn uses a 100vw root, which ignores body padding. Restrict only
       * that root so its detail pane ends exactly before the Jobby panel. */
      html.${PAGE_SHRINK_OPEN_CLASS} #app__container {
        width: calc(100vw - ${PANEL_WIDTH}px) !important;
        max-width: calc(100vw - ${PANEL_WIDTH}px) !important;
        transition: width ${PANEL_TRANSITION}, max-width ${PANEL_TRANSITION} !important;
      }
      html.${PAGE_SHRINK_OPEN_CLASS} #global-nav,
      html.${PAGE_SHRINK_OPEN_CLASS} .global-nav,
      html.${PAGE_SHRINK_OPEN_CLASS} .global-nav__header {
        right: ${PANEL_WIDTH}px !important;
        width: auto !important;
        max-width: calc(100vw - ${PANEL_WIDTH}px) !important;
        transition: right ${PANEL_TRANSITION}, max-width ${PANEL_TRANSITION} !important;
      }
    ` : '';
    const style = document.createElement('style');
    style.id = PAGE_SHRINK_STYLE_ID;
    style.textContent = `
      body {
        box-sizing: border-box !important;
        padding-right: 0 !important;
        transition: padding-right ${PANEL_TRANSITION} !important;
      }
      html.${PAGE_SHRINK_OPEN_CLASS} > body {
        padding-right: ${PANEL_WIDTH}px !important;
      }
      ${linkedInRootRule}
    `;
    (document.head ?? document.documentElement).appendChild(style);
  }

  // Give the browser one frame to establish the zero-padding state before
  // changing it, otherwise style injection can appear as an instant jump.
  requestAnimationFrame(() => {
    if (panelState === 'iframe') {
      document.documentElement.classList.add(PAGE_SHRINK_OPEN_CLASS);
    }
  });
}

function restoreBodyRight(immediate = false) {
  clearPageShrinkCleanupTimer();
  document.documentElement.classList.remove(PAGE_SHRINK_OPEN_CLASS);

  if (immediate) {
    document.getElementById(PAGE_SHRINK_STYLE_ID)?.remove();
    return;
  }

  // Keep the transition rule installed until the closing animation ends.
  pageShrinkCleanupTimer = window.setTimeout(() => {
    if (panelState !== 'iframe') {
      document.getElementById(PAGE_SHRINK_STYLE_ID)?.remove();
    }
    pageShrinkCleanupTimer = null;
  }, PANEL_TRANSITION_MS);
}

/**
 * Slide the pre-loaded (or freshly injected) iframe panel into view.
 */
function showSidepanelIframe() {
  if (panelState === 'iframe') return;

  if (!iframeRoot) {
    preloadSidepanelIframe();
  }

  const wrapper = iframeRoot?.shadowRoot?.getElementById(
    'jobby-iframe-wrapper',
  );
  if (!wrapper || !iframeRoot) return;

  panelState = 'iframe';
  removeFloatingBall();
  mountOverlay(iframeRoot);
  pushBodyRight();

  requestAnimationFrame(() => {
    wrapper.classList.add('is-visible');
    wrapper.style.transform = 'translateX(0)';
    wrapper.style.opacity = '1';
  });
}

/**
 * Slide the iframe panel out of view without destroying the React app inside.
 * The next call to showSidepanelIframe() brings it back instantly.
 */
function hideSidepanelIframe() {
  if (!iframeRoot || panelState !== 'iframe') return;

  const wrapper = iframeRoot.shadowRoot?.getElementById('jobby-iframe-wrapper');
  if (!wrapper) return;

  panelState = 'idle';
  restoreBodyRight();

  requestAnimationFrame(() => {
    wrapper.classList.remove('is-visible');
    wrapper.style.transform = 'translateX(100%)';
    wrapper.style.opacity = '0';
  });

  setTimeout(() => {
    if (panelState === 'idle') {
      updateBallVisibility();
    }
  }, PANEL_TRANSITION_MS);
}

/**
 * Fully remove the iframe from the DOM (used when native side panel takes over).
 */
function removeSidepanelIframe(immediate = false) {
  if (!iframeRoot) return;

  const wrapper = iframeRoot.shadowRoot?.getElementById('jobby-iframe-wrapper');

  if (immediate) {
    iframeRoot.remove();
    iframeRoot = null;
    restoreBodyRight(true);
    return;
  }

  const cleanup = () => {
    iframeRoot?.remove();
    iframeRoot = null;
    if (panelState === 'idle') {
      updateBallVisibility();
    }
  };

  if (wrapper && panelState === 'iframe') {
    panelState = 'idle';
    restoreBodyRight();
    requestAnimationFrame(() => {
      wrapper.classList.remove('is-visible');
      wrapper.style.transform = 'translateX(100%)';
      wrapper.style.opacity = '0';
    });
    wrapper.addEventListener('transitionend', cleanup, { once: true });
  } else {
    restoreBodyRight();
    cleanup();
  }
}

// ─── Initialization ───────────────────────────────────────────────────────────

export function initializeFloatingBall(): () => void {
  if (
    !isExtensionContextValid() ||
    !chrome.runtime ||
    !chrome.runtime.onMessage
  )
    return () => undefined;

  // Some job sites replace large DOM subtrees (and occasionally <body>) during
  // client-side navigation. Recover the floating ball if the host page removes
  // it, instead of retaining a disconnected ballRoot forever.
  const recoveryTimer = window.setInterval(() => {
    try {
      if (!isExtensionContextValid()) {
        window.clearInterval(recoveryTimer);
        removeFloatingBall();
        removeSidepanelIframe(true);
        return;
      }
      if (shouldShowBall() && !ballRoot?.isConnected) {
        createFloatingBall();
      }
    } catch {
      window.clearInterval(recoveryTimer);
    }
  }, 1_000);

  // Initialize theme and disabled settings from storage
  if (chrome.storage?.local) {
    try {
      chrome.storage.local.get(
        [
          'auto-job-ui-theme',
          'auto-job-ui-theme-color',
          DISABLED_DOMAINS_KEY,
          DISABLE_ALL_PAGES_KEY,
          AUTO_SHOW_JOB_DIALOG_KEY,
        ],
        (res) => {
          if (!isExtensionContextValid() || !res) return;
          if (res['auto-job-ui-theme']) {
            currentThemeMode = res['auto-job-ui-theme'];
          }
          if (
            typeof res['auto-job-ui-theme-color'] === 'string' &&
            res['auto-job-ui-theme-color']
          ) {
            currentThemeColor = res['auto-job-ui-theme-color'];
          }
          if (Array.isArray(res[DISABLED_DOMAINS_KEY])) {
            disabledDomains = res[DISABLED_DOMAINS_KEY];
          }
          if (typeof res[DISABLE_ALL_PAGES_KEY] === 'boolean') {
            disableAllPages = res[DISABLE_ALL_PAGES_KEY];
          }
          if (typeof res[AUTO_SHOW_JOB_DIALOG_KEY] === 'boolean') {
            autoShowJobDialog = res[AUTO_SHOW_JOB_DIALOG_KEY];
            const toggleBtn = ballRoot?.shadowRoot?.querySelector('.jobby-menu-toggle-item');
            if (toggleBtn) {
              if (autoShowJobDialog) toggleBtn.classList.add('is-active');
              else toggleBtn.classList.remove('is-active');
            }
            if (!autoShowJobDialog) {
              hideFloatingDialog();
            }
          }
          updateThemeClasses();
          updateBallVisibility();
        },
      );
    } catch {
      // Ignore
    }
  }

  const onStorageChanged = (changes: Record<string, chrome.storage.StorageChange>, area: string) => {
    try {
      if (!isExtensionContextValid()) return;
      if (area === 'local') {
        let stateChanged = false;
        if (changes['auto-job-ui-theme']) {
          currentThemeMode = changes['auto-job-ui-theme'].newValue;
          updateThemeClasses();
        }
        if (changes['auto-job-ui-theme-color']) {
          currentThemeColor = changes['auto-job-ui-theme-color']
            .newValue as string;
          updateThemeShadows();
        }
        if (changes[DISABLED_DOMAINS_KEY]) {
          disabledDomains =
            Array.isArray(changes[DISABLED_DOMAINS_KEY].newValue) ?
              changes[DISABLED_DOMAINS_KEY].newValue
            : [];
          stateChanged = true;
        }
        if (changes[DISABLE_ALL_PAGES_KEY] !== undefined) {
          disableAllPages = !!changes[DISABLE_ALL_PAGES_KEY].newValue;
          stateChanged = true;
        }
        if (changes[AUTO_SHOW_JOB_DIALOG_KEY] !== undefined) {
          autoShowJobDialog = changes[AUTO_SHOW_JOB_DIALOG_KEY].newValue !== false;
          const toggleBtn = ballRoot?.shadowRoot?.querySelector('.jobby-menu-toggle-item');
          if (toggleBtn) {
            if (autoShowJobDialog) toggleBtn.classList.add('is-active');
            else toggleBtn.classList.remove('is-active');
          }
          if (!autoShowJobDialog) {
            hideFloatingDialog();
          }
        }
        if (stateChanged) {
          updateBallVisibility();
        }
      }
    } catch {
      // Ignore
    }
  };

  if (chrome.storage?.onChanged) {
    try {
      chrome.storage.onChanged.addListener(onStorageChanged);
    } catch {
      // Ignore
    }
  }

  const onMediaChange = () => {
    try {
      if (!isExtensionContextValid()) return;
      if (currentThemeMode === 'system') {
        updateThemeClasses();
      }
    } catch {
      // Ignore
    }
  };

  const darkModeMedia = window.matchMedia('(prefers-color-scheme: dark)');
  darkModeMedia.addEventListener('change', onMediaChange);

  // Show the ball immediately based on initial state.
  updateBallVisibility();

  // If we already know this is a popup window, start pre-loading the iframe
  // right away — no need to wait for the async background round-trip.
  if (likelyPopup) {
    preloadSidepanelIframe();
  }

  // Ask the background for the authoritative window + side-panel state.
  try {
    if (isExtensionContextValid()) {
      chrome.runtime.sendMessage({ type: 'sidepanel.query-state' }, (response) => {
        if (chrome.runtime.lastError || !isExtensionContextValid()) return;
        if (response?.ok) {
          if (typeof response.canHostSidepanel === 'boolean') {
            windowCanHostSidepanel = response.canHostSidepanel;
          }

          if (windowCanHostSidepanel) {
            panelState = response.isOpen ? 'native' : 'idle';
            // Native Chrome side panel manages viewport resizing automatically;
            // do not add page padding. Ensure any leftover fallback shrink style is restored.
            if (panelState === 'native') {
              restoreBodyRight();
            }
          } else {
            panelState = 'idle';
            if (!iframeRoot) preloadSidepanelIframe();
          }

          updateBallVisibility();
        }
      });
    }
  } catch {
    // Ignore context invalidation
  }

  const onVisibilityChange = () => {
    try {
      if (!isExtensionContextValid()) return;
      if (document.visibilityState === 'visible' && panelState === 'idle') {
        const pageClass = classifyCurrentPage();
        if (pageClass.isJobPage) {
          void runJobDetectionForBall(true);
        }
      }
    } catch {
      // Ignore
    }
  };
  document.addEventListener('visibilitychange', onVisibilityChange);

  // Listen for native side panel open/close broadcasts and detection events.
  const onRuntimeMessage = (message: any) => {
    try {
      if (!isExtensionContextValid()) return;
      if (
        message?.type === 'content.page-changed' ||
        message?.type === 'content.trigger-job-detection'
      ) {
        if (panelState === 'idle') {
          runJobDetectionForBall(true);
        }
        return;
      }
      if (message?.type !== 'sidepanel.state-changed') return;
      if (!windowCanHostSidepanel) return;

      if (message.isOpen) {
        openIframeAfterNativeClose = false;
        // Native side panel just opened.
        // Tear down the iframe if it was showing.
        if (panelState === 'iframe') {
          // The two entry points are mutually exclusive: do not leave the
          // 380px in-page panel visible while Chrome opens its native panel.
          removeSidepanelIframe(true);
        }
        panelState = 'native';
        // Native sidepanel does NOT need page padding.
        restoreBodyRight();
        updateBallVisibility();
      } else {
        // Native side panel just closed.
        panelState = 'idle';
        restoreBodyRight();
        if (openIframeAfterNativeClose) {
          openIframeAfterNativeClose = false;
          showSidepanelIframe();
        } else {
          updateBallVisibility();
        }
      }
    } catch {
      // Ignore
    }
  };

  try {
    chrome.runtime.onMessage.addListener(onRuntimeMessage);
  } catch {
    // Ignore
  }

  return () => {
    window.clearInterval(recoveryTimer);
    darkModeMedia.removeEventListener('change', onMediaChange);
    document.removeEventListener('visibilitychange', onVisibilityChange);
    try {
      if (isExtensionContextValid()) {
        if (chrome.storage?.onChanged) {
          chrome.storage.onChanged.removeListener(onStorageChanged);
        }
        if (chrome.runtime?.onMessage) {
          chrome.runtime.onMessage.removeListener(onRuntimeMessage);
        }
      }
    } catch {
      // Ignore
    }
    removeFloatingBall();
    removeSidepanelIframe(true);
  };
}
