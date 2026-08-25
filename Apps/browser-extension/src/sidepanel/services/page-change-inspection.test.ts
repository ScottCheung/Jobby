import { describe, expect, it } from 'vitest';

import {
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
});
