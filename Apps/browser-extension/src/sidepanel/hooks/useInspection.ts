/** @format */

import { useCallback, useEffect, useRef, useState } from 'react';
import { formInspectionSchema } from '../../shared/contracts/form-inspection';
import type { FormInspection } from '../../shared/contracts/form-inspection';
import type { FormFieldObservation } from '../../shared/contracts/form-inspection';
import type { PageInspection } from '../../shared/contracts/page-inspection';
import { getActiveTab, send, wait } from '../services/messaging';

export type UploadSyncState = {
  phase: 'idle' | 'uploading' | 'confirmed' | 'unconfirmed' | 'failed';
  message: string;
  updatedAt: number;
};

function pageUploadState(field: FormFieldObservation): UploadSyncState | null {
  if (field.type !== 'file' || !field.upload) return null;
  if (field.upload.state === 'ready') {
    return {
      phase: 'confirmed',
      message:
        field.upload.filename ?
          `Confirmed: ${field.upload.filename}`
        : 'Confirmed: File ready',
      updatedAt: Date.now(),
    };
  }
  if (field.upload.state === 'rejected') {
    return {
      phase: 'failed',
      message: field.upload.detail || 'Failed: File rejected',
      updatedAt: Date.now(),
    };
  }
  return {
    phase: 'idle',
    message: 'Idle: File not detected yet',
    updatedAt: Date.now(),
  };
}

function reconcileUploadStates(
  previous: Record<string, UploadSyncState>,
  form: FormInspection,
): Record<string, UploadSyncState> {
  if (form.kind !== 'application_form' && form.kind !== 'page_input_fields')
    return previous;
  let changed = false;
  const next = { ...previous };
  const fileKeys = new Set<string>();

  for (const field of form.fields) {
    if (field.type !== 'file') continue;
    fileKeys.add(field.key);
    const observed = pageUploadState(field);
    if (!observed) continue;
    const prior = previous[field.key];
    // The first scan after an upload command can arrive before an ATS has
    // rendered the selected filename. Keep the pending state until the page
    // explicitly confirms, rejects, or the command's retry window expires.
    if (observed.phase === 'idle' && prior?.phase === 'uploading') continue;
    if (
      !prior ||
      prior.phase !== observed.phase ||
      prior.message !== observed.message
    ) {
      next[field.key] = observed;
      changed = true;
    }
  }

  for (const key of Object.keys(next)) {
    if (!fileKeys.has(key)) {
      delete next[key];
      changed = true;
    }
  }
  return changed ? next : previous;
}

function sameJob(left: PageInspection | null, right: PageInspection): boolean {
  return Boolean(
    left?.kind === 'job' &&
    right.kind === 'job' &&
    left.snapshot.platform === right.snapshot.platform &&
    left.snapshot.externalId === right.snapshot.externalId,
  );
}

function mergePageInspection(
  previous: PageInspection | null,
  next: PageInspection,
): PageInspection {
  if (
    !sameJob(previous, next) ||
    previous?.kind !== 'job' ||
    next.kind !== 'job'
  ) {
    return next;
  }

  // Merge snapshot fields, keeping previous valid values if next is temporarily partial
  return {
    ...next,
    snapshot: {
      ...next.snapshot,
      location: next.snapshot.location || previous.snapshot.location,
      description: next.snapshot.description || previous.snapshot.description,
      datePosted: next.snapshot.datePosted || previous.snapshot.datePosted,
    },
  };
}

function inspectionUrl(inspection: PageInspection): string {
  return inspection.kind === 'job' ? inspection.snapshot.url : inspection.url;
}

function targetFor(field: FormFieldObservation) {
  return {
    key: field.key,
    frameId: field.frameId,
    id: field.id,
    name: field.name,
    type: field.type,
    label: field.label,
  };
}

function isSameField(
  candidate: FormFieldObservation,
  field: FormFieldObservation,
): boolean {
  return (
    candidate.key === field.key ||
    Boolean(field.id && candidate.id === field.id) ||
    Boolean(
      field.name &&
      candidate.name === field.name &&
      candidate.type === field.type,
    ) ||
    (candidate.type === field.type && candidate.label === field.label)
  );
}

function fieldMatchesValue(
  field: FormFieldObservation,
  value: string | boolean,
): boolean {
  if (typeof value === 'boolean') return field.filled === value;
  const selectedOption = field.options.find(
    (option) => option.value === value || option.label === value,
  );
  const expected = selectedOption?.label || value;
  const current = field.currentValue || '';
  return (
    current === expected ||
    (expected.length > 1 && current.startsWith(`${expected} `))
  );
}

function formSignature(form: FormInspection): string {
  if (form.kind === 'application_form' || form.kind === 'page_input_fields') {
    return JSON.stringify({
      kind: form.kind,
      url: form.url,
      fields: form.fields.map((field) => ({
        key: field.key,
        frameId: field.frameId,
        type: field.type,
        label: field.label,
        required: field.required,
        filled: field.filled,
        currentValue: field.currentValue || '',
        options: field.options,
        upload: field.upload,
      })),
      ...(form.kind === 'application_form' ?
        {
          action: form.action,
          canGoBack: form.canGoBack,
          submitLabel: form.submitLabel,
        }
      : {}),
    });
  }
  return `${form.kind}:${form.url}:${form.reason}`;
}

function hasVisibleFields(form: FormInspection | null): boolean {
  return Boolean(
    form &&
    (form.kind === 'application_form' || form.kind === 'page_input_fields') &&
    form.fields.length > 0,
  );
}

function retainUploadedFileFields(
  previous: FormInspection | null,
  next: FormInspection,
): FormInspection {
  if (
    !previous ||
    (previous.kind !== 'application_form' &&
      previous.kind !== 'page_input_fields') ||
    (next.kind !== 'application_form' && next.kind !== 'page_input_fields') ||
    previous.url !== next.url
  ) {
    return next;
  }

  // Some ATSs replace the hidden file input with an uploaded-file card. The
  // next DOM inspection then no longer has an input to report, even though the
  // file was accepted. Preserve only confirmed file fields for this same form.
  const retained = previous.fields.filter(
    (field) =>
      field.type === 'file' &&
      (field.filled || field.upload?.state === 'ready') &&
      !next.fields.some((candidate) => isSameField(candidate, field)),
  );
  if (retained.length === 0) return next;
  return { ...next, fields: [...next.fields, ...retained] };
}

function isLinkedInTransientEmptyForm(form: FormInspection): boolean {
  return form.kind === 'not_application_form' && form.platform === 'linkedin';
}

export function useInspection(onJobChanged?: () => void) {
  const [latestInspection, setLatestInspection] =
    useState<PageInspection | null>(null);
  const [latestForm, setLatestForm] = useState<FormInspection | null>(null);
  const [inspectionError, setInspectionError] = useState<string>('');
  const [isInspectingPage, setIsInspectingPage] = useState(false);
  const [isInspectingForm, setIsInspectingForm] = useState(false);
  const [isClearingForm, setIsClearingForm] = useState(false);
  const [uploadStates, setUploadStates] = useState<
    Record<string, UploadSyncState>
  >({});

  const pageInspectionInFlight = useRef(false);
  const formInspectionInFlight = useRef(false);
  const lastObservedActiveUrl = useRef<string | null>(null);
  const lastObservedActiveTabId = useRef<number | null>(null);
  const lastFormSignature = useRef<string>('');
  const pendingFormChange = useRef<FormInspection | null>(null);
  const formChangeTimer = useRef<number | undefined>(undefined);
  const linkedInClearTimer = useRef<number | undefined>(undefined);
  const latestFormRef = useRef<FormInspection | null>(null);

  useEffect(() => {
    latestFormRef.current = latestForm;
  }, [latestForm]);

  const setFormIfChanged = useCallback((form: FormInspection) => {
    const reconciledForm = retainUploadedFileFields(
      latestFormRef.current,
      form,
    );
    const nextSignature = formSignature(reconciledForm);
    if (nextSignature === lastFormSignature.current) return false;
    lastFormSignature.current = nextSignature;
    latestFormRef.current = reconciledForm;
    setLatestForm(reconciledForm);
    setUploadStates((previous) =>
      reconcileUploadStates(previous, reconciledForm),
    );
    return true;
  }, []);

  const resetInspectionState = useCallback(() => {
    setLatestInspection(null);
    setLatestForm(null);
    setUploadStates({});
    lastFormSignature.current = '';
    onJobChanged?.();
  }, [onJobChanged]);

  const inspectPage = useCallback(async () => {
    if (pageInspectionInFlight.current) return;
    pageInspectionInFlight.current = true;
    setIsInspectingPage(true);
    try {
      resetInspectionState();
      lastObservedActiveUrl.current = null;
      lastObservedActiveTabId.current = null;
      const response = await send({ type: 'content.inspect-active' });
      if (!response.ok) {
        setInspectionError(response.error);
        return;
      }
      setInspectionError('');
      if (response.inspection) {
        setLatestInspection(response.inspection);
        const tab = await getActiveTab();
        lastObservedActiveTabId.current = tab?.id ?? null;
        lastObservedActiveUrl.current = inspectionUrl(response.inspection);
      }
    } finally {
      pageInspectionInFlight.current = false;
      setIsInspectingPage(false);
    }
  }, [resetInspectionState]);

  const autoInspectActivePage = useCallback(
    async (force = false, showLoading = false): Promise<boolean> => {
      if (pageInspectionInFlight.current) return false;

      const tab = await getActiveTab();
      const url = tab?.url;
      const tabId = tab?.id ?? null;
      if (!url) {
        setInspectionError('No active web page detected. Please switch to the job page you wish to inspect.');
        return false;
      }

      const tabOrUrlChanged =
        tabId !== lastObservedActiveTabId.current ||
        url !== lastObservedActiveUrl.current;
      const missingDateOnJob =
        latestInspection?.kind === 'job' &&
        !latestInspection.snapshot.datePosted;

      if (!force && !tabOrUrlChanged && !missingDateOnJob) return false;

      pageInspectionInFlight.current = true;
      if (showLoading) {
        setIsInspectingPage(true);
      }
      try {
        const response = await send({ type: 'content.inspect-active' });
        if (!response.ok || !response.inspection) {
          setInspectionError(
            response.ok ? 'The page returned no inspection results.' : response.error,
          );
          // Communication error — don't update URL cache so the next page
          // event or recovery check can retry.
          lastObservedActiveUrl.current = null;
          lastObservedActiveTabId.current = null;
          return false;
        }

        setInspectionError('');
        setLatestInspection((prev) => {
          const mergedInspection = mergePageInspection(
            prev,
            response.inspection!,
          );
          if (!sameJob(prev, mergedInspection)) {
            setLatestForm(null);
            lastFormSignature.current = '';
            onJobChanged?.();
          }
          return mergedInspection;
        });

        // Always record the current tab/URL even for non-job results.
        // This prevents the polling loop from treating the next tick as a
        // "new URL" and forcing another redundant inspection.
        lastObservedActiveTabId.current = tabId;
        lastObservedActiveUrl.current = url;
        return response.inspection.kind === 'job';
      } catch (error) {
        setInspectionError(
          error instanceof Error ? error.message : 'Failed to inspect the current page.',
        );
        lastObservedActiveUrl.current = null;
        lastObservedActiveTabId.current = null;
        return false;
      } finally {
        pageInspectionInFlight.current = false;
        setIsInspectingPage(false);
      }
    },
    [onJobChanged],
  );

  const inspectForm = useCallback(
    async (silent = false): Promise<FormInspection | null> => {
      if (formInspectionInFlight.current) return null;
      formInspectionInFlight.current = true;
      if (!silent) setIsInspectingForm(true);
      try {
        const response = await send({ type: 'content.inspect-form-active' });
        if (!response.ok) {
          setInspectionError(response.error);
          return null;
        }
        setInspectionError('');
        if (response.form) {
          setFormIfChanged(response.form);
          return response.form;
        }
        return null;
      } finally {
        formInspectionInFlight.current = false;
        if (!silent) setIsInspectingForm(false);
      }
    },
    [setFormIfChanged],
  );

  const focusFormField = useCallback(async (field: FormFieldObservation) => {
    const response = await send({
      type: 'content.focus-form-field-active',
      target: targetFor(field),
    });
    if (!response.ok) setInspectionError(response.error);
  }, []);

  const autofillSingleField = useCallback(
    async (field: FormFieldObservation) => {
      const response = await send({
        type: 'content.autofill-single-field-active',
        target: targetFor(field),
      });
      if (!response.ok) {
        setInspectionError(response.error);
        return false;
      }
      if (
        response.fillResult &&
        !['filled', 'already_filled'].includes(response.fillResult.status)
      ) {
        setInspectionError(response.fillResult.message);
        void inspectForm(true);
        return false;
      }
      setInspectionError('');
      await inspectForm(true);
      return true;
    },
    [inspectForm],
  );

  const uploadDefaultResume = useCallback(
    async (field: FormFieldObservation) => {
      setUploadStates((previous) => ({
        ...previous,
        [field.key]: {
          phase: 'uploading',
          message: 'Uploading default resume, awaiting webpage confirmation.',
          updatedAt: Date.now(),
        },
      }));
      const response = await send({
        type: 'content.upload-default-resume-active',
        target: targetFor(field),
      });
      if (!response.ok) {
        setUploadStates((previous) => ({
          ...previous,
          [field.key]: {
            phase: 'failed',
            message: response.error,
            updatedAt: Date.now(),
          },
        }));
        setInspectionError(response.error);
        return;
      }
      const fillResult = response.fillResult;
      if (
        fillResult &&
        !['filled', 'already_filled'].includes(fillResult.status)
      ) {
        setUploadStates((previous) => ({
          ...previous,
          [field.key]: {
            phase: 'failed',
            message: fillResult.message,
            updatedAt: Date.now(),
          },
        }));
        setInspectionError(fillResult.message);
        return;
      }
      setInspectionError('');
      for (let attempt = 0; attempt < 4; attempt += 1) {
        const form = await inspectForm(true);
        const uploadedField =
          (
            form?.kind === 'application_form' ||
            form?.kind === 'page_input_fields'
          ) ?
            form.fields.find((candidate) => candidate.key === field.key)
          : undefined;
        const upload = uploadedField?.upload;
        if (upload?.state === 'ready') {
          setUploadStates((previous) => ({
            ...previous,
            [field.key]: {
              phase: 'confirmed',
              message:
                upload.filename ?
                  `Confirmed: ${upload.filename}`
                : 'Confirmed: Default resume ready',
              updatedAt: Date.now(),
            },
          }));
          return;
        }
        if (attempt < 3) await wait(250);
      }
      setUploadStates((previous) => ({
        ...previous,
        [field.key]: {
          phase: 'unconfirmed',
          message:
            'File command completed, but the website has not confirmed it yet; please check the upload status on the website.',
          updatedAt: Date.now(),
        },
      }));
    },
    [inspectForm],
  );

  const editFormField = useCallback(
    async (field: FormFieldObservation, value: string | boolean) => {
      const response = await send({
        type: 'content.edit-form-field-active',
        target: targetFor(field),
        value,
      });
      if (!response.ok) {
        setInspectionError(response.error);
        return;
      }
      if (
        response.fillResult &&
        !['filled', 'already_filled'].includes(response.fillResult.status)
      ) {
        setInspectionError(response.fillResult.message);
        void inspectForm();
        return;
      }

      // A number of ATS pages use controlled checkbox/radio widgets. Confirm
      // the rendered form state after the message round-trip so the side panel
      // never claims a change that the webpage immediately rejected.
      if (
        typeof value === 'boolean' ||
        field.type === 'radio' ||
        field.type === 'select'
      ) {
        for (let attempt = 0; attempt < 5; attempt += 1) {
          const form = await inspectForm(true);
          const updatedField =
            form &&
            (form.kind === 'application_form' ||
              form.kind === 'page_input_fields') &&
            form.fields.find((candidate) => isSameField(candidate, field));
          const confirmed =
            updatedField &&
            (field.type === 'checkbox' ?
              typeof value === 'boolean' && updatedField.filled === value
            : fieldMatchesValue(updatedField, value));
          if (confirmed) {
            setInspectionError('');
            return;
          }
          if (attempt < 4) await wait(180);
        }
        setInspectionError(
          'The website has not confirmed this option update. Please complete this action directly on the webpage.',
        );
        return;
      }

      setInspectionError('');
    },
    [inspectForm],
  );

  const clearAllFormFields = useCallback(async () => {
    const form = latestFormRef.current;
    if (
      !form ||
      (form.kind !== 'application_form' && form.kind !== 'page_input_fields')
    )
      return;

    setIsClearingForm(true);
    setInspectionError('');
    setUploadStates({});
    try {
      await Promise.all(
        form.fields
          .filter((field) => !['password', 'radio'].includes(field.type))
          .map((field) =>
            editFormField(field, field.type === 'checkbox' ? false : ''),
          ),
      );
      await inspectForm(true);
    } finally {
      setIsClearingForm(false);
    }
  }, [editFormField, inspectForm]);

  useEffect(() => {
    const listener = (message: unknown) => {
      if (
        typeof message !== 'object' ||
        message === null ||
        (message as { type?: unknown }).type !== 'sidepanel.form-changed'
      )
        return;
      const changedTabId = (message as { tabId?: unknown }).tabId;
      void getActiveTab().then((tab) => {
        if (typeof changedTabId !== 'number' || tab?.id !== changedTabId)
          return;
        const parsed = formInspectionSchema.safeParse(
          (message as { form?: unknown }).form,
        );
        if (parsed.success) {
          // LinkedIn briefly removes/replaces its modal subtree during a step
          // transition. Do not erase the visible field list for that single
          // intermediate frame; verify once the transition settles instead.
          if (
            isLinkedInTransientEmptyForm(parsed.data) &&
            hasVisibleFields(latestFormRef.current)
          ) {
            if (linkedInClearTimer.current !== undefined)
              window.clearTimeout(linkedInClearTimer.current);
            linkedInClearTimer.current = window.setTimeout(() => {
              linkedInClearTimer.current = undefined;
              void inspectForm();
            }, 500);
            return;
          }
          if (linkedInClearTimer.current !== undefined) {
            window.clearTimeout(linkedInClearTimer.current);
            linkedInClearTimer.current = undefined;
          }
          pendingFormChange.current = parsed.data;
          if (formChangeTimer.current !== undefined)
            window.clearTimeout(formChangeTimer.current);
          formChangeTimer.current = window.setTimeout(() => {
            const form = pendingFormChange.current;
            pendingFormChange.current = null;
            formChangeTimer.current = undefined;
            if (!form) return;
            setInspectionError('');
            setFormIfChanged(form);
          }, 150);
          return;
        }
        void inspectForm();
      });
    };
    if (typeof chrome !== 'undefined' && chrome.runtime?.onMessage) {
      chrome.runtime.onMessage.addListener(listener);
    }
    return () => {
      if (typeof chrome !== 'undefined' && chrome.runtime?.onMessage) {
        chrome.runtime.onMessage.removeListener(listener);
      }
      if (formChangeTimer.current !== undefined)
        window.clearTimeout(formChangeTimer.current);
      if (linkedInClearTimer.current !== undefined)
        window.clearTimeout(linkedInClearTimer.current);
    };
  }, [inspectForm, setFormIfChanged]);

  return {
    latestInspection,
    setLatestInspection,
    latestForm,
    setLatestForm,
    inspectionError,
    isInspectingPage,
    isInspectingForm,
    isClearingForm,
    setInspectionError,
    resetInspectionState,
    inspectPage,
    autoInspectActivePage,
    inspectForm,
    focusFormField,
    autofillSingleField,
    uploadDefaultResume,
    editFormField,
    clearAllFormFields,
    uploadStates,
  };
}
