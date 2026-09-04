/** @format */

"use client";

import React, { useEffect, useState } from "react";
import Image from "next/image";
import { motion, Tooltip } from "@jobby/ui";
import jobRecognitionDescriptions from "@jobby/ui/constants/job-recognition-descriptions.json";
import {
  ArrowUp,
  ClipboardPaste,
  Loader2,
  X,
} from "lucide-react";
import { inspectJobLink } from "@/lib/job-link-inspection";
import { showGlobalToast } from "@/lib/toast";
import { cn } from "@/lib/utils";
import type { RecognizedTailorJob } from "./TailorConversation";

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

export interface TailorQuickEntryProps {
  onInspectionStart: (requestId: string, input: string) => void;
  onInspectionStatus: (requestId: string, status: string) => void;
  onInspectionSuccess: (job: RecognizedTailorJob) => void;
  onInspectionError: (requestId: string, message: string) => void;
  value?: string;
  onValueChange?: (value: string) => void;
  isGenerating?: boolean;
  compact?: boolean;
  isHero?: boolean;
  onOpenFullscreen?: () => void;
  className?: string;
}

export function TailorQuickEntry({
  onInspectionStart,
  onInspectionStatus,
  onInspectionSuccess,
  onInspectionError,
  value,
  onValueChange,
  isGenerating = false,
  compact = false,
  isHero = false,
  onOpenFullscreen,
  className,
}: TailorQuickEntryProps) {
  const [internalJobInput, setInternalJobInput] = useState("");
  const [isInspecting, setIsInspecting] = useState(false);
  const [activeInspectionId, setActiveInspectionId] = useState("");
  const jobInput = value ?? internalJobInput;

  const setJobInput = (nextValue: string) => {
    setInternalJobInput(nextValue);
    onValueChange?.(nextValue);
  };

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

  return (
    <div className={cn("w-full", className)}>
      <div
        className={cn(
          "relative mx-auto flex w-full flex-col gap-2 transition-all",
          compact ? "max-w-none" : isHero ? "max-w-3xl" : "max-w-3xl",
        )}
      >
        <div className="relative group/glow w-full rounded-full">
          {/* Ambient Atmospheric Diffusion Glow */}
<motion.div
  layout
  className="
    pointer-events-none
    absolute -inset-1
    scale-105 rounded-full blur-xl
    opacity-0
    duration-700
    group-focus-within/glow:opacity-100
    group-focus-within/glow:duration-300
    transition-opacity
    animate-ai-diffuse
  "
  style={{
    background:
      "linear-gradient(90deg, rgba(16,185,129,.75), rgba(6,182,212,.75), rgba(139,92,246,.75), rgba(236,72,153,.65), rgba(245,158,11,.75), rgba(16,185,129,.75))",
    backgroundSize: "300% 100%",
  }}
/>

          {/* Animated Glowing Gradient Border */}
          <div
            className="relative w-full rounded-full p-[1.5px] transition-all duration-300 animate-ai-glow-flow shadow-lg"
          >
            <div
              className={cn(
                "relative flex w-full items-center rounded-full transition-all duration-300",
                "bg-background-primary ] group-focus-within/glow:bg-primary-foreground backdrop-blur-xl",
                compact
                  ? "min-h-10 pl-3 pr-1 py-1 gap-2"
                  : isHero
                  ? "min-h-14 pl-4.5 pr-2 py-1.5 gap-3"
                  : "min-h-12 pl-4 pr-1.5 py-1 gap-2.5",
                isInspecting && "opacity-95",
              )}
            >
              <div className="flex items-center justify-center shrink-0">
                <Image
                  src="/favicon.svg"
                  alt="Jobby Logo"
                  width={compact ? 20 : isHero ? 28 : 24}
                  height={compact ? 20 : isHero ? 28 : 24}
                  className={cn(
                    "shrink-0 object-contain drop-shadow-xs select-none transition-transform",
                    compact ? "size-5" : isHero ? "size-7" : "size-6",
                  )}
                />
              </div>

              <textarea
                rows={1}
                wrap="soft"
                value={jobInput}
                onChange={(event) => setJobInput(event.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={
                  isHero
                    ? "Paste a job posting URL (LinkedIn, Seek, Indeed...) or paste full Job Description"
                    : "Paste a job description or link to tailor..."
                }
                aria-label="Job description or link"
                className={cn(
                  "min-w-0 flex-1 resize-none overflow-y-auto break-words bg-transparent text-ink-primary placeholder:text-ink-secondary/60 outline-none leading-relaxed",
                  compact
                    ? "max-h-20 py-1 text-xs"
                    : isHero
                    ? "max-h-36 py-2 text-sm sm:text-base placeholder:text-sm"
                    : "max-h-28 py-1.5 text-sm",
                )}
              />

              <div className="flex items-center gap-1.5 shrink-0">
                {jobInput.trim() ? (
                  <>
                    <Tooltip content="Clear input" side="top">
                      <button
                        type="button"
                        onClick={handleClearInput}
                        className={cn(
                          "flex items-center justify-center rounded-full transition-all cursor-pointer select-none",
                          compact ? "size-8" : isHero ? "size-10" : "size-9",
                          "bg-background-secondary/50 text-ink-secondary/70 hover:bg-background-secondary hover:text-ink-primary dark:bg-white/5 dark:text-ink-secondary/60 dark:hover:bg-white/10 dark:hover:text-white",
                        )}
                        aria-label="Clear input"
                      >
                        <X className={compact ? "size-4" : isHero ? "size-5" : "size-4.5"} />
                      </button>
                    </Tooltip>

                    <Tooltip content={isInspecting ? "Analyzing..." : "Analyze & Tailor"} side="top">
                      <button
                        type="button"
                        onClick={() => {
                          if (jobInput.trim()) {
                            void inspectInput();
                          }
                        }}
                        disabled={isInspecting || isGenerating}
                        className={cn(
                          "flex items-center justify-center rounded-full transition-all select-none",
                          compact ? "size-8" : isHero ? "size-10" : "size-9",
                          !isInspecting && !isGenerating
                            ? "bg-primary text-primary-foreground shadow-md hover:opacity-95 active:scale-95 cursor-pointer hover:shadow-primary/30 hover:shadow-lg"
                            : "bg-foreground/5 text-ink-secondary/35 dark:bg-white/5 dark:text-white/25 cursor-not-allowed",
                        )}
                        aria-label="Submit"
                      >
                        {isInspecting ? (
                          <Loader2 className={cn("animate-spin", compact ? "size-4" : isHero ? "size-5" : "size-4.5")} />
                        ) : (
                          <ArrowUp className={compact ? "size-4" : isHero ? "size-5" : "size-4.5"} />
                        )}
                      </button>
                    </Tooltip>
                  </>
                ) : (
                  <Tooltip content="Paste from clipboard" side="top">
                    <button
                      type="button"
                      onClick={handlePasteFromClipboard}
                      className={cn(
                        "flex items-center justify-center rounded-full transition-all cursor-pointer select-none",
                        compact ? "size-8" : isHero ? "size-10" : "size-9",
                        "bg-primary text-primary-foreground shadow-md hover:opacity-95 active:scale-95 hover:shadow-primary/30 hover:shadow-lg",
                      )}
                      aria-label="Paste from clipboard"
                    >
                      <ClipboardPaste className={compact ? "size-4" : isHero ? "size-5" : "size-4.5"} />
                    </button>
                  </Tooltip>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
