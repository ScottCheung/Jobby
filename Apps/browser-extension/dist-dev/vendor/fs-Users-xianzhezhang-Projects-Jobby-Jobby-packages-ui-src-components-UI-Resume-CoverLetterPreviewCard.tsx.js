import { createHotContext as __vite__createHotContext } from "/vendor/vite-client.js";import.meta.hot = __vite__createHotContext("/vendor/fs-Users-xianzhezhang-Projects-Jobby-Jobby-packages-ui-src-components-UI-Resume-CoverLetterPreviewCard.tsx.js");import __vite__cjsImport0_react_jsxDevRuntime from "/vendor/.vite-deps-react_jsx-dev-runtime.js__v--22c5bc1a.js"; const jsxDEV = __vite__cjsImport0_react_jsxDevRuntime["jsxDEV"];
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
  window.$RefreshReg$ = RefreshRuntime.getRefreshReg("/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/CoverLetterPreviewCard.tsx");
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
  CoverLetterPdfPreview,
  renderCoverLetterPdfOnce
} from "/vendor/fs-Users-xianzhezhang-Projects-Jobby-Jobby-packages-ui-src-components-UI-Resume-CoverLetterPdfPreview.tsx.js";
import { formatCoverLetterFilename } from "/vendor/fs-Users-xianzhezhang-Projects-Jobby-Jobby-packages-ui-src-components-UI-Resume-helpers.ts.js";
export function CoverLetterPreviewCard({
  coverLetter,
  candidateData,
  company,
  jobTitle,
  filename,
  title,
  badge,
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
  const handleCopy = async () => {
    if (onCopy) {
      onCopy();
      return;
    }
    try {
      await navigator.clipboard.writeText(coverLetter);
      setCopied(true);
      notify.success("Cover letter copied to clipboard");
      setTimeout(() => setCopied(false), 2e3);
    } catch {
      notify.error("Failed to copy cover letter to clipboard");
    }
  };
  const handleDownload = async () => {
    if (onDownload) {
      onDownload();
      return;
    }
    setDownloading(true);
    try {
      const downloadName = filename || formatCoverLetterFilename(candidateData, company, jobTitle);
      const { blob } = await renderCoverLetterPdfOnce(
        coverLetter,
        candidateData,
        company,
        jobTitle
      );
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = downloadName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1e3);
      notify.success("Cover letter downloaded");
    } catch {
      notify.error("Failed to download cover letter PDF");
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
              fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/CoverLetterPreviewCard.tsx",
              lineNumber: 133,
              columnNumber: 11
            }, this),
            /* @__PURE__ */ jsxDEV("strong", { className: "text-xs font-bold text-ink-primary shrink-0", children: "Cover Letter" }, void 0, false, {
              fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/CoverLetterPreviewCard.tsx",
              lineNumber: 134,
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
                fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/CoverLetterPreviewCard.tsx",
                lineNumber: 138,
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
                fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/CoverLetterPreviewCard.tsx",
                lineNumber: 145,
                columnNumber: 11
              },
              this
            ) : null
          ] }, void 0, true, {
            fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/CoverLetterPreviewCard.tsx",
            lineNumber: 132,
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
                title: "Copy cover letter text",
                children: copied ? "Copied" : "Copy"
              },
              void 0,
              false,
              {
                fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/CoverLetterPreviewCard.tsx",
                lineNumber: 156,
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
                title: "Download cover letter PDF",
                children: "Download"
              },
              void 0,
              false,
              {
                fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/CoverLetterPreviewCard.tsx",
                lineNumber: 167,
                columnNumber: 11
              },
              this
            )
          ] }, void 0, true, {
            fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/CoverLetterPreviewCard.tsx",
            lineNumber: 154,
            columnNumber: 9
          }, this)
        ] }, void 0, true, {
          fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/CoverLetterPreviewCard.tsx",
          lineNumber: 131,
          columnNumber: 7
        }, this),
        /* @__PURE__ */ jsxDEV("div", { className: "flex flex-col gap-2 pt-1 w-full min-w-0", children: /* @__PURE__ */ jsxDEV(
          CoverLetterPdfPreview,
          {
            coverLetter,
            candidateData,
            company,
            jobTitle,
            filename,
            onOpenModal,
            onPreview,
            onNewWindow,
            onEdit,
            onDownload: handleDownload
          },
          void 0,
          false,
          {
            fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/CoverLetterPreviewCard.tsx",
            lineNumber: 183,
            columnNumber: 9
          },
          this
        ) }, void 0, false, {
          fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/CoverLetterPreviewCard.tsx",
          lineNumber: 182,
          columnNumber: 7
        }, this)
      ]
    },
    void 0,
    true,
    {
      fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/CoverLetterPreviewCard.tsx",
      lineNumber: 127,
      columnNumber: 5
    },
    this
  );
}
_s(CoverLetterPreviewCard, "fozF/wM9AN6Cj0fgzwYlMUNNKPU=");
_c = CoverLetterPreviewCard;
var _c;
$RefreshReg$(_c, "CoverLetterPreviewCard");
if (import.meta.hot && !inWebWorker) {
  window.$RefreshReg$ = prevRefreshReg;
  window.$RefreshSig$ = prevRefreshSig;
}
if (import.meta.hot && !inWebWorker) {
  RefreshRuntime.__hmr_import(import.meta.url).then((currentExports) => {
    RefreshRuntime.registerExportsForReactRefresh("/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/CoverLetterPreviewCard.tsx", currentExports);
    import.meta.hot.accept((nextExports) => {
      if (!nextExports) return;
      const invalidateMessage = RefreshRuntime.validateRefreshBoundaryAndEnqueueUpdate("/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/CoverLetterPreviewCard.tsx", currentExports, nextExports);
      if (invalidateMessage) import.meta.hot.invalidate(invalidateMessage);
    });
  });
}
