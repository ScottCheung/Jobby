import { createHotContext as __vite__createHotContext } from "/vendor/vite-client.js";import.meta.hot = __vite__createHotContext("/vendor/fs-Users-xianzhezhang-Projects-Jobby-Jobby-packages-ui-src-components-UI-Button-button.tsx.js");import __vite__cjsImport0_react_jsxDevRuntime from "/vendor/.vite-deps-react_jsx-dev-runtime.js__v--22c5bc1a.js"; const jsxDEV = __vite__cjsImport0_react_jsxDevRuntime["jsxDEV"];
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
  window.$RefreshReg$ = RefreshRuntime.getRefreshReg("/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Button/button.tsx");
  window.$RefreshSig$ = RefreshRuntime.createSignatureFunctionForTransform;
}
"use client";
var _s = $RefreshSig$();
import __vite__cjsImport3_react from "/vendor/.vite-deps-react.js__v--22c5bc1a.js"; const React = ((m) => m?.__esModule ? m : { ...typeof m === "object" && !Array.isArray(m) || typeof m === "function" ? m : {}, default: m })(__vite__cjsImport3_react);
import { cva } from "/vendor/.vite-deps-class-variance-authority.js__v--22c5bc1a.js";
import { motion } from "/vendor/.vite-deps-framer-motion.js__v--22c5bc1a.js";
import { cn } from "/vendor/fs-Users-xianzhezhang-Projects-Jobby-Jobby-packages-ui-src-lib-utils.ts.js";
import { Loader2 } from "/vendor/.vite-deps-lucide-react.js__v--22c5bc1a.js";
const MIN_LOADING_MS = 200;
const buttonVariants = cva(
  "inline-flex items-center gap-3 p-1 justify-center whitespace-nowrap rounded-full transition-all focus-visible:outline-none duration-200 focus-visible:ring-2 focus-visible:ring-primary disabled:pointer-events-none disabled:opacity-50 active:scale-95 cursor-pointer",
  {
    variants: {
      variant: {
        custom: "",
        default: "bg-primary-gradient hover:bg-primary text-primary-foreground ",
        secondary: "border border-transparent hover:bg-primary/5 backdrop-blur-[20px]  bg-background text-ink-primary hover:text-primary",
        destructive: "bg-destructive  hover:bg-destructive/80 text-destructive-foreground",
        outline: "border border-primary  text-primary hover:bg-primary  hover:text-primary-foreground",
        icon: "bg-glass text-ink-secondary hover:bg-primary-gradient hover:text-primary-foreground rounded-full ",
        iconActive: "hover:bg-glass text-ink-secondary bg-primary-gradient hover:text-primary-foreground rounded-full ",
        ghost: "text-ink-primary bg-ink-secondary/50 hover:bg-primary-gradient hover:text-primary-foreground",
        link: "text-primary underline-offset-4 hover:underline",
        toolbar: "text-ink-secondary hover:text-ink-primary hover:bg-primary/10  rounded-full   active:scale-95 disabled:opacity-40 disabled:scale-100 disabled:cursor-not-allowed",
        toolbarActive: "text-primary hover:bg-primary/20 rounded-full text-primary  active:scale-95 disabled:opacity-40 disabled:scale-100 disabled:cursor-not-allowed"
      },
      size: {
        link: "p-0",
        sm: "h-[30px] px-3 font-semibold",
        md: "h-[40px] pl-3 pr-4 font-semibold",
        icon: "h-[40px] w-[40px] shrink-0",
        default: "h-[48px] px-6 py-2 font-semibold",
        lg: "title-card h-[52px] px-6 uppercase italic",
        WithIcons: "p-1",
        toolbar: "p-3 h-auto ",
        toolbarSm: "px-3 py-1.5 h-auto "
      }
    },
    defaultVariants: {
      variant: "default",
      size: "default"
    }
  }
);
const Button = _s(React.forwardRef(
  _c = _s(
    ({
      className,
      variant,
      size,
      asChild = false,
      Icon,
      icon,
      iconPosition,
      iconPlacement,
      iconClassName,
      children,
      isLoading = false,
      layoutId,
      ...props
    }, ref) => {
      _s();
      const rawIcon = Icon ?? icon;
      const effectiveIconPosition = iconPosition || iconPlacement || "left";
      const hasIcon = Boolean(rawIcon);
      const hasChildren = children !== void 0 && children !== null && children !== "";
      const resolvedVariant = variant || (hasIcon && !hasChildren ? "icon" : void 0);
      const resolvedSize = size || (hasIcon && !hasChildren ? "icon" : void 0);
      const [latch, setLatch] = React.useState(false);
      const timerRef = React.useRef(null);
      React.useEffect(() => {
        if (isLoading) {
          if (timerRef.current) clearTimeout(timerRef.current);
          setLatch(true);
        } else {
          timerRef.current = setTimeout(() => {
            setLatch(false);
          }, MIN_LOADING_MS);
        }
        return () => {
          if (timerRef.current) clearTimeout(timerRef.current);
        };
      }, [isLoading]);
      const displayLoading = isLoading || latch;
      const renderIconNode = () => {
        if (!rawIcon) return null;
        if (React.isValidElement(rawIcon)) {
          return rawIcon;
        }
        if (typeof rawIcon === "function" || typeof rawIcon === "object" && rawIcon !== null) {
          const IconComponent = rawIcon;
          return /* @__PURE__ */ jsxDEV(IconComponent, { className: cn("size-4 shrink-0", iconClassName) }, void 0, false, {
            fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Button/button.tsx",
            lineNumber: 159,
            columnNumber: 11
          }, this);
        }
        return null;
      };
      return /* @__PURE__ */ jsxDEV(
        motion.button,
        {
          layoutId,
          transition: {
            type: "spring",
            duration: 0.7,
            bounce: 0.2,
            ease: [0.22, 1, 0.36, 1]
          },
          className: cn(
            buttonVariants({
              variant: resolvedVariant,
              size: resolvedSize,
              className
            }),
            "relative",
            displayLoading && "cursor-not-allowed opacity-50"
          ),
          style: layoutId ? {
            transition: "none"
          } : void 0,
          ref,
          ...props,
          children: [
            /* @__PURE__ */ jsxDEV(
              "span",
              {
                className: cn(
                  "inline-flex items-center justify-center gap-2",
                  displayLoading && "opacity-0"
                ),
                children: [
                  effectiveIconPosition === "left" && renderIconNode(),
                  resolvedVariant !== "icon" && resolvedVariant !== "iconActive" && children,
                  effectiveIconPosition === "right" && renderIconNode()
                ]
              },
              void 0,
              true,
              {
                fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Button/button.tsx",
                lineNumber: 193,
                columnNumber: 9
              },
              this
            ),
            displayLoading && /* @__PURE__ */ jsxDEV(Loader2, { className: "size-5 animate-spin absolute" }, void 0, false, {
              fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Button/button.tsx",
              lineNumber: 205,
              columnNumber: 28
            }, this)
          ]
        },
        void 0,
        true,
        {
          fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Button/button.tsx",
          lineNumber: 166,
          columnNumber: 7
        },
        this
      );
    },
    "oOvZG4iPqtnsY7Oe6VTIy2QNWy0="
  )
), "oOvZG4iPqtnsY7Oe6VTIy2QNWy0=");
_c2 = Button;
Button.displayName = "Button";
export { Button, buttonVariants };
var _c, _c2;
$RefreshReg$(_c, "Button$React.forwardRef");
$RefreshReg$(_c2, "Button");
if (import.meta.hot && !inWebWorker) {
  window.$RefreshReg$ = prevRefreshReg;
  window.$RefreshSig$ = prevRefreshSig;
}
if (import.meta.hot && !inWebWorker) {
  RefreshRuntime.__hmr_import(import.meta.url).then((currentExports) => {
    RefreshRuntime.registerExportsForReactRefresh("/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Button/button.tsx", currentExports);
    import.meta.hot.accept((nextExports) => {
      if (!nextExports) return;
      const invalidateMessage = RefreshRuntime.validateRefreshBoundaryAndEnqueueUpdate("/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Button/button.tsx", currentExports, nextExports);
      if (invalidateMessage) import.meta.hot.invalidate(invalidateMessage);
    });
  });
}
