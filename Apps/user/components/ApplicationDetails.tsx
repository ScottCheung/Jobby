"use client";

import { useEffect, useMemo, useState } from "react";
import {
  getApplicationTimeline,
  getCurrentApplicationStage,
  type ApplicationTimelineEntry,
  type JobApplication,
} from "@/lib/types";
import { useLayoutStore } from "@/lib/store/layout-store";
import {
  X,
  Globe,
  Calendar,
  Briefcase,
  MapPin,
  Tag,
  MessageSquare,
  FileText,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Eye,
  Award,
  XCircle,
  LogOut,
  Trash2,
  Plus,
  Clipboard
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatRelativeDate, formatDate } from "@/components/ConsoleUtils";

const stageConfig: Record<
  string,
  { label: string; icon: any; colorClass: string; bgColorClass: string; borderClass: string }
> = {
  applied: {
    label: "Applied",
    icon: CheckCircle2,
    colorClass: "text-blue-500",
    bgColorClass: "bg-blue-500/10",
    borderClass: "border-blue-500/20"
  },
  screening: {
    label: "Screening",
    icon: Eye,
    colorClass: "text-amber-500",
    bgColorClass: "bg-amber-500/10",
    borderClass: "border-amber-500/20"
  },
  interviewing: {
    label: "Interviewing",
    icon: MessageSquare,
    colorClass: "text-purple-500",
    bgColorClass: "bg-purple-500/10",
    borderClass: "border-purple-500/20"
  },
  offer: {
    label: "Offer",
    icon: Award,
    colorClass: "text-emerald-500",
    bgColorClass: "bg-emerald-500/10",
    borderClass: "border-emerald-500/20"
  },
  skipped: {
    label: "Skipped",
    icon: Clock,
    colorClass: "text-zinc-500",
    bgColorClass: "bg-glass",
    borderClass: "border-border"
  },
  processing: {
    label: "Processing",
    icon: Clock,
    colorClass: "text-sky-500",
    bgColorClass: "bg-sky-500/10",
    borderClass: "border-sky-500/20"
  },
  interrupted: {
    label: "Needs Review",
    icon: AlertTriangle,
    colorClass: "text-orange-500",
    bgColorClass: "bg-orange-500/10",
    borderClass: "border-orange-500/20"
  },
  cancelled: {
    label: "Cancelled",
    icon: XCircle,
    colorClass: "text-rose-500",
    bgColorClass: "bg-rose-500/10",
    borderClass: "border-rose-500/20"
  },
  rejected: {
    label: "Rejected",
    icon: XCircle,
    colorClass: "text-red-500",
    bgColorClass: "bg-red-500/10",
    borderClass: "border-red-500/20"
  },
  withdrawn: {
    label: "Withdrawn",
    icon: LogOut,
    colorClass: "text-zinc-400",
    bgColorClass: "bg-glass",
    borderClass: "border-border"
  },
};

function toInputDateTime(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const offsetMs = date.getTimezoneOffset() * 60 * 1000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
}

function fromInputDateTime(value: string) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString();
}

function FormField({
  label,
  value,
  onChange,
  type = "text",
  placeholder = "",
  disabled = false,
  icon: Icon
}: {
  label: string;
  value: string | number | null | undefined;
  onChange: (val: string) => void;
  type?: string;
  placeholder?: string;
  disabled?: boolean;
  icon?: any;
}) {
  return (
    <div className="flex flex-col gap-1.5 w-full">
      <label className="text-[10px] font-bold text-ink-secondary uppercase tracking-wider">
        {label}
      </label>
      <div className="relative">
        {Icon && (
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-secondary pointer-events-none">
            <Icon className="w-4 h-4" />
          </div>
        )}
        <input
          type={type}
          value={value ?? ""}
          placeholder={placeholder}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
          className={cn(
            "px-3 py-2 rounded-xl bg-glass border border-border text-ink-primary text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all placeholder-ink-secondary w-full",
            Icon && "pl-9"
          )}
        />
      </div>
    </div>
  );
}

function FormSelect({
  label,
  value,
  onChange,
  options,
  disabled = false,
  icon: Icon
}: {
  label: string;
  value: string | null | undefined;
  onChange: (val: string) => void;
  options: Array<{ value: string; label: string }>;
  disabled?: boolean;
  icon?: any;
}) {
  return (
    <div className="flex flex-col gap-1.5 w-full">
      <label className="text-[10px] font-bold text-ink-secondary uppercase tracking-wider">
        {label}
      </label>
      <div className="relative">
        {Icon && (
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-secondary pointer-events-none">
            <Icon className="w-4 h-4" />
          </div>
        )}
        <select
          value={value ?? ""}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
          className={cn(
            "px-3 py-2 rounded-xl bg-glass border border-border text-ink-primary text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all cursor-pointer w-full appearance-none",
            Icon && "pl-9 pr-8"
          )}
        >
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-ink-secondary">
          <svg className="w-4 h-4 fill-current" viewBox="0 0 20 20">
            <path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" />
          </svg>
        </div>
      </div>
    </div>
  );
}

function FormTextarea({
  label,
  value,
  onChange,
  placeholder = "",
  rows = 4,
  disabled = false,
}: {
  label: string;
  value: string | null | undefined;
  onChange: (val: string) => void;
  placeholder?: string;
  rows?: number;
  disabled?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1.5 w-full">
      <label className="text-[10px] font-bold text-ink-secondary uppercase tracking-wider">
        {label}
      </label>
      <textarea
        value={value ?? ""}
        rows={rows}
        placeholder={placeholder}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        className="px-3 py-2 rounded-xl bg-glass border border-border text-ink-primary text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all placeholder-ink-secondary resize-y w-full"
      />
    </div>
  );
}

export function ApplicationDetails({
  application,
  onSave,
}: {
  application: JobApplication;
  onSave: (applicationId: string, payload: Partial<JobApplication>) => Promise<void>;
}) {
  const { actions } = useLayoutStore();
  const [draft, setDraft] = useState<JobApplication>(application);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<"overview" | "qa" | "description">("overview");

  useEffect(() => {
    setDraft(application);
  }, [application]);

  // Read or initialize custom stage timeline from raw_data
  const timeline: ApplicationTimelineEntry[] = useMemo(
    () => getApplicationTimeline(draft),
    [draft],
  );

  const set = (key: keyof JobApplication, value: string | null | Record<string, any>) => {
    setDraft((current) => ({ ...current, [key]: value }));
  };

  const updateTimeline = (newTimeline: ApplicationTimelineEntry[]) => {
    const rawData = {
      ...(draft.raw_data || {}),
      timeline: newTimeline,
    };
    const latestStage = getCurrentApplicationStage({
      ...draft,
      raw_data: rawData,
    });

    setDraft((curr) => ({
      ...curr,
      pipeline_stage: latestStage,
      status: latestStage === "applied" ? "submitted" : latestStage,
      raw_data: {
        ...(curr.raw_data || {}),
        timeline: newTimeline
      }
    }));
  };

  const addTimelineStage = (stage: string) => {
    const defaultNotes = `Transitioned to ${stageConfig[stage]?.label || stage}.`;
    const newEntry: ApplicationTimelineEntry = {
      stage,
      timestamp: new Date().toISOString(),
      notes: defaultNotes
    };
    updateTimeline([...timeline, newEntry]);
  };

  const handleTimelineEntryChange = (index: number, key: keyof ApplicationTimelineEntry, val: string) => {
    const updated = [...timeline];
    updated[index] = { ...updated[index], [key]: val };
    updateTimeline(updated);
  };

  const deleteTimelineEntry = (index: number) => {
    const updated = timeline.filter((_, i) => i !== index);
    updateTimeline(updated);
  };

  const save = async () => {
    setSaving(true);
    try {
      await onSave(application.id, {
        title: draft.title,
        company: draft.company,
        work_location: draft.work_location,
        work_style: draft.work_style,
        job_description: draft.job_description,
        status: draft.status,
        pipeline_stage: draft.pipeline_stage,
        interview_stage: draft.interview_stage,
        next_action: draft.next_action,
        next_action_at: draft.next_action_at,
        notes: draft.notes,
        skip_reason: draft.skip_reason,
        raw_data: draft.raw_data, // Ensure raw_data updates are stored
      });
    } finally {
      setSaving(false);
    }
  };

  const renderQuestions = () => {
    if (!draft.questions) return null;

    let QAList: Array<{ question: string; answer: string }> = [];

    if (Array.isArray(draft.questions)) {
      QAList = draft.questions.map((item: any) => ({
        question: item.question || item.label || item.original_label || '',
        answer: item.answer || '',
      })).filter(item => item.question);
    } else if (typeof draft.questions === 'object' && draft.questions !== null) {
      QAList = Object.entries(draft.questions).map(([q, a]) => ({
        question: q,
        answer: String(a),
      }));
    }

    if (QAList.length === 0) {
      return (
        <div className="text-center py-8 text-ink-secondary">
          <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-40" />
          <p className="text-sm">No Q&A recorded for this application.</p>
        </div>
      );
    }

    return (
      <div className="space-y-4">
        <h3 className="text-xs font-bold text-ink-secondary uppercase tracking-wider mb-3">
          AI Auto-Apply Questions
        </h3>
        <div className="space-y-3">
          {QAList.map((qa, index) => (
            <div
              key={index}
              className="p-4 rounded-2xl bg-panel border border-border flex flex-col gap-2 shadow-xs"
            >
              <div className="flex items-start gap-2.5">
                <span className="px-2 py-0.5 rounded-md bg-glass border border-border text-[10px] font-bold text-ink-secondary uppercase tracking-wider mt-0.5 shrink-0">
                  Q
                </span>
                <p className="text-sm font-semibold text-ink-primary">
                  {qa.question}
                </p>
              </div>
              <div className="flex items-start gap-2.5 border-t border-border pt-2.5 mt-1">
                <span className="px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10px] font-bold uppercase tracking-wider mt-0.5 shrink-0">
                  A
                </span>
                <p className="text-sm text-ink-secondary font-medium">
                  {qa.answer}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full bg-background text-ink-primary">
      <div className="sticky top-0 z-20 bg-panel/95 backdrop-blur-md border-b border-border">
        <div className="flex items-start justify-between px-6 py-5">
          <div className="min-w-0 pr-4">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 capitalize tracking-wide border border-emerald-500/20">
                {draft.platform || "Platform"}
              </span>
              {draft.work_style && (
                <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-sky-500/10 text-sky-600 dark:text-sky-400 capitalize tracking-wide border border-sky-500/20">
                  {draft.work_style}
                </span>
              )}
              {draft.job_id && (
                <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-mono font-medium bg-glass border border-border text-ink-secondary">
                  ID: {draft.job_id}
                </span>
              )}
            </div>
            <h2
              className="text-lg font-extrabold text-ink-primary mt-2 truncate"
              title={draft.title || "Untitled Role"}
            >
              {draft.title || "Untitled Role"}
            </h2>
            <div className="flex items-center gap-1.5 text-sm text-ink-secondary mt-1 font-semibold flex-wrap">
              <span>{draft.company || "Unknown Company"}</span>
              {draft.work_location && (
                <>
                  <span className="text-border">•</span>
                  <span className="inline-flex items-center gap-1 text-xs font-normal">
                    <MapPin className="w-3.5 h-3.5" />
                    {draft.work_location}
                  </span>
                </>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {draft.job_link && (
              <a
                href={draft.job_link}
                target="_blank"
                rel="noopener noreferrer"
                className="p-2 rounded-xl text-ink-secondary hover:text-ink-primary hover:bg-glass transition-colors border border-border"
                title="Open job posting link"
              >
                <Globe className="w-4 h-4" />
              </a>
            )}
            <button
              onClick={actions.closeDrawer}
              className="p-2 rounded-xl text-ink-secondary hover:text-ink-primary hover:bg-glass transition-colors border border-border"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="flex border-t border-border px-6 overflow-x-auto custom-scrollbar-primary">
          {[
            { id: "overview", label: "Overview", icon: Clipboard },
            { id: "qa", label: "Notes & Q&A", icon: MessageSquare },
            { id: "description", label: "Job Description", icon: FileText },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={cn(
                  "flex items-center gap-2 py-3.5 px-4 text-sm font-semibold border-b-2 transition-all relative cursor-pointer whitespace-nowrap",
                  isActive ?
                    "border-primary text-primary font-bold"
                  : "border-transparent text-ink-secondary hover:text-ink-primary"
                )}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Scrollable Content Container */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar-primary">
        {activeTab === "overview" && (
          <div className="space-y-6">
            {/* Custom Interactive Stages Timeline Log */}
            <div className="p-5 rounded-2xl bg-panel border border-border shadow-xs space-y-4">
              <h3 className="text-xs font-bold text-ink-secondary uppercase tracking-wider">
                Application Timeline Stages
              </h3>

              {/* Fast Transition Stage Selector */}
              <div className="space-y-2">
                <p className="text-[10px] font-bold text-ink-secondary uppercase tracking-wider">
                  Log New Event / Transition Stage:
                </p>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(stageConfig).map(([key, cfg]) => {
                    const Icon = cfg.icon;
                    return (
                      <button
                        key={key}
                        onClick={() => addTimelineStage(key)}
                        className={cn(
                          "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all border cursor-pointer active:scale-95",
                          cfg.bgColorClass,
                          cfg.colorClass,
                          cfg.borderClass
                        )}
                      >
                        <Plus className="w-3 h-3" />
                        <Icon className="w-3.5 h-3.5" />
                        {cfg.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Log Timeline List */}
              {timeline.length === 0 ? (
                <div className="text-center py-6 border border-dashed border-border rounded-xl text-ink-secondary">
                  No timeline entries log recorded. Click buttons above to add entries.
                </div>
              ) : (
                <div className="relative pl-6 space-y-5 pt-2">
                  {/* Vertical Timeline bar */}
                  <div className="absolute left-[9px] top-2 bottom-4 w-0.5 bg-border" />

                  {timeline.map((entry, index) => {
                    const cfg = stageConfig[entry.stage] || {
                      label: entry.stage,
                      icon: Tag,
                      colorClass: "text-ink-secondary",
                      bgColorClass: "bg-glass",
                      borderClass: "border-border",
                    };
                    const Icon = cfg.icon;
                    const isRelative =
                      entry.timestamp &&
                      Date.now() - new Date(entry.timestamp).getTime() < 14 * 24 * 60 * 60 * 1000;

                    return (
                      <div key={index} className="relative flex flex-col gap-2">
                        {/* Timeline Stage Circle Icon */}
                        <div
                          className={cn(
                            "absolute -left-6 w-5 h-5 rounded-full border flex items-center justify-center transition-all z-10",
                            cfg.bgColorClass,
                            cfg.colorClass,
                            cfg.borderClass
                          )}
                        >
                          <Icon className="w-3 h-3" />
                        </div>

                        {/* Title & Actions Row */}
                        <div className="flex items-center justify-between min-w-0 gap-2">
                          <div className="flex items-center gap-2 flex-wrap min-w-0">
                            <span className={cn("text-sm font-bold capitalize", cfg.colorClass)}>
                              {cfg.label}
                            </span>
                            <span
                              className={cn(
                                "text-[10px] whitespace-nowrap",
                                isRelative ? "text-primary font-semibold" : "text-ink-secondary"
                              )}
                            >
                              ({formatRelativeDate(entry.timestamp)})
                            </span>
                          </div>
                          <button
                            onClick={() => deleteTimelineEntry(index)}
                            className="p-1 rounded text-ink-secondary hover:text-red-500 hover:bg-glass border border-transparent hover:border-border transition-all cursor-pointer shrink-0"
                            title="Delete timeline log entry"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        {/* Editing Log Fields Container */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pl-1">
                          {/* DateTime input */}
                          <div className="flex flex-col gap-1">
                            <span className="text-[9px] font-bold text-ink-secondary uppercase tracking-wider">
                              Event Time
                            </span>
                            <div className="relative">
                              <Calendar className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-ink-secondary pointer-events-none" />
                              <input
                                type="datetime-local"
                                value={toInputDateTime(entry.timestamp)}
                                onChange={(e) =>
                                  handleTimelineEntryChange(
                                    index,
                                    "timestamp",
                                    e.target.value ? fromInputDateTime(e.target.value) : new Date().toISOString()
                                  )
                                }
                                className="pl-8 pr-2 py-1 bg-glass border border-border text-ink-primary rounded-xl text-xs w-full focus:outline-none focus:ring-1 focus:ring-emerald-500/20"
                              />
                            </div>
                          </div>

                          {/* Notes input */}
                          <div className="flex flex-col gap-1">
                            <span className="text-[9px] font-bold text-ink-secondary uppercase tracking-wider">
                              Quick log notes
                            </span>
                            <input
                              type="text"
                              value={entry.notes ?? ""}
                              placeholder="Enter notes about this stage..."
                              onChange={(e) =>
                                handleTimelineEntryChange(index, "notes", e.target.value)
                              }
                              className="px-3 py-1 bg-glass border border-border text-ink-primary rounded-xl text-xs w-full focus:outline-none focus:ring-1 focus:ring-emerald-500/20"
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Core Properties Forms */}
            <div className="p-5 rounded-2xl bg-panel border border-border shadow-xs space-y-4">
              <h3 className="text-xs font-bold text-ink-secondary uppercase tracking-wider mb-2">
                Job Properties
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  label="Title"
                  value={draft.title}
                  onChange={(val) => set("title", val)}
                  icon={Briefcase}
                />
                <FormField
                  label="Company"
                  value={draft.company}
                  onChange={(val) => set("company", val)}
                  icon={Briefcase}
                />
                <FormField
                  label="Work Location"
                  value={draft.work_location}
                  onChange={(val) => set("work_location", val)}
                  icon={MapPin}
                />
                <FormSelect
                  label="Work Style"
                  value={draft.work_style || ""}
                  onChange={(val) => set("work_style", val || null)}
                  options={[
                    { value: "", label: "Not recorded" },
                    { value: "remote", label: "Remote" },
                    { value: "hybrid", label: "Hybrid" },
                    { value: "onsite", label: "On-site" },
                  ]}
                  icon={MapPin}
                />
                <FormSelect
                  label="Pipeline Stage"
                  value={draft.pipeline_stage || "applied"}
                  onChange={(val) => set("pipeline_stage", val)}
                  options={Object.entries(stageConfig).map(([key, cfg]) => ({
                    value: key,
                    label: cfg.label,
                  }))}
                  icon={Tag}
                />
                <FormField
                  label="Interview Stage Details"
                  value={draft.interview_stage}
                  onChange={(val) => set("interview_stage", val)}
                  placeholder="e.g. Technical Round 1"
                  icon={MessageSquare}
                />
                <FormField
                  label="Next Action"
                  value={draft.next_action}
                  onChange={(val) => set("next_action", val)}
                  placeholder="e.g. Send follow up email"
                  icon={CheckCircle2}
                />
                <div className="flex flex-col gap-1.5 w-full">
                  <label className="text-[10px] font-bold text-ink-secondary uppercase tracking-wider">
                    Next Action Time
                  </label>
                  <div className="relative">
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-secondary pointer-events-none">
                      <Clock className="w-4 h-4" />
                    </div>
                    <input
                      type="datetime-local"
                      value={toInputDateTime(draft.next_action_at)}
                      onChange={(event) =>
                        set(
                          "next_action_at",
                          event.target.value ? new Date(event.target.value).toISOString() : null
                        )
                      }
                      className="px-3 py-2 rounded-xl bg-glass border border-border text-ink-primary text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all w-full pl-9 pr-3"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Posting & Application Info Card */}
            <div className="p-5 rounded-2xl bg-panel border border-border shadow-xs space-y-4">
              <h3 className="text-xs font-bold text-ink-secondary uppercase tracking-wider mb-2">
                Posting Details
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                {draft.date_posted && (
                  <div className="flex justify-between items-center bg-glass border border-border rounded-xl p-3">
                    <span className="text-xs font-bold text-ink-secondary uppercase tracking-wider">
                      Posted Time
                    </span>
                    <span className="text-primary font-bold">
                      {formatDate(draft.date_posted)}
                    </span>
                  </div>
                )}
                {draft.date_applied && (
                  <div className="flex justify-between items-center bg-glass border border-border rounded-xl p-3">
                    <span className="text-xs font-bold text-ink-secondary uppercase tracking-wider">
                      Applied Time
                    </span>
                    <span className="text-primary font-bold">
                      {formatDate(draft.date_applied)}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === "qa" && (
          <div className="space-y-6 animate-in fade-in duration-200">
            {/* Custom Notes Card */}
            <div className="p-5 rounded-2xl bg-panel border border-border shadow-xs space-y-4">
              <h3 className="text-xs font-bold text-ink-secondary uppercase tracking-wider mb-2">
                Application Insights
              </h3>

              <FormTextarea
                label="Custom Notes"
                value={draft.notes}
                onChange={(val) => set("notes", val)}
                placeholder="Write your comments, timeline tracker, or details here..."
                rows={5}
              />

              {draft.status === "skipped" && (
                <FormField
                  label="Auto Apply Skip Reason"
                  value={draft.skip_reason}
                  onChange={(val) => set("skip_reason", val)}
                  icon={AlertTriangle}
                  disabled
                />
              )}
            </div>

            {/* Questions list */}
            {renderQuestions()}
          </div>
        )}

        {activeTab === "description" && (
          <div className="space-y-4 animate-in fade-in duration-200">
            <h3 className="text-xs font-bold text-ink-secondary uppercase tracking-wider">
              Job Description
            </h3>
            {draft.job_description ? (
              <div className="whitespace-pre-wrap font-sans text-sm text-ink-secondary leading-relaxed bg-panel border border-border p-5 rounded-2xl shadow-xs">
                {draft.job_description}
              </div>
            ) : (
              <div className="text-center py-12 bg-panel border border-border rounded-2xl text-ink-secondary">
                <FileText className="w-10 h-10 mx-auto mb-2 opacity-40 animate-pulse" />
                <p className="text-sm font-semibold">No description saved for this role.</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Floating Save Actions Bar */}
      <div className="px-6 py-4 border-t border-border bg-panel flex items-center justify-between shrink-0">
        <span className="text-xs text-ink-secondary font-semibold">
          {draft.updated_at ? `Updated: ${formatRelativeDate(draft.updated_at)}` : ""}
        </span>
        <div className="flex items-center gap-3">
          <button
            onClick={actions.closeDrawer}
            className="px-4 py-2 text-xs font-bold text-ink-primary hover:bg-glass rounded-xl transition-all cursor-pointer border border-border"
          >
            Cancel
          </button>
          <button
            onClick={() => void save()}
            disabled={saving}
            className="px-5 py-2 text-xs font-bold text-white bg-gradient-to-r from-emerald-600 to-green-700 hover:opacity-90 active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none rounded-xl transition-all shadow-sm shadow-emerald-500/10 cursor-pointer"
          >
            {saving ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </div>
    </div>
  );
}
