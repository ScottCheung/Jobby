import { useCallback, useEffect, useRef, useState } from 'react';
import { notify } from '@jobby/ui/components/UI/toast/toast-store';
import { defaultMasterResumeData } from '@jobby/ui/components/UI/Resume/helpers';
import { ApiClientError, apiClient } from '../../background/api-client';
import { renderCoverLetterPdfForExtension } from '../services/cover-letter-pdf-renderer';
import { renderResumePdfOnce } from '@jobby/ui/components/UI/Resume/ResumePdfPreview';
import type { PageInspection } from '../../shared/contracts/page-inspection';
import type {
  CareerProfile,
  DocType,
  JobReviewPreview,
  JobReviewResult,
  MasterResumeData,
  TailoredResume,
} from '../../shared/contracts/tailored-resume';

export type { DocType };

export type TailorGenerationTask = {
  id: string;
  optimisticId: string;
  docType: DocType;
  jobTitle: string;
  company: string;
  fingerprint: string;
  startedAt: number;
};

export function tailorGenerationFingerprint(
  type: DocType,
  jobTitle: string,
  company: string,
  jobDescription: string,
): string {
  return JSON.stringify([type, jobTitle, company, jobDescription]);
}

export function useTailoredResumeStudio(
  latestInspection: PageInspection | null,
  authConnected = false,
  enabled = true,
  onReDetect?: () => Promise<void> | void,
  onSignIn?: () => void,
) {
  const [docType, setDocType] = useState<DocType>('resume');
  const [jobTitle, setJobTitle] = useState('');
  const [company, setCompany] = useState('');
  const [datePosted, setDatePosted] = useState('');
  const [jobDescription, setJobDescription] = useState('');

  const [mockMode, setMockMode] = useState(false);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const [generationTasks, setGenerationTasks] = useState<TailorGenerationTask[]>([]);
  const generationControllers = useRef(
    new Map<string, { controller: AbortController; fingerprint: string; optimisticId: string }>(),
  );
  const refreshInFlightRef = useRef(false);
  const refreshEpochRef = useRef(0);

  const [preview, setPreview] = useState<JobReviewPreview | null>(null);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [result, setResult] = useState<JobReviewResult | null>(null);
  const [savedResumes, setSavedResumes] = useState<TailoredResume[]>([]);
  const [careerProfiles, setCareerProfiles] = useState<CareerProfile[]>([]);
  const [selectedProfileId, setSelectedProfileId] = useState<string>('');
  const [originalResume, setOriginalResume] = useState<MasterResumeData | null>(
    defaultMasterResumeData,
  );

  const [activeOptimisticId, setActiveOptimisticId] = useState<string | null>(null);
  const [hasNewDocuments, setHasNewDocuments] = useState(false);
  const userSelectedVersionRef = useRef(false);
  const isLoading = isPreviewLoading || generationTasks.length > 0;
  const activeGeneratingType =
    generationTasks[generationTasks.length - 1]?.docType || null;

  const lastJobKeyRef = useRef<string | null>(null);
  const lastSnapshotRef = useRef<{
    title?: string;
    company?: string;
    datePosted?: string;
    description?: string;
  }>({});

  // Load initial career profile & saved resumes
  const refreshSavedResumes = useCallback(async () => {
    if (!authConnected || !enabled || refreshInFlightRef.current) return;
    const requestEpoch = refreshEpochRef.current;
    refreshInFlightRef.current = true;
    try {
      const [profiles, saved] = await Promise.all([
        apiClient.getCareerProfiles().catch(() => [] as CareerProfile[]),
        apiClient.getTailoredResumes(),
      ]);
      if (requestEpoch !== refreshEpochRef.current) return;
      const restoredGeneratingItems = saved
        .filter((item) => item.status === 'processing')
        .map((item) => ({
          ...item,
          isGenerating: true,
          generatingDocType:
            (item.raw_ai_response?.generation_doc_type as DocType | undefined) ||
            'resume',
        }));
      const restoredGenerationIds = new Set(
        restoredGeneratingItems
          .map((item) => item.raw_ai_response?.generation_id)
          .filter((value): value is string => typeof value === 'string'),
      );
      const normalizedSaved = saved.map((item) => {
        const restored = restoredGeneratingItems.find(
          (candidate) => candidate.id === item.id,
        );
        return restored || item;
      });
      setCareerProfiles(profiles);
      const defaultProfile =
        profiles.find((p) => p.is_default) ?? profiles[0];
      if (defaultProfile) {
        setSelectedProfileId(defaultProfile.id);
        if (defaultProfile.resume_data) {
          setOriginalResume(defaultProfile.resume_data);
        }
      }
      setSavedResumes((current) => {
        const generatingItems = current.filter(
          (item) =>
            item.isGenerating &&
            !Array.from(restoredGenerationIds).some((generationId) =>
              item.id.includes(generationId),
            ),
        );
        const serverIds = new Set(normalizedSaved.map((s) => s.id));
        return [
          ...generatingItems.filter((item) => !serverIds.has(item.id)),
          ...normalizedSaved,
        ];
      });
      setGenerationTasks((current) => {
        const localTasks = current.filter((task) =>
          generationControllers.current.has(task.id),
        );
        const localIds = new Set(localTasks.map((task) => task.id));
        const restoredTasks = restoredGeneratingItems
          .map((item) => {
            const generationId = String(
              item.raw_ai_response?.generation_id || `server-${item.id}`,
            );
            return {
              id: generationId,
              optimisticId: item.id,
              docType: item.generatingDocType || 'resume',
              jobTitle: item.job_title || 'Target Role',
              company: item.company || 'Target Company',
              fingerprint: tailorGenerationFingerprint(
                item.generatingDocType || 'resume',
                item.job_title || 'Target Role',
                item.company || 'Target Company',
                item.job_description,
              ),
              startedAt: Date.parse(item.updated_at || item.created_at),
            } satisfies TailorGenerationTask;
          })
          .filter((task) => !localIds.has(task.id));
        return [...localTasks, ...restoredTasks];
      });
      if (restoredGeneratingItems.length > 0) {
        setActiveOptimisticId((current) => {
          const matchingServerItem = restoredGeneratingItems.find((item) => {
            const generationId = item.raw_ai_response?.generation_id;
            return (
              typeof generationId === 'string' &&
              current?.includes(generationId)
            );
          });
          return (
            matchingServerItem?.id ||
            current ||
            restoredGeneratingItems[0]?.id ||
            null
          );
        });
      } else {
        setActiveOptimisticId((current) =>
          current?.startsWith('optimistic-') ||
          current?.startsWith('dev-optimistic-') ?
            current
          : null,
        );
      }

      // Default to the first ready tailored document record (CV, CL, or both).
      const first = normalizedSaved.find(
        (item) => item.status !== 'processing',
      );
      setResult((prev) => {
        const selected = prev?.tailored_resume?.id;
        const current =
          selected ?
            normalizedSaved.find((item) => item.id === selected)
          : first;
        if (!current || current.isGenerating) return prev;
        return {
          resume_data: current.resume_data,
          core_competencies:
            current.core_competencies || current.key_qualifications || [],
          key_qualifications: current.key_qualifications,
          targeted_projects: current.targeted_projects,
          raw_ai_response: current.raw_ai_response,
          cover_letter:
            current.cover_letter ||
            (current.raw_ai_response?.cover_letter as string | undefined) ||
            null,
          tailored_resume: current,
        };
      });
    } catch {
      // Background load failures are quiet
    } finally {
      refreshInFlightRef.current = false;
    }
  }, [authConnected, enabled]);

  useEffect(() => {
    void refreshSavedResumes();
  }, [refreshSavedResumes]);

  const switchProfile = useCallback(
    (profileId: string) => {
      const target = careerProfiles.find((p) => p.id === profileId);
      if (target) {
        setSelectedProfileId(target.id);
        if (target.resume_data) {
          setOriginalResume(target.resume_data);
        }
      }
    },
    [careerProfiles],
  );

  // Extract detected job information if available on page
  const detectedJob =
    latestInspection?.kind === 'job'
      ? {
          title: latestInspection.snapshot.title || '',
          company: latestInspection.snapshot.company || '',
          datePosted: latestInspection.snapshot.lastPostedAt || '',
          jobDescription: latestInspection.snapshot.description || '',
          platform: latestInspection.snapshot.platform || '',
          url: latestInspection.snapshot.url || '',
        }
      : null;

  const generationFingerprintFor = useCallback(
    (type: DocType) =>
      tailorGenerationFingerprint(
        type,
        jobTitle.trim() || detectedJob?.title || 'Target Role',
        company.trim() || detectedJob?.company || 'Target Company',
        jobDescription.trim(),
      ),
    [company, detectedJob, jobDescription, jobTitle],
  );

  const isGeneratingType = useCallback(
    (type: DocType) => {
      const fingerprint = generationFingerprintFor(type);
      return generationTasks.some(
        (task) => task.fingerprint === fingerprint,
      );
    },
    [generationFingerprintFor, generationTasks],
  );

  // Auto-synchronize in real-time whenever a job is detected or updated on page
  useEffect(() => {
    if (latestInspection?.kind !== 'job') {
      lastJobKeyRef.current = null;
      lastSnapshotRef.current = {};
      return;
    }

    const snapshot = latestInspection.snapshot;
    const currentJobKey = `${snapshot.platform}:${snapshot.externalId || snapshot.url || snapshot.title}`;
    const isNewJob = currentJobKey !== lastJobKeyRef.current;

    if (isNewJob) {
      lastJobKeyRef.current = currentJobKey;
      lastSnapshotRef.current = {
        title: snapshot.title,
        company: snapshot.company,
        datePosted: snapshot.lastPostedAt,
        description: snapshot.description,
      };
      setJobTitle(snapshot.title || '');
      setCompany(snapshot.company || '');
      setDatePosted(snapshot.lastPostedAt || '');
      setJobDescription(snapshot.description || '');
      return;
    }

    // Same job, but snapshot fields might have resolved asynchronously (e.g. company, description, datePosted)
    const prev = lastSnapshotRef.current;
    if (snapshot.title && snapshot.title !== prev.title) {
      setJobTitle(snapshot.title);
      prev.title = snapshot.title;
    }
    if (snapshot.company && snapshot.company !== prev.company) {
      setCompany(snapshot.company);
      prev.company = snapshot.company;
    }
    if (snapshot.lastPostedAt && snapshot.lastPostedAt !== prev.datePosted) {
      setDatePosted(snapshot.lastPostedAt);
      prev.datePosted = snapshot.lastPostedAt;
    }
    if (snapshot.description && snapshot.description !== prev.description) {
      setJobDescription(snapshot.description);
      prev.description = snapshot.description;
    }
  }, [latestInspection]);

  const populateFromDetected = useCallback(async () => {
    if (onReDetect) {
      try {
        await onReDetect();
      } catch {}
    }
    if (detectedJob) {
      setJobTitle(detectedJob.title);
      setCompany(detectedJob.company);
      setDatePosted(detectedJob.datePosted);
      setJobDescription(detectedJob.jobDescription);
      setResult(null);
      setPreview(null);
      notify.success('Job details imported from current page');
    }
  }, [detectedJob, onReDetect]);

  // Load a saved resume from history
  const loadSavedResume = useCallback((saved: TailoredResume) => {
    userSelectedVersionRef.current = true;
    if (saved.isGenerating) {
      setResult(null);
      setActiveOptimisticId(saved.id);
      setJobDescription(saved.job_description || '');
      setJobTitle(saved.job_title || '');
      setCompany(saved.company || '');
      return;
    }
    setActiveOptimisticId(null);
    setResult({
      resume_data: saved.resume_data,
      core_competencies:
        saved.core_competencies || saved.key_qualifications || [],
      key_qualifications: saved.key_qualifications,
      targeted_projects: saved.targeted_projects,
      raw_ai_response: saved.raw_ai_response,
      cover_letter:
        saved.cover_letter ||
        (saved.raw_ai_response?.cover_letter as string | undefined) ||
        null,
      tailored_resume: saved,
    });
    setJobDescription(saved.job_description || '');
    setJobTitle(saved.job_title || '');
    setCompany(saved.company || '');
  }, []);

  // Preview the prompt/payload
  const previewPrompt = useCallback(async (targetType?: DocType) => {
    if (!jobDescription.trim()) {
      notify.error('Please provide a job description first');
      return;
    }
    if (!authConnected) {
      notify.info('Please sign in to Jobby to preview prompt.');
      onSignIn?.();
      return;
    }
    const chosenType = targetType || docType;
    setIsPreviewLoading(true);
    try {
      const p = await apiClient.previewJobReview({
        job_description: jobDescription.trim(),
        title: jobTitle.trim() || undefined,
        company: company.trim() || undefined,
        last_posted_at: datePosted.trim() || undefined,
        doc_type: chosenType,
      });
      setPreview(p);
      setShowPreviewModal(true);
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : 'Failed to generate prompt preview';
      notify.error(msg);
    } finally {
      setIsPreviewLoading(false);
    }
  }, [authConnected, onSignIn, jobDescription, jobTitle, company, datePosted, docType]);

  // Generate tailored resume / cover letter / both
  const generateTailoredResume = useCallback(async (
    targetType?: DocType,
    draft?: { jobTitle?: string; company?: string; jobDescription?: string },
  ) => {
    const draftDescription = draft?.jobDescription ?? jobDescription;
    if (!draftDescription.trim()) {
      notify.error('Please provide a job description first');
      return;
    }
    if (!authConnected) {
      notify.info('Please sign in to Jobby to generate tailored resumes.');
      onSignIn?.();
      return;
    }
    const chosenType = targetType || docType;
    const targetTitle = draft?.jobTitle?.trim() || jobTitle.trim() || detectedJob?.title || 'Target Role';
    const targetCompany = draft?.company?.trim() || company.trim() || detectedJob?.company || 'Target Company';
    const targetDescription = draftDescription.trim();
    const fingerprint = tailorGenerationFingerprint(
      chosenType,
      targetTitle,
      targetCompany,
      targetDescription,
    );
    if (
      Array.from(generationControllers.current.values()).some(
        (task) => task.fingerprint === fingerprint,
      )
    ) {
      notify.error('This document is already generating for the current job.');
      return;
    }
    const generationId = crypto.randomUUID();
    const optimisticId = `optimistic-${generationId}`;
    const controller = new AbortController();
    // A generation explicitly started by the user should become the active
    // result when it completes. A later history click can still opt out while
    // this request is running.
    userSelectedVersionRef.current = false;
    refreshEpochRef.current += 1;
    setResult(null);
    generationControllers.current.set(generationId, {
      controller,
      fingerprint,
      optimisticId,
    });

    const optimisticItem: TailoredResume = {
      id: optimisticId,
      job_application_id: '',
      career_profile_id: selectedProfileId || null,
      job_title: targetTitle,
      company: targetCompany,
      job_description: targetDescription,
      resume_data: {} as MasterResumeData,
      core_competencies: [],
      key_qualifications: [],
      targeted_projects: [],
      cover_letter: null,
      raw_ai_response: undefined,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      isGenerating: true,
      generatingDocType: chosenType,
    };

    // 1. Optimistic Update: Immediately prepend pending card to Recent Tailor
    setSavedResumes((current) => [
      optimisticItem,
      ...current.filter((item) => item.id !== optimisticId),
    ]);
    setActiveOptimisticId(optimisticId);
    setGenerationTasks((current) => [
      ...current,
      {
        id: generationId,
        optimisticId,
        docType: chosenType,
        jobTitle: targetTitle,
        company: targetCompany,
        fingerprint,
        startedAt: Date.now(),
      },
    ]);
    setShowPreviewModal(false);

    try {
      const nextResult = await apiClient.reviewJob({
        job_description: targetDescription,
        title: targetTitle,
        company: targetCompany,
        last_posted_at: datePosted.trim() || undefined,
        doc_type: chosenType,
        mock: mockMode,
        generation_id: generationId,
      }, controller.signal);

      if (controller.signal.aborted) return;
      refreshEpochRef.current += 1;

      // Compute PDF sizes immediately upon generation so they are saved and ready
      let clSize: number | undefined;
      let cvSize: number | undefined;
      const clText =
        nextResult.cover_letter ||
        nextResult.tailored_resume?.cover_letter ||
        (nextResult.raw_ai_response?.cover_letter as string | undefined);
      if (clText) {
        try {
          const { blob } = await renderCoverLetterPdfForExtension(
            clText,
            nextResult.resume_data || undefined,
            targetCompany || undefined,
            targetTitle || undefined,
          );
          clSize = blob.size;
        } catch {
          // Non-blocking
        }
      }
      if (nextResult.resume_data && Object.keys(nextResult.resume_data).length > 0) {
        try {
          const { blob } = await renderResumePdfOnce(
            nextResult.resume_data,
            1,
            nextResult.core_competencies || [],
            nextResult.key_qualifications || [],
          );
          cvSize = blob.size;
        } catch {
          // Non-blocking
        }
      }

      const rawAi = {
        ...((nextResult.tailored_resume?.raw_ai_response || nextResult.raw_ai_response || {}) as Record<string, unknown>),
        ...(clSize !== undefined ? { cover_letter_file_size: clSize } : {}),
        ...(cvSize !== undefined ? { resume_file_size: cvSize } : {}),
      };
      if (nextResult.tailored_resume) {
        nextResult.tailored_resume.raw_ai_response = rawAi;
        if (clSize !== undefined) nextResult.tailored_resume.cover_letter_file_size = clSize;
        if (cvSize !== undefined) nextResult.tailored_resume.resume_file_size = cvSize;
      }
      nextResult.raw_ai_response = rawAi;

      if (nextResult.tailored_resume?.id && (clSize !== undefined || cvSize !== undefined)) {
        void apiClient
          .updateTailoredResume(nextResult.tailored_resume.id, {
            raw_ai_response: rawAi,
          })
          .catch(() => undefined);
      }

      // A background completion must never pull someone away from a version
      // they are currently inspecting. With no explicit selection, newest wins.
      if (!userSelectedVersionRef.current) setResult(nextResult);
      setDocType(chosenType);
      setActiveOptimisticId((current) =>
        current === optimisticId ||
        current === nextResult.tailored_resume?.id ?
          null
        : current,
      );

      // 2. Replace optimistic record with the real server response
      if (nextResult.tailored_resume) {
        setSavedResumes((current) => [
          nextResult.tailored_resume!,
          ...current.filter(
            (item) =>
              item.id !== optimisticId &&
              item.id !== nextResult.tailored_resume!.id,
          ),
        ]);
      } else {
        setSavedResumes((current) =>
          current.filter((item) => item.id !== optimisticId),
        );
      }
      setHasNewDocuments(true);

      let successText = 'Tailored resume generated successfully!';
      if (chosenType === 'cover_letter') {
        successText = 'Tailored cover letter generated successfully!';
      } else if (chosenType === 'both') {
        successText = 'Tailored resume & cover letter generated successfully!';
      }
      const msg = mockMode
        ? `Mock ${chosenType === 'cover_letter' ? 'cover letter' : chosenType === 'both' ? 'resume & cover letter' : 'resume'} generated (0 tokens used)!`
        : successText;
      notify.success(msg);
    } catch (err) {
      refreshEpochRef.current += 1;
      // 3. Rollback optimistic record on error
      setSavedResumes((current) =>
        current.filter((item) => item.id !== optimisticId),
      );
      setActiveOptimisticId((current) =>
        current === optimisticId ? null : current,
      );
      const wasCancelled =
        controller.signal.aborted ||
        (err instanceof ApiClientError && err.status === 499);
      if (wasCancelled) return;
      const msg =
        err instanceof Error ? err.message : 'Failed to generate content';
      notify.error(msg);
    } finally {
      generationControllers.current.delete(generationId);
      setGenerationTasks((current) =>
        current.filter((task) => task.id !== generationId),
      );
    }
  }, [jobDescription, jobTitle, company, datePosted, docType, mockMode, detectedJob, selectedProfileId]);

  const cancelGeneration = useCallback(async (generationId: string) => {
    const task = generationControllers.current.get(generationId);
    if (!task) {
      setGenerationTasks((current) =>
        current.filter((candidate) => candidate.id !== generationId),
      );
      setSavedResumes((current) =>
        current.filter(
          (resume) =>
            !resume.id.includes(generationId) &&
            !resume.id.startsWith('dev-optimistic-'),
        ),
      );
      setActiveOptimisticId((current) =>
        current?.includes(generationId) || current?.startsWith('dev-optimistic-')
          ? null
          : current,
      );
      return;
    }
    task.controller.abort();
    generationControllers.current.delete(generationId);
    setGenerationTasks((current) =>
      current.filter((candidate) => candidate.id !== generationId),
    );
    setSavedResumes((current) =>
      current.filter((resume) => resume.id !== task.optimisticId),
    );
    setActiveOptimisticId((current) =>
      current === task.optimisticId ? null : current,
    );
    void apiClient.cancelJobReview(generationId).catch(() => undefined);
    notify.success('Generation cancelled. Tokens already produced cannot be recovered.');
  }, []);

  const simulateDevGeneration = useCallback(
    (type: DocType) => {
      const devTaskId = `dev-task-${type}`;
      const devOptimisticId = `dev-optimistic-${type}`;
      const targetTitle =
        jobTitle.trim() || detectedJob?.title || 'Senior Software Engineer';
      const targetCompany =
        company.trim() || detectedJob?.company || 'Acme Corp';
      const fingerprint = generationFingerprintFor(type);

      // Toggle off if already running this exact type
      const isAlreadyRunning = generationTasks.some(
        (t) => t.id.startsWith('dev-task-') && t.docType === type,
      );
      if (isAlreadyRunning) {
        setGenerationTasks((current) =>
          current.filter((t) => !t.id.startsWith('dev-task-')),
        );
        setSavedResumes((current) =>
          current.filter((r) => !r.id.startsWith('dev-optimistic-')),
        );
        setActiveOptimisticId((curr) =>
          curr?.startsWith('dev-optimistic-') ? null : curr,
        );
        return;
      }

      // Clear any prior dev tasks first
      const cleanTasks = generationTasks.filter(
        (t) => !t.id.startsWith('dev-task-'),
      );
      const cleanSaved = savedResumes.filter(
        (r) => !r.id.startsWith('dev-optimistic-'),
      );

      const optimisticItem: TailoredResume = {
        id: devOptimisticId,
        job_application_id: '',
        career_profile_id: selectedProfileId || null,
        job_title: targetTitle,
        company: targetCompany,
        job_description: jobDescription || '',
        resume_data: (originalResume || {}) as MasterResumeData,
        core_competencies: [],
        key_qualifications: [],
        targeted_projects: [],
        cover_letter: null,
        raw_ai_response: undefined,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        isGenerating: true,
        generatingDocType: type,
      };

      setSavedResumes([optimisticItem, ...cleanSaved]);
      setActiveOptimisticId(devOptimisticId);
      setGenerationTasks([
        ...cleanTasks,
        {
          id: devTaskId,
          optimisticId: devOptimisticId,
          docType: type,
          jobTitle: targetTitle,
          company: targetCompany,
          fingerprint,
          startedAt: Date.now(),
        },
      ]);
    },
    [
      company,
      datePosted,
      detectedJob,
      generationFingerprintFor,
      generationTasks,
      jobDescription,
      jobTitle,
      originalResume,
      savedResumes,
    ],
  );

  const clearDevGeneration = useCallback(() => {
    setGenerationTasks((current) =>
      current.filter((t) => !t.id.startsWith('dev-task-')),
    );
    setSavedResumes((current) =>
      current.filter((r) => !r.id.startsWith('dev-optimistic-')),
    );
    setActiveOptimisticId((curr) =>
      curr?.startsWith('dev-optimistic-') ? null : curr,
    );
  }, []);

  const deleteSavedResume = useCallback(
    async (id: string) => {
      if (!id) return;
      setSavedResumes((current) => current.filter((item) => item.id !== id));
      setResult((current) =>
        current?.tailored_resume?.id === id ? null : current,
      );
      try {
        await apiClient.deleteTailoredResume(id);
        notify.success('Tailored record permanently deleted.');
      } catch (err) {
        void refreshSavedResumes();
        const msg =
          err instanceof Error ? err.message : 'Failed to delete record';
        notify.error(msg);
        throw err;
      }
    },
    [refreshSavedResumes],
  );

  const makeDefaultProfile = useCallback(
    async (profileId: string) => {
      try {
        await apiClient.setPrimaryCareerProfile(profileId);
        setCareerProfiles((current) =>
          current.map((p) => ({
            ...p,
            is_default: p.id === profileId,
          })),
        );
        notify.success('Set as default resume profile');
      } catch {
        setCareerProfiles((current) =>
          current.map((p) => ({
            ...p,
            is_default: p.id === profileId,
          })),
        );
        notify.success('Default resume profile updated');
      }
    },
    [],
  );

  const markDocumentsSeen = useCallback(() => setHasNewDocuments(false), []);

  return {
    docType,
    setDocType,
    jobTitle,
    setJobTitle,
    company,
    setCompany,
    datePosted,
    setDatePosted,
    jobDescription,
    setJobDescription,
    mockMode,
    setMockMode,
    isLoading,
    isPreviewLoading,
    activeGeneratingType,
    generationTasks,
    isGeneratingType,
    activeOptimisticId,
    preview,
    showPreviewModal,
    setShowPreviewModal,
    result,
    setResult,
    savedResumes,
    careerProfiles,
    selectedProfileId,
    switchProfile,
    makeDefaultProfile,
    originalResume,
    detectedJob,
    populateFromDetected,
    loadSavedResume,
    previewPrompt,
    generateTailoredResume,
    cancelGeneration,
    deleteSavedResume,
    simulateDevGeneration,
    clearDevGeneration,
    refreshSavedResumes,
    hasNewDocuments,
    markDocumentsSeen,
  };
}
