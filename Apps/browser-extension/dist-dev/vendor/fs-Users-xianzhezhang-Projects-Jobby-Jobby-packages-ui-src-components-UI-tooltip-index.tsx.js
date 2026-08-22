import { createHotContext as __vite__createHotContext } from "/vendor/vite-client.js";import.meta.hot = __vite__createHotContext("/vendor/fs-Users-xianzhezhang-Projects-Jobby-Jobby-packages-ui-src-components-UI-tooltip-index.tsx.js");import __vite__cjsImport0_react_jsxDevRuntime from "/vendor/.vite-deps-react_jsx-dev-runtime.js__v--f5b0ea50.js"; const jsxDEV = __vite__cjsImport0_react_jsxDevRuntime["jsxDEV"];
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
  window.$RefreshReg$ = RefreshRuntime.getRefreshReg("/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/tooltip/index.tsx");
  window.$RefreshSig$ = RefreshRuntime.createSignatureFunctionForTransform;
}
"use client";
import __vite__cjsImport3_react from "/vendor/.vite-deps-react.js__v--f5b0ea50.js"; const React = ((m) => m?.__esModule ? m : { ...typeof m === "object" && !Array.isArray(m) || typeof m === "function" ? m : {}, default: m })(__vite__cjsImport3_react);
import * as TooltipPrimitive from "/vendor/.vite-deps-@radix-ui_react-tooltip.js__v--7359ebf1.js";
import { cn } from "/vendor/fs-Users-xianzhezhang-Projects-Jobby-Jobby-packages-ui-src-lib-utils.ts.js";
const TooltipProvider = TooltipPrimitive.Provider;
const TooltipRoot = TooltipPrimitive.Root;
const TooltipTrigger = TooltipPrimitive.Trigger;
const style = "z-[9999] break-words rounded-xl bg-panel/95 text-foreground backdrop-blur-xl px-3 py-2 text-xs border border-primary/80 shadow-xl pointer-events-none animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95";
const TooltipContent = React.forwardRef(
  _c = ({ className, sideOffset = 16, ...props }, ref) => /* @__PURE__ */ jsxDEV(TooltipPrimitive.Portal, { children: /* @__PURE__ */ jsxDEV(
    TooltipPrimitive.Content,
    {
      ref,
      sideOffset,
      className: cn(style, className),
      ...props
    },
    void 0,
    false,
    {
      fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/tooltip/index.tsx",
      lineNumber: 40,
      columnNumber: 5
    },
    this
  ) }, void 0, false, {
    fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/tooltip/index.tsx",
    lineNumber: 39,
    columnNumber: 1
  }, this)
);
_c2 = TooltipContent;
TooltipContent.displayName = TooltipPrimitive.Content.displayName;
export function Tooltip({
  content,
  children,
  side = "top",
  size = "md",
  className,
  delay = 50
}) {
  return /* @__PURE__ */ jsxDEV(TooltipProvider, { delayDuration: delay, children: /* @__PURE__ */ jsxDEV(TooltipRoot, { children: [
    /* @__PURE__ */ jsxDEV(TooltipTrigger, { asChild: true, children }, void 0, false, {
      fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/tooltip/index.tsx",
      lineNumber: 71,
      columnNumber: 9
    }, this),
    content && /* @__PURE__ */ jsxDEV(
      TooltipContent,
      {
        side,
        className: cn(
          style,
          className,
          size === "sm" && "max-w-48!",
          size === "md" && "max-w-96!",
          size === "lg" && "max-w-[70vw]!",
          size === "xl" && "max-w-full!"
        ),
        children: content
      },
      void 0,
      false,
      {
        fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/tooltip/index.tsx",
        lineNumber: 73,
        columnNumber: 9
      },
      this
    )
  ] }, void 0, true, {
    fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/tooltip/index.tsx",
    lineNumber: 70,
    columnNumber: 7
  }, this) }, void 0, false, {
    fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/tooltip/index.tsx",
    lineNumber: 69,
    columnNumber: 5
  }, this);
}
_c3 = Tooltip;
export function Kbd({
  children,
  className,
  size = "md"
}) {
  return /* @__PURE__ */ jsxDEV(
    "kbd",
    {
      className: cn(
        "inline-flex items-center justify-center cursor-help rounded border border-primary/80 bg-background-secondary/80 px-1 py-0.5 font-mono text-[9px] font-bold text-ink-primary shadow-xs leading-none select-none ml-1",
        size === "sm" && "text-[8px] px-0.5",
        size === "lg" && "text-[10px] px-1.5",
        size === "xl" && "text-xs px-2",
        className
      ),
      children
    },
    void 0,
    false,
    {
      fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/tooltip/index.tsx",
      lineNumber: 102,
      columnNumber: 5
    },
    this
  );
}
_c4 = Kbd;
export { TooltipRoot, TooltipTrigger, TooltipContent, TooltipProvider };
var _c, _c2, _c3, _c4;
$RefreshReg$(_c, "TooltipContent$React.forwardRef");
$RefreshReg$(_c2, "TooltipContent");
$RefreshReg$(_c3, "Tooltip");
$RefreshReg$(_c4, "Kbd");
if (import.meta.hot && !inWebWorker) {
  window.$RefreshReg$ = prevRefreshReg;
  window.$RefreshSig$ = prevRefreshSig;
}
if (import.meta.hot && !inWebWorker) {
  RefreshRuntime.__hmr_import(import.meta.url).then((currentExports) => {
    RefreshRuntime.registerExportsForReactRefresh("/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/tooltip/index.tsx", currentExports);
    import.meta.hot.accept((nextExports) => {
      if (!nextExports) return;
      const invalidateMessage = RefreshRuntime.validateRefreshBoundaryAndEnqueueUpdate("/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/tooltip/index.tsx", currentExports, nextExports);
      if (invalidateMessage) import.meta.hot.invalidate(invalidateMessage);
    });
  });
}
