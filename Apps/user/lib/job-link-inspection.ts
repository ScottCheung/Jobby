/** @format */

export interface InspectedJobLink {
  url?: string;
  platform?: string;
  external_id?: string;
  title?: string;
  company?: string;
  location?: string;
  first_posted_at?: string;
  last_posted_at?: string;
  technologies?: string[];
  easy_apply?: boolean;
  job_description?: string;
}

interface ExtensionInspectionResponse {
  ok?: boolean;
  error?: string;
  inspection?: {
    kind?: string;
    snapshot?: {
      url?: string;
      platform?: string;
      externalId?: string;
      title?: string;
      company?: string;
      location?: string;
      firstPostedAt?: string;
      lastPostedAt?: string;
      technologies?: string[];
      easyApply?: boolean;
      description?: string;
    };
  };
}

export function inspectJobLink(url: string): Promise<InspectedJobLink> {
  const requestId = crypto.randomUUID();

  return new Promise((resolve, reject) => {
    let timeoutId: number;

    const finish = (result: InspectedJobLink) => {
      window.clearTimeout(timeoutId);
      window.removeEventListener("message", onMessage);
      resolve(result);
    };

    const fail = (message: string) => {
      window.clearTimeout(timeoutId);
      window.removeEventListener("message", onMessage);
      reject(new Error(message));
    };

    const onMessage = (event: MessageEvent) => {
      if (
        event.source !== window ||
        event.origin !== window.location.origin ||
        event.data?.source !== "jobby-extension" ||
        event.data?.requestId !== requestId
      ) {
        return;
      }

      if (event.data.type === "JOBBY_INSPECT_JOB_URL_ACK") {
        window.clearTimeout(timeoutId);
        timeoutId = window.setTimeout(
          () => fail("The job page took too long to load."),
          40_000,
        );
        return;
      }

      if (event.data.type !== "JOBBY_INSPECT_JOB_URL_RESULT") return;
      const response = event.data.response as ExtensionInspectionResponse;
      const snapshot = response.inspection?.snapshot;
      if (!response.ok || response.inspection?.kind !== "job" || !snapshot) {
        fail(
          response.error || "The extension could not recognize this job page.",
        );
        return;
      }
      if (!snapshot.description?.trim()) {
        fail(
          "The extension found the job, but could not read its job description.",
        );
        return;
      }
      finish({
        url: snapshot.url,
        platform: snapshot.platform,
        external_id: snapshot.externalId,
        title: snapshot.title,
        company: snapshot.company,
        location: snapshot.location,
        first_posted_at: snapshot.firstPostedAt,
        last_posted_at: snapshot.lastPostedAt,
        technologies: snapshot.technologies || [],
        easy_apply: snapshot.easyApply,
        job_description: snapshot.description,
      });
    };

    window.addEventListener("message", onMessage);
    timeoutId = window.setTimeout(
      () =>
        fail(
          "The Jobby extension bridge is not loaded. Reload the extension, then refresh this page.",
        ),
      1_000,
    );
    window.postMessage(
      {
        source: "jobby-web-app",
        type: "JOBBY_INSPECT_JOB_URL",
        requestId,
        url,
      },
      window.location.origin,
    );
  });
}
