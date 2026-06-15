"use client";

import { useEffect, useMemo, useState } from "react";
import type { JobApplication } from "@/lib/types";
import { Field } from "./forms";

const pipelineStages = [
  { id: "applied", label: "Applied" },
  { id: "screening", label: "Screening" },
  { id: "interviewing", label: "Interviewing" },
  { id: "offer", label: "Offer" },
  { id: "skipped", label: "Skipped" },
  { id: "rejected", label: "Rejected" },
  { id: "withdrawn", label: "Withdrawn" },
];

function toInputDateTime(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 16);
}

export function ApplicationDetails({
  application,
  onSave,
}: {
  application: JobApplication;
  onSave: (applicationId: string, payload: Partial<JobApplication>) => Promise<void>;
}) {
  const [draft, setDraft] = useState<JobApplication>(application);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setDraft(application);
  }, [application]);

  const activeStageIndex = useMemo(() => {
    const index = pipelineStages.findIndex((stage) => stage.id === (draft.pipeline_stage || "applied"));
    return index >= 0 ? index : 0;
  }, [draft.pipeline_stage]);

  const set = (key: keyof JobApplication, value: string | null) => {
    setDraft((current) => ({ ...current, [key]: value }));
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
        contact_name: draft.contact_name,
        contact_email: draft.contact_email,
        skip_reason: draft.skip_reason,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="application-details">
      <div className="progress-card">
        <div className="progress-track">
          {pipelineStages.map((stage, index) => (
            <div className={`progress-step ${index <= activeStageIndex ? "active" : ""}`} key={stage.id}>
              <span>{index + 1}</span>
              <strong>{stage.label}</strong>
            </div>
          ))}
        </div>
        {draft.notes ? <p className="progress-note">{draft.notes}</p> : null}
      </div>

      <div className="form-grid compact">
        <Field label="Title" value={draft.title} onChange={(value) => set("title", value)} />
        <Field label="Company" value={draft.company} onChange={(value) => set("company", value)} />
        <Field label="Work location" value={draft.work_location} onChange={(value) => set("work_location", value)} />
        <Field label="Work style" value={draft.work_style} onChange={(value) => set("work_style", value)} />
        <div className="field">
          <label>Pipeline stage</label>
          <select value={draft.pipeline_stage || "applied"} onChange={(event) => set("pipeline_stage", event.target.value)}>
            {pipelineStages.map((stage) => (
              <option value={stage.id} key={stage.id}>
                {stage.label}
              </option>
            ))}
          </select>
        </div>
        <Field label="Interview stage" value={draft.interview_stage} onChange={(value) => set("interview_stage", value)} />
        <Field label="Next action" value={draft.next_action} onChange={(value) => set("next_action", value)} />
        <div className="field">
          <label>Next action time</label>
          <input
            type="datetime-local"
            value={toInputDateTime(draft.next_action_at)}
            onChange={(event) => set("next_action_at", event.target.value ? new Date(event.target.value).toISOString() : null)}
          />
        </div>
        <Field label="Contact name" value={draft.contact_name} onChange={(value) => set("contact_name", value)} />
        <Field label="Contact email" value={draft.contact_email} onChange={(value) => set("contact_email", value)} />
        <Field label="Skip reason" value={draft.skip_reason} onChange={(value) => set("skip_reason", value)} full />
        <Field label="Notes" value={draft.notes} onChange={(value) => set("notes", value)} multiline full />
        <Field label="Job description" value={draft.job_description} onChange={(value) => set("job_description", value)} multiline full />
      </div>

      <div className="actions">
        <button className="primary" onClick={() => void save()} disabled={saving}>
          {saving ? "Saving..." : "Save changes"}
        </button>
      </div>
    </div>
  );
}
