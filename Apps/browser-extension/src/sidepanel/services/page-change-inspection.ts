export type PageChangeInspectionRequest = {
  showLoading: boolean;
  force: boolean;
};

type InspectPage = (request: PageChangeInspectionRequest) => Promise<void>;

function mergeRequests(
  current: PageChangeInspectionRequest | null,
  next: PageChangeInspectionRequest,
): PageChangeInspectionRequest {
  return {
    showLoading: current?.showLoading || next.showLoading,
    force: current?.force || next.force,
  };
}

export function createPageInspectionQueue(inspectPage: InspectPage) {
  let inFlight = false;
  let pending: PageChangeInspectionRequest | null = null;

  const inspect = (request: PageChangeInspectionRequest): void => {
    if (inFlight) {
      pending = mergeRequests(pending, request);
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

export function createPageInspectionScheduler(
  inspectPage: (request: PageChangeInspectionRequest) => void,
  delayMs: number,
) {
  let timer: ReturnType<typeof globalThis.setTimeout> | undefined;
  let pending: PageChangeInspectionRequest | null = null;

  const schedule = (request: PageChangeInspectionRequest): void => {
    pending = mergeRequests(pending, request);
    if (timer !== undefined) return;

    timer = globalThis.setTimeout(() => {
      timer = undefined;
      const next = pending;
      pending = null;
      if (next) inspectPage(next);
    }, delayMs);
  };

  const cancel = (): void => {
    if (timer !== undefined) globalThis.clearTimeout(timer);
    timer = undefined;
    pending = null;
  };

  return { schedule, cancel };
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
