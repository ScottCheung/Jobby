/** @format */

import { describe, expect, it, vi, beforeEach } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { SettingsSection } from './SettingsSection';

describe('SettingsSection Component', () => {
  let mockStorage: Record<string, any> = {};

  beforeEach(() => {
    mockStorage = {
      jobby_disabled_all_pages: false,
      jobby_disabled_domains: ['example.com', 'test.org'],
      jobby_auto_show_job_dialog: true,
    };

    (globalThis as any).chrome = {
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

  it('renders all key sections: Floating Ball, Recognition & Tools, Appearance', () => {
    const onSetThemeColor = vi.fn();
    const onSetThemeMode = vi.fn();

    const html = renderToStaticMarkup(
      createElement(SettingsSection, {
        themeColor: 'green',
        themeMode: 'system',
        onSetThemeColor,
        onSetThemeMode,
      }),
    );

    // Section 1: Floating Ball
    expect(html).toContain('Floating Ball');
    expect(html).toContain('Show Floating Ball');

    // Section 2: Recognition
    expect(html).toContain('Recognition &amp; Tools');
    expect(html).toContain('Auto-Show Job Results');

    // Section 3: Appearance
    expect(html).toContain('Appearance');
    expect(html).toContain('System');
    expect(html).toContain('Light');
    expect(html).toContain('Dark');
    expect(html).toContain('Theme Color');
  });

  it('renders inspection action buttons when handlers are provided', () => {
    const onInspectPage = vi.fn();
    const onInspectForm = vi.fn();

    const html = renderToStaticMarkup(
      createElement(SettingsSection, {
        themeColor: 'blue',
        themeMode: 'dark',
        onSetThemeColor: vi.fn(),
        onSetThemeMode: vi.fn(),
        onInspectPage,
        onInspectForm,
      }),
    );

    expect(html).toContain('Inspect Page');
    expect(html).toContain('Inspect Form');
  });
});
