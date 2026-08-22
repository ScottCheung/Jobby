import { createHotContext as __vite__createHotContext } from "/vendor/vite-client.js";import.meta.hot = __vite__createHotContext("/vendor/fs-Users-xianzhezhang-Projects-Jobby-Jobby-packages-ui-src-components-animation-container-stagger.tsx.js");import __vite__cjsImport0_react_jsxDevRuntime from "/vendor/.vite-deps-react_jsx-dev-runtime.js__v--f5b0ea50.js"; const jsxDEV = __vite__cjsImport0_react_jsxDevRuntime["jsxDEV"];
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
  window.$RefreshReg$ = RefreshRuntime.getRefreshReg("/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/animation/container/stagger.tsx");
  window.$RefreshSig$ = RefreshRuntime.createSignatureFunctionForTransform;
}
"use client";
import { motion } from "/vendor/.vite-deps-framer-motion.js__v--788107dc.js";
import { cn } from "/vendor/fs-Users-xianzhezhang-Projects-Jobby-Jobby-packages-ui-src-lib-utils.ts.js";
const staggerVariants = (staggerDelay, delayChildren) => ({
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: staggerDelay,
      delayChildren
    }
  }
});
export function Stagger({
  children,
  className,
  staggerDelay = 0.07,
  delayChildren = 0,
  animateOnMount = false,
  variants,
  ...props
}) {
  return /* @__PURE__ */ jsxDEV(
    motion.div,
    {
      initial: "hidden",
      ...animateOnMount ? { animate: "visible" } : {
        whileInView: "visible",
        viewport: { once: true }
      },
      variants: variants || staggerVariants(staggerDelay, delayChildren),
      className: cn(className),
      ...props,
      children
    },
    void 0,
    false,
    {
      fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/animation/container/stagger.tsx",
      lineNumber: 56,
      columnNumber: 5
    },
    this
  );
}
_c = Stagger;
const itemVariants = (y, x) => ({
  hidden: {
    opacity: 0,
    y,
    x
    // filter: 'blur(4px)',
  },
  visible: {
    opacity: 1,
    y: 0,
    x: 0,
    // filter: 'blur(0px)',
    transition: {
      opacity: { duration: 0.9, ease: "easeInOut" },
      filter: { duration: 0.7, ease: "easeInOut" },
      y: { duration: 0.7, ease: "easeInOut" },
      x: { duration: 0.7, ease: "easeInOut" }
    }
  }
});
export function StaggerItem({
  children,
  className,
  yOffset = 0,
  xOffset = 0,
  variants,
  ...props
}) {
  return /* @__PURE__ */ jsxDEV(
    motion.div,
    {
      variants: variants || itemVariants(yOffset, xOffset),
      className: cn(className),
      ...props,
      children
    },
    void 0,
    false,
    {
      fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/animation/container/stagger.tsx",
      lineNumber: 108,
      columnNumber: 5
    },
    this
  );
}
_c2 = StaggerItem;
var _c, _c2;
$RefreshReg$(_c, "Stagger");
$RefreshReg$(_c2, "StaggerItem");
if (import.meta.hot && !inWebWorker) {
  window.$RefreshReg$ = prevRefreshReg;
  window.$RefreshSig$ = prevRefreshSig;
}
if (import.meta.hot && !inWebWorker) {
  RefreshRuntime.__hmr_import(import.meta.url).then((currentExports) => {
    RefreshRuntime.registerExportsForReactRefresh("/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/animation/container/stagger.tsx", currentExports);
    import.meta.hot.accept((nextExports) => {
      if (!nextExports) return;
      const invalidateMessage = RefreshRuntime.validateRefreshBoundaryAndEnqueueUpdate("/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/animation/container/stagger.tsx", currentExports, nextExports);
      if (invalidateMessage) import.meta.hot.invalidate(invalidateMessage);
    });
  });
}
