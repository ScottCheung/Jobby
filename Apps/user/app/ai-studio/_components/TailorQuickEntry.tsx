/** @format */

"use client";

import React, { useEffect, useState } from "react";
import Image from "next/image";
import {
  Button,
  Checkbox,
  InputField,
  Modal,
  Select,
  StructuredJobDescription,
  Textarea,
  Tooltip,
  jobRecognitionDescriptions,
  type JobAnalysisCareerProfile,
  type JobAnalysisDocType,
  type JobAnalysisSnapshot,
  type JobAnalysisUserSkill,
} from "@jobby/ui";
import {
  ArrowUp,
  ClipboardPaste,
  X,
} from "lucide-react";
import { api } from "@/lib/api";
import { inspectJobLink } from "@/lib/job-link-inspection";
import type { CareerProfile } from "@/lib/types";
import { showGlobalToast } from "@/lib/toast";
import { cn } from "@/lib/utils";
import {
  TailorConversation,
  type RecognizedTailorJob,
  type TailorConversationMessage,
} from "./TailorConversation";

function parsePostedDate(input: string): string | undefined {
  const match = input.match(
    /(?:date\s+)?posted(?:\s+on)?\s*[:\-]?\s*([^\n|]{3,50})/i,
  );
  if (!match?.[1]) return undefined;

  const parsed = new Date(match[1].trim());
  return Number.isNaN(parsed.getTime())
    ? undefined
    : parsed.toISOString().slice(0, 10);
}

interface ParsedJobMeta {
  company?: string;
  jobTitle?: string;
  postedAt?: string;
}

export function parseJobUrlOrText(input: string): ParsedJobMeta {
  const trimmed = input.trim();
  const meta: ParsedJobMeta = { postedAt: parsePostedDate(trimmed) };

  for (const rawLine of trimmed.split("\n").slice(0, 10)) {
    const line = rawLine.trim();
    const company = line.match(
      /(?:company|employer|organization)\s*[:：]\s*(.+)/i,
    );
    const title = line.match(
      /(?:role|title|position|job title)\s*[:：]\s*(.+)/i,
    );
    const at = line.match(
      /^#?\s*([A-Za-z0-9\s/]+)\s+(?:at|@)\s+([A-Za-z0-9\s.,-]+)$/i,
    );

    if (company?.[1]) meta.company = company[1].replace(/[*_#]/g, "").trim();
    if (title?.[1]) meta.jobTitle = title[1].replace(/[*_#]/g, "").trim();
    if (at?.[1] && at[2] && !meta.jobTitle && !meta.company) {
      meta.jobTitle = at[1].trim();
      meta.company = at[2].trim();
    }
  }

  if (!meta.jobTitle) {
    const title = trimmed.match(
      /\b(?:full[-\s]stack|front[-\s]end|back[-\s]end|software|web|wordpress|mobile|data|devops|cloud|product|project|engineering|technical|ui\/?ux|ux|business|systems?|security|qa|quality assurance)\s+(?:developer|engineer|designer|manager|analyst|specialist|administrator|architect|consultant|coordinator|director|intern)\b/i,
    );
    if (title?.[0]) meta.jobTitle = title[0];
  }

  return meta;
}

export function isLikelyJobDescription(input: string): boolean {
  const parsed = parseJobUrlOrText(input);
  if (parsed.jobTitle && parsed.company) return true;

  const signals = input.toLowerCase().match(
    /\b(job|role|position|responsibilit(?:y|ies)|qualification|requirement|experience|skills?|candidate|apply|salary|benefits|full[- ]time|part[- ]time|remote|hybrid|developer|engineer|designer|manager|analyst|specialist|intern|react|typescript|python|java|aws|sql)\b/g,
  );

  return new Set(signals || []).size >= 2;
}

interface TailorQuickEntryProps {
  onGenerationStart: (params: {
    docType: "resume" | "cover_letter" | "both";
    jobTitle: string;
    company: string;
    jobDescription: string;
    lastPostedAt?: string;
    mock?: boolean;
    careerProfileId?: string;
  }) => void;
  isGenerating?: boolean;
  selectedProfileId?: string;
  onProfileChange?: (id: string) => void;
  value?: string;
  onValueChange?: (value: string) => void;
  mockMode?: boolean;
  onMockModeChange?: (enabled: boolean) => void;
  conversationMessages?: TailorConversationMessage[];
  onInspectionStart: (requestId: string, input: string) => void;
  onInspectionStatus: (requestId: string, status: string) => void;
  onInspectionSuccess: (job: RecognizedTailorJob) => void;
  onInspectionError: (requestId: string, message: string) => void;
  onRetryEvaluation: (messageId: string, job: RecognizedTailorJob) => void;
  onClaimSkill: (messageId: string, job: RecognizedTailorJob, skill: string) => Promise<void>;
  onUnclaimSkill: (messageId: string, job: RecognizedTailorJob, skill: string) => Promise<void>;
  onUpdateJob: (
    messageId: string,
    job: RecognizedTailorJob,
    updates: Partial<JobAnalysisSnapshot>,
  ) => void;
  onReDetect: (messageId: string, job: RecognizedTailorJob) => void;
  activeProfile?: JobAnalysisCareerProfile | null;
  profileSkills?: JobAnalysisUserSkill[];
  compact?: boolean;
  onOpenFullscreen?: () => void;
  className?: string;
}

export function TailorQuickEntry({
  onGenerationStart,
  isGenerating = false,
  selectedProfileId,
  onProfileChange,
  value,
  onValueChange,
  mockMode: controlledMockMode,
  onMockModeChange,
  conversationMessages = [],
  onInspectionStart,
  onInspectionStatus,
  onInspectionSuccess,
  onInspectionError,
  onRetryEvaluation,
  onClaimSkill,
  onUnclaimSkill,
  onUpdateJob,
  onReDetect,
  activeProfile,
  profileSkills,
  compact = false,
  onOpenFullscreen,
  className,
}: TailorQuickEntryProps) {
  const [internalJobInput, setInternalJobInput] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [company, setCompany] = useState("");
  const [postedAt, setPostedAt] = useState("");
  const [resolvedJobDescription, setResolvedJobDescription] = useState("");
  const [docType, setDocType] = useState<"resume" | "cover_letter" | "both">(
    "both",
  );
  const [isConfirming, setIsConfirming] = useState(false);
  const [isInspecting, setIsInspecting] = useState(false);
  const [activeInspectionId, setActiveInspectionId] = useState("");
  const [isEditingJobDescription, setIsEditingJobDescription] = useState(false);
  const [internalMockMode, setInternalMockMode] = useState(false);
  const [profiles, setProfiles] = useState<CareerProfile[]>([]);
  const [activeProfileId, setActiveProfileId] = useState("");
  const jobInput = value ?? internalJobInput;
  const mockMode = controlledMockMode ?? internalMockMode;

  const setJobInput = (nextValue: string) => {
    setInternalJobInput(nextValue);
    onValueChange?.(nextValue);
  };

  const setMockMode = (enabled: boolean) => {
    setInternalMockMode(enabled);
    onMockModeChange?.(enabled);
  };

  useEffect(() => {
    async function loadProfiles() {
      const list = await api.careerProfiles().catch(() => []);
      if (list.length === 0) return;
      const defaultProfile =
        list.find((profile) => profile.is_default) || list[0];
      setProfiles(list);
      setActiveProfileId(selectedProfileId || defaultProfile.id);
    }
    void loadProfiles();
  }, [selectedProfileId]);

  const inspectingDescriptions =
    jobRecognitionDescriptions?.inspectingDescriptions || [
      'Recognizing Job Title...',
      'Scanning Job Details...',
      'Extracting Required Skills...',
      'Analyzing Qualifications...',
      'Parsing Experience Level...',
      'Identifying Company Info...',
      'Evaluating Tech Stack...',
      'Scanning Core Responsibilities...',
      'Checking Requirements...',
    ];

  const [messageIndex, setMessageIndex] = useState(() =>
    Math.floor(Math.random() * inspectingDescriptions.length),
  );

  useEffect(() => {
    if (!isInspecting) return;

    setMessageIndex((prev) => {
      const total = inspectingDescriptions.length;
      if (total <= 1) return 0;
      let next = Math.floor(Math.random() * total);
      if (next === prev) {
        next = (next + 1) % total;
      }
      return next;
    });

    const interval = setInterval(() => {
      setMessageIndex((prev) => {
        const total = inspectingDescriptions.length;
        if (total <= 1) return 0;
        let next = Math.floor(Math.random() * total);
        if (next === prev) {
          next = (next + 1) % total;
        }
        return next;
      });
    }, 1200);

    return () => clearInterval(interval);
  }, [isInspecting, inspectingDescriptions]);

  const currentLoadingMessage =
    inspectingDescriptions[messageIndex % inspectingDescriptions.length] ||
    'Recognizing...';
  const compactStatusMessage =
    isInspecting ?
      currentLoadingMessage
    : conversationMessages.at(-1)?.role === "assistant" ?
      conversationMessages.at(-1)?.content
    : isGenerating ?
      "Tailoring your documents..."
    : null;

  useEffect(() => {
    if (!isInspecting || !activeInspectionId) return;
    onInspectionStatus(activeInspectionId, currentLoadingMessage);
  }, [
    activeInspectionId,
    currentLoadingMessage,
    isInspecting,
    onInspectionStatus,
  ]);

  const handlePasteFromClipboard = async () => {
    if (!navigator.clipboard?.readText) return;
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        setJobInput(text);
      }
    } catch {
      // Ignore clipboard permission errors
    }
  };

  const handleClearInput = () => {
    setJobInput('');
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (jobInput.trim()) {
        void inspectInput();
      }
    }
  };

  const inspectInput = async () => {
    if (!jobInput.trim()) {
      showGlobalToast("Paste a job description or link to continue.");
      return;
    }

    const submittedInput = jobInput.trim();
    const requestId = crypto.randomUUID();
    const localDetails = parseJobUrlOrText(submittedInput);
    const url = submittedInput.match(/https?:\/\/[^\s]+/i)?.[0];
    onInspectionStart(requestId, submittedInput);
    setJobInput("");
    if (compact) {
      onOpenFullscreen?.();
    }

    if (!url && !isLikelyJobDescription(submittedInput)) {
      onInspectionError(
        requestId,
        "This doesn't look like a job description. Paste a job link or the full JD.",
      );
      return;
    }

    setActiveInspectionId(requestId);
    setIsInspecting(true);
    try {
      const inspected = url ? await inspectJobLink(url) : null;
      onInspectionSuccess({
        requestId,
        input: submittedInput,
        url: inspected?.url || url,
        platform: inspected?.platform || (url ? "generic" : "manual"),
        externalId: inspected?.external_id || url || requestId,
        title: inspected?.title || localDetails.jobTitle || "",
        company: inspected?.company || localDetails.company || "",
        location: inspected?.location,
        postedAt:
          inspected?.last_posted_at ||
          inspected?.first_posted_at ||
          localDetails.postedAt,
        jobDescription: inspected?.job_description || submittedInput,
        technologies: inspected?.technologies || [],
        easyApply: inspected?.easy_apply,
      });
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Could not inspect this job link.";
      onInspectionError(requestId, message);
      showGlobalToast(message);
    } finally {
      setIsInspecting(false);
      setActiveInspectionId("");
    }
  };

  const openJobConfirmation = (
    job: RecognizedTailorJob,
    selectedDocType: JobAnalysisDocType,
  ) => {
    setJobTitle(job.title);
    setCompany(job.company);
    setPostedAt((job.postedAt || "").slice(0, 10));
    setResolvedJobDescription(job.jobDescription);
    setDocType(selectedDocType);
    setIsEditingJobDescription(false);
    setIsConfirming(true);
  };

  const confirmGeneration = () => {
    setIsConfirming(false);
    onGenerationStart({
      docType,
      jobTitle: jobTitle.trim(),
      company: company.trim(),
      jobDescription: resolvedJobDescription || jobInput.trim(),
      lastPostedAt: postedAt || undefined,
      mock: mockMode,
      careerProfileId: activeProfileId || undefined,
    });
  };

  return (
    <div className={cn("w-full", className)}>
      {/* {!compact && <div className="mb-5 flex items-center justify-end gap-3">
        <label className="flex cursor-pointer items-center gap-2 text-xs font-medium text-ink-secondary">
          <Checkbox
            checked={mockMode}
            onCheckedChange={(checked) => setMockMode(checked === true)}
            disabled={isGenerating}
          />
          Mock AI
        </label>

        {profiles.length > 0 && (
          <Select
            value={activeProfileId}
            onChange={(event) => {
              setActiveProfileId(event.target.value);
              onProfileChange?.(event.target.value);
            }}
            disabled={isGenerating}
            aria-label="Career profile"
            containerClassName="w-48"
          >
            {profiles.map((profile) => (
              <option key={profile.id} value={profile.id}>
                {profile.name || "Unnamed Profile"}
              </option>
            ))}
          </Select>
        )}
      </div>} */}

      <div
        className={cn(
          "relative mx-auto flex w-full flex-col gap-3",
          compact ? "max-w-none" : "max-w-3xl ",
        )}
      >
        {!compact && (
          <TailorConversation
            messages={conversationMessages}
            onTailor={openJobConfirmation}
            onRetryEvaluation={onRetryEvaluation}
            onClaimSkill={onClaimSkill}
            onUnclaimSkill={onUnclaimSkill}
            onUpdateJob={onUpdateJob}
            onReDetect={onReDetect}
            activeProfile={activeProfile}
            profileSkills={profileSkills}
            activeGeneration={
              isGenerating ?
                {
                  docType,
                  jobTitle,
                  company,
                }
              : null
            }
          />
        )}

        {compact && compactStatusMessage && (
          <div
            aria-live="polite"
            className="absolute bottom-full left-0 mb-2 max-w-sm rounded-2xl rounded-bl-md border border-primary/30 bg-panel px-3 py-2 text-xs font-medium text-primary shadow-md"
          >
            {compactStatusMessage}
          </div>
        )}

        <div
          className={cn(
            "relative flex w-full items-center rounded-full border transition-all duration-200",
            "bg-glass dark:bg-black/20 hover:bg-panel/50 focus-within:bg-background-primary",
            "border-border/60 hover:border-primary/50 focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20",
            compact ? "min-h-10 pl-3 pr-1 py-1 gap-2" : "min-h-12 pl-4 pr-1 py-1 gap-2.5",
            "shadow-xs",
            isInspecting && "opacity-95",
          )}
        >
          <div className="flex items-center justify-center shrink-0">
            <Image
              src="/favicon.svg"
              alt="Jobby Logo"
              width={compact ? 20 : 24}
              height={compact ? 20 : 24}
              className={cn(
                "shrink-0 object-contain drop-shadow-xs select-none",
                compact ? "size-5" : "size-6",
              )}
            />
          </div>

          <textarea
            rows={1}
            wrap="soft"
            value={jobInput}
            onChange={(event) => setJobInput(event.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Paste a job description or job link"
            aria-label="Job description or link"
            className={cn(
              "min-w-0 flex-1 resize-none overflow-y-auto break-words bg-transparent text-ink-primary placeholder:text-ink-secondary/60 outline-none leading-relaxed",
              compact ? "max-h-20 py-1 text-xs" : "max-h-28 py-1.5 text-sm",
            )}
          />

          <div className="flex items-center gap-1 shrink-0">
            {jobInput.trim() ? (
              <Tooltip content="Clear input" side="top">
                <button
                  type="button"
                  onClick={handleClearInput}
                  className={cn(
                    "flex items-center justify-center rounded-full bg-background-secondary/60 hover:bg-background-secondary dark:bg-white/5 dark:hover:bg-white/10 text-ink-secondary hover:text-ink-primary transition-all cursor-pointer",
                    compact ? "size-8" : "size-9",
                  )}
                  aria-label="Clear input"
                >
                  <X className={compact ? "size-4" : "size-4.5"} />
                </button>
              </Tooltip>
            ) : (
              <Tooltip content="Paste from clipboard" side="top">
                <button
                  type="button"
                  onClick={handlePasteFromClipboard}
                  className={cn(
                    "flex items-center justify-center rounded-full bg-background-secondary/60 hover:bg-background-secondary dark:bg-white/5 dark:hover:bg-white/10 text-ink-secondary hover:text-ink-primary transition-all cursor-pointer",
                    compact ? "size-8" : "size-9",
                  )}
                  aria-label="Paste from clipboard"
                >
                  <ClipboardPaste className={compact ? "size-4" : "size-4.5"} />
                </button>
              </Tooltip>
            )}

            <Tooltip content="Submit" side="top">
              <button
                type="button"
                onClick={() => {
                  if (jobInput.trim()) {
                    void inspectInput();
                  }
                }}
                disabled={!jobInput.trim()}
                className={cn(
                  "flex items-center justify-center rounded-full transition-all",
                  compact ? "size-8" : "size-9",
                  jobInput.trim()
                    ? "bg-primary text-primary-foreground shadow-xs hover:opacity-90 active:scale-95 cursor-pointer"
                    : "bg-foreground/5 text-ink-secondary/30 dark:bg-white/5 dark:text-white/20 cursor-not-allowed",
                )}
                aria-label="Submit"
              >
                <ArrowUp className={compact ? "size-4" : "size-4.5"} />
              </button>
            </Tooltip>
          </div>
        </div>

      </div>

      <Modal
        isOpen={isConfirming}
        onClose={() => setIsConfirming(false)}
        className="h-[78vh] w-[94vw] max-w-6xl text-ink-primary"
      >

          <h2 className="text-base font-semibold">Confirm job details</h2>
  


        <div className="grid min-h-0 flex-1 gap-4 body md:grid-cols-[320px_minmax(0,1fr)]">
          <div className="space-y-4 overflow-y-auto">
            <InputField
              label="Job title"
              value={jobTitle}
              onChange={(event) => setJobTitle(event.target.value)}
            />
            <InputField
              label="Company"
              value={company}
              onChange={(event) => setCompany(event.target.value)}
            />
            <InputField
              label="Posted"
              type="date"
              value={postedAt}
              onChange={(event) => setPostedAt(event.target.value)}
            />


          </div>

          <div className="flex min-h-0 flex-col ">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">Job description</h3>
              <div className="flex items-center gap-2">
                
                <Button
                  type="button"
                  size="sm"
                  variant={isEditingJobDescription ? "ghost" : "secondary"}
                  onClick={() => setIsEditingJobDescription(false)}
                >
                  Preview
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={isEditingJobDescription ? "secondary" : "ghost"}
                  onClick={() => setIsEditingJobDescription(true)}
                >
                  Edit
                </Button>
              </div>
            </div>
            <div className="body">
              {isEditingJobDescription ? (
                <Textarea
                  value={resolvedJobDescription}
                  onChange={(event) =>
                    setResolvedJobDescription(event.target.value)
                  }
                  minHeight="100%"
                  showCharCount={false}
                  showClearButton={false}
                  className="h-full resize-none min-h-[600px]"
                  containerClassName="h-full"
                  aria-label="Edit job description"
                />
              ) : (
                <StructuredJobDescription content={resolvedJobDescription} />
              )}
            </div>
          </div>
        </div>

        <div className="footer justify-between w-full">

                        <div className="flex flex-wrap items-center gap-2">
                {(
                  [
                    ["resume", "Resume"],
                    ["cover_letter", "Cover letter"],
                    ["both", "Resume + Cover letter"],
                  ] as const
                ).map(([value, label]) => (
                  <Button
                    key={value}
                    type="button"
                    variant={docType === value ? null : "secondary"}
                    onClick={() => setDocType(value)}
                  >
                    {label}
                  </Button>
                ))}
              </div>
              <div className="flex gap-2 flex-1 justify-end">

          <Button variant="outline" onClick={() => setIsConfirming(false)}>
            Cancel
          </Button>
          <Button onClick={confirmGeneration}>Generate</Button></div>
        </div>
      </Modal>
    </div>
  );
}
