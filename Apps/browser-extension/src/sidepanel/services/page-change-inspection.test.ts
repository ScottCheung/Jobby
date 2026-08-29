import { describe, expect, it } from 'vitest';

import {
  createPageInspectionQueue,
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
});
