export type PageChangeInspectionRequest = {
  showLoading: false;
  force: true;
};

export function pageChangeInspectionRequest(
  message: unknown,
): PageChangeInspectionRequest | null {
  return typeof message === 'object' &&
    message !== null &&
    (message as { type?: unknown }).type === 'content.page-changed'
    ? { showLoading: false, force: true }
    : null;
}
