export type PageChangeInspectionRequest = {
  showLoading: boolean;
  force: boolean;
};

type InspectPage = (request: PageChangeInspectionRequest) => Promise<void>;

export function createPageInspectionQueue(inspectPage: InspectPage) {
  let inFlight = false;
  let pending: PageChangeInspectionRequest | null = null;

  const inspect = (request: PageChangeInspectionRequest): void => {
    if (inFlight) {
      pending = {
        showLoading: pending?.showLoading || request.showLoading,
        force: pending?.force || request.force,
      };
      return;
    }

    inFlight = true;
    void inspectPage(request).finally(() => {
      inFlight = false;
      const next = pending;
      pending = null;
      if (next) inspect(next);
    });
  };

  return inspect;
}

export function pageChangeInspectionRequest(
  message: unknown,
): PageChangeInspectionRequest | null {
  return typeof message === 'object' &&
    message !== null &&
    (message as { type?: unknown }).type === 'content.page-changed'
    ? { showLoading: false, force: true }
    : null;
}
