import { createHotContext as __vite__createHotContext } from "/vendor/vite-client.js";import.meta.hot = __vite__createHotContext("/vendor/fs-Users-xianzhezhang-Projects-Jobby-Jobby-packages-ui-src-components-animation-transition-slide.tsx.js");import __vite__cjsImport0_react_jsxDevRuntime from "/vendor/.vite-deps-react_jsx-dev-runtime.js__v--f5b0ea50.js"; const jsxDEV = __vite__cjsImport0_react_jsxDevRuntime["jsxDEV"];
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
  window.$RefreshReg$ = RefreshRuntime.getRefreshReg("/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/animation/transition/slide.tsx");
  window.$RefreshSig$ = RefreshRuntime.createSignatureFunctionForTransform;
}
"use client";
import { motion, AnimatePresence } from "/vendor/.vite-deps-framer-motion.js__v--788107dc.js";
import { cn } from "/vendor/fs-Users-xianzhezhang-Projects-Jobby-Jobby-packages-ui-src-lib-utils.ts.js";
export function Slide({
  show,
  children,
  className,
  direction = "left",
  offset = "100%",
  duration = 0.3,
  ...props
}) {
  const getInitial = () => {
    switch (direction) {
      case "left":
        return { x: typeof offset === "number" ? -offset : `-${offset}` };
      case "right":
        return { x: offset };
      case "top":
        return { y: typeof offset === "number" ? -offset : `-${offset}` };
      case "bottom":
        return { y: offset };
    }
  };
  const variants = {
    hidden: {
      ...getInitial(),
      opacity: 0
    },
    visible: {
      x: 0,
      y: 0,
      opacity: 1,
      transition: {
        type: "spring",
        damping: 25,
        stiffness: 300,
        duration
      }
    },
    exit: {
      ...getInitial(),
      opacity: 0,
      transition: {
        duration: duration * 0.8,
        ease: "easeInOut"
      }
    }
  };
  if (show !== void 0) {
    return /* @__PURE__ */ jsxDEV(AnimatePresence, { mode: "wait", children: show && /* @__PURE__ */ jsxDEV(
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
        fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/animation/transition/slide.tsx",
        lineNumber: 94,
        columnNumber: 9
      },
      this
    ) }, void 0, false, {
      fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/animation/transition/slide.tsx",
      lineNumber: 92,
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
      fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/animation/transition/slide.tsx",
      lineNumber: 110,
      columnNumber: 5
    },
    this
  );
}
_c = Slide;
var _c;
$RefreshReg$(_c, "Slide");
if (import.meta.hot && !inWebWorker) {
  window.$RefreshReg$ = prevRefreshReg;
  window.$RefreshSig$ = prevRefreshSig;
}
if (import.meta.hot && !inWebWorker) {
  RefreshRuntime.__hmr_import(import.meta.url).then((currentExports) => {
    RefreshRuntime.registerExportsForReactRefresh("/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/animation/transition/slide.tsx", currentExports);
    import.meta.hot.accept((nextExports) => {
      if (!nextExports) return;
      const invalidateMessage = RefreshRuntime.validateRefreshBoundaryAndEnqueueUpdate("/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/animation/transition/slide.tsx", currentExports, nextExports);
      if (invalidateMessage) import.meta.hot.invalidate(invalidateMessage);
    });
  });
}
