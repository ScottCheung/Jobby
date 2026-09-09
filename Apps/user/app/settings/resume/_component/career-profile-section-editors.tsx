/** @format */

"use client";
import { BulletListInput, Button, Input, TagInput, Textarea } from "@jobby/ui";

import { useState, useRef, useEffect } from "react";
import { cn } from "@/lib/utils";
import {
  Check,
  Plus,
  Trash2,
  X,
  ChevronUp,
  ChevronDown,
  GripVertical,
} from "lucide-react";

import type {
  MasterResumeData,
  ResumeLocation,
  ResumeSkillGroup,
  ResumeCertificationGroup,
  ResumeCertification,
  ResumeLink,
  ResumeOtherItem,
} from "@/lib/types";

type ResumeBasics = NonNullable<MasterResumeData["basics"]>;
type ResumeExperience = NonNullable<MasterResumeData["experience"]>[number];
type ResumeEducation = NonNullable<MasterResumeData["education"]>[number];
type ResumeProject = NonNullable<MasterResumeData["projects"]>[number];

function asValue(val?: string | null) {
  return val ?? "";
}

function ModalHeader({
  title,
  onClose,
}: {
  title: string;
  onClose: () => void;
}) {
  return (
    <header className="flex items-center justify-between border-b border-border/50 pb-3">
      <h2 className="title-section text-ink-primary">{title}</h2>
      <button
        type="button"
        title="Close editor"
        aria-label="Close editor"
        onClick={onClose}
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-ink-secondary hover:bg-background-secondary hover:text-ink-primary"
      >
        <X className="h-4 w-4" />
      </button>
    </header>
  );
}

function ModalFooter({
  onClose,
  onSave,
  saving,
}: {
  onClose: () => void;
  onSave: () => void;
  saving?: boolean;
}) {
  return (
    <footer className="flex shrink-0 items-center justify-end gap-2 border-t border-border/50 pt-3">
      <Button variant="ghost" onClick={onClose} disabled={saving}>
        Cancel
      </Button>
      <Button Icon={Check} isLoading={saving} onClick={onSave}>
        Save changes
      </Button>
    </footer>
  );
}

/* ========================================================================== */
/* Personal Info Editor                                                       */
/* ========================================================================== */
export function BasicsEditor({
  data,
  onSave,
  onClose,
  hideHeader = false,
  hideFooter = false,
  onChange,
}: {
  data: MasterResumeData;
  onSave: (next: MasterResumeData) => Promise<void>;
  onClose: () => void;
  hideHeader?: boolean;
  hideFooter?: boolean;
  onChange?: (next: MasterResumeData) => void;
}) {
  const basics = data.basics ?? {};
  const location = (basics.location ?? {}) as Partial<ResumeLocation>;
  const [draft, setDraft] = useState<{
    first_name: string;
    last_name: string;
    email: string;
    phone: string;
    headline: string;
    linkedin_id: string;
    website: string;
    portfolio_url: string;
    city: string;
    state: string;
    country: string;
  }>({
    first_name: asValue(basics.first_name),
    last_name: asValue(basics.last_name),
    email: asValue(basics.email),
    phone: asValue(basics.phone),
    headline: asValue(basics.headline),
    linkedin_id: asValue(basics.linkedin_id),
    website: asValue(basics.website),
    portfolio_url: asValue(basics.portfolio_url),
    city: asValue(location.city),
    state: asValue(location.state),
    country: asValue(location.country),
  });
  const [saving, setSaving] = useState(false);
  const dataRef = useRef(data);
  dataRef.current = data;

  const updateDraft = (patch: Partial<typeof draft>) => {
    const next = { ...draft, ...patch };
    setDraft(next);
    if (onChange) {
      const nextBasics: ResumeBasics = {
        ...basics,
        first_name: next.first_name || null,
        last_name: next.last_name || null,
        email: next.email || null,
        phone: next.phone || null,
        headline: next.headline || null,
        linkedin_id: next.linkedin_id || null,
        website: next.website || null,
        portfolio_url: next.portfolio_url || null,
        location: {
          ...location,
          city: next.city || null,
          state: next.state || null,
          country: next.country || null,
        } as ResumeLocation,
      };
      onChange({ ...dataRef.current, basics: nextBasics });
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const nextBasics: ResumeBasics = {
        ...basics,
        first_name: draft.first_name || null,
        last_name: draft.last_name || null,
        email: draft.email || null,
        phone: draft.phone || null,
        headline: draft.headline || null,
        linkedin_id: draft.linkedin_id || null,
        website: draft.website || null,
        portfolio_url: draft.portfolio_url || null,
        location: {
          ...location,
          city: draft.city || null,
          state: draft.state || null,
          country: draft.country || null,
        } as ResumeLocation,
      };
      await onSave({ ...dataRef.current, basics: nextBasics });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex max-h-[88vh] min-h-[360px] flex-col">
      {!hideHeader && <ModalHeader title="Personal Info" onClose={onClose} />}
      <div className="flex-1 overflow-y-auto custom-scrollbar py-3 pr-1">
        <div className="grid gap-x-3 gap-y-2.5 md:grid-cols-2">
          <div>
            <label className="text-xs font-medium text-ink-secondary mb-1 block">
              First Name
            </label>
            <Input
              className="font-semibold text-ink-primary"
              value={draft.first_name}
              placeholder="First name"
              onChange={(e) =>
                updateDraft({ first_name: e.target.value })
              }
            />
          </div>
          <div>
            <label className="text-xs font-medium text-ink-secondary mb-1 block">
              Last Name
            </label>
            <Input
              className="font-semibold text-ink-primary"
              value={draft.last_name}
              placeholder="Last name"
              onChange={(e) =>
                updateDraft({ last_name: e.target.value })
              }
            />
          </div>
          <div>
            <label className="text-xs font-medium text-ink-secondary mb-1 block">
              Email
            </label>
            <Input
              className="font-semibold text-ink-primary"
              value={draft.email}
              placeholder="email@example.com"
              onChange={(e) => updateDraft({ email: e.target.value })}
            />
          </div>
          <div>
            <label className="text-xs font-medium text-ink-secondary mb-1 block">
              Phone
            </label>
            <Input
              className="font-semibold text-ink-primary"
              value={draft.phone}
              placeholder="+1 (555) 000-0000"
              onChange={(e) => updateDraft({ phone: e.target.value })}
            />
          </div>
          <div>
            <label className="text-xs font-medium text-ink-secondary mb-1 block">
              City
            </label>
            <Input
              className="font-semibold text-ink-primary"
              value={draft.city}
              placeholder="City"
              onChange={(e) => updateDraft({ city: e.target.value })}
            />
          </div>
          <div>
            <label className="text-xs font-medium text-ink-secondary mb-1 block">
              Country
            </label>
            <Input
              className="font-semibold text-ink-primary"
              value={draft.country}
              placeholder="Country"
              onChange={(e) => updateDraft({ country: e.target.value })}
            />
          </div>
          <div>
            <label className="text-xs font-medium text-ink-secondary mb-1 block">
              LinkedIn ID
            </label>
            <Input
              className="font-semibold text-ink-primary"
              value={draft.linkedin_id}
              placeholder="e.g. scottzhang1110"
              onChange={(e) =>
                updateDraft({ linkedin_id: e.target.value })
              }
            />
          </div>
          <div>
            <label className="text-xs font-medium text-ink-secondary mb-1 block">
              Portfolio / Project URL
            </label>
            <Input
              className="font-semibold text-ink-primary"
              value={draft.portfolio_url}
              placeholder="https://..."
              onChange={(e) =>
                updateDraft({ portfolio_url: e.target.value })
              }
            />
          </div>
          <div className="md:col-span-2">
            <label className="text-xs font-medium text-ink-secondary mb-1 block">
              Personal Website
            </label>
            <Input
              className="font-semibold text-ink-primary"
              value={draft.website}
              placeholder="https://..."
              onChange={(e) => updateDraft({ website: e.target.value })}
            />
          </div>
          <div className="md:col-span-2">
            <label className="text-xs font-medium text-ink-secondary mb-1 block">
              Professional Headline
            </label>
            <Input
              className="font-semibold text-ink-primary"
              value={draft.headline}
              placeholder="e.g. Senior Software Engineer"
              onChange={(e) => updateDraft({ headline: e.target.value })}
            />
          </div>
        </div>
      </div>
      {!hideFooter && <ModalFooter onClose={onClose} onSave={handleSave} saving={saving} />}
    </div>
  );
}

/* ========================================================================== */
/* Summary Editor                                                             */
/* ========================================================================== */
export function SummaryEditor({
  data,
  onSave,
  onClose,
  hideHeader = false,
  hideFooter = false,
  onChange,
}: {
  data: MasterResumeData;
  onSave: (next: MasterResumeData) => Promise<void>;
  onClose: () => void;
  hideHeader?: boolean;
  hideFooter?: boolean;
  onChange?: (next: MasterResumeData) => void;
}) {
  const [summary, setSummary] = useState(asValue(data.summary));
  const [saving, setSaving] = useState(false);
  const dataRef = useRef(data);
  dataRef.current = data;

  useEffect(() => {
    setSummary(asValue(data.summary));
  }, [data.summary]);

  const handleChange = (val: string) => {
    setSummary(val);
    onChange?.({ ...dataRef.current, summary: val.trim() || null });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave({ ...dataRef.current, summary: summary.trim() || null });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex max-h-[88vh] min-h-[320px] flex-col">
      {!hideHeader && <ModalHeader title="Summary" onClose={onClose} />}
      <div className="flex-1 overflow-y-auto custom-scrollbar py-3 pr-1">
        <Textarea
          label={hideHeader ? undefined : "Professional Summary"}
          value={summary}
          placeholder="Brief professional summary..."
          onChange={(e) => handleChange(e.target.value)}
          minHeight={160}
        />
      </div>
      {!hideFooter && <ModalFooter onClose={onClose} onSave={handleSave} saving={saving} />}
    </div>
  );
}

/* ========================================================================== */
/* Experience Editor                                                          */
/* ========================================================================== */
export function ExperienceEditor({
  data,
  onSave,
  onClose,
  initialIndex,
  onItemFocus,
  onChange,
  hideHeader = false,
  hideFooter = false,
}: {
  data: MasterResumeData;
  onSave: (next: MasterResumeData) => Promise<void>;
  onClose: () => void;
  initialIndex?: number | null;
  onItemFocus?: (index: number) => void;
  onChange?: (next: MasterResumeData) => void;
  hideHeader?: boolean;
  hideFooter?: boolean;
}) {
  const [items, setItems] = useState<ResumeExperience[]>(
    Array.isArray(data.experience) ? data.experience : [],
  );
  const [saving, setSaving] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState<number>(initialIndex ?? 0);
  const itemRefs = useRef<(HTMLDivElement | null)[]>([]);
  const dataRef = useRef(data);
  dataRef.current = data;

  const handleFocusIndex = (index: number) => {
    setFocusedIndex(index);
    onItemFocus?.(index);
  };

  useEffect(() => {
    if (initialIndex != null && initialIndex >= 0 && initialIndex < items.length) {
      setFocusedIndex(initialIndex);
    }
  }, [initialIndex, items.length]);

  useEffect(() => {
    if (focusedIndex != null && itemRefs.current[focusedIndex]) {
      itemRefs.current[focusedIndex]?.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
      });
    }
  }, [focusedIndex]);

  const updateItem = (index: number, patch: Partial<ResumeExperience>) => {
    const list = [...items];
    list[index] = { ...list[index], ...patch };
    setItems(list);
    onChange?.({ ...dataRef.current, experience: list });
  };

  const removeItem = (index: number) => {
    const list = items.filter((_, i) => i !== index);
    setItems(list);
    if (focusedIndex >= items.length - 1) {
      handleFocusIndex(Math.max(0, items.length - 2));
    }
    onChange?.({ ...dataRef.current, experience: list });
  };

  const moveItem = (index: number, direction: "up" | "down") => {
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= items.length) return;
    const next = [...items];
    const [moved] = next.splice(index, 1);
    next.splice(targetIndex, 0, moved);
    setItems(next);
    handleFocusIndex(targetIndex);
    onChange?.({ ...dataRef.current, experience: next });
  };

  const addItem = () => {
    const next = [
      ...items,
      {
        title: "",
        company: "",
        location: "",
        start_date: "",
        end_date: "",
        summary: "",
        description: [],
        technologies: [],
      },
    ];
    setItems(next);
    handleFocusIndex(items.length);
    onChange?.({ ...dataRef.current, experience: next });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave({ ...dataRef.current, experience: items });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex max-h-[88vh] min-h-[420px] flex-col">
      {!hideHeader && <ModalHeader title="Experience" onClose={onClose} />}

      <div className="flex-1 space-y-3 overflow-y-auto custom-scrollbar py-3 pr-1">
        {items.map((item, index) => (
          <div
            key={`exp-${index}`}
            ref={(el) => {
              itemRefs.current[index] = el;
            }}
            id={`exp-card-${index}`}
            onClick={() => handleFocusIndex(index)}
            onFocusCapture={() => handleFocusIndex(index)}
            className={cn(
              "space-y-3 rounded-lg bg-panel p-3 shadow-xs transition-all duration-200 border",
              focusedIndex === index
                ? "border-primary/60 ring-2 ring-primary/20 shadow-sm"
                : "border-transparent"
            )}
          >
            <div className="flex items-center justify-between gap-3 pb-3">
              <div className="flex items-center gap-2 min-w-0">
                <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-md bg-primary/10 px-1.5 text-[11px] font-bold text-primary shrink-0">
                  {index + 1}
                </span>
                <h3 className="font-semibold text-ink-primary truncate text-sm">
                  {item.title || item.company
                    ? `${item.title || "Role"} at ${item.company || "Company"}`
                    : `Experience #${index + 1}`}
                </h3>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  title="Move role up"
                  aria-label="Move role up"
                  disabled={index === 0}
                  onClick={() => moveItem(index, "up")}
                  className="p-1 rounded-md text-ink-secondary hover:text-ink-primary hover:bg-background-secondary disabled:opacity-30 cursor-pointer"
                >
                  <ChevronUp className="size-4" />
                </button>
                <button
                  type="button"
                  title="Move role down"
                  aria-label="Move role down"
                  disabled={index === items.length - 1}
                  onClick={() => moveItem(index, "down")}
                  className="p-1 rounded-md text-ink-secondary hover:text-ink-primary hover:bg-background-secondary disabled:opacity-30 cursor-pointer"
                >
                  <ChevronDown className="size-4" />
                </button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="text-red-500 hover:bg-red-500/10 hover:text-red-600"
                  Icon={Trash2}
                  onClick={() => removeItem(index)}
                >
                  Delete Role
                </Button>
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <label className="text-xs font-medium text-ink-secondary mb-1 block">
                  Job Title
                </label>
                <Input
                  value={asValue(item.title)}
                  placeholder="Job title"
                  onChange={(e) =>
                    updateItem(index, { title: e.target.value || null })
                  }
                />
              </div>
              <div>
                <label className="text-xs font-medium text-ink-secondary mb-1 block">
                  Company
                </label>
                <Input
                  value={asValue(item.company)}
                  placeholder="Company name"
                  onChange={(e) =>
                    updateItem(index, { company: e.target.value || null })
                  }
                />
              </div>
              <div>
                <label className="text-xs font-medium text-ink-secondary mb-1 block">
                  Location
                </label>
                <Input
                  value={asValue(item.location)}
                  placeholder="Location"
                  onChange={(e) =>
                    updateItem(index, { location: e.target.value || null })
                  }
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-medium text-ink-secondary mb-1 block">
                    Start Date
                  </label>
                  <Input
                    value={asValue(item.start_date)}
                    placeholder="e.g. Jan 2022"
                    onChange={(e) =>
                      updateItem(index, { start_date: e.target.value || null })
                    }
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-ink-secondary mb-1 block">
                    End Date
                  </label>
                  <Input
                    value={asValue(item.end_date)}
                    placeholder="e.g. Present"
                    onChange={(e) =>
                      updateItem(index, { end_date: e.target.value || null })
                    }
                  />
                </div>
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-ink-secondary mb-1 block">
                Summary
              </label>
              <Textarea
                value={asValue(item.summary)}
                placeholder="Brief role summary, e.g. Architected and delivered cloud-native web platforms..."
                rows={2}
                onChange={(e) =>
                  updateItem(index, { summary: e.target.value || null })
                }
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-ink-secondary mb-1 block">
                Key Achievements / Responsibilities{" "}
                <span className="text-ink-secondary/70 font-normal">
                  (Drag to reorder)
                </span>
              </label>
              <BulletListInput
                values={
                  Array.isArray(item.description)
                    ? item.description
                    : typeof item.description === 'string' && (item.description as string).trim()
                    ? [(item.description as string).trim()]
                    : []
                }
                placeholder="Add an achievement point... (paste multi-line text to auto-split)"
                onChange={(desc) => updateItem(index, { description: desc })}
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-ink-secondary mb-1 block">
                Technologies Used
              </label>
              <TagInput
                values={
                  Array.isArray(item.technologies)
                    ? item.technologies
                    : typeof item.technologies === 'string' && (item.technologies as string).trim()
                    ? [(item.technologies as string).trim()]
                    : []
                }
                placeholder={[
                  "Add technologies (e.g. Next.js, GraphQL, Redis)",
                  "Tip: Type multiple items separated by commas, | or •",
                  "Press Enter, comma, | or • to add tags",
                ]}
                onChange={(techs) => updateItem(index, { technologies: techs })}
              />
            </div>
          </div>
        ))}

        <Button
          type="button"
          variant="secondary"
          className="w-full"
          Icon={Plus}
          onClick={addItem}
        >
          Add Experience Entry
        </Button>
      </div>
      {!hideFooter && <ModalFooter onClose={onClose} onSave={handleSave} saving={saving} />}
    </div>
  );
}

/* ========================================================================== */
/* Projects Editor                                                            */
/* ========================================================================== */
export function ProjectsEditor({
  data,
  onSave,
  onClose,
  initialIndex,
  onItemFocus,
  onChange,
  hideHeader = false,
  hideFooter = false,
}: {
  data: MasterResumeData;
  onSave: (next: MasterResumeData) => Promise<void>;
  onClose: () => void;
  initialIndex?: number | null;
  onItemFocus?: (index: number) => void;
  onChange?: (next: MasterResumeData) => void;
  hideHeader?: boolean;
  hideFooter?: boolean;
}) {
  const [items, setItems] = useState<ResumeProject[]>(
    Array.isArray(data.projects) ? data.projects : [],
  );
  const [saving, setSaving] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState<number>(initialIndex ?? 0);
  const itemRefs = useRef<(HTMLDivElement | null)[]>([]);
  const dataRef = useRef(data);
  dataRef.current = data;

  const handleFocusIndex = (index: number) => {
    setFocusedIndex(index);
    onItemFocus?.(index);
  };

  useEffect(() => {
    if (initialIndex != null && initialIndex >= 0 && initialIndex < items.length) {
      setFocusedIndex(initialIndex);
    }
  }, [initialIndex, items.length]);

  useEffect(() => {
    if (focusedIndex != null && itemRefs.current[focusedIndex]) {
      itemRefs.current[focusedIndex]?.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
      });
    }
  }, [focusedIndex]);

  const updateItem = (index: number, patch: Partial<ResumeProject>) => {
    const list = [...items];
    list[index] = { ...list[index], ...patch };
    setItems(list);
    onChange?.({ ...dataRef.current, projects: list });
  };

  const removeItem = (index: number) => {
    const list = items.filter((_, i) => i !== index);
    setItems(list);
    if (focusedIndex >= items.length - 1) {
      handleFocusIndex(Math.max(0, items.length - 2));
    }
    onChange?.({ ...dataRef.current, projects: list });
  };

  const moveItem = (index: number, direction: "up" | "down") => {
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= items.length) return;
    const next = [...items];
    const [moved] = next.splice(index, 1);
    next.splice(targetIndex, 0, moved);
    setItems(next);
    handleFocusIndex(targetIndex);
    onChange?.({ ...dataRef.current, projects: next });
  };

  const addItem = () => {
    const next = [
      ...items,
      {
        name: "",
        url: "",
        start_date: "",
        end_date: "",
        description: [],
        technologies: [],
      },
    ];
    setItems(next);
    handleFocusIndex(items.length);
    onChange?.({ ...dataRef.current, projects: next });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave({ ...dataRef.current, projects: items });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex max-h-[88vh] min-h-[420px] flex-col">
      {!hideHeader && <ModalHeader title="Projects" onClose={onClose} />}

      <div className="flex-1 space-y-3 overflow-y-auto custom-scrollbar py-3 pr-1">
        {items.map((item, index) => (
          <div
            key={`project-item-${index}`}
            ref={(el) => {
              itemRefs.current[index] = el;
            }}
            id={`project-card-${index}`}
            onClick={() => handleFocusIndex(index)}
            onFocusCapture={() => handleFocusIndex(index)}
            className={cn(
              "space-y-3 rounded-lg bg-panel p-3 shadow-xs transition-all duration-200 border",
              focusedIndex === index
                ? "border-primary/60 ring-2 ring-primary/20 shadow-sm"
                : "border-transparent"
            )}
          >
            <div className="flex items-center justify-between gap-3 pb-3">
              <div className="flex items-center gap-2 min-w-0">
                <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-md bg-primary/10 px-1.5 text-[11px] font-bold text-primary shrink-0">
                  {index + 1}
                </span>
                <h3 className="font-semibold text-ink-primary truncate text-sm">
                  {item.name || `Project #${index + 1}`}
                </h3>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  title="Move project up"
                  aria-label="Move project up"
                  disabled={index === 0}
                  onClick={() => moveItem(index, "up")}
                  className="p-1 rounded-md text-ink-secondary hover:text-ink-primary hover:bg-background-secondary disabled:opacity-30 cursor-pointer"
                >
                  <ChevronUp className="size-4" />
                </button>
                <button
                  type="button"
                  title="Move project down"
                  aria-label="Move project down"
                  disabled={index === items.length - 1}
                  onClick={() => moveItem(index, "down")}
                  className="p-1 rounded-md text-ink-secondary hover:text-ink-primary hover:bg-background-secondary disabled:opacity-30 cursor-pointer"
                >
                  <ChevronDown className="size-4" />
                </button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="text-red-500 hover:bg-red-500/10 hover:text-red-600"
                  Icon={Trash2}
                  onClick={() => removeItem(index)}
                >
                  Delete Project
                </Button>
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <label className="body-sm mb-1 block text-ink-secondary">
                  Project Name
                </label>
                <Input
                  value={asValue(item.name)}
                  placeholder="Project title"
                  onChange={(e) =>
                    updateItem(index, { name: e.target.value || null })
                  }
                />
              </div>
              <div>
                <label className="body-sm mb-1 block text-ink-secondary">
                  URL / Link
                </label>
                <Input
                  value={asValue(item.url)}
                  placeholder="https://github.com/..."
                  onChange={(e) =>
                    updateItem(index, { url: e.target.value || null })
                  }
                />
              </div>
              <div>
                <label className="body-sm mb-1 block text-ink-secondary">
                  Start Date
                </label>
                <Input
                  value={asValue(item.start_date)}
                  placeholder="e.g. Jan 2023"
                  onChange={(e) =>
                    updateItem(index, { start_date: e.target.value || null })
                  }
                />
              </div>
              <div>
                <label className="body-sm mb-1 block text-ink-secondary">
                  End Date
                </label>
                <Input
                  value={asValue(item.end_date)}
                  placeholder="e.g. Dec 2023"
                  onChange={(e) =>
                    updateItem(index, { end_date: e.target.value || null })
                  }
                />
              </div>
            </div>

            <div>
              <label className="body-sm mb-1 block font-medium text-ink-primary">
                Project Highlights / Features (Drag to reorder)
              </label>
              <BulletListInput
                values={
                  Array.isArray(item.description)
                    ? item.description
                    : typeof item.description === 'string' && (item.description as string).trim()
                    ? [(item.description as string).trim()]
                    : []
                }
                placeholder="Add a project feature or achievement point... (paste multi-line text to auto-split)"
                onChange={(desc) => updateItem(index, { description: desc })}
              />
            </div>

            <div>
              <label className="body-sm mb-1 block font-medium text-ink-primary">
                Technologies Used
              </label>
              <TagInput
                values={
                  Array.isArray(item.technologies)
                    ? item.technologies
                    : typeof item.technologies === 'string' && (item.technologies as string).trim()
                    ? [(item.technologies as string).trim()]
                    : []
                }
                placeholder={[
                  "Add technologies (e.g. React, TailwindCSS, AWS)",
                  "Tip: Type multiple items separated by commas, | or •",
                  "Press Enter, comma, | or • to add tags",
                ]}
                onChange={(techs) => updateItem(index, { technologies: techs })}
              />
            </div>
          </div>
        ))}

        <Button
          type="button"
          variant="secondary"
          className="w-full"
          Icon={Plus}
          onClick={addItem}
        >
          Add Project
        </Button>
      </div>
      {!hideFooter && <ModalFooter onClose={onClose} onSave={handleSave} saving={saving} />}
    </div>
  );
}

/* ========================================================================== */
/* Core Competencies Editor                                                   */
/* ========================================================================== */
export function CoreCompetenciesEditor({
  data,
  onSave,
  onClose,
  initialCoreCompetencies,
  hideHeader = false,
  hideFooter = false,
  onChange,
}: {
  data: MasterResumeData;
  onSave: (
    next: MasterResumeData,
    nextCoreCompetencies?: string[],
  ) => Promise<void>;
  onClose: () => void;
  initialCoreCompetencies?: string[];
  hideHeader?: boolean;
  hideFooter?: boolean;
  onChange?: (next: MasterResumeData, nextCoreCompetencies?: string[]) => void;
}) {
  const [coreCompetencies, setCoreCompetencies] = useState<string[]>(
    initialCoreCompetencies ??
      data.core_competencies ??
      (data as unknown as Record<string, string[]>).key_qualifications ??
      [],
  );
  const [saving, setSaving] = useState(false);
  const dataRef = useRef(data);
  dataRef.current = data;

  const updateCompetencies = (next: string[]) => {
    setCoreCompetencies(next);
    onChange?.(
      { ...dataRef.current, core_competencies: next },
      next,
    );
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(
        { ...dataRef.current, core_competencies: coreCompetencies },
        coreCompetencies,
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex max-h-[88vh] min-h-[320px] flex-col">
      {!hideHeader && <ModalHeader title="Core Competencies" onClose={onClose} />}
      <div className="flex-1 overflow-y-auto custom-scrollbar py-3 pr-1">
        <div className="space-y-3 rounded-lg bg-primary/5 p-3">
          <div className="flex items-center justify-between gap-3">
            {!hideHeader && (
              <label className="body-sm font-bold text-ink-primary">
                Competencies (Drag to reorder)
              </label>
            )}
            {coreCompetencies.length > 0 && (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className={cn(
                  "text-red-500 hover:bg-red-500/10 hover:text-red-600",
                  hideHeader ? "ml-auto" : "self-start"
                )}
                Icon={Trash2}
                onClick={() => updateCompetencies([])}
              >
                Clear All
              </Button>
            )}
          </div>
          <TagInput
            values={coreCompetencies}
            placeholder={[
              "Add core competencies (e.g. AWS Cloud & Serverless Architecture)",
              "Tip: Type or paste multiple competencies separated by commas, | or •",
              "Press Enter, comma, | or • to add tags",
            ]}
            onChange={updateCompetencies}
          />
        </div>
      </div>
      {!hideFooter && <ModalFooter onClose={onClose} onSave={handleSave} saving={saving} />}
    </div>
  );
}

/* ========================================================================== */
/* Skills Editor                                                              */
/* ========================================================================== */
export function SkillsEditor({
  data,
  onSave,
  onClose,
  initialIndex,
  onItemFocus,
  onChange,
  hideHeader = false,
  hideFooter = false,
}: {
  data: MasterResumeData;
  onSave: (next: MasterResumeData) => Promise<void>;
  onClose: () => void;
  initialIndex?: number | null;
  onItemFocus?: (index: number) => void;
  onChange?: (next: MasterResumeData) => void;
  hideHeader?: boolean;
  hideFooter?: boolean;
}) {
  const [groups, setGroups] = useState<ResumeSkillGroup[]>(
    Array.isArray(data.skills) ? data.skills : [],
  );
  const [saving, setSaving] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState<number>(initialIndex ?? 0);
  const itemRefs = useRef<(HTMLDivElement | null)[]>([]);

  const handleFocusIndex = (index: number) => {
    setFocusedIndex(index);
    onItemFocus?.(index);
  };

  useEffect(() => {
    if (initialIndex != null && initialIndex >= 0 && initialIndex < groups.length) {
      setFocusedIndex(initialIndex);
    }
  }, [initialIndex, groups.length]);

  useEffect(() => {
    if (focusedIndex != null && itemRefs.current[focusedIndex]) {
      itemRefs.current[focusedIndex]?.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
      });
    }
  }, [focusedIndex]);

  const updateGroup = (index: number, patch: Partial<ResumeSkillGroup>) => {
    const list = [...groups];
    list[index] = { ...list[index], ...patch };
    setGroups(list);
    onChange?.({ ...data, skills: list });
  };

  const removeGroup = (index: number) => {
    const list = groups.filter((_, i) => i !== index);
    setGroups(list);
    if (focusedIndex >= groups.length - 1) {
      handleFocusIndex(Math.max(0, groups.length - 2));
    }
    onChange?.({ ...data, skills: list });
  };

  const moveGroup = (index: number, direction: "up" | "down") => {
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= groups.length) return;
    const next = [...groups];
    const [moved] = next.splice(index, 1);
    next.splice(targetIndex, 0, moved);
    setGroups(next);
    handleFocusIndex(targetIndex);
    onChange?.({ ...data, skills: next });
  };

  const addGroup = () => {
    const list = [...groups, { type: "Languages & Frameworks", skills: [] }];
    setGroups(list);
    handleFocusIndex(groups.length);
    onChange?.({ ...data, skills: list });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave({ ...data, skills: groups });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex max-h-[88vh] min-h-[380px] flex-col">
      {!hideHeader && <ModalHeader title="Skills" onClose={onClose} />}

      <div className="flex-1 overflow-y-auto custom-scrollbar py-3 pr-1">
        <div className="space-y-3">
          {groups.map((group, index) => (
            <div
              key={`skill-group-${index}`}
              ref={(el) => {
                itemRefs.current[index] = el;
              }}
              id={`skill-card-${index}`}
              onClick={() => handleFocusIndex(index)}
              onFocusCapture={() => handleFocusIndex(index)}
              className={cn(
                "space-y-3 rounded-lg bg-panel p-3 border transition-all duration-200",
                focusedIndex === index
                  ? "border-primary/60 ring-2 ring-primary/20 shadow-sm"
                  : "border-border/60 shadow-xs"
              )}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <label className="body-sm mb-1 block text-ink-secondary font-medium">
                    Category Name
                  </label>
                  <Input
                    value={asValue(group.type)}
                    placeholder="e.g. Programming Languages"
                    onChange={(e) =>
                      updateGroup(index, { type: e.target.value || "Other" })
                    }
                  />
                </div>
                <div className="flex items-center gap-1 shrink-0 self-end">
                  <button
                    type="button"
                    title="Move category up"
                    disabled={index === 0}
                    onClick={() => moveGroup(index, "up")}
                    className="flex h-8 w-8 items-center justify-center rounded-lg border border-border/60 text-ink-secondary hover:bg-background-secondary hover:text-ink-primary disabled:opacity-30 disabled:pointer-events-none cursor-pointer transition-colors"
                  >
                    <ChevronUp className="size-4" />
                  </button>
                  <button
                    type="button"
                    title="Move category down"
                    disabled={index === groups.length - 1}
                    onClick={() => moveGroup(index, "down")}
                    className="flex h-8 w-8 items-center justify-center rounded-lg border border-border/60 text-ink-secondary hover:bg-background-secondary hover:text-ink-primary disabled:opacity-30 disabled:pointer-events-none cursor-pointer transition-colors"
                  >
                    <ChevronDown className="size-4" />
                  </button>
                  <button
                    type="button"
                    title="Remove category"
                    onClick={() => removeGroup(index)}
                    className="flex h-8 w-8 items-center justify-center rounded-lg border border-red-200/60 text-red-500 hover:bg-red-500/10 hover:text-red-600 cursor-pointer transition-colors"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>
              </div>

              <div>
                <label className="body-sm mb-1 block font-medium text-ink-primary">
                  Skills (Drag to reorder)
                </label>
                <TagInput
                  values={group.skills ?? []}
                  placeholder={[
                    "Add skills (e.g. React, TypeScript, Python, Docker)",
                    "Tip: Type or paste multiple skills separated by commas, | or •",
                    "Press Enter, comma, | or • to add tags in bulk",
                  ]}
                  onChange={(skills) => updateGroup(index, { skills })}
                />
              </div>
            </div>
          ))}

          <Button
            type="button"
            variant="ghost"
            className="w-full bg-primary/10 hover:bg-primary/20 text-primary"
            Icon={Plus}
            onClick={addGroup}
          >
            Add Skill Category
          </Button>
        </div>
      </div>
      {!hideFooter && <ModalFooter onClose={onClose} onSave={handleSave} saving={saving} />}
    </div>
  );
}

/* ========================================================================== */
/* Education Editor                                                           */
/* ========================================================================== */
export function EducationEditor({
  data,
  onSave,
  onClose,
  initialIndex,
  onItemFocus,
  onChange,
  hideHeader = false,
  hideFooter = false,
}: {
  data: MasterResumeData;
  onSave: (next: MasterResumeData) => Promise<void>;
  onClose: () => void;
  initialIndex?: number | null;
  onItemFocus?: (index: number) => void;
  onChange?: (next: MasterResumeData) => void;
  hideHeader?: boolean;
  hideFooter?: boolean;
}) {
  const [items, setItems] = useState<ResumeEducation[]>(
    Array.isArray(data.education) ? data.education : [],
  );
  const [saving, setSaving] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState<number>(initialIndex ?? 0);
  const itemRefs = useRef<(HTMLDivElement | null)[]>([]);
  const dataRef = useRef(data);
  dataRef.current = data;

  const handleFocusIndex = (index: number) => {
    setFocusedIndex(index);
    onItemFocus?.(index);
  };

  useEffect(() => {
    if (initialIndex != null && initialIndex >= 0 && initialIndex < items.length) {
      setFocusedIndex(initialIndex);
    }
  }, [initialIndex, items.length]);

  useEffect(() => {
    if (focusedIndex != null && itemRefs.current[focusedIndex]) {
      itemRefs.current[focusedIndex]?.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
      });
    }
  }, [focusedIndex]);

  const updateItem = (index: number, patch: Partial<ResumeEducation>) => {
    const list = [...items];
    list[index] = { ...list[index], ...patch };
    setItems(list);
    onChange?.({ ...dataRef.current, education: list });
  };

  const removeItem = (index: number) => {
    const list = items.filter((_, i) => i !== index);
    setItems(list);
    if (focusedIndex >= items.length - 1) {
      handleFocusIndex(Math.max(0, items.length - 2));
    }
    onChange?.({ ...dataRef.current, education: list });
  };

  const moveItem = (index: number, direction: "up" | "down") => {
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= items.length) return;
    const next = [...items];
    const [moved] = next.splice(index, 1);
    next.splice(targetIndex, 0, moved);
    setItems(next);
    handleFocusIndex(targetIndex);
    onChange?.({ ...dataRef.current, education: next });
  };

  const addItem = () => {
    const next = [
      ...items,
      {
        institution: "",
        degree: "",
        field_of_study: "",
        location: "",
        start_date: "",
        end_date: "",
        highlights: [],
      },
    ];
    setItems(next);
    handleFocusIndex(items.length);
    onChange?.({ ...dataRef.current, education: next });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave({ ...dataRef.current, education: items });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex max-h-[88vh] min-h-[400px] flex-col">
      {!hideHeader && <ModalHeader title="Education" onClose={onClose} />}

      <div className="flex-1 space-y-3 overflow-y-auto custom-scrollbar py-3 pr-1">
        {items.map((item, index) => (
          <div
            key={`edu-${index}`}
            ref={(el) => {
              itemRefs.current[index] = el;
            }}
            id={`edu-card-${index}`}
            onClick={() => handleFocusIndex(index)}
            onFocusCapture={() => handleFocusIndex(index)}
            className={cn(
              "space-y-3 rounded-lg bg-panel p-3 shadow-xs transition-all duration-200 border",
              focusedIndex === index
                ? "border-primary/60 ring-2 ring-primary/20 shadow-sm"
                : "border-transparent"
            )}
          >
            <div className="flex items-center justify-between gap-3 pb-3">
              <div className="flex items-center gap-2 min-w-0">
                <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-md bg-primary/10 px-1.5 text-[11px] font-bold text-primary shrink-0">
                  {index + 1}
                </span>
                <h3 className="font-semibold text-ink-primary truncate text-sm">
                  {item.degree || item.institution
                    ? `${item.degree || "Education"} - ${item.institution || "School"}`
                    : `Education #${index + 1}`}
                </h3>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  title="Move education up"
                  aria-label="Move education up"
                  disabled={index === 0}
                  onClick={() => moveItem(index, "up")}
                  className="p-1 rounded-md text-ink-secondary hover:text-ink-primary hover:bg-background-secondary disabled:opacity-30 cursor-pointer"
                >
                  <ChevronUp className="size-4" />
                </button>
                <button
                  type="button"
                  title="Move education down"
                  aria-label="Move education down"
                  disabled={index === items.length - 1}
                  onClick={() => moveItem(index, "down")}
                  className="p-1 rounded-md text-ink-secondary hover:text-ink-primary hover:bg-background-secondary disabled:opacity-30 cursor-pointer"
                >
                  <ChevronDown className="size-4" />
                </button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="text-red-500 hover:bg-red-500/10 hover:text-red-600"
                  Icon={Trash2}
                  onClick={() => removeItem(index)}
                >
                  Delete Entry
                </Button>
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <label className="body-sm mb-1 block text-ink-secondary">
                  Degree
                </label>
                <Input
                  value={asValue(item.degree)}
                  placeholder="e.g. Bachelor of Science"
                  onChange={(e) =>
                    updateItem(index, { degree: e.target.value || null })
                  }
                />
              </div>
              <div>
                <label className="body-sm mb-1 block text-ink-secondary">
                  Field of Study
                </label>
                <Input
                  value={asValue(item.field_of_study)}
                  placeholder="e.g. Computer Science"
                  onChange={(e) =>
                    updateItem(index, {
                      field_of_study: e.target.value || null,
                    })
                  }
                />
              </div>
              <div className="md:col-span-2">
                <label className="body-sm mb-1 block text-ink-secondary">
                  Institution / University
                </label>
                <Input
                  value={asValue(item.institution)}
                  placeholder="University name"
                  onChange={(e) =>
                    updateItem(index, { institution: e.target.value || null })
                  }
                />
              </div>
              <div>
                <label className="body-sm mb-1 block text-ink-secondary">
                  Location
                </label>
                <Input
                  value={asValue(item.location)}
                  placeholder="City, Country"
                  onChange={(e) =>
                    updateItem(index, { location: e.target.value || null })
                  }
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="body-sm mb-1 block text-ink-secondary">
                    Start Date
                  </label>
                  <Input
                    value={asValue(item.start_date)}
                    placeholder="e.g. Sep 2018"
                    onChange={(e) =>
                      updateItem(index, { start_date: e.target.value || null })
                    }
                  />
                </div>
                <div>
                  <label className="body-sm mb-1 block text-ink-secondary">
                    End Date
                  </label>
                  <Input
                    value={asValue(item.end_date)}
                    placeholder="e.g. May 2022"
                    onChange={(e) =>
                      updateItem(index, { end_date: e.target.value || null })
                    }
                  />
                </div>
              </div>
            </div>

            <div>
              <label className="body-sm mb-1 block font-medium text-ink-primary">
                Highlights / Honors (Drag to reorder)
              </label>
              <BulletListInput
                values={
                  Array.isArray(item.highlights)
                    ? item.highlights
                    : typeof item.highlights === 'string' && (item.highlights as string).trim()
                    ? [(item.highlights as string).trim()]
                    : []
                }
                placeholder="Add an education highlight or honor..."
                onChange={(highlights) => updateItem(index, { highlights })}
              />
            </div>
          </div>
        ))}

        <Button
          type="button"
          variant="secondary"
          className="w-full"
          Icon={Plus}
          onClick={addItem}
        >
          Add Education Entry
        </Button>
      </div>
      {!hideFooter && <ModalFooter onClose={onClose} onSave={handleSave} saving={saving} />}
    </div>
  );
}

/* ========================================================================== */
/* Certifications Editor                                                      */
/* ========================================================================== */
export function CertificationsEditor({
  data,
  onSave,
  onClose,
  hideHeader = false,
  hideFooter = false,
  onChange,
}: {
  data: MasterResumeData;
  onSave: (next: MasterResumeData) => Promise<void>;
  onClose: () => void;
  hideHeader?: boolean;
  hideFooter?: boolean;
  onChange?: (next: MasterResumeData) => void;
}) {
  const [groups, setGroups] = useState<ResumeCertificationGroup[]>(
    Array.isArray(data.certifications) ? data.certifications : [],
  );
  const [saving, setSaving] = useState(false);
  const dataRef = useRef(data);
  dataRef.current = data;

  const updateGroup = (
    index: number,
    patch: Partial<ResumeCertificationGroup>,
  ) => {
    const list = [...groups];
    list[index] = { ...list[index], ...patch };
    setGroups(list);
    onChange?.({ ...dataRef.current, certifications: list });
  };

  const removeGroup = (index: number) => {
    const list = groups.filter((_, i) => i !== index);
    setGroups(list);
    onChange?.({ ...dataRef.current, certifications: list });
  };

  const addGroup = () => {
    const list = [
      ...groups,
      { type: "Professional Certifications", certifications: [] },
    ];
    setGroups(list);
    onChange?.({ ...dataRef.current, certifications: list });
  };

  const addCert = (groupIndex: number) => {
    const list = [...groups];
    const certs = [...(list[groupIndex].certifications ?? [])];
    certs.push({
      name: "",
      issuer: "",
      issue_date: "",
      expiry_date: "",
      credential_url: "",
    });
    list[groupIndex] = { ...list[groupIndex], certifications: certs };
    setGroups(list);
    onChange?.({ ...dataRef.current, certifications: list });
  };

  const updateCert = (
    groupIndex: number,
    certIndex: number,
    patch: Partial<ResumeCertification>,
  ) => {
    const list = [...groups];
    const certs = [...(list[groupIndex].certifications ?? [])];
    certs[certIndex] = { ...certs[certIndex], ...patch };
    list[groupIndex] = { ...list[groupIndex], certifications: certs };
    setGroups(list);
    onChange?.({ ...dataRef.current, certifications: list });
  };

  const removeCert = (groupIndex: number, certIndex: number) => {
    const list = [...groups];
    const certs = (list[groupIndex].certifications ?? []).filter(
      (_, i) => i !== certIndex,
    );
    list[groupIndex] = { ...list[groupIndex], certifications: certs };
    setGroups(list);
    onChange?.({ ...dataRef.current, certifications: list });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave({ ...dataRef.current, certifications: groups });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex max-h-[88vh] min-h-[400px] flex-col">
      {!hideHeader && <ModalHeader title="Certifications" onClose={onClose} />}
      <div className="flex-1 overflow-y-auto custom-scrollbar py-3 pr-1">
        {groups.map((group, groupIndex) => (
          <div
            key={`cert-group-${groupIndex}`}
            className="space-y-3 rounded-lg bg-panel p-3"
          >
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0 flex-1">
                <label className="body-sm mb-1 block text-ink-secondary">
                  Category
                </label>
                <Input
                  value={asValue(group.type)}
                  placeholder="e.g. Cloud & DevOps"
                  onChange={(e) =>
                    updateGroup(groupIndex, { type: e.target.value || "Other" })
                  }
                />
              </div>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="text-red-500 hover:bg-red-500/10 hover:text-red-600 self-end"
                Icon={Trash2}
                onClick={() => removeGroup(groupIndex)}
              >
                Remove Group
              </Button>
            </div>

            <div className="space-y-3 pt-2">
              {(group.certifications ?? []).map((cert, certIndex) => (
                <div
                  key={`cert-${groupIndex}-${certIndex}`}
                  className="rounded-md bg-background-secondary p-3 space-y-3"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="body-sm font-medium text-ink-primary">
                      Certification #{certIndex + 1}
                    </span>
                    <button
                      type="button"
                      onClick={() => removeCert(groupIndex, certIndex)}
                      className="text-ink-secondary hover:text-red-500"
                      title="Remove certification"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                  <div className="grid gap-3 md:grid-cols-2">
                    <Input
                      value={asValue(cert.name)}
                      placeholder="Certification Name"
                      onChange={(e) =>
                        updateCert(groupIndex, certIndex, {
                          name: e.target.value || null,
                        })
                      }
                    />
                    <Input
                      value={asValue(cert.issuer)}
                      placeholder="Issuer (e.g. AWS, Google)"
                      onChange={(e) =>
                        updateCert(groupIndex, certIndex, {
                          issuer: e.target.value || null,
                        })
                      }
                    />
                    <Input
                      value={asValue(cert.issue_date)}
                      placeholder="Issue Date"
                      onChange={(e) =>
                        updateCert(groupIndex, certIndex, {
                          issue_date: e.target.value || null,
                        })
                      }
                    />
                    <Input
                      value={asValue(cert.expiry_date)}
                      placeholder="Expiry Date"
                      onChange={(e) =>
                        updateCert(groupIndex, certIndex, {
                          expiry_date: e.target.value || null,
                        })
                      }
                    />
                    <Input
                      className="md:col-span-2"
                      value={asValue(cert.credential_url)}
                      placeholder="Credential URL"
                      onChange={(e) =>
                        updateCert(groupIndex, certIndex, {
                          credential_url: e.target.value || null,
                        })
                      }
                    />
                  </div>
                </div>
              ))}

              <Button
                type="button"
                size="sm"
                variant="secondary"
                Icon={Plus}
                onClick={() => addCert(groupIndex)}
              >
                Add Certification
              </Button>
            </div>
          </div>
        ))}

        <Button
          type="button"
          variant="secondary"
          className="w-full"
          Icon={Plus}
          onClick={addGroup}
        >
          Add Certification Group
        </Button>
      </div>
      {!hideFooter && <ModalFooter onClose={onClose} onSave={handleSave} saving={saving} />}
    </div>
  );
}

/* ========================================================================== */
/* Links Editor                                                               */
/* ========================================================================== */
export function LinksEditor({
  data,
  onSave,
  onClose,
}: {
  data: MasterResumeData;
  onSave: (next: MasterResumeData) => Promise<void>;
  onClose: () => void;
}) {
  const [items, setItems] = useState<ResumeLink[]>(
    Array.isArray(data.links) ? data.links : [],
  );
  const [saving, setSaving] = useState(false);

  const updateItem = (index: number, patch: Partial<ResumeLink>) => {
    const list = [...items];
    list[index] = { ...list[index], ...patch };
    setItems(list);
  };

  const removeItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const addItem = () => {
    setItems([...items, { type: "", link: "" }]);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave({ ...data, links: items });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex max-h-[88vh] min-h-[340px] flex-col">
      <ModalHeader title="Links" onClose={onClose} />
      <div className="flex-1 space-y-3 overflow-y-auto custom-scrollbar py-3 pr-1">
        {items.map((item, index) => (
          <div
            key={`link-${index}`}
            className="flex items-center gap-3 rounded-lg bg-panel p-3"
          >
            <div className="w-1/3">
              <Input
                value={asValue(item.type)}
                placeholder="Type (e.g. GitHub)"
                onChange={(e) =>
                  updateItem(index, { type: e.target.value || null })
                }
              />
            </div>
            <div className="flex-1">
              <Input
                value={asValue(item.link)}
                placeholder="https://..."
                onChange={(e) =>
                  updateItem(index, { link: e.target.value || null })
                }
              />
            </div>
            <button
              type="button"
              onClick={() => removeItem(index)}
              className="text-ink-secondary hover:text-red-500 p-1"
              title="Remove link"
            >
              <Trash2 className="size-4" />
            </button>
          </div>
        ))}

        <Button
          type="button"
          variant="secondary"
          className="w-full"
          Icon={Plus}
          onClick={addItem}
        >
          Add Link
        </Button>
      </div>
      <ModalFooter onClose={onClose} onSave={handleSave} saving={saving} />
    </div>
  );
}

/* ========================================================================== */
/* Other Section Editor                                                       */
/* ========================================================================== */
export function OtherEditor({
  data,
  onSave,
  onClose,
}: {
  data: MasterResumeData;
  onSave: (next: MasterResumeData) => Promise<void>;
  onClose: () => void;
}) {
  const [items, setItems] = useState<ResumeOtherItem[]>(
    Array.isArray(data.other) ? data.other : [],
  );
  const [saving, setSaving] = useState(false);

  const updateItem = (index: number, patch: Partial<ResumeOtherItem>) => {
    const list = [...items];
    list[index] = { ...list[index], ...patch };
    setItems(list);
  };

  const removeItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const addItem = () => {
    setItems([
      ...items,
      {
        type: "Volunteering",
        title: "",
        organization: "",
        location: "",
        date: "",
        description: [],
      },
    ]);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave({ ...data, other: items });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex max-h-[88vh] min-h-[400px] flex-col">
      <ModalHeader title="Additional Information" onClose={onClose} />
      <div className="flex-1 overflow-y-auto custom-scrollbar py-3 pr-1">
        {items.map((item, index) => (
          <div
            key={`other-${index}`}
            className="space-y-3 rounded-lg bg-panel p-3"
          >
            <div className="flex items-center justify-between gap-3 pb-3">
              <h3 className="font-semibold text-ink-primary">
                {item.title || item.type || `Entry #${index + 1}`}
              </h3>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="text-red-500 hover:bg-red-500/10 hover:text-red-600"
                Icon={Trash2}
                onClick={() => removeItem(index)}
              >
                Delete Entry
              </Button>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <label className="body-sm mb-1 block text-ink-secondary">
                  Category Type
                </label>
                <Input
                  value={asValue(item.type)}
                  placeholder="e.g. Volunteer, Publication"
                  onChange={(e) =>
                    updateItem(index, { type: e.target.value || null })
                  }
                />
              </div>
              <div>
                <label className="body-sm mb-1 block text-ink-secondary">
                  Role / Title
                </label>
                <Input
                  value={asValue(item.title)}
                  placeholder="Role or activity title"
                  onChange={(e) =>
                    updateItem(index, { title: e.target.value || null })
                  }
                />
              </div>
              <div>
                <label className="body-sm mb-1 block text-ink-secondary">
                  Organization
                </label>
                <Input
                  value={asValue(item.organization)}
                  placeholder="Organization name"
                  onChange={(e) =>
                    updateItem(index, { organization: e.target.value || null })
                  }
                />
              </div>
              <div>
                <label className="body-sm mb-1 block text-ink-secondary">
                  Date / Duration
                </label>
                <Input
                  value={asValue(item.date)}
                  placeholder="e.g. 2023"
                  onChange={(e) =>
                    updateItem(index, { date: e.target.value || null })
                  }
                />
              </div>
            </div>

            <div>
              <label className="body-sm mb-1 block font-medium text-ink-primary">
                Details (Drag to reorder)
              </label>
              <BulletListInput
                values={item.description ?? []}
                placeholder="Add a detail point..."
                onChange={(desc) => updateItem(index, { description: desc })}
              />
            </div>
          </div>
        ))}

        <Button
          type="button"
          variant="secondary"
          className="w-full"
          Icon={Plus}
          onClick={addItem}
        >
          Add Entry
        </Button>
      </div>
      <ModalFooter onClose={onClose} onSave={handleSave} saving={saving} />
    </div>
  );
}
