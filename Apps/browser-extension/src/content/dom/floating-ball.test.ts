// @vitest-environment happy-dom
/** @format */

import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { initializeFloatingBall } from './floating-ball';

describe('Floating Ball & Auto-Show Card', () => {
  let cleanup: (() => void) | null = null;
  let mockStorage: Record<string, any> = {};

  beforeEach(() => {
    document.body.innerHTML = '';
    mockStorage = {};

    // Mock chrome APIs
    (globalThis as any).chrome = {
      runtime: {
        id: 'test-ext-id',
        getURL: (path: string) => `chrome-extension://test-ext-id/${path}`,
        sendMessage: vi.fn(),
        onMessage: {
          addListener: vi.fn(),
          removeListener: vi.fn(),
        },
      },
      storage: {
        local: {
          get: vi.fn((keys: string[], cb: (res: any) => void) => {
            const res: Record<string, any> = {};
            keys.forEach((k) => {
              if (k in mockStorage) res[k] = mockStorage[k];
            });
            cb(res);
          }),
          set: vi.fn((items: Record<string, any>, cb?: () => void) => {
            Object.assign(mockStorage, items);
            cb?.();
          }),
        },
        onChanged: {
          addListener: vi.fn(),
          removeListener: vi.fn(),
        },
      },
    };
  });

  afterEach(() => {
    if (cleanup) {
      cleanup();
      cleanup = null;
    }
    document.body.innerHTML = '';
  });

  it('toggles Auto-show card without opening the sidepanel or triggering ball click', async () => {
    cleanup = initializeFloatingBall();

    const root = document.getElementById('jobby-floating-ball-root');
    expect(root).not.toBeNull();
    const shadow = root?.shadowRoot;
    expect(shadow).not.toBeNull();

    const closeBtn = shadow!.getElementById('close-btn') as HTMLButtonElement;
    expect(closeBtn).not.toBeNull();

    const dismissMenu = shadow!.getElementById('jobby-dismiss-menu') as HTMLDivElement;
    expect(dismissMenu).not.toBeNull();

    const toggleBtn = shadow!.querySelector('.jobby-menu-toggle-item') as HTMLButtonElement;
    expect(toggleBtn).not.toBeNull();
    expect(toggleBtn.classList.contains('is-active')).toBe(true);

    // Clear initial query calls
    vi.mocked(chrome.runtime.sendMessage).mockClear();

    // Open dismiss menu
    closeBtn.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    closeBtn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(dismissMenu.classList.contains('is-open')).toBe(true);

    // Pointer down on toggle button (should not close menu or start drag on wrapper)
    const pointerDownEvent = new PointerEvent('pointerdown', { bubbles: true, cancelable: true });
    toggleBtn.dispatchEvent(pointerDownEvent);
    expect(dismissMenu.classList.contains('is-open')).toBe(true);

    // Click toggle button (Auto-show card)
    toggleBtn.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    // Verify toggle button is now inactive and storage is saved
    expect(toggleBtn.classList.contains('is-active')).toBe(false);
    expect(mockStorage['jobby_auto_show_job_dialog']).toBe(false);

    // Verify sidepanel close / iframe open message was NOT sent
    expect(chrome.runtime.sendMessage).not.toHaveBeenCalled();

    // Verify in-page sidepanel wrapper is not visible
    const iframeRoot = document.getElementById('jobby-in-page-sidepanel-root');
    const iframeWrapper = iframeRoot?.shadowRoot?.getElementById('jobby-iframe-wrapper');
    expect(iframeWrapper?.classList.contains('is-visible') ?? false).toBe(false);
  });
});
