import { useCallback, useEffect, useRef, useState } from "react";
import { formInspectionSchema } from "../../shared/contracts/form-inspection";
import type { FormInspection } from "../../shared/contracts/form-inspection";
import type { FormFieldObservation } from "../../shared/contracts/form-inspection";
import type { PageInspection } from "../../shared/contracts/page-inspection";
import { getActiveTab, send } from "../services/messaging";

function sameJob(left: PageInspection | null, right: PageInspection): boolean {
  return Boolean(
    left?.kind === "job" &&
      right.kind === "job" &&
      left.snapshot.platform === right.snapshot.platform &&
      left.snapshot.externalId === right.snapshot.externalId,
  );
}

function inspectionUrl(inspection: PageInspection): string {
  return inspection.kind === "job" ? inspection.snapshot.url : inspection.url;
}

function targetFor(field: FormFieldObservation) {
  return {
    key: field.key,
    frameId: field.frameId,
    id: field.id,
    name: field.name,
    type: field.type,
    label: field.label,
  };
}

function formSignature(form: FormInspection): string {
  if (form.kind === "application_form" || form.kind === "page_input_fields") {
    return JSON.stringify({
      kind: form.kind,
      url: form.url,
      fields: form.fields.map((field) => ({
        key: field.key,
        frameId: field.frameId,
        type: field.type,
        label: field.label,
        required: field.required,
        filled: field.filled,
        currentValue: field.currentValue || "",
        options: field.options,
      })),
      ...(form.kind === "application_form"
        ? { action: form.action, canGoBack: form.canGoBack, submitLabel: form.submitLabel }
        : {}),
    });
  }
  return `${form.kind}:${form.url}:${form.reason}`;
}

function hasVisibleFields(form: FormInspection | null): boolean {
  return Boolean(
    form &&
      (form.kind === "application_form" || form.kind === "page_input_fields") &&
      form.fields.length > 0,
  );
}

function isLinkedInTransientEmptyForm(form: FormInspection): boolean {
  return form.kind === "not_application_form" && form.platform === "linkedin";
}

export function useInspection(onJobChanged?: () => void) {
  const [latestInspection, setLatestInspection] = useState<PageInspection | null>(null);
  const [latestForm, setLatestForm] = useState<FormInspection | null>(null);
  const [inspectionError, setInspectionError] = useState<string>("");
  const [isInspectingPage, setIsInspectingPage] = useState(false);
  const [isInspectingForm, setIsInspectingForm] = useState(false);

  const pageInspectionInFlight = useRef(false);
  const formInspectionInFlight = useRef(false);
  const lastObservedActiveUrl = useRef<string | null>(null);
  const lastObservedActiveTabId = useRef<number | null>(null);
  const lastFormSignature = useRef<string>("");
  const pendingFormChange = useRef<FormInspection | null>(null);
  const formChangeTimer = useRef<number | undefined>(undefined);
  const linkedInClearTimer = useRef<number | undefined>(undefined);
  const latestFormRef = useRef<FormInspection | null>(null);

  useEffect(() => {
    latestFormRef.current = latestForm;
  }, [latestForm]);

  const setFormIfChanged = useCallback((form: FormInspection) => {
    const nextSignature = formSignature(form);
    if (nextSignature === lastFormSignature.current) return false;
    lastFormSignature.current = nextSignature;
    setLatestForm(form);
    return true;
  }, []);

  const resetInspectionState = useCallback(() => {
    setLatestInspection(null);
    setLatestForm(null);
    lastFormSignature.current = "";
    onJobChanged?.();
  }, [onJobChanged]);

  const inspectPage = useCallback(async () => {
    if (pageInspectionInFlight.current) return;
    pageInspectionInFlight.current = true;
    setIsInspectingPage(true);
    try {
      resetInspectionState();
      lastObservedActiveUrl.current = null;
      lastObservedActiveTabId.current = null;
      const response = await send({ type: "content.inspect-active" });
      if (!response.ok) {
        setInspectionError(response.error);
        return;
      }
      setInspectionError("");
      if (response.inspection) {
        setLatestInspection(response.inspection);
        const tab = await getActiveTab();
        lastObservedActiveTabId.current = tab?.id ?? null;
        lastObservedActiveUrl.current = inspectionUrl(response.inspection);
      }
    } finally {
      pageInspectionInFlight.current = false;
      setIsInspectingPage(false);
    }
  }, [resetInspectionState]);

  const autoInspectActivePage = useCallback(async (force = false): Promise<boolean> => {
    if (pageInspectionInFlight.current) return false;

    const tab = await getActiveTab();
    const url = tab?.url;
    const tabId = tab?.id ?? null;
    if (!url) return false;

    const tabOrUrlChanged = tabId !== lastObservedActiveTabId.current || url !== lastObservedActiveUrl.current;
    if (!force && !tabOrUrlChanged) return false;

    pageInspectionInFlight.current = true;
    setIsInspectingPage(true);
    try {
      const response = await send({ type: "content.inspect-active" });
      if (!response.ok || !response.inspection) {
        lastObservedActiveUrl.current = null;
        lastObservedActiveTabId.current = null;
        return false;
      }

      setLatestInspection((prev) => {
        if (!sameJob(prev, response.inspection!)) {
          setLatestForm(null);
          lastFormSignature.current = "";
          onJobChanged?.();
        }
        return response.inspection!;
      });

      lastObservedActiveTabId.current = tabId;
      lastObservedActiveUrl.current = inspectionUrl(response.inspection);
      return true;
    } catch {
      lastObservedActiveUrl.current = null;
      lastObservedActiveTabId.current = null;
      return false;
    } finally {
      pageInspectionInFlight.current = false;
      setIsInspectingPage(false);
    }
  }, [onJobChanged]);

  const inspectForm = useCallback(async (): Promise<FormInspection | null> => {
    if (formInspectionInFlight.current) return null;
    formInspectionInFlight.current = true;
    setIsInspectingForm(true);
    try {
      const response = await send({ type: "content.inspect-form-active" });
      if (!response.ok) {
        setInspectionError(response.error);
        return null;
      }
      setInspectionError("");
      if (response.form) {
        setFormIfChanged(response.form);
        return response.form;
      }
      return null;
    } finally {
      formInspectionInFlight.current = false;
      setIsInspectingForm(false);
    }
  }, [setFormIfChanged]);

  const focusFormField = useCallback(async (field: FormFieldObservation) => {
    const response = await send({
      type: "content.focus-form-field-active",
      target: targetFor(field),
    });
    if (!response.ok) setInspectionError(response.error);
  }, []);

  const uploadDefaultResume = useCallback(async (field: FormFieldObservation) => {
    const response = await send({
      type: "content.upload-default-resume-active",
      target: targetFor(field),
    });
    if (!response.ok) {
      setInspectionError(response.error);
      return;
    }
    if (response.fillResult && !["filled", "already_filled"].includes(response.fillResult.status)) {
      setInspectionError(response.fillResult.message);
      return;
    }
    setInspectionError("");
    void inspectForm();
  }, [inspectForm]);

  const editFormField = useCallback(async (field: FormFieldObservation, value: string | boolean) => {
    const response = await send({
      type: "content.edit-form-field-active",
      target: targetFor(field),
      value,
    });
    if (!response.ok) {
      setInspectionError(response.error);
      return;
    }
    if (response.fillResult && !["filled", "already_filled"].includes(response.fillResult.status)) {
      setInspectionError(response.fillResult.message);
      void inspectForm();
      return;
    }
    setInspectionError("");
  }, [inspectForm]);

  useEffect(() => {
    const listener = (message: unknown) => {
      if (
        typeof message !== "object" ||
        message === null ||
        (message as { type?: unknown }).type !== "sidepanel.form-changed"
      ) return;
      const changedTabId = (message as { tabId?: unknown }).tabId;
      void getActiveTab().then((tab) => {
        if (typeof changedTabId !== "number" || tab?.id !== changedTabId) return;
        const parsed = formInspectionSchema.safeParse((message as { form?: unknown }).form);
        if (parsed.success) {
          // LinkedIn briefly removes/replaces its modal subtree during a step
          // transition. Do not erase the visible field list for that single
          // intermediate frame; verify once the transition settles instead.
          if (isLinkedInTransientEmptyForm(parsed.data) && hasVisibleFields(latestFormRef.current)) {
            if (linkedInClearTimer.current !== undefined) window.clearTimeout(linkedInClearTimer.current);
            linkedInClearTimer.current = window.setTimeout(() => {
              linkedInClearTimer.current = undefined;
              void inspectForm();
            }, 500);
            return;
          }
          if (linkedInClearTimer.current !== undefined) {
            window.clearTimeout(linkedInClearTimer.current);
            linkedInClearTimer.current = undefined;
          }
          pendingFormChange.current = parsed.data;
          if (formChangeTimer.current !== undefined) window.clearTimeout(formChangeTimer.current);
          formChangeTimer.current = window.setTimeout(() => {
            const form = pendingFormChange.current;
            pendingFormChange.current = null;
            formChangeTimer.current = undefined;
            if (!form) return;
            setInspectionError("");
            setFormIfChanged(form);
          }, 150);
          return;
        }
        void inspectForm();
      });
    };
    chrome.runtime.onMessage.addListener(listener);
    return () => {
      chrome.runtime.onMessage.removeListener(listener);
      if (formChangeTimer.current !== undefined) window.clearTimeout(formChangeTimer.current);
      if (linkedInClearTimer.current !== undefined) window.clearTimeout(linkedInClearTimer.current);
    };
  }, [inspectForm, setFormIfChanged]);

  return {
    latestInspection,
    setLatestInspection,
    latestForm,
    setLatestForm,
    inspectionError,
    isInspectingPage,
    isInspectingForm,
    setInspectionError,
    resetInspectionState,
    inspectPage,
    autoInspectActivePage,
    inspectForm,
    focusFormField,
    uploadDefaultResume,
    editFormField,
  };
}
