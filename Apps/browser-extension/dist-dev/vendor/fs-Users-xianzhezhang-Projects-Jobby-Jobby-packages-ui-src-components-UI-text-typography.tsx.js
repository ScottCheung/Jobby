import { createHotContext as __vite__createHotContext } from "/vendor/vite-client.js";import.meta.hot = __vite__createHotContext("/vendor/fs-Users-xianzhezhang-Projects-Jobby-Jobby-packages-ui-src-components-UI-text-typography.tsx.js");import __vite__cjsImport0_react_jsxDevRuntime from "/vendor/.vite-deps-react_jsx-dev-runtime.js__v--f5b0ea50.js"; const jsxDEV = __vite__cjsImport0_react_jsxDevRuntime["jsxDEV"];
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
  window.$RefreshReg$ = RefreshRuntime.getRefreshReg("/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/text/typography.tsx");
  window.$RefreshSig$ = RefreshRuntime.createSignatureFunctionForTransform;
}
"use client";
import { cn } from "/vendor/fs-Users-xianzhezhang-Projects-Jobby-Jobby-packages-ui-src-lib-utils.ts.js";
import { Collapse } from "/vendor/fs-Users-xianzhezhang-Projects-Jobby-Jobby-packages-ui-src-components-animation-index.ts.js";
export function H1({ className, ...props }) {
  return /* @__PURE__ */ jsxDEV(
    "h1",
    {
      className: cn(
        "title-page md:text-4xl",
        className
      ),
      ...props
    },
    void 0,
    false,
    {
      fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/text/typography.tsx",
      lineNumber: 32,
      columnNumber: 5
    },
    this
  );
}
_c = H1;
export function H2({ className, ...props }) {
  return /* @__PURE__ */ jsxDEV(
    "h2",
    {
      className: cn(
        "title-section tracking-tight",
        className
      ),
      ...props
    },
    void 0,
    false,
    {
      fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/text/typography.tsx",
      lineNumber: 44,
      columnNumber: 5
    },
    this
  );
}
_c2 = H2;
export function H3({ className, ...props }) {
  return /* @__PURE__ */ jsxDEV(
    "h3",
    {
      className: cn(
        "title-card tracking-tight",
        className
      ),
      ...props
    },
    void 0,
    false,
    {
      fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/text/typography.tsx",
      lineNumber: 56,
      columnNumber: 5
    },
    this
  );
}
_c3 = H3;
export function H4({ className, ...props }) {
  return /* @__PURE__ */ jsxDEV(
    "h4",
    {
      className: cn(
        "title-sub text-ink-secondary",
        className
      ),
      ...props
    },
    void 0,
    false,
    {
      fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/text/typography.tsx",
      lineNumber: 68,
      columnNumber: 5
    },
    this
  );
}
_c4 = H4;
export function P({ className, ...props }) {
  return /* @__PURE__ */ jsxDEV(
    "p",
    {
      className: cn("label text-ink-secondary", className),
      ...props
    },
    void 0,
    false,
    {
      fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/text/typography.tsx",
      lineNumber: 80,
      columnNumber: 5
    },
    this
  );
}
_c5 = P;
export function Lead({ className, ...props }) {
  return /* @__PURE__ */ jsxDEV("p", { className: cn("body-lg text-ink-secondary", className), ...props }, void 0, false, {
    fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/text/typography.tsx",
    lineNumber: 89,
    columnNumber: 5
  }, this);
}
_c6 = Lead;
export function Small({ className, ...props }) {
  return /* @__PURE__ */ jsxDEV(
    "small",
    {
      className: cn(
        "label-sm leading-none",
        className
      ),
      ...props
    },
    void 0,
    false,
    {
      fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/text/typography.tsx",
      lineNumber: 95,
      columnNumber: 5
    },
    this
  );
}
_c7 = Small;
export function Muted({ className, ...props }) {
  return /* @__PURE__ */ jsxDEV("p", { className: cn("body-md text-ink-secondary", className), ...props }, void 0, false, {
    fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/text/typography.tsx",
    lineNumber: 107,
    columnNumber: 5
  }, this);
}
_c8 = Muted;
export function Error({
  className,
  content,
  show,
  children,
  ...props
}) {
  const message = content || children;
  const shouldShow = !!message && message !== true;
  const isVisible = show ?? shouldShow;
  return /* @__PURE__ */ jsxDEV(Collapse, { isOpen: isVisible, className: "overflow-hidden", children: /* @__PURE__ */ jsxDEV(
    "p",
    {
      className: cn(
        "text-[12px] text-red-500 pl-2 flex items-center mt-1 font-medium",
        className
      ),
      role: "alert",
      ...props,
      children: message
    },
    void 0,
    false,
    {
      fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/text/typography.tsx",
      lineNumber: 125,
      columnNumber: 7
    },
    this
  ) }, void 0, false, {
    fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/text/typography.tsx",
    lineNumber: 124,
    columnNumber: 5
  }, this);
}
_c9 = Error;
var _c, _c2, _c3, _c4, _c5, _c6, _c7, _c8, _c9;
$RefreshReg$(_c, "H1");
$RefreshReg$(_c2, "H2");
$RefreshReg$(_c3, "H3");
$RefreshReg$(_c4, "H4");
$RefreshReg$(_c5, "P");
$RefreshReg$(_c6, "Lead");
$RefreshReg$(_c7, "Small");
$RefreshReg$(_c8, "Muted");
$RefreshReg$(_c9, "Error");
if (import.meta.hot && !inWebWorker) {
  window.$RefreshReg$ = prevRefreshReg;
  window.$RefreshSig$ = prevRefreshSig;
}
if (import.meta.hot && !inWebWorker) {
  RefreshRuntime.__hmr_import(import.meta.url).then((currentExports) => {
    RefreshRuntime.registerExportsForReactRefresh("/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/text/typography.tsx", currentExports);
    import.meta.hot.accept((nextExports) => {
      if (!nextExports) return;
      const invalidateMessage = RefreshRuntime.validateRefreshBoundaryAndEnqueueUpdate("/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/text/typography.tsx", currentExports, nextExports);
      if (invalidateMessage) import.meta.hot.invalidate(invalidateMessage);
    });
  });
}
