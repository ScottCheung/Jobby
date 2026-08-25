import { useCallback, useEffect, useRef, useState } from 'react';
import { notify } from '@jobby/ui/components/UI/toast/toast-store';

import { apiClient } from '../../background/api-client';
import type { FieldFillResult } from '../../shared/contracts/form-actions';
import type { FormInspection } from '../../shared/contracts/form-inspection';
import type {
  JobSnapshot,
  PageInspection,
} from '../../shared/contracts/page-inspection';
import { send, wait } from '../services/messaging';

function jobKey(snapshot: JobSnapshot): string {
  return `${snapshot.platform}:${snapshot.externalId}`;
}

export function useApplicationTools(
  latestInspection: PageInspection | null,
  latestForm: FormInspection | null,
  inspectForm: () => Promise<FormInspection | null>,
  reportError: (message: string) => void,
  applyAutofillResults: (
    results: FieldFillResult[],
    form?: FormInspection,
  ) => void,
  authConnected = false,
  onSignIn?: () => void,
) {
  const [loadingButton, setLoadingButton] = useState<string | null>(null);
  const [recordedJobKey, setRecordedJobKey] = useState<string | null>(null);
  const latestJobRef = useRef<JobSnapshot | null>(null);

  useEffect(() => {
    if (latestInspection?.kind !== 'job') return;
    const snapshot = latestInspection.snapshot;
    if (
      latestJobRef.current &&
      jobKey(latestJobRef.current) !== jobKey(snapshot)
    ) {
      setRecordedJobKey(null);
    }
    latestJobRef.current = snapshot;
  }, [latestInspection]);

  const requireSignIn = useCallback(
    (message: string): boolean => {
      if (authConnected) return true;
      notify.info(message);
      onSignIn?.();
      return false;
    },
    [authConnected, onSignIn],
  );

  const autofillForm = useCallback(async () => {
    if (!requireSignIn('Please sign in to Jobby to autofill forms.')) return;

    setLoadingButton('autofill');
    try {
      let form =
        latestForm?.kind === 'application_form' ||
        latestForm?.kind === 'page_input_fields' ?
          latestForm
        : await inspectForm();
      if (
        !form ||
        (form.kind !== 'application_form' &&
          form.kind !== 'page_input_fields')
      ) {
        await wait(150);
        form = await inspectForm();
      }
      if (
        !form ||
        (form.kind !== 'application_form' &&
          form.kind !== 'page_input_fields')
      ) {
        reportError('No supported form was detected on this page.');
        return;
      }

      const response = await send({ type: 'form.autofill-active' }).catch(
        (error: unknown) => ({
          ok: false as const,
          error:
            error instanceof Error ?
              error.message
            : 'Autofill could not start.',
        }),
      );
      if (!response.ok) {
        reportError(response.error);
        return;
      }

      const results = response.fillResults || [];
      applyAutofillResults(results, response.form);
      reportError('');
      await inspectForm();
    } finally {
      setLoadingButton(null);
    }
  }, [
    applyAutofillResults,
    inspectForm,
    latestForm,
    reportError,
    requireSignIn,
  ]);

  const recordApplication = useCallback(async () => {
    if (!requireSignIn('Please sign in to Jobby to record applications.')) {
      return;
    }

    const snapshot =
      latestInspection?.kind === 'job' ?
        latestInspection.snapshot
      : latestJobRef.current;
    if (!snapshot) {
      notify.error('Detect the job page before recording this application.');
      return;
    }

    setLoadingButton('record');
    try {
      await apiClient.recordSubmittedApplication(snapshot);
      setRecordedJobKey(jobKey(snapshot));
      notify.success('Application recorded.');
    } catch (error) {
      notify.error(
        error instanceof Error ?
          error.message
        : 'Could not record the application.',
      );
    } finally {
      setLoadingButton(null);
    }
  }, [latestInspection, requireSignIn]);

  const currentJob =
    latestInspection?.kind === 'job' ?
      latestInspection.snapshot
    : latestJobRef.current;

  return {
    loadingButton,
    autofillForm,
    recordApplication,
    canRecordApplication: Boolean(currentJob),
    isApplicationRecorded: Boolean(
      currentJob && recordedJobKey === jobKey(currentJob),
    ),
  };
}
