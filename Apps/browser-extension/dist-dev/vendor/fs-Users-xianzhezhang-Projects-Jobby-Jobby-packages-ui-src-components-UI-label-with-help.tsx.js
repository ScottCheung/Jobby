import { createHotContext as __vite__createHotContext } from "/vendor/vite-client.js";import.meta.hot = __vite__createHotContext("/vendor/fs-Users-xianzhezhang-Projects-Jobby-Jobby-packages-ui-src-components-UI-label-with-help.tsx.js");import __vite__cjsImport0_react_jsxDevRuntime from "/vendor/.vite-deps-react_jsx-dev-runtime.js__v--f5b0ea50.js"; const jsxDEV = __vite__cjsImport0_react_jsxDevRuntime["jsxDEV"];
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
  window.$RefreshReg$ = RefreshRuntime.getRefreshReg("/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/label/with-help.tsx");
  window.$RefreshSig$ = RefreshRuntime.createSignatureFunctionForTransform;
}
"use client";
import { HelpCircle } from "/vendor/.vite-deps-lucide-react.js__v--d47d6985.js";
import { cn } from "/vendor/fs-Users-xianzhezhang-Projects-Jobby-Jobby-packages-ui-src-lib-utils.ts.js";
import {
  TooltipProvider,
  TooltipRoot,
  TooltipTrigger,
  TooltipContent
} from "/vendor/fs-Users-xianzhezhang-Projects-Jobby-Jobby-packages-ui-src-components-UI-tooltip-index.tsx.js";
export const LabelWithHelp = ({
  label,
  helpTextShort,
  helpTextLong,
  className,
  required = false,
  optional = false
}) => {
  const tooltipText = (helpTextLong || helpTextShort || "").trim();
  const hasHelpText = tooltipText.length > 0;
  return /* @__PURE__ */ jsxDEV("div", { className: cn("col", className), children: /* @__PURE__ */ jsxDEV("div", { className: "flex items-center gap-1.5", children: [
    /* @__PURE__ */ jsxDEV("label", { className: "text-xs font-semibold text-ink-primary select-none", children: [
      label,
      required && /* @__PURE__ */ jsxDEV("span", { className: "text-rose-500 font-bold ml-0.5", children: "*" }, void 0, false, {
        fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/label/with-help.tsx",
        lineNumber: 61,
        columnNumber: 24
      }, this)
    ] }, void 0, true, {
      fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/label/with-help.tsx",
      lineNumber: 59,
      columnNumber: 9
    }, this),
    optional && /* @__PURE__ */ jsxDEV("span", { className: "rounded-sm bg-background-secondary px-1 py-0.2 text-[8px] font-semibold uppercase tracking-wide text-ink-secondary", children: "Optional" }, void 0, false, {
      fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/label/with-help.tsx",
      lineNumber: 64,
      columnNumber: 9
    }, this),
    hasHelpText && /* @__PURE__ */ jsxDEV(TooltipProvider, { delayDuration: 200, children: /* @__PURE__ */ jsxDEV(TooltipRoot, { children: [
      /* @__PURE__ */ jsxDEV(TooltipTrigger, { asChild: true, children: /* @__PURE__ */ jsxDEV("button", { type: "button", className: "inline-flex items-center", children: /* @__PURE__ */ jsxDEV(HelpCircle, { className: "size-3.5 text-ink-secondary cursor-help hover:text-primary transition-colors" }, void 0, false, {
        fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/label/with-help.tsx",
        lineNumber: 73,
        columnNumber: 19
      }, this) }, void 0, false, {
        fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/label/with-help.tsx",
        lineNumber: 72,
        columnNumber: 17
      }, this) }, void 0, false, {
        fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/label/with-help.tsx",
        lineNumber: 71,
        columnNumber: 15
      }, this),
      /* @__PURE__ */ jsxDEV(
        TooltipContent,
        {
          side: "right",
          className: "body-sm max-w-xs",
          sideOffset: 5,
          children: /* @__PURE__ */ jsxDEV("p", { children: tooltipText }, void 0, false, {
            fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/label/with-help.tsx",
            lineNumber: 81,
            columnNumber: 17
          }, this)
        },
        void 0,
        false,
        {
          fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/label/with-help.tsx",
          lineNumber: 76,
          columnNumber: 15
        },
        this
      )
    ] }, void 0, true, {
      fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/label/with-help.tsx",
      lineNumber: 70,
      columnNumber: 13
    }, this) }, void 0, false, {
      fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/label/with-help.tsx",
      lineNumber: 69,
      columnNumber: 9
    }, this)
  ] }, void 0, true, {
    fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/label/with-help.tsx",
    lineNumber: 58,
    columnNumber: 7
  }, this) }, void 0, false, {
    fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/label/with-help.tsx",
    lineNumber: 57,
    columnNumber: 5
  }, this);
};
_c = LabelWithHelp;
var _c;
$RefreshReg$(_c, "LabelWithHelp");
if (import.meta.hot && !inWebWorker) {
  window.$RefreshReg$ = prevRefreshReg;
  window.$RefreshSig$ = prevRefreshSig;
}
if (import.meta.hot && !inWebWorker) {
  RefreshRuntime.__hmr_import(import.meta.url).then((currentExports) => {
    RefreshRuntime.registerExportsForReactRefresh("/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/label/with-help.tsx", currentExports);
    import.meta.hot.accept((nextExports) => {
      if (!nextExports) return;
      const invalidateMessage = RefreshRuntime.validateRefreshBoundaryAndEnqueueUpdate("/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/label/with-help.tsx", currentExports, nextExports);
      if (invalidateMessage) import.meta.hot.invalidate(invalidateMessage);
    });
  });
}
