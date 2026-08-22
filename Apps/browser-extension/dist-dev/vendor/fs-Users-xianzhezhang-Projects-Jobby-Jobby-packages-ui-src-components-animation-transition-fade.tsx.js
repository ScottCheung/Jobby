import { createHotContext as __vite__createHotContext } from "/vendor/vite-client.js";import.meta.hot = __vite__createHotContext("/vendor/fs-Users-xianzhezhang-Projects-Jobby-Jobby-packages-ui-src-components-animation-transition-fade.tsx.js");import __vite__cjsImport0_react_jsxDevRuntime from "/vendor/.vite-deps-react_jsx-dev-runtime.js__v--f5b0ea50.js"; const jsxDEV = __vite__cjsImport0_react_jsxDevRuntime["jsxDEV"];
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
  window.$RefreshReg$ = RefreshRuntime.getRefreshReg("/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/animation/transition/fade.tsx");
  window.$RefreshSig$ = RefreshRuntime.createSignatureFunctionForTransform;
}
"use client";
import { motion, AnimatePresence } from "/vendor/.vite-deps-framer-motion.js__v--788107dc.js";
import { cn } from "/vendor/fs-Users-xianzhezhang-Projects-Jobby-Jobby-packages-ui-src-lib-utils.ts.js";
export function Fade({
  show,
  children,
  className,
  blur = false,
  yOffset = 0,
  xOffset = 0,
  duration = 0.4,
  delay = 0,
  ...props
}) {
  const blurValue = typeof blur === "number" ? blur : blur ? 8 : 0;
  const variants = {
    hidden: {
      opacity: 0,
      y: yOffset,
      x: xOffset,
      filter: blurValue ? `blur(${blurValue}px)` : void 0
    },
    visible: {
      opacity: 1,
      y: 0,
      x: 0,
      filter: "blur(0px)",
      transition: {
        duration,
        delay,
        ease: [0.22, 1, 0.36, 1]
      }
    },
    exit: {
      opacity: 0,
      y: yOffset,
      x: xOffset,
      filter: blurValue ? `blur(${blurValue}px)` : void 0,
      transition: {
        duration: duration * 0.75,
        ease: [0.22, 1, 0.36, 1]
      }
    }
  };
  if (show !== void 0) {
    return /* @__PURE__ */ jsxDEV(AnimatePresence, { children: show && /* @__PURE__ */ jsxDEV(
      motion.div,
      {
        initial: "hidden",
        animate: "visible",
        exit: "exit",
        variants,
        className: cn(className),
        ...props,
        children
      },
      void 0,
      false,
      {
        fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/animation/transition/fade.tsx",
        lineNumber: 95,
        columnNumber: 9
      },
      this
    ) }, void 0, false, {
      fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/animation/transition/fade.tsx",
      lineNumber: 93,
      columnNumber: 7
    }, this);
  }
  return /* @__PURE__ */ jsxDEV(
    motion.div,
    {
      initial: "hidden",
      animate: "visible",
      exit: "exit",
      variants,
      className: cn(className),
      ...props,
      children
    },
    void 0,
    false,
    {
      fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/animation/transition/fade.tsx",
      lineNumber: 112,
      columnNumber: 5
    },
    this
  );
}
_c = Fade;
var _c;
$RefreshReg$(_c, "Fade");
if (import.meta.hot && !inWebWorker) {
  window.$RefreshReg$ = prevRefreshReg;
  window.$RefreshSig$ = prevRefreshSig;
}
if (import.meta.hot && !inWebWorker) {
  RefreshRuntime.__hmr_import(import.meta.url).then((currentExports) => {
    RefreshRuntime.registerExportsForReactRefresh("/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/animation/transition/fade.tsx", currentExports);
    import.meta.hot.accept((nextExports) => {
      if (!nextExports) return;
      const invalidateMessage = RefreshRuntime.validateRefreshBoundaryAndEnqueueUpdate("/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/animation/transition/fade.tsx", currentExports, nextExports);
      if (invalidateMessage) import.meta.hot.invalidate(invalidateMessage);
    });
  });
}
