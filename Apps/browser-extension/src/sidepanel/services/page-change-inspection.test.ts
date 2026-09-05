import { describe, expect, it, vi } from 'vitest';

import {
  createPageInspectionQueue,
  createPageInspectionScheduler,
  pageChangeInspectionRequest,
} from './page-change-inspection';

describe('same-document job changes', () => {
  it('forces a new inspection even when the active tab URL did not change', () => {
    expect(pageChangeInspectionRequest({ type: 'content.page-changed' })).toEqual({
      showLoading: false,
      force: true,
    });
  });

  it('ignores unrelated runtime messages', () => {
    expect(pageChangeInspectionRequest({ type: 'sidepanel.form-changed' })).toBeNull();
  });

  it('runs one follow-up inspection when the selected job changes during inspection', async () => {
    const completions: Array<() => void> = [];
    const requests: Array<{ showLoading: boolean; force: boolean }> = [];
    const inspect = createPageInspectionQueue((request) => {
      requests.push(request);
      return new Promise<void>((resolve) => completions.push(resolve));
    });

    inspect({ showLoading: true, force: false });
    inspect({ showLoading: false, force: true });
    inspect({ showLoading: false, force: true });
    expect(requests).toEqual([{ showLoading: true, force: false }]);

    completions.shift()?.();
    await Promise.resolve();
    expect(requests).toEqual([
      { showLoading: true, force: false },
      { showLoading: false, force: true },
    ]);

    completions.shift()?.();
    await Promise.resolve();
  });

  it('does not postpone inspection while page-change messages keep arriving', async () => {
    vi.useFakeTimers();
    const requests: Array<{ showLoading: boolean; force: boolean }> = [];
    const scheduler = createPageInspectionScheduler(
      (request) => requests.push(request),
      150,
    );

    scheduler.schedule({ showLoading: false, force: true });
    await vi.advanceTimersByTimeAsync(100);
    scheduler.schedule({ showLoading: true, force: false });
    await vi.advanceTimersByTimeAsync(50);

    expect(requests).toEqual([{ showLoading: true, force: true }]);
    scheduler.cancel();
    vi.useRealTimers();
  });
});
