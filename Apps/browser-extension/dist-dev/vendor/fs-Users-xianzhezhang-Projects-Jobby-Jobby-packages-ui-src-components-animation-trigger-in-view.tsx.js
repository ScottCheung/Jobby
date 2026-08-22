import { createHotContext as __vite__createHotContext } from "/vendor/vite-client.js";import.meta.hot = __vite__createHotContext("/vendor/fs-Users-xianzhezhang-Projects-Jobby-Jobby-packages-ui-src-components-animation-trigger-in-view.tsx.js");import __vite__cjsImport0_react_jsxDevRuntime from "/vendor/.vite-deps-react_jsx-dev-runtime.js__v--f5b0ea50.js"; const jsxDEV = __vite__cjsImport0_react_jsxDevRuntime["jsxDEV"];
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
  window.$RefreshReg$ = RefreshRuntime.getRefreshReg("/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/animation/trigger/in-view.tsx");
  window.$RefreshSig$ = RefreshRuntime.createSignatureFunctionForTransform;
}
"use client";
var _s = $RefreshSig$();
import { motion, useInView } from "/vendor/.vite-deps-framer-motion.js__v--788107dc.js";
import { cn } from "/vendor/fs-Users-xianzhezhang-Projects-Jobby-Jobby-packages-ui-src-lib-utils.ts.js";
import __vite__cjsImport5_react from "/vendor/.vite-deps-react.js__v--f5b0ea50.js"; const useRef = __vite__cjsImport5_react["useRef"];
export function InView({
  children,
  fallback,
  margin = "-30% 0px -30% 0px",
  once = true,
  yOffset = 20,
  xOffset = 0,
  duration = 0.5,
  className,
  ...props
}) {
  _s();
  const ref = useRef(null);
  const isInView = useInView(ref, { once, margin });
  return /* @__PURE__ */ jsxDEV("div", { ref, className: cn("w-full h-full relative", className), ...props, children: isInView ? /* @__PURE__ */ jsxDEV(
    motion.div,
    {
      initial: { opacity: 0, y: yOffset, x: xOffset },
      animate: { opacity: 1, y: 0, x: 0 },
      exit: { opacity: 0 },
      transition: { duration },
      className: "w-full h-full",
      children
    },
    void 0,
    false,
    {
      fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/animation/trigger/in-view.tsx",
      lineNumber: 74,
      columnNumber: 7
    },
    this
  ) : fallback !== void 0 ? fallback : /* @__PURE__ */ jsxDEV(motion.div, { className: "flex h-full w-full items-center justify-center bg-ink-secondary/10 rounded-xl" }, void 0, false, {
    fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/animation/trigger/in-view.tsx",
    lineNumber: 87,
    columnNumber: 7
  }, this) }, void 0, false, {
    fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/animation/trigger/in-view.tsx",
    lineNumber: 72,
    columnNumber: 5
  }, this);
}
_s(InView, "DljcBprJKYjULUac3YKdUV9OwZQ=", false, function() {
  return [useInView];
});
_c = InView;
var _c;
$RefreshReg$(_c, "InView");
if (import.meta.hot && !inWebWorker) {
  window.$RefreshReg$ = prevRefreshReg;
  window.$RefreshSig$ = prevRefreshSig;
}
if (import.meta.hot && !inWebWorker) {
  RefreshRuntime.__hmr_import(import.meta.url).then((currentExports) => {
    RefreshRuntime.registerExportsForReactRefresh("/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/animation/trigger/in-view.tsx", currentExports);
    import.meta.hot.accept((nextExports) => {
      if (!nextExports) return;
      const invalidateMessage = RefreshRuntime.validateRefreshBoundaryAndEnqueueUpdate("/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/animation/trigger/in-view.tsx", currentExports, nextExports);
      if (invalidateMessage) import.meta.hot.invalidate(invalidateMessage);
    });
  });
}
