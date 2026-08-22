import { createHotContext as __vite__createHotContext } from "/vendor/vite-client.js";import.meta.hot = __vite__createHotContext("/vendor/fs-Users-xianzhezhang-Projects-Jobby-Jobby-packages-ui-src-components-UI-input-index.tsx.js");import __vite__cjsImport0_react_jsxDevRuntime from "/vendor/.vite-deps-react_jsx-dev-runtime.js__v--f5b0ea50.js"; const jsxDEV = __vite__cjsImport0_react_jsxDevRuntime["jsxDEV"];
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
  window.$RefreshReg$ = RefreshRuntime.getRefreshReg("/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/input/index.tsx");
  window.$RefreshSig$ = RefreshRuntime.createSignatureFunctionForTransform;
}
"use client";
var _s = $RefreshSig$(), _s2 = $RefreshSig$();
import __vite__cjsImport3_react from "/vendor/.vite-deps-react.js__v--f5b0ea50.js"; const React = ((m) => m?.__esModule ? m : { ...typeof m === "object" && !Array.isArray(m) || typeof m === "function" ? m : {}, default: m })(__vite__cjsImport3_react);
import { ClipboardPaste, X, Eye, EyeOff } from "/vendor/.vite-deps-lucide-react.js__v--d47d6985.js";
import { cn } from "/vendor/fs-Users-xianzhezhang-Projects-Jobby-Jobby-packages-ui-src-lib-utils.ts.js";
import { LabelWithHelp } from "/vendor/fs-Users-xianzhezhang-Projects-Jobby-Jobby-packages-ui-src-components-UI-label-with-help.tsx.js";
import { Tooltip } from "/vendor/fs-Users-xianzhezhang-Projects-Jobby-Jobby-packages-ui-src-components-UI-tooltip-index.tsx.js";
import { Error } from "/vendor/fs-Users-xianzhezhang-Projects-Jobby-Jobby-packages-ui-src-components-UI-text-typography.tsx.js";
const Input = _s(React.forwardRef(
  _c = _s(
    ({ className, type, icon: Icon, rightElement, ...props }, ref) => {
      _s();
      const isPassword = type === "password";
      const [showPassword, setShowPassword] = React.useState(false);
      const resolvedType = isPassword ? showPassword ? "text" : "password" : type;
      return /* @__PURE__ */ jsxDEV("div", { className: "relative w-full flex items-center", children: [
        Icon && /* @__PURE__ */ jsxDEV(Icon, { className: "absolute left-4 top-1/2 size-4 -translate-y-1/2 text-ink-secondary group-hover:text-primary transition-colors pointer-events-none z-10" }, void 0, false, {
          fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/input/index.tsx",
          lineNumber: 49,
          columnNumber: 9
        }, this),
        /* @__PURE__ */ jsxDEV(
          "input",
          {
            type: resolvedType,
            className: cn(
              "relative flex w-full items-center h-11 p-1 pl-4 pr-3 text-sm select-none",
              "rounded-full border transition-colors duration-200 outline-none",
              "bg-glass dark:bg-black/20 hover:bg-panel/50 focus:bg-background-primary",
              "border-transparent hover:border-primary/50 focus:border-primary",
              "text-ink-primary placeholder:text-ink-secondary/60",
              "disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none",
              Icon && "!pl-11",
              (rightElement || isPassword) && "!pr-12",
              className
            ),
            ref,
            ...props
          },
          void 0,
          false,
          {
            fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/input/index.tsx",
            lineNumber: 51,
            columnNumber: 9
          },
          this
        ),
        (rightElement || isPassword) && /* @__PURE__ */ jsxDEV("div", { className: "absolute right-1 top-1/2 -translate-y-1/2 flex items-center gap-1 z-20", children: [
          rightElement,
          isPassword && /* @__PURE__ */ jsxDEV(
            Tooltip,
            {
              content: showPassword ? "Hide password" : "Show password",
              side: "top",
              children: /* @__PURE__ */ jsxDEV(
                "button",
                {
                  type: "button",
                  onClick: () => setShowPassword(!showPassword),
                  className: "flex items-center justify-center size-9 rounded-full bg-background-secondary/60 hover:bg-background-secondary dark:bg-white/5 dark:hover:bg-white/10 text-ink-secondary hover:text-ink-primary transition-colors shrink-0 cursor-pointer",
                  "aria-label": showPassword ? "Hide password" : "Show password",
                  children: showPassword ? /* @__PURE__ */ jsxDEV(EyeOff, { className: "h-4 w-4" }, void 0, false, {
                    fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/input/index.tsx",
                    lineNumber: 82,
                    columnNumber: 15
                  }, this) : /* @__PURE__ */ jsxDEV(Eye, { className: "h-4 w-4" }, void 0, false, {
                    fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/input/index.tsx",
                    lineNumber: 83,
                    columnNumber: 15
                  }, this)
                },
                void 0,
                false,
                {
                  fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/input/index.tsx",
                  lineNumber: 75,
                  columnNumber: 17
                },
                this
              )
            },
            void 0,
            false,
            {
              fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/input/index.tsx",
              lineNumber: 71,
              columnNumber: 11
            },
            this
          )
        ] }, void 0, true, {
          fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/input/index.tsx",
          lineNumber: 68,
          columnNumber: 9
        }, this)
      ] }, void 0, true, {
        fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/input/index.tsx",
        lineNumber: 47,
        columnNumber: 7
      }, this);
    },
    "daguiRHWMFkqPgCh/ppD7CF5VuQ="
  )
), "daguiRHWMFkqPgCh/ppD7CF5VuQ=");
_c2 = Input;
Input.displayName = "Input";
const InputField = _s2(React.forwardRef(
  _c3 = _s2(
    ({
      label,
      icon: Icon,
      containerClassName,
      className,
      error,
      showCharCount = true,
      maxLength,
      onChange,
      onBlur,
      helpTextShort,
      helpTextLong,
      required,
      optional,
      value,
      defaultValue,
      showClear,
      showPaste,
      rightElement,
      type,
      ...props
    }, ref) => {
      _s2();
      const isPassword = type === "password";
      const [showPassword, setShowPassword] = React.useState(false);
      const resolvedType = isPassword ? showPassword ? "text" : "password" : type;
      const enableClear = showClear !== void 0 ? showClear : !isPassword;
      const enablePaste = showPaste !== void 0 ? showPaste : !isPassword;
      const [internalValue, setInternalValue] = React.useState(
        value || defaultValue || ""
      );
      const inputRef = React.useRef(null);
      React.useEffect(() => {
        if (value !== void 0) {
          setInternalValue(value);
        }
      }, [value]);
      const currentLength = internalValue.length;
      const hasValue = currentLength > 0;
      const isExceeded = maxLength ? currentLength > maxLength : false;
      const handleChange = (e) => {
        if (value === void 0) {
          setInternalValue(e.target.value);
        }
        onChange?.(e);
      };
      const handleClear = () => {
        if (inputRef.current) {
          const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
            window.HTMLInputElement.prototype,
            "value"
          )?.set;
          nativeInputValueSetter?.call(inputRef.current, "");
          const event = new Event("input", { bubbles: true });
          inputRef.current.dispatchEvent(event);
          if (value === void 0) {
            setInternalValue("");
          }
          inputRef.current.focus();
        }
      };
      const handlePaste = async () => {
        if (!inputRef.current || !navigator.clipboard?.readText) return;
        try {
          const pastedValue = await navigator.clipboard.readText();
          if (!pastedValue) return;
          const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
            window.HTMLInputElement.prototype,
            "value"
          )?.set;
          nativeInputValueSetter?.call(inputRef.current, pastedValue);
          inputRef.current.dispatchEvent(new Event("input", { bubbles: true }));
          if (value === void 0) setInternalValue(pastedValue);
          inputRef.current.focus();
        } catch {
        }
      };
      const hasRightActions = Boolean(rightElement) || isPassword || enableClear && hasValue && !props.disabled && !props.readOnly || enablePaste && !hasValue && !props.disabled && !props.readOnly;
      const actionCount = (rightElement ? 1 : 0) + (isPassword ? 1 : 0) + (enableClear && hasValue || enablePaste && !hasValue ? 1 : 0);
      const isError = Boolean(error || isExceeded);
      return /* @__PURE__ */ jsxDEV(
        "div",
        {
          className: cn(
            "relative w-full transition-none group",
            containerClassName
          ),
          children: [
            label && /* @__PURE__ */ jsxDEV("div", { className: "flex justify-between items-center", children: [
              /* @__PURE__ */ jsxDEV(
                LabelWithHelp,
                {
                  label,
                  helpTextShort,
                  helpTextLong,
                  required,
                  optional
                },
                void 0,
                false,
                {
                  fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/input/index.tsx",
                  lineNumber: 230,
                  columnNumber: 13
                },
                this
              ),
              showCharCount && maxLength && /* @__PURE__ */ jsxDEV(
                "p",
                {
                  className: cn(
                    "body-sm transition-colors",
                    isExceeded ? "text-red-500 dark:text-red-400 font-medium" : "text-gray-400 dark:text-ink-secondary"
                  ),
                  children: [
                    currentLength,
                    " / ",
                    maxLength
                  ]
                },
                void 0,
                true,
                {
                  fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/input/index.tsx",
                  lineNumber: 238,
                  columnNumber: 11
                },
                this
              )
            ] }, void 0, true, {
              fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/input/index.tsx",
              lineNumber: 229,
              columnNumber: 9
            }, this),
            /* @__PURE__ */ jsxDEV("div", { className: cn("relative w-full transition-none", label && "mt-2"), children: [
              Icon && /* @__PURE__ */ jsxDEV(Icon, { className: "absolute left-4 top-1/2 size-4 -translate-y-1/2 text-ink-secondary group-hover:text-primary transition-colors pointer-events-none z-10" }, void 0, false, {
                fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/input/index.tsx",
                lineNumber: 254,
                columnNumber: 11
              }, this),
              /* @__PURE__ */ jsxDEV(
                "input",
                {
                  type: resolvedType,
                  ref: (node) => {
                    inputRef.current = node;
                    if (typeof ref === "function") {
                      ref(node);
                    } else if (ref) {
                      ref.current = node;
                    }
                  },
                  className: cn(
                    "relative flex w-full items-center h-11 p-1 pl-4 text-sm select-none",
                    "rounded-full border border-transparent transition-colors duration-200 outline-none",
                    "bg-glass dark:bg-black/20 hover:bg-panel/50 focus:bg-background-primary",
                    isError ? "border-red-500 focus:border-red-500 text-red-600 dark:text-red-400" : "border-transparent hover:border-primary/50 focus:border-primary",
                    "text-ink-primary placeholder:text-ink-secondary/60",
                    "disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none",
                    Icon && "!pl-11",
                    actionCount >= 2 ? "!pr-22" : hasRightActions ? "!pr-12" : "!pr-4",
                    className
                  ),
                  onChange: handleChange,
                  onBlur,
                  value,
                  defaultValue,
                  ...props
                },
                void 0,
                false,
                {
                  fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/input/index.tsx",
                  lineNumber: 257,
                  columnNumber: 11
                },
                this
              ),
              hasRightActions && /* @__PURE__ */ jsxDEV("div", { className: "absolute right-1 top-1/2 -translate-y-1/2 flex items-center gap-1 z-20", children: [
                rightElement,
                isPassword && /* @__PURE__ */ jsxDEV(
                  Tooltip,
                  {
                    content: showPassword ? "Hide password" : "Show password",
                    side: "top",
                    children: /* @__PURE__ */ jsxDEV(
                      "button",
                      {
                        type: "button",
                        onClick: () => setShowPassword(!showPassword),
                        className: "flex items-center justify-center size-9 rounded-full bg-background-secondary/60 hover:bg-background-secondary dark:bg-white/5 dark:hover:bg-white/10 text-ink-secondary hover:text-ink-primary transition-colors shrink-0 cursor-pointer",
                        "aria-label": showPassword ? "Hide password" : "Show password",
                        children: showPassword ? /* @__PURE__ */ jsxDEV(EyeOff, { className: "h-4 w-4" }, void 0, false, {
                          fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/input/index.tsx",
                          lineNumber: 306,
                          columnNumber: 17
                        }, this) : /* @__PURE__ */ jsxDEV(Eye, { className: "h-4 w-4" }, void 0, false, {
                          fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/input/index.tsx",
                          lineNumber: 307,
                          columnNumber: 17
                        }, this)
                      },
                      void 0,
                      false,
                      {
                        fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/input/index.tsx",
                        lineNumber: 297,
                        columnNumber: 19
                      },
                      this
                    )
                  },
                  void 0,
                  false,
                  {
                    fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/input/index.tsx",
                    lineNumber: 293,
                    columnNumber: 13
                  },
                  this
                ),
                enableClear && hasValue && !props.disabled && !props.readOnly && /* @__PURE__ */ jsxDEV(Tooltip, { content: "Clear", side: "top", children: /* @__PURE__ */ jsxDEV(
                  "button",
                  {
                    type: "button",
                    onClick: handleClear,
                    className: "flex items-center justify-center size-9 rounded-full bg-background-secondary/60 hover:bg-background-secondary dark:bg-white/5 dark:hover:bg-white/10 text-ink-secondary hover:text-ink-primary transition-colors shrink-0 cursor-pointer",
                    "aria-label": "Clear input",
                    children: /* @__PURE__ */ jsxDEV(X, { className: "h-4 w-4" }, void 0, false, {
                      fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/input/index.tsx",
                      lineNumber: 322,
                      columnNumber: 23
                    }, this)
                  },
                  void 0,
                  false,
                  {
                    fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/input/index.tsx",
                    lineNumber: 316,
                    columnNumber: 21
                  },
                  this
                ) }, void 0, false, {
                  fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/input/index.tsx",
                  lineNumber: 315,
                  columnNumber: 13
                }, this),
                enablePaste && !hasValue && !props.disabled && !props.readOnly && /* @__PURE__ */ jsxDEV(Tooltip, { content: "Paste from clipboard", side: "top", children: /* @__PURE__ */ jsxDEV(
                  "button",
                  {
                    type: "button",
                    onClick: () => void handlePaste(),
                    className: "flex items-center justify-center size-9 rounded-full bg-background-secondary/60 hover:bg-background-secondary dark:bg-white/5 dark:hover:bg-white/10 text-ink-secondary hover:text-primary transition-colors shrink-0 cursor-pointer",
                    "aria-label": "Paste from clipboard",
                    children: /* @__PURE__ */ jsxDEV(ClipboardPaste, { className: "h-4 w-4" }, void 0, false, {
                      fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/input/index.tsx",
                      lineNumber: 337,
                      columnNumber: 23
                    }, this)
                  },
                  void 0,
                  false,
                  {
                    fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/input/index.tsx",
                    lineNumber: 331,
                    columnNumber: 21
                  },
                  this
                ) }, void 0, false, {
                  fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/input/index.tsx",
                  lineNumber: 330,
                  columnNumber: 13
                }, this)
              ] }, void 0, true, {
                fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/input/index.tsx",
                lineNumber: 290,
                columnNumber: 11
              }, this)
            ] }, void 0, true, {
              fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/input/index.tsx",
              lineNumber: 252,
              columnNumber: 9
            }, this),
            (error || isExceeded) && /* @__PURE__ */ jsxDEV("div", { className: "flex items-center justify-between mt-1", children: /* @__PURE__ */ jsxDEV(Error, { children: error || isExceeded && `Exceeds maximum length by ${currentLength - (maxLength || 0)} characters` }, void 0, false, {
              fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/input/index.tsx",
              lineNumber: 347,
              columnNumber: 13
            }, this) }, void 0, false, {
              fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/input/index.tsx",
              lineNumber: 346,
              columnNumber: 9
            }, this)
          ]
        },
        void 0,
        true,
        {
          fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/input/index.tsx",
          lineNumber: 222,
          columnNumber: 7
        },
        this
      );
    },
    "I4+7L4jI9geP1/u1/AhTuhbDDag="
  )
), "I4+7L4jI9geP1/u1/AhTuhbDDag=");
_c4 = InputField;
InputField.displayName = "InputField";
export { InputField, Input };
var _c, _c2, _c3, _c4;
$RefreshReg$(_c, "Input$React.forwardRef");
$RefreshReg$(_c2, "Input");
$RefreshReg$(_c3, "InputField$React.forwardRef");
$RefreshReg$(_c4, "InputField");
if (import.meta.hot && !inWebWorker) {
  window.$RefreshReg$ = prevRefreshReg;
  window.$RefreshSig$ = prevRefreshSig;
}
if (import.meta.hot && !inWebWorker) {
  RefreshRuntime.__hmr_import(import.meta.url).then((currentExports) => {
    RefreshRuntime.registerExportsForReactRefresh("/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/input/index.tsx", currentExports);
    import.meta.hot.accept((nextExports) => {
      if (!nextExports) return;
      const invalidateMessage = RefreshRuntime.validateRefreshBoundaryAndEnqueueUpdate("/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/input/index.tsx", currentExports, nextExports);
      if (invalidateMessage) import.meta.hot.invalidate(invalidateMessage);
    });
  });
}
