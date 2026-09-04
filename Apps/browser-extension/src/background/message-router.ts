/** @format */

import type { RuntimeMessageResponse } from '../shared/contracts/messages';
import { runtimeMessageSchema } from '../shared/contracts/messages';

import {
  disconnect,
  getAuthStatus,
  openLogin,
} from './auth-service';
import {
  editActiveTabField,
  focusActiveTabField,
  highlightJobRequirementInActiveTab,
  inspectActiveTab,
  inspectJobUrl,
  inspectFormActiveTab,
  setTargetedTabId,
} from './content-bridge';
import { logDiagnostic } from './diagnostics';
import {
  autofillDetectedFormForActiveTab,
  cancelActiveAutofill,
  autofillSingleFieldForActiveTab,
  uploadDefaultResumeToActiveTab,
  uploadPreparedFileToActiveTab,
} from './field-fill-service';
import {
  clearDiagnostics,
  getRuntimeSnapshot,
  listDiagnostics,
} from './session-store';
import { controlRun } from './run-controller';
import { closeSidepanelForWindow, isSidepanelOpenForWindow } from './service-worker';

export async function handleRuntimeMessage(
  rawMessage: unknown,
  sender?: chrome.runtime.MessageSender,
): Promise<RuntimeMessageResponse> {
  const parsed = runtimeMessageSchema.safeParse(rawMessage);
  if (!parsed.success)
    return { ok: false, error: 'Unsupported extension message.' };

  const messageTargetTabId = readTargetedTabId(rawMessage);
  setTargetedTabId(messageTargetTabId);

  try {
    switch (parsed.data.type) {
      case 'runtime.get':
        return { ok: true, snapshot: await getRuntimeSnapshot() };
      case 'runtime.pause':
        return { ok: true, snapshot: await controlRun('paused') };
      case 'runtime.resume':
        return { ok: true, snapshot: await controlRun('running') };
      case 'runtime.stop':
        return { ok: true, snapshot: await controlRun('stopped') };
      case 'diagnostics.list':
        return {
          ok: true,
          snapshot: await getRuntimeSnapshot(),
          diagnostics: await listDiagnostics(),
        };
      case 'diagnostics.clear':
        await clearDiagnostics();
        return {
          ok: true,
          snapshot: await getRuntimeSnapshot(),
          diagnostics: [],
        };
      case 'auth.status':
        return {
          ok: true,
          snapshot: await getRuntimeSnapshot(),
          auth: await getAuthStatus(),
        };
      case 'auth.disconnect':
        if (!isExtensionUiSender(sender))
          return { ok: false, error: 'Only the extension UI can disconnect.' };
        await disconnect();
        await logDiagnostic('info', 'auth', 'Extension disconnected.');
        return {
          ok: true,
          snapshot: await getRuntimeSnapshot(),
          auth: { connected: false },
        };
      case 'auth.open-login':
        if (!isExtensionUiSender(sender))
          return { ok: false, error: 'Only the extension UI can connect.' };
        return {
          ok: true,
          snapshot: await getRuntimeSnapshot(),
          auth: await openLogin(),
        };
      case 'content.inspect-active':
        if (!isExtensionUiSender(sender))
          return {
            ok: false,
            error: 'Only the extension UI can inspect a page.',
          };
        return {
          ok: true,
          snapshot: await getRuntimeSnapshot(),
          inspection: await inspectActiveTab(messageTargetTabId),
        };
      case 'content.inspect-url':
        if (!isJobbyWebAppSender(sender))
          return {
            ok: false,
            error: 'Only the Jobby web app can inspect a pasted job link.',
          };
        return {
          ok: true,
          snapshot: await getRuntimeSnapshot(),
          inspection: await inspectJobUrl(parsed.data.url, sender?.tab?.id),
        };
      case 'content.inspect-form-active':
        if (!isExtensionUiSender(sender))
          return {
            ok: false,
            error: 'Only the extension UI can inspect a form.',
          };
        return {
          ok: true,
          snapshot: await getRuntimeSnapshot(),
          form: await inspectFormActiveTab(),
        };
      case 'form.autofill-active':
        if (!isExtensionUiSender(sender))
          return {
            ok: false,
            error: 'Only the extension UI can autofill forms.',
          };
        {
          const result = await autofillDetectedFormForActiveTab();
          // Return a fresh post-fill snapshot with the command result. The
          // side panel must not rely on an observer race to show completion.
          const form = await inspectFormActiveTab().catch(() => undefined);
          return {
            ok: true,
            snapshot: await getRuntimeSnapshot(),
            fillResults: result.results,
            unansweredFields: result.unansweredFields,
            ...(form ? { form } : {}),
          };
        }
      case 'form.autofill-cancel-active':
        if (!isExtensionUiSender(sender))
          return {
            ok: false,
            error: 'Only the extension UI can cancel autofill.',
          };
        await cancelActiveAutofill();
        return { ok: true, snapshot: await getRuntimeSnapshot() };
      case 'content.focus-form-field-active':
        if (!isExtensionUiSender(sender))
          return {
            ok: false,
            error: 'Only the extension UI can focus form fields.',
          };
        return {
          ok: true,
          snapshot: await getRuntimeSnapshot(),
          focusResult: await focusActiveTabField(parsed.data.target),
        };
      case 'content.highlight-job-requirement-active': {
        if (!isExtensionUiSender(sender))
          return {
            ok: false,
            error: 'Only the extension UI can highlight job requirements.',
          };
        const result = await highlightJobRequirementInActiveTab(
          parsed.data.searchTerms,
        );
        return {
          ok: true,
          snapshot: await getRuntimeSnapshot(),
          highlighted: result.highlighted,
          matchCount: result.matchCount,
          currentIndex: result.currentIndex,
        };
      }
      case 'content.autofill-single-field-active':
        if (!isExtensionUiSender(sender))
          return {
            ok: false,
            error: 'Only the extension UI can autofill form fields.',
          };
        return {
          ok: true,
          snapshot: await getRuntimeSnapshot(),
          fillResult: await autofillSingleFieldForActiveTab(parsed.data.target),
        };
      case 'content.upload-default-resume-active':
        if (!isExtensionUiSender(sender))
          return {
            ok: false,
            error: 'Only the extension UI can upload resumes.',
          };
        return {
          ok: true,
          snapshot: await getRuntimeSnapshot(),
          fillResult: await uploadDefaultResumeToActiveTab(parsed.data.target),
        };
      case 'content.upload-file-active':
        if (!isExtensionUiSender(sender))
          return {
            ok: false,
            error: 'Only the extension UI can upload files.',
          };
        return {
          ok: true,
          snapshot: await getRuntimeSnapshot(),
          fillResult: await uploadPreparedFileToActiveTab(parsed.data.target, {
            filename: parsed.data.filename,
            mimeType: parsed.data.mimeType,
            contentBase64: parsed.data.contentBase64,
          }),
        };
      case 'content.edit-form-field-active':
        if (!isExtensionUiSender(sender))
          return {
            ok: false,
            error: 'Only the extension UI can edit form fields.',
          };
        return {
          ok: true,
          snapshot: await getRuntimeSnapshot(),
          fillResult: await editActiveTabField(
            parsed.data.target,
            parsed.data.value,
          ),
        };
      case 'sidepanel.query-state':
        if (sender?.tab?.windowId !== undefined) {
          try {
            const win = await chrome.windows.get(sender.tab.windowId);
            if (win.type === 'popup') {
              return {
                ok: true,
                snapshot: await getRuntimeSnapshot(),
                isOpen: false,
                canHostSidepanel: false,
              };
            }
          } catch {
            // Ignore error and fall back
          }
          return {
            ok: true,
            snapshot: await getRuntimeSnapshot(),
            isOpen: isSidepanelOpenForWindow(sender.tab.windowId),
            canHostSidepanel: true,
          };
        }
        return {
          ok: true,
          snapshot: await getRuntimeSnapshot(),
          isOpen: false,
          canHostSidepanel: false,
        };
      case 'sidepanel.open':
        if (sender?.tab?.id !== undefined && sender.tab.windowId !== undefined) {
          try {
            const window = await chrome.windows.get(sender.tab.windowId);
            if (window.type === 'popup') {
              return {
                ok: false,
                error: 'Chrome Side Panel is unavailable in popup windows.',
              };
            }
            await chrome.sidePanel.setOptions({
              tabId: sender.tab.id,
              path: 'src/sidepanel/index.html',
              enabled: true,
            });
            await chrome.sidePanel.open({ windowId: sender.tab.windowId });
            return { ok: true, snapshot: await getRuntimeSnapshot() };
          } catch (error: unknown) {
            const msg = error instanceof Error ? error.message : String(error);
            return { ok: false, error: msg };
          }
        }
        return { ok: false, error: 'No sender tab' };
      case 'sidepanel.close':
        if (sender?.tab?.windowId !== undefined) {
          try {
            const closed = await closeSidepanelForWindow(sender.tab.windowId);
            if (!closed) {
              return { ok: false, error: 'The Chrome Side Panel is not open.' };
            }
            return { ok: true, snapshot: await getRuntimeSnapshot() };
          } catch (error: unknown) {
            const msg = error instanceof Error ? error.message : String(error);
            return { ok: false, error: msg };
          }
        }
        return { ok: false, error: 'No sender window' };
    }
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Unexpected extension error.';
    await logDiagnostic('error', 'message-router', message);
    return { ok: false, error: message };
  }
}

function isExtensionUiSender(sender?: chrome.runtime.MessageSender): boolean {
  return Boolean(
    sender?.id === chrome.runtime.id &&
    sender.url?.startsWith(`chrome-extension://${chrome.runtime.id}/`),
  );
}

function isJobbyWebAppSender(sender?: chrome.runtime.MessageSender): boolean {
  if (sender?.id !== chrome.runtime.id || !sender.tab?.url) return false;
  try {
    const url = new URL(sender.tab.url);
    const configuredOrigin = new URL(
      import.meta.env.VITE_WEB_APP_URL || 'http://localhost:3000',
    ).origin;
    return (
      url.origin === configuredOrigin ||
      ((url.hostname === 'localhost' || url.hostname === '127.0.0.1') &&
        (url.port === '3000' || url.port === '3001'))
    );
  } catch {
    return false;
  }
}

function readTargetedTabId(message: unknown): number | undefined {
  if (typeof message !== 'object' || message === null) return undefined;
  const tabId = (message as { activeTabId?: unknown }).activeTabId;
  return typeof tabId === 'number' && Number.isInteger(tabId) && tabId >= 0 ?
      tabId
    : undefined;
}
