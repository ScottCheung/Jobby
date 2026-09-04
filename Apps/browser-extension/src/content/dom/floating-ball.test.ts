// @vitest-environment happy-dom
/** @format */

import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { initializeFloatingBall } from './floating-ball';

describe('Floating Ball & Auto-Show Card', () => {
  let cleanup: (() => void) | null = null;
  let mockStorage: Record<string, any> = {};

  beforeEach(() => {
    document.body.innerHTML = '';
    sessionStorage.clear();
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

  it('synchronizes theme shadow and primary color variables on theme changes', async () => {
    let storageChangedListener: any = null;
    vi.mocked(chrome.storage.onChanged.addListener).mockImplementation((fn: any) => {
      storageChangedListener = fn;
    });

    cleanup = initializeFloatingBall();

    const root = document.getElementById('jobby-floating-ball-root') as HTMLDivElement;
    expect(root).not.toBeNull();

    // Default theme color is green
    expect(root.style.getPropertyValue('--primary-shadow')).toBe('rgba(13, 148, 136, 0.32)');
    expect(root.style.getPropertyValue('--primary-color')).toBe('#0d9488');

    // Simulate changing theme color to blue
    storageChangedListener?.(
      {
        'auto-job-ui-theme-color': { newValue: 'blue' },
      },
      'local',
    );

    expect(root.style.getPropertyValue('--primary-shadow')).toBe('rgba(37, 99, 235, 0.3)');
    expect(root.style.getPropertyValue('--primary-glow')).toBe('rgba(59, 130, 246, 0.55)');
    expect(root.style.getPropertyValue('--primary-color')).toBe('#2563eb');

    // Simulate changing theme color to purple and dark mode
    storageChangedListener?.(
      {
        'auto-job-ui-theme-color': { newValue: 'purple' },
        'auto-job-ui-theme': { newValue: 'dark' },
      },
      'local',
    );

    expect(root.classList.contains('dark')).toBe(true);
    expect(root.style.getPropertyValue('--primary-shadow')).toBe('rgba(167, 139, 250, 0.4)');
    expect(root.style.getPropertyValue('--primary-glow')).toBe('rgba(196, 181, 253, 0.65)');
    expect(root.style.getPropertyValue('--primary-color')).toBe('#a78bfa');
  });

  it('switches dialog iframe container mode between compact and expanded on resize messages', async () => {
    cleanup = initializeFloatingBall();

    const root = document.getElementById('jobby-floating-ball-root') as HTMLDivElement;
    expect(root).not.toBeNull();
    const shadow = root?.shadowRoot;
    const dialogWrapper = shadow!.getElementById('jobby-dialog-iframe-wrapper') as HTMLDivElement;
    expect(dialogWrapper).not.toBeNull();

    // Send compact mode resize message
    window.dispatchEvent(
      new MessageEvent('message', {
        data: {
          source: 'jobby-dialog',
          type: 'jobby.dialog-resize',
          mode: 'compact',
        },
      }),
    );

    expect(dialogWrapper.classList.contains('is-compact')).toBe(true);
    expect(dialogWrapper.classList.contains('is-expanded')).toBe(false);

    // Send expanded mode resize message
    window.dispatchEvent(
      new MessageEvent('message', {
        data: {
          source: 'jobby-dialog',
          type: 'jobby.dialog-resize',
          mode: 'expanded',
        },
      }),
    );

    expect(dialogWrapper.classList.contains('is-expanded')).toBe(true);
    expect(dialogWrapper.classList.contains('is-compact')).toBe(false);
  });

  it('clamps the dialog inside the viewport when the ball is in the middle', () => {
    const viewportHeight = window.innerHeight;
    const ballTop = viewportHeight / 2;
    sessionStorage.setItem(
      'jobby-floating-ball-position',
      JSON.stringify({ edge: 'right', top: ballTop }),
    );

    cleanup = initializeFloatingBall();

    const root = document.getElementById(
      'jobby-floating-ball-root',
    ) as HTMLDivElement;
    const wrapper = root.shadowRoot!.getElementById(
      'jobby-ball-wrapper',
    ) as HTMLDivElement;
    const offset = Number.parseFloat(
      wrapper.style.getPropertyValue('--jobby-dialog-offset-y'),
    );
    const dialogHeight = Math.min(600, viewportHeight - 40);
    const dialogTop = ballTop + offset;

    expect(dialogTop).toBeGreaterThanOrEqual(20);
    expect(dialogTop + dialogHeight).toBeLessThanOrEqual(
      viewportHeight - 20,
    );
  });

  it('opens in-page sidepanel iframe when floating ball is clicked', async () => {
    cleanup = initializeFloatingBall();

    const root = document.getElementById('jobby-floating-ball-root') as HTMLDivElement;
    expect(root).not.toBeNull();
    const shadow = root?.shadowRoot;
    const wrapper = shadow!.getElementById('jobby-ball-wrapper') as HTMLDivElement;
    expect(wrapper).not.toBeNull();

    // Click on the floating ball wrapper
    wrapper.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0 }));
    wrapper.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, button: 0 }));

    await new Promise((r) => setTimeout(r, 20));

    // Verify sidepanel iframe container was created and shown
    const iframeRoot = document.getElementById('jobby-in-page-sidepanel-root');
    expect(iframeRoot).not.toBeNull();
    const iframeShadow = iframeRoot?.shadowRoot;
    const iframeWrapper = iframeShadow?.getElementById('jobby-iframe-wrapper');
    expect(iframeWrapper).not.toBeNull();
    expect(iframeWrapper?.classList.contains('is-visible')).toBe(true);
  });

  it('hides floating ball and in-page sidebar when native sidepanel is opened, and restores ball when closed', async () => {
    let runtimeListener: ((message: any) => void) | null = null;
    vi.mocked(chrome.runtime.onMessage.addListener).mockImplementation((fn: any) => {
      runtimeListener = fn;
    });

    cleanup = initializeFloatingBall();

    // Floating ball is initially present
    expect(document.getElementById('jobby-floating-ball-root')).not.toBeNull();

    // Simulate native sidepanel opening
    runtimeListener?.({ type: 'sidepanel.state-changed', isOpen: true });

    // Floating ball and dialog should be completely removed from DOM
    expect(document.getElementById('jobby-floating-ball-root')).toBeNull();

    // Simulate native sidepanel closing
    runtimeListener?.({ type: 'sidepanel.state-changed', isOpen: false });

    // Floating ball should be restored in the DOM
    expect(document.getElementById('jobby-floating-ball-root')).not.toBeNull();
  });

  it('hides floating ball on initial load if native sidepanel query returns open', async () => {
    vi.mocked(chrome.runtime.sendMessage).mockImplementation((msg: any, cb?: (res: any) => void) => {
      if (msg?.type === 'sidepanel.query-state') {
        cb?.({ ok: true, isOpen: true, canHostSidepanel: true });
      }
    });

    cleanup = initializeFloatingBall();

    // Because query returned isOpen: true, floating ball should be removed from DOM
    expect(document.getElementById('jobby-floating-ball-root')).toBeNull();
  });

  it('toggles is-loading class on the ball wrapper when loading messages are received', async () => {
    cleanup = initializeFloatingBall();

    const root = document.getElementById('jobby-floating-ball-root') as HTMLDivElement;
    expect(root).not.toBeNull();
    const shadow = root?.shadowRoot;
    const wrapper = shadow!.getElementById('jobby-ball-wrapper') as HTMLDivElement;
    expect(wrapper).not.toBeNull();
    expect(wrapper.classList.contains('is-loading')).toBe(false);

    // Send compact mode with isLoading: true
    window.dispatchEvent(
      new MessageEvent('message', {
        data: {
          source: 'jobby-dialog',
          type: 'jobby.dialog-resize',
          mode: 'compact',
          isLoading: true,
        },
      }),
    );

    expect(wrapper.classList.contains('is-loading')).toBe(true);

    // Send expanded mode with isLoading: false
    window.dispatchEvent(
      new MessageEvent('message', {
        data: {
          source: 'jobby-dialog',
          type: 'jobby.dialog-resize',
          mode: 'expanded',
          isLoading: false,
        },
      }),
    );

    expect(wrapper.classList.contains('is-loading')).toBe(false);
  });
});
