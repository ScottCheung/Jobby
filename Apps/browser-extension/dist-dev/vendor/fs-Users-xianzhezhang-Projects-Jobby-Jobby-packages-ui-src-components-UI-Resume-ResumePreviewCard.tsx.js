import { createHotContext as __vite__createHotContext } from "/vendor/vite-client.js";import.meta.hot = __vite__createHotContext("/vendor/fs-Users-xianzhezhang-Projects-Jobby-Jobby-packages-ui-src-components-UI-Resume-ResumePreviewCard.tsx.js");import __vite__cjsImport0_react_jsxDevRuntime from "/vendor/.vite-deps-react_jsx-dev-runtime.js__v--22c5bc1a.js"; const jsxDEV = __vite__cjsImport0_react_jsxDevRuntime["jsxDEV"];
import * as RefreshRuntime from "/vendor/react-refresh.js";
const inWebWorker = typeof WorkerGlobalScope !== "undefined" && self instanceof WorkerGlobalScope;
let prevRefreshReg;
let prevRefreshSig;
if (import.meta.hot && !inWebWorker) {
  if (!window.$RefreshReg$) {
    throw new Error(
      "@vitejs/plugin-react can't detect preamble. Something is wrong."
    );
  }
  prevRefreshReg = window.$RefreshReg$;
  prevRefreshSig = window.$RefreshSig$;
  window.$RefreshReg$ = RefreshRuntime.getRefreshReg("/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/ResumePreviewCard.tsx");
  window.$RefreshSig$ = RefreshRuntime.createSignatureFunctionForTransform;
}
"use client";
var _s = $RefreshSig$();
import __vite__cjsImport3_react from "/vendor/.vite-deps-react.js__v--22c5bc1a.js"; const useState = __vite__cjsImport3_react["useState"];
import {
  Check,
  Copy,
  Download,
  Sparkles
} from "/vendor/.vite-deps-lucide-react.js__v--22c5bc1a.js";
import { Button } from "/vendor/fs-Users-xianzhezhang-Projects-Jobby-Jobby-packages-ui-src-components-UI-Button-index.tsx.js";
import { notify } from "/vendor/fs-Users-xianzhezhang-Projects-Jobby-Jobby-packages-ui-src-components-UI-toast-toast-store.ts.js";
import {
  ResumePdfPreview,
  renderResumePdfOnce
} from "/vendor/fs-Users-xianzhezhang-Projects-Jobby-Jobby-packages-ui-src-components-UI-Resume-ResumePdfPreview.tsx.js";
import {
  formatResumeAsPlainText,
  formatResumeFilename
} from "/vendor/fs-Users-xianzhezhang-Projects-Jobby-Jobby-packages-ui-src-components-UI-Resume-helpers.ts.js";
export function ResumePreviewCard({
  data,
  filename,
  title,
  badge,
  coreCompetencies,
  keyQualifications,
  company,
  jobTitle,
  showCompetencies = true,
  onOpenModal,
  onPreview,
  onNewWindow,
  onEdit,
  onDownload,
  onCopy,
  className = "",
  headerAction
}) {
  _s();
  const [copied, setCopied] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const competencies = coreCompetencies ?? data.core_competencies ?? [];
  const handleCopy = async () => {
    if (onCopy) {
      onCopy();
      return;
    }
    try {
      const text = formatResumeAsPlainText(data, competencies);
      await navigator.clipboard.writeText(text);
      setCopied(true);
      notify.success("Resume copied to clipboard");
      setTimeout(() => setCopied(false), 2e3);
    } catch {
      notify.error("Failed to copy resume to clipboard");
    }
  };
  const handleDownload = async () => {
    if (onDownload) {
      onDownload();
      return;
    }
    setDownloading(true);
    try {
      const downloadName = filename || formatResumeFilename(data, company, jobTitle);
      const { blob } = await renderResumePdfOnce(
        data,
        1,
        competencies,
        keyQualifications
      );
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = downloadName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1e3);
      notify.success("Resume downloaded");
    } catch {
      notify.error("Failed to download resume PDF");
    } finally {
      setDownloading(false);
    }
  };
  return /* @__PURE__ */ jsxDEV(
    "div",
    {
      className: `panel-xl col group gap-2.5 p-3.5 w-full min-w-0 max-w-full box-border rounded-xl ${className}`,
      children: [
        /* @__PURE__ */ jsxDEV("div", { className: "flex items-center justify-between gap-2 border-b border-primary/40 pb-2.5 w-full min-w-0", children: [
          /* @__PURE__ */ jsxDEV("div", { className: "min-w-0 flex-1 flex items-center gap-1.5 overflow-hidden", children: [
            /* @__PURE__ */ jsxDEV(Sparkles, { className: "w-3.5 h-3.5 text-primary shrink-0" }, void 0, false, {
              fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/ResumePreviewCard.tsx",
              lineNumber: 143,
              columnNumber: 11
            }, this),
            /* @__PURE__ */ jsxDEV("strong", { className: "text-xs font-bold text-ink-primary shrink-0", children: "Resume" }, void 0, false, {
              fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/ResumePreviewCard.tsx",
              lineNumber: 144,
              columnNumber: 11
            }, this),
            badge ? /* @__PURE__ */ jsxDEV(
              "span",
              {
                title: badge,
                className: "inline-flex items-center rounded-md bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold text-primary truncate max-w-[100px]",
                children: badge
              },
              void 0,
              false,
              {
                fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/ResumePreviewCard.tsx",
                lineNumber: 148,
                columnNumber: 11
              },
              this
            ) : title ? /* @__PURE__ */ jsxDEV(
              "span",
              {
                title,
                className: "text-xs text-ink-secondary truncate",
                children: title
              },
              void 0,
              false,
              {
                fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/ResumePreviewCard.tsx",
                lineNumber: 155,
                columnNumber: 11
              },
              this
            ) : null
          ] }, void 0, true, {
            fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/ResumePreviewCard.tsx",
            lineNumber: 142,
            columnNumber: 9
          }, this),
          /* @__PURE__ */ jsxDEV("div", { className: "flex items-center gap-1.5 shrink-0", children: [
            headerAction,
            /* @__PURE__ */ jsxDEV(
              Button,
              {
                size: "sm",
                variant: "outline",
                Icon: copied ? Check : Copy,
                onClick: () => void handleCopy(),
                className: "!rounded-xl !h-7 !px-2.5 text-xs font-semibold text-ink-primary",
                title: "Copy formatted resume text",
                children: copied ? "Copied" : "Copy"
              },
              void 0,
              false,
              {
                fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/ResumePreviewCard.tsx",
                lineNumber: 166,
                columnNumber: 11
              },
              this
            ),
            /* @__PURE__ */ jsxDEV(
              Button,
              {
                size: "sm",
                variant: "default",
                Icon: Download,
                isLoading: downloading,
                onClick: () => void handleDownload(),
                className: "!rounded-xl !h-7 !px-2.5 text-xs font-semibold",
                title: "Download resume PDF",
                children: "Download"
              },
              void 0,
              false,
              {
                fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/ResumePreviewCard.tsx",
                lineNumber: 177,
                columnNumber: 11
              },
              this
            )
          ] }, void 0, true, {
            fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/ResumePreviewCard.tsx",
            lineNumber: 164,
            columnNumber: 9
          }, this)
        ] }, void 0, true, {
          fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/ResumePreviewCard.tsx",
          lineNumber: 141,
          columnNumber: 7
        }, this),
        showCompetencies && competencies.length > 0 && /* @__PURE__ */ jsxDEV("div", { className: "flex flex-col gap-1.5 w-full min-w-0", children: [
          /* @__PURE__ */ jsxDEV("span", { className: "text-ink-secondary text-[10px] font-bold uppercase tracking-wider", children: "Core Competencies" }, void 0, false, {
            fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/ResumePreviewCard.tsx",
            lineNumber: 194,
            columnNumber: 11
          }, this),
          /* @__PURE__ */ jsxDEV("div", { className: "flex flex-wrap gap-1.5", children: competencies.map(
            (comp, idx) => /* @__PURE__ */ jsxDEV(
              "span",
              {
                className: "inline-flex items-center rounded-md bg-primary/15 px-2 py-0.5 text-[9px] font-semibold text-primary",
                children: comp
              },
              `${comp}-${idx}`,
              false,
              {
                fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/ResumePreviewCard.tsx",
                lineNumber: 199,
                columnNumber: 11
              },
              this
            )
          ) }, void 0, false, {
            fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/ResumePreviewCard.tsx",
            lineNumber: 197,
            columnNumber: 11
          }, this)
        ] }, void 0, true, {
          fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/ResumePreviewCard.tsx",
          lineNumber: 193,
          columnNumber: 7
        }, this),
        /* @__PURE__ */ jsxDEV("div", { className: "flex flex-col gap-2 pt-1 w-full min-w-0", children: /* @__PURE__ */ jsxDEV(
          ResumePdfPreview,
          {
            data,
            filename,
            coreCompetencies: competencies,
            keyQualifications,
            company,
            jobTitle,
            onOpenModal,
            onPreview,
            onNewWindow,
            onEdit,
            onDownload: handleDownload
          },
          void 0,
          false,
          {
            fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/ResumePreviewCard.tsx",
            lineNumber: 212,
            columnNumber: 9
          },
          this
        ) }, void 0, false, {
          fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/ResumePreviewCard.tsx",
          lineNumber: 211,
          columnNumber: 7
        }, this)
      ]
    },
    void 0,
    true,
    {
      fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/ResumePreviewCard.tsx",
      lineNumber: 137,
      columnNumber: 5
    },
    this
  );
}
_s(ResumePreviewCard, "fozF/wM9AN6Cj0fgzwYlMUNNKPU=");
_c = ResumePreviewCard;
var _c;
$RefreshReg$(_c, "ResumePreviewCard");
if (import.meta.hot && !inWebWorker) {
  window.$RefreshReg$ = prevRefreshReg;
  window.$RefreshSig$ = prevRefreshSig;
}
if (import.meta.hot && !inWebWorker) {
  RefreshRuntime.__hmr_import(import.meta.url).then((currentExports) => {
    RefreshRuntime.registerExportsForReactRefresh("/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/ResumePreviewCard.tsx", currentExports);
    import.meta.hot.accept((nextExports) => {
      if (!nextExports) return;
      const invalidateMessage = RefreshRuntime.validateRefreshBoundaryAndEnqueueUpdate("/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/ResumePreviewCard.tsx", currentExports, nextExports);
      if (invalidateMessage) import.meta.hot.invalidate(invalidateMessage);
    });
  });
}
