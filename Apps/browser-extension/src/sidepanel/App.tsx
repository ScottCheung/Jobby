import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { Sparkles } from 'lucide-react';
import {
  JobAnalysisPanel,
  PlatformQuickSearchCard,
  type JobAnalysisSnapshot,
  type JobDescriptionOpenPayload,
} from '@jobby/ui/components/UI/job-analysis';
import { Button } from '@jobby/ui/components/UI/Button';
import { Input } from '@jobby/ui/components/UI/input';
import { Textarea } from '@jobby/ui/components/UI/textarea';
import type {
  FormFieldObservation,
  FormInspection,
} from '../shared/contracts/form-inspection';
import type {
  JobSnapshot,
  PageInspection,
} from '../shared/contracts/page-inspection';
import type {
  DocType,
  TailoredResume,
} from '../shared/contracts/tailored-resume';
import { fileFieldPurpose } from '../shared/utils/form-field-resolution';
import { AuthCard } from './components/AuthCard';
import { AuthGuardBanner } from './components/AuthGuardBanner';
import { BottomNav, type TabType } from './components/BottomNav';
import { DiagnosticsCard } from './components/DiagnosticsCard';
import { HeaderQuickActions } from './components/HeaderQuickActions';
import { ResultsDisplay } from './components/ResultsDisplay';
import { SettingsSection } from './components/SettingsSection';
import { WorkflowSection } from './components/WorkflowSection';
import { useApplicationTools } from './hooks/useApplicationTools';
import { useAuth } from './hooks/useAuth';
import { useDiagnostics } from './hooks/useDiagnostics';
import { useInspection } from './hooks/useInspection';
import { useJobMatch } from './hooks/useJobMatch';
import { useTailoredResumeStudio } from './hooks/useTailoredResumeStudio';
import { useThemeSync } from './hooks/useThemeSync';
import {
  getActiveTab,
  sendContentCommandToActiveTab,
} from './services/messaging';
import {
  createPageInspectionQueue,
  pageChangeInspectionRequest,
} from './services/page-change-inspection';
import { Toaster } from '@jobby/ui/components/UI/toast/toaster';
import { cn } from '@jobby/ui/lib/utils';
import { notify } from '@jobby/ui/components/UI/toast/toast-store';
import { renderResumePdfOnce } from '@jobby/ui/components/UI/Resume/ResumePdfPreview';
import {
  formatResumeFilename,
  formatCoverLetterFilename,
} from '@jobby/ui/components/UI/Resume/helpers';
import { renderCoverLetterPdfForExtension } from './services/cover-letter-pdf-renderer';
import {
  findTailoredDocumentForJob,
  resolveAutofillDocument,
  tailoredDocumentAvailability,
} from './services/tailored-document-state';

const PAGE_READY_DELAY_MS = 150;
const TAILORED_RESUME_VERSION_KEY = 'jobby-tailored-resume-version';
const TailorStudioCard = lazy(() =>
  import('./components/TailorStudioCard').then((module) => ({
    default: module.TailorStudioCard,
  })),
);

export function App() {
  const [activeTab, setActiveTab] = useState<TabType>('home');
  const [generationDraft, setGenerationDraft] = useState<{
    type: DocType;
    jobTitle: string;
    company: string;
    jobDescription: string;
  } | null>(null);
  const [pendingFormAction, setPendingFormAction] = useState<{
    tabId: number;
    pendingCount: number;
  } | null>(null);
  const [isFinalizingFormAction, setIsFinalizingFormAction] = useState(false);
  const [formActionError, setFormActionError] = useState<string | null>(null);
  const [selectedAutofillDocumentId, setSelectedAutofillDocumentId] =
    useState('');

  const { diagnostics, errorMessage, refresh, clearLogs } = useDiagnostics();
  const {
    authStatus,
    authError,
    refreshAuth,
    signIn,
    disconnect,
    isSigningIn,
  } = useAuth();
  const {
    themeColor,
    themeMode,
    toggleThemeColor,
    toggleThemeMode,
    setThemeColor,
    setThemeMode,
  } = useThemeSync(authStatus);
  const {
    latestInspection,
    setLatestInspection,
    latestForm,
    inspectionError,
    setInspectionError,
    applyAutofillResults,
    isInspectingPage,
    isInspectingForm,
    isClearingForm,
    inspectPage,
    autoInspectActivePage,
    inspectForm,
    focusFormField,
    highlightJobRequirement,
    autofillSingleField,
    uploadTailoredResume,
    uploadDefaultResume,
    editFormField,
    clearAllFormFields,
    uploadStates,
  } = useInspection();

  useEffect(() => {
    if (activeTab === 'form') {
      void inspectForm(true);
    }
  }, [activeTab, inspectForm]);

  useEffect(() => {
    const isIframe =
      typeof window !== 'undefined' && window.self !== window.top;
    if (!isIframe && typeof chrome !== 'undefined' && chrome.runtime?.connect) {
      const port = chrome.runtime.connect({ name: 'jobby-sidepanel' });

      const registerWindow = async () => {
        try {
          // getCurrent inside the sidepanel page context always returns the window hosting the sidepanel
          const win = await chrome.windows.getCurrent();
          if (win && win.id !== undefined) {
            port.postMessage({ type: 'sidepanel.init', windowId: win.id });
          }
        } catch {}
      };

      void registerWindow();

      const closePanel = (message: unknown) => {
        if (
          typeof message === 'object' &&
          message !== null &&
          (message as { type?: unknown }).type === 'sidepanel.close'
        ) {
          window.close();
        }
      };
      port.onMessage.addListener(closePanel);

      return () => {
        port.onMessage.removeListener(closePanel);
        port.disconnect();
      };
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    const loadPendingFormAction = async () => {
      const tab = await getActiveTab();
      if (cancelled) return;
      if (tab?.id === undefined) {
        setPendingFormAction(null);
        return;
      }
      try {
        const response = (await chrome.runtime.sendMessage({
          type: 'sidepanel.form-action-get-pending',
          tabId: tab.id,
        })) as {
          ok?: boolean;
          pending?: { tabId: number; pendingCount: number } | null;
        };
        if (!cancelled && response?.ok) {
          setPendingFormAction(response.pending || null);
          setFormActionError(null);
        }
      } catch {
        // The side panel can mount before the service worker is ready.
      }
    };

    const onRuntimeMessage = (message: unknown) => {
      if (typeof message !== 'object' || message === null) return;
      const candidate = message as {
        type?: unknown;
        tabId?: unknown;
        pendingCount?: unknown;
      };
      if (
        candidate.type === 'sidepanel.form-action-pending' &&
        typeof candidate.tabId === 'number' &&
        typeof candidate.pendingCount === 'number'
      ) {
        void getActiveTab().then((tab) => {
          if (!cancelled && tab?.id === candidate.tabId) {
            setPendingFormAction({
              tabId: candidate.tabId as number,
              pendingCount: candidate.pendingCount as number,
            });
            setFormActionError(null);
          }
        });
      } else if (
        candidate.type === 'sidepanel.form-action-resolved' &&
        typeof candidate.tabId === 'number'
      ) {
        setPendingFormAction((current) =>
          current?.tabId === candidate.tabId ? null : current,
        );
      }
    };

    void loadPendingFormAction();
    chrome.tabs?.onActivated?.addListener(loadPendingFormAction);
    chrome.runtime?.onMessage?.addListener(onRuntimeMessage);
    return () => {
      cancelled = true;
      chrome.tabs?.onActivated?.removeListener(loadPendingFormAction);
      chrome.runtime?.onMessage?.removeListener(onRuntimeMessage);
    };
  }, []);

  const jobMatch = useJobMatch(latestInspection, authStatus?.connected, signIn);
  const isMatchPending = Boolean(
    authStatus?.connected &&
    latestInspection?.kind === 'job' &&
    !jobMatch.evaluation &&
    !jobMatch.error,
  );

  const handleReDetectPage = async () => {
    await inspectPage();
    void inspectForm(true);
  };

  const handleUpdateJobSnapshot = (updates: Partial<JobAnalysisSnapshot>) => {
    setLatestInspection((prev) => {
      if (!prev || prev.kind !== 'job') return prev;
      const updatedInspection: PageInspection = {
        ...prev,
        originalSnapshot: prev.originalSnapshot || prev.snapshot,
        snapshot: {
          ...prev.snapshot,
          ...updates,
        } as JobSnapshot,
      };
      return updatedInspection;
    });
  };

  const handleOpenJobDescription = async (
    payload: JobDescriptionOpenPayload,
  ) => {
    await sendContentCommandToActiveTab({
      type: 'content.show-job-description',
      ...payload,
    });
  };

  const tailorStudio = useTailoredResumeStudio(
    latestInspection,
    authStatus?.connected,
    true,
    handleReDetectPage,
    signIn,
  );

  const openGenerationConfirmation = useCallback(
    (
      type: DocType,
      draftOverrides?: {
        jobTitle?: string;
        company?: string;
        jobDescription?: string;
      },
    ) => {
      const job =
        latestInspection?.kind === 'job' ? latestInspection.snapshot : null;
      setGenerationDraft({
        type,
        jobTitle:
          draftOverrides?.jobTitle ||
          job?.title ||
          tailorStudio.jobTitle ||
          tailorStudio.detectedJob?.title ||
          '',
        company:
          draftOverrides?.company ||
          job?.company ||
          tailorStudio.company ||
          tailorStudio.detectedJob?.company ||
          '',
        jobDescription:
          draftOverrides?.jobDescription ||
          (job && ('description' in job && job.description ? job.description : 'jobDescription' in job && (job as { jobDescription?: string }).jobDescription ? (job as { jobDescription?: string }).jobDescription : '')) ||
          tailorStudio.jobDescription ||
          tailorStudio.detectedJob?.jobDescription ||
          '',
      });
    },
    [
      latestInspection,
      tailorStudio.company,
      tailorStudio.detectedJob,
      tailorStudio.jobDescription,
      tailorStudio.jobTitle,
    ],
  );

  const confirmGeneration = () => {
    if (!generationDraft) return;
    const draft = generationDraft;
    setGenerationDraft(null);
    handleUpdateJobSnapshot({
      title: draft.jobTitle,
      company: draft.company,
      description: draft.jobDescription,
    });
    void tailorStudio.generateTailoredResume(draft.type, draft);
  };

  const generationCoinCost = generationDraft?.type === 'both' ? 18 : 10;
  const activeTailorGeneration =
    tailorStudio.generationTasks[tailorStudio.generationTasks.length - 1] ||
    null;

  const webAppBaseUrl = (
    import.meta.env.VITE_WEB_APP_URL || 'http://localhost:3000'
  ).replace(/\/$/, '');

  const matchingTailoredDoc = findTailoredDocumentForJob(
    tailorStudio.savedResumes,
    latestInspection?.kind === 'job' ? latestInspection.snapshot.title || '' : '',
    latestInspection?.kind === 'job' ?
      latestInspection.snapshot.company || ''
    : '',
  );
  const existingDocuments = tailoredDocumentAvailability(matchingTailoredDoc);

  const resolveAutofillResume = useCallback(
    (field: FormFieldObservation): TailoredResume | undefined => {
      const isCoverLetter = fileFieldPurpose(field) === 'cover_letter';
      let defaultResumeId = '';
      try {
        defaultResumeId =
          localStorage?.getItem('jobby_default_tailored_resume_id') || '';
      } catch {}

      return resolveAutofillDocument(
        tailorStudio.savedResumes,
        selectedAutofillDocumentId,
        matchingTailoredDoc,
        defaultResumeId,
        isCoverLetter ? 'cover_letter' : 'resume',
      );
    },
    [matchingTailoredDoc, selectedAutofillDocumentId, tailorStudio.savedResumes],
  );

  const autofillDocuments = useCallback(
    async (form: FormInspection) => {
      if (
        form.kind !== 'application_form' &&
        form.kind !== 'page_input_fields'
      ) {
        return;
      }
      const fileFields = form.fields.filter(
        (field) =>
          field.type === 'file' &&
          !field.filled &&
          field.upload?.state !== 'ready',
      );
      for (const field of fileFields) {
        const purpose = fileFieldPurpose(field);
        if (purpose === 'resume') {
          const candidateResume = resolveAutofillResume(field);
          if (candidateResume) {
            await uploadTailoredResume(field, candidateResume);
          } else {
            await uploadDefaultResume(field);
          }
        } else if (purpose === 'cover_letter') {
          const candidateCoverLetter = resolveAutofillResume(field);
          if (candidateCoverLetter) {
            await uploadTailoredResume(field, candidateCoverLetter);
          } else {
            await uploadDefaultResume(field);
          }
        }
      }
    },
    [
      resolveAutofillResume,
      uploadDefaultResume,
      uploadTailoredResume,
    ],
  );

  const {
    loadingButton,
    isCancellingAutofill,
    autofillForm,
    cancelAutofill,
    recordApplication,
    canRecordApplication,
    isApplicationRecorded,
  } = useApplicationTools(
    latestInspection,
    latestForm,
    inspectForm,
    setInspectionError,
    applyAutofillResults,
    authStatus?.connected,
    signIn,
    autofillDocuments,
  );

  const handlePreviewDocument = useCallback(
    async (type: 'resume' | 'cover_letter') => {
      if (!matchingTailoredDoc) return;
      const docResume = matchingTailoredDoc.resume_data;
      const docCompany =
        (latestInspection?.kind === 'job' && latestInspection.snapshot.company ?
          latestInspection.snapshot.company
        : matchingTailoredDoc.company) || '';
      const docTitle =
        (latestInspection?.kind === 'job' && latestInspection.snapshot.title ?
          latestInspection.snapshot.title
        : matchingTailoredDoc.job_title) || '';
      const docCoverLetter =
        matchingTailoredDoc.cover_letter ||
        (matchingTailoredDoc.raw_ai_response?.cover_letter as
          | string
          | undefined);

      try {
        const [activeTab] = await chrome.tabs.query({
          active: true,
          currentWindow: true,
        });
        if (!activeTab?.id) {
          notify.error('Could not find the active page for preview.');
          return;
        }

        let blob: Blob;
        let pages: number;
        let pdfScale: number | undefined;
        let filename: string;

        if (type === 'cover_letter') {
          if (!docCoverLetter) {
            notify.error('No cover letter is saved for this job.');
            return;
          }
          const rendered = await renderCoverLetterPdfForExtension(
            docCoverLetter,
            docResume,
            docCompany || undefined,
            docTitle || undefined,
          );
          blob = rendered.blob;
          pages = rendered.pages || 1;
          filename = formatCoverLetterFilename(
            docResume,
            docCompany || undefined,
            docTitle || undefined,
          );
        } else {
          if (!docResume) {
            notify.error('No tailored CV is saved for this job.');
            return;
          }
          const competencies =
            matchingTailoredDoc.core_competencies ||
            matchingTailoredDoc.key_qualifications ||
            [];
          const rendered = await renderResumePdfOnce(
            docResume,
            1,
            competencies,
            [],
          );
          blob = rendered.blob;
          pages = rendered.pages;
          pdfScale = rendered.scale;
          filename = formatResumeFilename(
            docResume,
            docCompany || '',
            docTitle || '',
          );
        }

        const pdfDataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });

        const payload = {
          type: 'content.show-resume-preview',
          data: docResume,
          ...(type === 'resume' ?
            {
              coreCompetencies:
                matchingTailoredDoc.core_competencies ||
                matchingTailoredDoc.key_qualifications ||
                [],
            }
          : {}),
          company: docCompany || undefined,
          jobTitle: docTitle || undefined,
          filename,
          pdfDataUrl,
          pages,
          fileSize: blob.size,
          ...(pdfScale === undefined ? {} : { pdfScale }),
          generatedAt:
            matchingTailoredDoc.created_at || new Date().toISOString(),
          editUrl: `${webAppBaseUrl}/ai-studio/tailor/${matchingTailoredDoc.id}`,
        };

        try {
          await chrome.tabs.sendMessage(activeTab.id, payload);
        } catch {
          await chrome.scripting.executeScript({
            target: { tabId: activeTab.id },
            files: ['src/content/bootstrap.ts-loader.js'],
          });
          await chrome.tabs.sendMessage(activeTab.id, payload);
        }
      } catch (error) {
        notify.error(
          error instanceof Error ? error.message : 'Could not open preview.',
        );
      }
    },
    [matchingTailoredDoc, latestInspection, webAppBaseUrl],
  );

  useEffect(() => {
    const handleAction = (candidate: {
      type?: unknown;
      docType?: DocType;
      tab?: TabType;
      draft?: {
        jobTitle?: string;
        company?: string;
        jobDescription?: string;
      };
    }) => {
      if (candidate.type === 'sidepanel.open-tab' && candidate.tab) {
        setActiveTab(candidate.tab);
      } else if (
        candidate.type === 'sidepanel.trigger-tailor' &&
        candidate.docType
      ) {
        setActiveTab('home');
        openGenerationConfirmation(candidate.docType, candidate.draft);
      }
    };

    const handleRuntimeMessage = (message: unknown) => {
      if (typeof message !== 'object' || message === null) return;
      handleAction(message as any);
    };

    const handleWindowMessage = (event: MessageEvent) => {
      if (
        event.data?.source === 'jobby-ball' &&
        event.data?.type === 'sidepanel.trigger-tailor'
      ) {
        handleAction(event.data);
      }
    };

    if (typeof chrome !== 'undefined' && chrome.runtime?.onMessage) {
      chrome.runtime.onMessage.addListener(handleRuntimeMessage);
    }
    window.addEventListener('message', handleWindowMessage);

    return () => {
      if (typeof chrome !== 'undefined' && chrome.runtime?.onMessage) {
        chrome.runtime.onMessage.removeListener(handleRuntimeMessage);
      }
      window.removeEventListener('message', handleWindowMessage);
    };
  }, [openGenerationConfirmation]);

  useEffect(() => {
    if (typeof chrome === 'undefined' || !chrome.storage?.onChanged) return;
    const onStorageChanged = (
      changes: Record<string, chrome.storage.StorageChange>,
      areaName: string,
    ) => {
      if (areaName === 'local' && changes[TAILORED_RESUME_VERSION_KEY]) {
        void tailorStudio.refreshSavedResumes();
      }
    };
    chrome.storage.onChanged.addListener(onStorageChanged);
    return () => chrome.storage.onChanged.removeListener(onStorageChanged);
  }, [tailorStudio.refreshSavedResumes]);

  useEffect(() => {
    if (activeTab === 'studio' && tailorStudio.hasNewDocuments) {
      tailorStudio.markDocumentsSeen();
    }
  }, [
    activeTab,
    tailorStudio.hasNewDocuments,
    tailorStudio.markDocumentsSeen,
  ]);

  const automaticTabContextRef = useRef({
    page: '',
    form: '',
    hasNewDocuments: false,
  });

  useEffect(() => {
    const pageContext =
      latestInspection?.kind === 'job' ?
        `job:${latestInspection.snapshot.platform}:${latestInspection.snapshot.externalId}`
      : latestInspection ?
        `${latestInspection.kind}:${latestInspection.url}`
      : '';
    const formContext =
      latestForm?.kind === 'application_form' && latestForm.fields.length > 0 ?
        `form:${latestForm.url}`
      : '';
    const previous = automaticTabContextRef.current;

    automaticTabContextRef.current = {
      page: pageContext,
      form: formContext,
      hasNewDocuments: tailorStudio.hasNewDocuments,
    };

    if (
      tailorStudio.hasNewDocuments &&
      !previous.hasNewDocuments
    ) {
      setActiveTab('studio');
      return;
    }

    if (formContext && formContext !== previous.form) {
      setActiveTab('form');
      return;
    }

    if (
      latestInspection?.kind === 'job' &&
      pageContext !== previous.page
    ) {
      setActiveTab('home');
    }
  }, [latestForm, latestInspection, tailorStudio.hasNewDocuments]);
  // dependencies. Including them there created a loop: inspect → state update
  // → effect restart → forced inspect, which made the panel and some dynamic
  // pages visibly jump.
  const latestInspectionRef = useRef(latestInspection);
  const latestFormRef = useRef(latestForm);
  useEffect(() => {
    latestInspectionRef.current = latestInspection;
    latestFormRef.current = latestForm;
  }, [latestInspection, latestForm]);

  useEffect(() => {
    refresh();
    refreshAuth();
    const inspectCurrentPage = createPageInspectionQueue(
      async ({ showLoading, force }) => {
        const isJob = await autoInspectActivePage(force, showLoading);
        if (isJob) {
          await inspectForm(true);
        }
      },
    );
    let scheduledInspection: number | undefined;
    const scheduleInspection = (showLoading: boolean, force = false) => {
      if (scheduledInspection !== undefined) {
        window.clearTimeout(scheduledInspection);
      }
      scheduledInspection = window.setTimeout(() => {
        scheduledInspection = undefined;
        inspectCurrentPage({ showLoading, force });
      }, PAGE_READY_DELAY_MS);
    };

    inspectCurrentPage({ showLoading: true, force: false });

    const onTabActivated = () => scheduleInspection(true, true);
    const onTabUpdated = (
      tabId: number,
      changeInfo: chrome.tabs.TabChangeInfo,
    ) => {
      if (!changeInfo.url && changeInfo.status !== 'complete') return;
      void getActiveTab().then((tab) => {
        if (tab?.id === tabId) scheduleInspection(true, true);
      });
    };

    const onRuntimeMessage = (message: unknown) => {
      const request = pageChangeInspectionRequest(message);
      if (request) {
        // Job-board split views can select a different card without changing
        // either the active tab or its URL.
        scheduleInspection(request.showLoading, request.force);
      }
    };

    if (
      typeof chrome !== 'undefined' &&
      chrome.tabs?.onActivated &&
      chrome.tabs?.onUpdated
    ) {
      chrome.tabs.onActivated.addListener(onTabActivated);
      chrome.tabs.onUpdated.addListener(onTabUpdated);
    }
    if (typeof chrome !== 'undefined' && chrome.runtime?.onMessage) {
      chrome.runtime.onMessage.addListener(onRuntimeMessage);
    }

    return () => {
      if (scheduledInspection !== undefined)
        window.clearTimeout(scheduledInspection);
      if (
        typeof chrome !== 'undefined' &&
        chrome.tabs?.onActivated &&
        chrome.tabs?.onUpdated
      ) {
        chrome.tabs.onActivated.removeListener(onTabActivated);
        chrome.tabs.onUpdated.removeListener(onTabUpdated);
      }
      if (typeof chrome !== 'undefined' && chrome.runtime?.onMessage) {
        chrome.runtime.onMessage.removeListener(onRuntimeMessage);
      }
    };
  }, [refresh, refreshAuth, autoInspectActivePage, inspectForm]);

  const [navVisible, setNavVisible] = useState(true);
  const lastScrollYRef = useRef(0);
  const lastTargetRef = useRef<EventTarget | null>(null);

  useEffect(() => {
    setNavVisible(true);
  }, [activeTab]);

  useEffect(() => {
    const handleScroll = (e: Event) => {
      const target = e.target;
      let currentY = 0;

      if (target === document || target === window) {
        currentY = window.scrollY || document.documentElement?.scrollTop || 0;
      } else if (target instanceof HTMLElement) {
        currentY = target.scrollTop;
      } else {
        return;
      }

      if (lastTargetRef.current !== target) {
        lastTargetRef.current = target;
        lastScrollYRef.current = currentY;
        return;
      }

      const diff = currentY - lastScrollYRef.current;

      if (currentY <= 10) {
        setNavVisible(true);
      } else if (diff > 6) {
        setNavVisible(false);
      } else if (diff < -6) {
        setNavVisible(true);
      }

      lastScrollYRef.current = currentY;
    };

    window.addEventListener('scroll', handleScroll, {
      capture: true,
      passive: true,
    });
    return () => {
      window.removeEventListener('scroll', handleScroll, { capture: true });
    };
  }, []);

  const finalizePendingFormAction = async (save: boolean) => {
    if (!pendingFormAction || isFinalizingFormAction) return;
    setIsFinalizingFormAction(true);
    setFormActionError(null);
    try {
      const response = (await chrome.runtime.sendMessage({
        type: 'sidepanel.form-action-finalize',
        tabId: pendingFormAction.tabId,
        save,
      })) as { ok?: boolean; error?: string };
      if (!response?.ok) {
        setFormActionError(
          response?.error || 'Could not update your saved form answers.',
        );
        return;
      }
      setPendingFormAction(null);
    } catch (error) {
      setFormActionError(
        error instanceof Error ?
          error.message
        : 'Could not update your saved form answers.',
      );
    } finally {
      setIsFinalizingFormAction(false);
    }
  };

  return (
    <main className='sidepanel-shell'>
      <header
        className={`sidepanel-header ${
          navVisible ? 'translate-y-0 ' : (
            '-translate-y-full  pointer-events-none'
          )
        }`}
      >
        <div className='sidepanel-brand'>
          <img
            src={
              typeof chrome !== 'undefined' && chrome.runtime?.getURL ?
                chrome.runtime.getURL('favicon.svg')
              : '/favicon.svg'
            }
            className='sidepanel-logo'
            alt='Jobby logo'
          />
          <span className='sidepanel-title'>Jobby</span>
        </div>
        <div className='flex items-center gap-1.5'>
          <HeaderQuickActions
            themeColor={themeColor}
            themeMode={themeMode}
            onToggleThemeColor={toggleThemeColor}
            onToggleThemeMode={toggleThemeMode}
          />
          <AuthCard
            authStatus={authStatus}
            authError={authError}
            onSignIn={signIn}
            onDisconnect={disconnect}
            isSigningIn={isSigningIn}
          />
        </div>
      </header>

      <div className='sidepanel-content'>
        {!authStatus?.connected && (
          <AuthGuardBanner onSignIn={signIn} isSigningIn={isSigningIn} />
        )}

        {activeTab === 'home' && (
          <>
            <section
              id='panel-page'
              className='sidebar-menu panel-section'
              aria-label='Current page'
            >
              <p className='menu-label'>Current Page</p>
              {(() => {
                const isJobPage = latestInspection?.kind === 'job';
                const showNotJobOverlay =
                  !isInspectingPage &&
                  !isJobPage &&
                  (latestInspection !== null || Boolean(inspectionError));

                if (showNotJobOverlay) {
                  return (
                    <PlatformQuickSearchCard
                      activeProfile={jobMatch.activeProfile}
                      onReDetect={handleReDetectPage}
                      isInspecting={isInspectingPage}
                    />
                  );
                }

                return (
                  <JobAnalysisPanel
                    latestInspection={latestInspection}
                    latestMatch={jobMatch.evaluation}
                    isMatchLoading={jobMatch.isEvaluating || isMatchPending}
                    isInspecting={isInspectingPage}
                    onTailor={openGenerationConfirmation}
                    onPreview={handlePreviewDocument}
                    existingDocuments={existingDocuments}
                    activeGeneration={activeTailorGeneration}
                    authConnected={authStatus?.connected}
                    onSignIn={signIn}
                    onRecordApplication={recordApplication}
                    canRecordApplication={canRecordApplication}
                    isApplicationRecorded={isApplicationRecorded}
                    isRecordingApplication={loadingButton === 'record'}
                    error={jobMatch.error}
                    onRetryMatch={() => void jobMatch.retry()}
                    onClaimSkill={jobMatch.claimSkill}
                    onUnclaimSkill={jobMatch.unclaimSkill}
                    activeProfile={jobMatch.activeProfile}
                    profileSkills={jobMatch.profileSkills}
                    onReDetect={handleReDetectPage}
                    onUpdateJobSnapshot={handleUpdateJobSnapshot}
                    onHighlightJobRequirement={highlightJobRequirement}
                    onOpenJobDescription={handleOpenJobDescription}
                  />
                );
              })()}
            </section>
          </>
        )}

        {activeTab === 'studio' && (
          <section
            id='panel-studio'
            className='sidebar-menu sidebar-menu--studio panel-section w-full min-w-0 max-w-full overflow-hidden'
            aria-label='Resume & Document Studio'
          >
            <Suspense fallback={null}>
              <TailorStudioCard
                studio={tailorStudio}
                latestInspection={latestInspection}
                managementOnly
                onNavigateHome={() => setActiveTab('home')}
                onReDetect={async () => {
                  await handleReDetectPage();
                  void tailorStudio.refreshSavedResumes();
                }}
                isInspecting={isInspectingPage}
              />
            </Suspense>
          </section>
        )}

        {activeTab === 'form' && (
          <div className='panel-form-area'>
            <div
              className={`sticky-autofill  ${navVisible ? 'top-[44px]' : 'top-0'}`}
              aria-label='Form autofill'
            >
              <WorkflowSection
                latestForm={latestForm}
                loadingButton={loadingButton}
                isClearingForm={isClearingForm}
                onAutofill={autofillForm}
                onCancelAutofill={cancelAutofill}
                isCancellingAutofill={isCancellingAutofill}
                onClearAll={clearAllFormFields}
                autofillOnly
                authConnected={authStatus?.connected}
                onSignIn={signIn}
              />
            </div>

            <section
              id='panel-fields'
              className='sidebar-menu sidebar-menu--fields panel-section'
              aria-label='Detected form fields'
            >
              <ResultsDisplay
                latestForm={latestForm}
                isInspectingForm={isInspectingForm}
                onFocusField={focusFormField}
                onFillSingleField={autofillSingleField}
                onUploadTailoredResume={uploadTailoredResume}
                onUploadDefaultResume={uploadDefaultResume}
                onDeleteTailoredResume={tailorStudio.deleteSavedResume}
                onEditField={editFormField}
                uploadStates={uploadStates}
                tailoredResumes={tailorStudio.savedResumes}
                isAutofilling={loadingButton === 'autofill'}
                onTailor={openGenerationConfirmation}
                existingDocuments={existingDocuments}
                currentJob={
                  latestInspection?.kind === 'job' ?
                    {
                      title: latestInspection.snapshot.title,
                      company: latestInspection.snapshot.company,
                    }
                  : undefined
                }
                selectedDocumentId={selectedAutofillDocumentId}
                onSelectDocument={setSelectedAutofillDocumentId}
              />
            </section>
          </div>
        )}

        {activeTab === 'tools' && (
          <section
            id='panel-tools'
            className='sidebar-menu sidebar-menu--tools flex flex-col gap-4'
            aria-label='Settings and tools'
          >
            <SettingsSection
              themeColor={themeColor}
              themeMode={themeMode}
              onSetThemeColor={setThemeColor}
              onSetThemeMode={setThemeMode}
              onInspectPage={inspectPage}
              onInspectForm={inspectForm}
            />
            <DiagnosticsCard
              diagnostics={diagnostics}
              errorMessage={errorMessage}
              onClearLogs={clearLogs}
            />
          </section>
        )}
      </div>

      <BottomNav
        activeTab={activeTab}
        onChange={setActiveTab}
        visible={navVisible}
        hasNewDocuments={tailorStudio.hasNewDocuments}
      />

      {generationDraft && (
        <div
          className='modal-backdrop'
          onClick={() => setGenerationDraft(null)}
        >
          <div
            className='modal-card max-w-[520px] !border-0'
            onClick={(event) => event.stopPropagation()}
          >
            <div className='modal-header !border-0'>
              <span className='modal-badge bg-primary text-primary-foreground'>
                {generationDraft.type === 'both' ?
                  'Resume + Cover Letter'
                : generationDraft.type === 'cover_letter' ?
                  'Generate Cover Letter'
                : 'Tailor Resume'}
              </span>
            </div>
            <div className='modal-body flex flex-col gap-3'>
              <div className='grid grid-cols-3 gap-2'>
                <button
                  type='button'
                  onClick={() =>
                    setGenerationDraft({
                      ...generationDraft,
                      type: 'resume',
                    })
                  }
                  className={cn(
                    'inline-flex items-center justify-center gap-1.5 rounded-full px-2.5 py-2 text-[10px] font-bold transition-all cursor-pointer',
                    generationDraft.type === 'resume' ?
                      'bg-primary-gradient text-primary-foreground shadow-xs'
                    : 'border border-primary/25 bg-primary/8 text-primary hover:bg-primary/20 active:scale-95',
                  )}
                >
                  <span>Resume</span>
                </button>
                <button
                  type='button'
                  onClick={() =>
                    setGenerationDraft({
                      ...generationDraft,
                      type: 'cover_letter',
                    })
                  }
                  className={cn(
                    'inline-flex items-center justify-center gap-1.5 rounded-full px-2.5 py-2 text-[10px] font-bold transition-all cursor-pointer',
                    generationDraft.type === 'cover_letter' ?
                      'bg-primary-gradient text-primary-foreground shadow-xs'
                    : 'border border-primary/25 bg-primary/8 text-primary hover:bg-primary/20 active:scale-95',
                  )}
                >
                  <span>Cover Letter</span>
                </button>
                <button
                  type='button'
                  onClick={() =>
                    setGenerationDraft({
                      ...generationDraft,
                      type: 'both',
                    })
                  }
                  className={cn(
                    'inline-flex items-center justify-center gap-1.5 rounded-full px-2.5 py-2 text-[10px] font-bold transition-all cursor-pointer',
                    generationDraft.type === 'both' ?
                      'bg-primary-gradient text-primary-foreground shadow-xs'
                    : 'border border-primary/25 bg-primary/8 text-primary hover:bg-primary/20 active:scale-95',
                  )}
                >

                  <span>Both</span>
                </button>
              </div>
              <Input
                value={generationDraft.jobTitle}
                onChange={(event) =>
                  setGenerationDraft({
                    ...generationDraft,
                    jobTitle: event.target.value,
                  })
                }
                placeholder='Job title'
                aria-label='Job title'
                className='!h-10 !border-0 !bg-muted/50 !px-3 text-xs focus:!ring-0'
              />
              <Input
                value={generationDraft.company}
                onChange={(event) =>
                  setGenerationDraft({
                    ...generationDraft,
                    company: event.target.value,
                  })
                }
                placeholder='Company'
                aria-label='Company'
                className='!h-10 !border-0 !bg-muted/50 !px-3 text-xs focus:!ring-0'
              />
              <Textarea
                value={generationDraft.jobDescription}
                onChange={(event) =>
                  setGenerationDraft({
                    ...generationDraft,
                    jobDescription: event.target.value,
                  })
                }
                placeholder='Job description'
                aria-label='Job description'
                minHeight={176}
                showClearButton={false}
                className='!min-h-44 !rounded-xl !border-0 !bg-muted/50 !p-3 text-xs leading-relaxed focus:!ring-0'
              />
            </div>
            <div className='modal-footer !border-0'>
              <Button
                variant='ghost'
                size='sm'
                onClick={() => setGenerationDraft(null)}
              >
                Cancel
              </Button>
              <Button
                size='sm'
                Icon={Sparkles}
                className='w-full'
                onClick={confirmGeneration}
                disabled={!generationDraft.jobDescription.trim()}
              >
                Confirm & start · {generationCoinCost}
              </Button>
            </div>
          </div>
        </div>
      )}

      {pendingFormAction && (
        <div className='modal-backdrop'>
          <div
            className='modal-card max-w-[420px] !border-0'
            role='dialog'
            aria-modal='true'
            aria-labelledby='form-action-title'
          >
            <div className='modal-header !border-0'>
              <div>
                <span className='modal-badge bg-primary text-primary-foreground'>
                  Form answers
                </span>
                <h2
                  id='form-action-title'
                  className='mt-2 text-sm font-semibold text-foreground'
                >
                  Save your form changes?
                </h2>
              </div>
            </div>
            <div className='modal-body flex flex-col gap-3'>
              <p className='text-xs leading-relaxed text-muted-foreground'>
                Your application has continued. Save the{' '}
                {pendingFormAction.pendingCount}{' '}
                {pendingFormAction.pendingCount === 1 ? 'answer' : 'answers'}{' '}
                you entered so Jobby can reuse them next time.
              </p>
              {formActionError && (
                <p className='rounded-xl bg-destructive/10 p-3 text-xs text-destructive'>
                  {formActionError}
                </p>
              )}
            </div>
            <div className='modal-footer !border-0'>
              <Button
                variant='ghost'
                size='sm'
                disabled={isFinalizingFormAction}
                onClick={() => void finalizePendingFormAction(false)}
              >
                Don&apos;t save
              </Button>
              <Button
                size='sm'
                className='w-full'
                disabled={isFinalizingFormAction}
                onClick={() => void finalizePendingFormAction(true)}
              >
                {isFinalizingFormAction ? 'Updating…' : 'Save changes'}
              </Button>
            </div>
          </div>
        </div>
      )}

      <Toaster />
    </main>
  );
}
