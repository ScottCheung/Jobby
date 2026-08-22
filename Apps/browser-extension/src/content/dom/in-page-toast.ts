/** @format */

const TOAST_CONTAINER_ID = 'jobby-in-page-toast-root';
let activeTimer: number | undefined;

export function showInPageToast(
  message: string,
  type: 'success' | 'error' | 'info' | 'warning' = 'info',
  duration = 2500,
): void {
  let host = document.getElementById(TOAST_CONTAINER_ID);
  if (!host) {
    host = document.createElement('div');
    host.id = TOAST_CONTAINER_ID;
    host.style.cssText = 'position: fixed !important; inset: 0 !important; z-index: 2147483647 !important; pointer-events: none !important; width: 0 !important; height: 0 !important; border: none !important; margin: 0 !important; padding: 0 !important; overflow: visible !important;';
    host.attachShadow({ mode: 'open' });
  }

  const rootParent = document.documentElement || document.body;
  if (host.parentElement !== rootParent || rootParent.lastElementChild !== host) {
    rootParent.appendChild(host);
  }

  const shadow = host.shadowRoot;
  if (!shadow) return;

  if (activeTimer !== undefined) {
    window.clearTimeout(activeTimer);
  }

  const iconSvg =
    type === 'success'
      ? `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg>`
      : type === 'error'
      ? `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>`
      : type === 'warning'
      ? `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`
      : `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#38bdf8" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>`;

  shadow.innerHTML = `
    <style>
      :host {
        all: initial !important;
        position: fixed !important;
        inset: 0 !important;
        z-index: 2147483647 !important;
        pointer-events: none !important;
        width: 0 !important;
        height: 0 !important;
        overflow: visible !important;
      }
      .toast-overlay {
        position: fixed !important;
        inset: 0 !important;
        z-index: 2147483647 !important;
        display: flex;
        align-items: center;
        justify-content: center;
        pointer-events: none;
        padding: 12px;
        box-sizing: border-box;
      }
      .toast-pill {
        pointer-events: auto;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 10px;
        padding: 12px 24px;
        min-height: 44px;
        box-sizing: border-box;
        background: #09090b;
        color: #ffffff;
        font-family: Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        font-size: 13px;
        font-weight: 600;
        line-height: 1.4;
        border-radius: 9999px;
        border: 1px solid rgba(255, 255, 255, 0.18);
        box-shadow: 0 20px 40px -8px rgba(0, 0, 0, 0.85), 0 6px 16px rgba(0, 0, 0, 0.6);
        opacity: 0;
        transform: scale(0.9) translateY(8px);
        transition: opacity 0.16s cubic-bezier(0.16, 1, 0.3, 1), transform 0.16s cubic-bezier(0.16, 1, 0.3, 1);
        user-select: none;
        max-width: calc(100vw - 32px);
        width: max-content;
        text-align: center;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .toast-pill.is-visible {
        opacity: 1;
        transform: scale(1) translateY(0);
      }
      .toast-icon {
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
      }
      .toast-message {
        line-height: 1.2;
        overflow: hidden;
        text-overflow: ellipsis;
      }
    </style>
    <div class="toast-overlay">
      <div class="toast-pill" id="jobby-toast-pill">
        <span class="toast-icon">${iconSvg}</span>
        <span class="toast-message">${message}</span>
      </div>
    </div>
  `;

  const pill = shadow.getElementById('jobby-toast-pill');
  if (pill) {
    requestAnimationFrame(() => {
      pill.classList.add('is-visible');
    });
  }

  activeTimer = window.setTimeout(() => {
    if (pill) {
      pill.classList.remove('is-visible');
      window.setTimeout(() => {
        host?.remove();
      }, 180);
    } else {
      host?.remove();
    }
  }, duration);
}
