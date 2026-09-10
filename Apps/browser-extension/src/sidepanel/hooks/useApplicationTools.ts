import { useCallback, useState } from 'react';
import { notify } from '@jobby/ui/components/UI/toast/toast-store';

import { apiClient } from '../../background/api-client';
import type { FieldFillResult } from '../../shared/contracts/form-actions';
import type { FormInspection } from '../../shared/contracts/form-inspection';
import type { PageInspection } from '../../shared/contracts/page-inspection';
import type { ApplicationAction } from '../../shared/contracts/application-navigation';
import type { ApplicationSession } from '../../shared/contracts/application-session';
import { send, wait } from '../services/messaging';

export function useApplicationTools(
  _latestInspection: PageInspection | null,
  latestForm: FormInspection | null,
  inspectForm: () => Promise<FormInspection | null>,
  reportError: (message: string) => void,
  applyAutofillResults: (
    results: FieldFillResult[],
    form?: FormInspection,
  ) => void,
  authConnected = false,
  onSignIn?: () => void,
  autofillDocuments?: (form: FormInspection) => Promise<void>,
  applicationSession?: ApplicationSession | null,
  onApplicationSessionChange?: (session: ApplicationSession | null) => void,
) {
  const [loadingButton, setLoadingButton] = useState<string | null>(null);
  const [isCancellingAutofill, setIsCancellingAutofill] = useState(false);
  const [recordedSessionId, setRecordedSessionId] = useState<string | null>(null);

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
    setIsCancellingAutofill(false);
    try {
      let form =
        (latestForm?.kind === 'application_form' ||
          latestForm?.kind === 'page_input_fields') &&
        latestForm.fields.length > 0 ?
          latestForm
        : await inspectForm();
      if (
        !form ||
        (form.kind !== 'application_form' &&
          form.kind !== 'page_input_fields') ||
        form.fields.length === 0
      ) {
        await wait(150);
        form = await inspectForm();
      }
      if (
        !form ||
        (form.kind !== 'application_form' &&
          form.kind !== 'page_input_fields') ||
        form.fields.length === 0
      ) {
        reportError('No supported form was detected on this page.');
        return;
      }

      if (applicationSession !== undefined) {
        if (!applicationSession) {
          reportError('Detect the job before autofilling this application.');
          return;
        }
        const lockResponse = await send({
          type: 'application.session-lock-active',
        });
        if (!lockResponse.ok || !lockResponse.applicationSession) {
          reportError(
            lockResponse.ok
              ? 'The application session is no longer available.'
              : lockResponse.error,
          );
          return;
        }
        onApplicationSessionChange?.(lockResponse.applicationSession);
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

      const refreshedForm = await inspectForm();
      const targetForm = refreshedForm || response.form || form;
      if (autofillDocuments && targetForm) {
        await autofillDocuments(targetForm);
        await inspectForm();
      }
    } finally {
      setIsCancellingAutofill(false);
      setLoadingButton(null);
    }
  }, [
    applyAutofillResults,
    autofillDocuments,
    inspectForm,
    latestForm,
    applicationSession,
    onApplicationSessionChange,
    reportError,
    requireSignIn,
  ]);

  const cancelAutofill = useCallback(async () => {
    if (loadingButton !== 'autofill' || isCancellingAutofill) return;
    setIsCancellingAutofill(true);
    const response = await send({ type: 'form.autofill-cancel-active' }).catch(
      (error: unknown) => ({
        ok: false as const,
        error: error instanceof Error ? error.message : 'Autofill could not be cancelled.',
      }),
    );
    if (!response.ok) {
      setIsCancellingAutofill(false);
      reportError(response.error);
    }
  }, [isCancellingAutofill, loadingButton, reportError]);

  const recordApplication = useCallback(async () => {
    if (!requireSignIn('Please sign in to Jobby to record applications.')) {
      return;
    }

    if (applicationSession === undefined || !applicationSession) {
      notify.error('Detect the job page before recording this application.');
      return;
    }

    setLoadingButton('record');
    try {
      await apiClient.recordSubmittedApplication(
        applicationSession.job,
        applicationSession.id,
      );
      const sessionResponse = await send({
        type: 'application.session-mark-submitted',
        submission: {
          platform: applicationSession.job.platform,
          url: applicationSession.job.url,
          verified: true,
        },
      });
      if (sessionResponse.ok && sessionResponse.applicationSession) {
        onApplicationSessionChange?.(sessionResponse.applicationSession);
      }
      setRecordedSessionId(applicationSession.id);
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
  }, [applicationSession, onApplicationSessionChange, requireSignIn]);

  const navigateApplication = useCallback(
    async (action: ApplicationAction) => {
      if (!requireSignIn('Please sign in to use application navigation.')) return;
      if (applicationSession === undefined || !applicationSession) {
        reportError('Detect the job before navigating this application.');
        return;
      }

      setLoadingButton(action);
      try {
        const sessionResponse = await send({
          type:
            action === 'submit'
              ? 'application.session-start-submit-active'
              : 'application.session-lock-active',
        });
        if (!sessionResponse.ok || !sessionResponse.applicationSession) {
          reportError(
            sessionResponse.ok
              ? 'The application session is no longer available.'
              : sessionResponse.error,
          );
          return;
        }
        const session = sessionResponse.applicationSession;
        onApplicationSessionChange?.(session);

        const response = await send({
          type: 'content.application-action-active',
          action,
        });
        if (!response.ok || !response.applicationAction) {
          if (action === 'submit') {
            const unknownResponse = await send({
              type: 'application.session-mark-unknown',
            });
            if (unknownResponse.ok && unknownResponse.applicationSession) {
              onApplicationSessionChange?.(unknownResponse.applicationSession);
            }
          }
          reportError(response.ok ? 'Application action is unavailable.' : response.error);
          return;
        }

        const actionResult = response.applicationAction;
        if (action === 'submit') {
          if (actionResult.status !== 'clicked' || actionResult.verified !== true) {
            const unknownResponse = await send({
              type: 'application.session-mark-unknown',
            });
            if (unknownResponse.ok && unknownResponse.applicationSession) {
              onApplicationSessionChange?.(unknownResponse.applicationSession);
            }
            reportError(
              actionResult.message ||
                'The application submission could not be confirmed.',
            );
            return;
          }

          const tab = await chrome.tabs.query({
            active: true,
            currentWindow: true,
          });
          const submissionUrl = tab[0]?.url || actionResult.url;
          if (!submissionUrl) {
            const unknownResponse = await send({
              type: 'application.session-mark-unknown',
            });
            if (unknownResponse.ok && unknownResponse.applicationSession) {
              onApplicationSessionChange?.(unknownResponse.applicationSession);
            }
            reportError('The application was submitted without a verifiable URL.');
            return;
          }
          try {
            await apiClient.recordSubmittedApplication(session.job, session.id);
            const submittedResponse = await send({
              type: 'application.session-mark-submitted',
              submission: {
                platform: session.job.platform,
                url: submissionUrl,
                verified: true,
              },
            });
            if (submittedResponse.ok && submittedResponse.applicationSession) {
              onApplicationSessionChange?.(submittedResponse.applicationSession);
            }
            setRecordedSessionId(session.id);
            notify.success('Application submitted and recorded.');
          } catch (error) {
            const unknownResponse = await send({
              type: 'application.session-mark-unknown',
            });
            if (unknownResponse.ok && unknownResponse.applicationSession) {
              onApplicationSessionChange?.(unknownResponse.applicationSession);
            }
            notify.error(
              error instanceof Error
                ? error.message
                : 'The application was submitted, but could not be recorded.',
            );
          }
          return;
        }

        await inspectForm();
        reportError('');
      } catch (error) {
        if (action === 'submit') {
          const unknownResponse = await send({
            type: 'application.session-mark-unknown',
          }).catch(() => null);
          if (unknownResponse?.ok && unknownResponse.applicationSession) {
            onApplicationSessionChange?.(unknownResponse.applicationSession);
          }
        }
        reportError(
          error instanceof Error
            ? error.message
            : 'Could not navigate the application.',
        );
      } finally {
        setLoadingButton(null);
      }
    },
    [
      applicationSession,
      inspectForm,
      onApplicationSessionChange,
      reportError,
      requireSignIn,
    ],
  );

  const currentJob = applicationSession?.job;

  return {
    loadingButton,
    isCancellingAutofill,
    autofillForm,
    cancelAutofill,
    recordApplication,
    navigateApplication,
    canRecordApplication: Boolean(currentJob),
    isApplicationRecorded: Boolean(
      currentJob && recordedSessionId === applicationSession?.id,
    ),
  };
}
