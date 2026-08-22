import {
  require_react_dom
} from "/vendor/.vite-deps-chunk-MUB6OXK6.js__v--22c5bc1a.js";
import {
  require_jsx_runtime
} from "/vendor/.vite-deps-chunk-IGPIJZJ5.js__v--22c5bc1a.js";
import {
  require_react
} from "/vendor/.vite-deps-chunk-USTO3F3J.js__v--22c5bc1a.js";
import {
  __toESM
} from "/vendor/.vite-deps-chunk-SNAQBZPT.js__v--22c5bc1a.js";

// ../../packages/ui/node_modules/@radix-ui/primitive/dist/index.mjs
var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });
var canUseDOM = !!(typeof window !== "undefined" && window.document && window.document.createElement);
function composeEventHandlers(originalEventHandler, ourEventHandler, { checkForDefaultPrevented = true } = {}) {
  return __name(function handleEvent(event) {
    originalEventHandler == null ? void 0 : originalEventHandler(event);
    if (checkForDefaultPrevented === false || !event || !event.defaultPrevented) {
      return ourEventHandler == null ? void 0 : ourEventHandler(event);
    }
  }, "handleEvent");
}
__name(composeEventHandlers, "composeEventHandlers");
function getOwnerWindow(element) {
  var _a;
  if (!canUseDOM) {
    throw new Error("Cannot access window outside of the DOM");
  }
  return ((_a = element == null ? void 0 : element.ownerDocument) == null ? void 0 : _a.defaultView) ?? window;
}
__name(getOwnerWindow, "getOwnerWindow");
function getOwnerDocument(element) {
  if (!canUseDOM) {
    throw new Error("Cannot access document outside of the DOM");
  }
  return (element == null ? void 0 : element.ownerDocument) ?? document;
}
__name(getOwnerDocument, "getOwnerDocument");
function getActiveElement(node, activeDescendant = false) {
  const { activeElement } = getOwnerDocument(node);
  if (!(activeElement == null ? void 0 : activeElement.nodeName)) {
    return null;
  }
  if (isFrame(activeElement) && activeElement.contentDocument) {
    return getActiveElement(activeElement.contentDocument.body, activeDescendant);
  }
  if (activeDescendant) {
    const id = activeElement.getAttribute("aria-activedescendant");
    if (id) {
      const element = getOwnerDocument(activeElement).getElementById(id);
      if (element) {
        return element;
      }
    }
  }
  return activeElement;
}
__name(getActiveElement, "getActiveElement");
function isFrame(element) {
  return element.tagName === "IFRAME";
}
__name(isFrame, "isFrame");

// ../../packages/ui/node_modules/@radix-ui/react-compose-refs/dist/index.mjs
var React = __toESM(require_react(), 1);
var __defProp2 = Object.defineProperty;
var __name2 = (target, value) => __defProp2(target, "name", { value, configurable: true });
function setRef(ref, value) {
  if (typeof ref === "function") {
    return ref(value);
  } else if (ref !== null && ref !== void 0) {
    ref.current = value;
  }
}
__name2(setRef, "setRef");
function composeRefs(...refs) {
  return (node) => {
    let hasCleanup = false;
    const cleanups = refs.map((ref) => {
      const cleanup = setRef(ref, node);
      if (!hasCleanup && typeof cleanup == "function") {
        hasCleanup = true;
      }
      return cleanup;
    });
    if (hasCleanup) {
      return () => {
        for (let i = 0; i < cleanups.length; i++) {
          const cleanup = cleanups[i];
          if (typeof cleanup == "function") {
            cleanup();
          } else {
            setRef(refs[i], null);
          }
        }
      };
    }
  };
}
__name2(composeRefs, "composeRefs");
function useComposedRefs(...refs) {
  return React.useCallback(composeRefs(...refs), refs);
}
__name2(useComposedRefs, "useComposedRefs");

// ../../packages/ui/node_modules/@radix-ui/react-context/dist/index.mjs
var React2 = __toESM(require_react(), 1);
var import_jsx_runtime = __toESM(require_jsx_runtime(), 1);
var __defProp3 = Object.defineProperty;
var __name3 = (target, value) => __defProp3(target, "name", { value, configurable: true });
function createContext2(rootComponentName, defaultContext) {
  const Context = React2.createContext(defaultContext);
  Context.displayName = rootComponentName + "Context";
  const Provider = __name3((props) => {
    const { children, ...context } = props;
    const value = React2.useMemo(() => context, Object.values(context));
    return (0, import_jsx_runtime.jsx)(Context.Provider, { value, children });
  }, "Provider");
  Provider.displayName = rootComponentName + "Provider";
  function useContext2(consumerName, options = {}) {
    const { optional = false } = options;
    const context = React2.useContext(Context);
    if (context) return context;
    if (defaultContext !== void 0) return defaultContext;
    if (optional) return void 0;
    throw new Error(`\`${consumerName}\` must be used within \`${rootComponentName}\``);
  }
  __name3(useContext2, "useContext");
  return [Provider, useContext2];
}
__name3(createContext2, "createContext");
function createContextScope(scopeName, createContextScopeDeps = []) {
  let defaultContexts = [];
  function createContext3(rootComponentName, defaultContext) {
    const BaseContext = React2.createContext(defaultContext);
    BaseContext.displayName = rootComponentName + "Context";
    const index = defaultContexts.length;
    defaultContexts = [...defaultContexts, defaultContext];
    const Provider = __name3((props) => {
      var _a;
      const { scope, children, ...context } = props;
      const Context = ((_a = scope == null ? void 0 : scope[scopeName]) == null ? void 0 : _a[index]) || BaseContext;
      const value = React2.useMemo(() => context, Object.values(context));
      return (0, import_jsx_runtime.jsx)(Context.Provider, { value, children });
    }, "Provider");
    Provider.displayName = rootComponentName + "Provider";
    function useContext2(consumerName, scope, options = {}) {
      var _a;
      const { optional = false } = options;
      const Context = ((_a = scope == null ? void 0 : scope[scopeName]) == null ? void 0 : _a[index]) || BaseContext;
      const context = React2.useContext(Context);
      if (context) return context;
      if (defaultContext !== void 0) return defaultContext;
      if (optional) return void 0;
      throw new Error(`\`${consumerName}\` must be used within \`${rootComponentName}\``);
    }
    __name3(useContext2, "useContext");
    return [Provider, useContext2];
  }
  __name3(createContext3, "createContext");
  const createScope = __name3(() => {
    const scopeContexts = defaultContexts.map((defaultContext) => {
      return React2.createContext(defaultContext);
    });
    return __name3(function useScope(scope) {
      const contexts = (scope == null ? void 0 : scope[scopeName]) || scopeContexts;
      return React2.useMemo(
        () => ({ [`__scope${scopeName}`]: { ...scope, [scopeName]: contexts } }),
        [scope, contexts]
      );
    }, "useScope");
  }, "createScope");
  createScope.scopeName = scopeName;
  return [createContext3, composeContextScopes(createScope, ...createContextScopeDeps)];
}
__name3(createContextScope, "createContextScope");
function composeContextScopes(...scopes) {
  const baseScope = scopes[0];
  if (scopes.length === 1) return baseScope;
  const createScope = __name3(() => {
    const scopeHooks = scopes.map((createScope2) => ({
      useScope: createScope2(),
      scopeName: createScope2.scopeName
    }));
    return __name3(function useComposedScopes(overrideScopes) {
      const nextScopes = scopeHooks.reduce((nextScopes2, { useScope, scopeName }) => {
        const scopeProps = useScope(overrideScopes);
        const currentScope = scopeProps[`__scope${scopeName}`];
        return { ...nextScopes2, ...currentScope };
      }, {});
      return React2.useMemo(() => ({ [`__scope${baseScope.scopeName}`]: nextScopes }), [nextScopes]);
    }, "useComposedScopes");
  }, "createScope");
  createScope.scopeName = baseScope.scopeName;
  return createScope;
}
__name3(composeContextScopes, "composeContextScopes");

// ../../packages/ui/node_modules/@radix-ui/react-slot/dist/index.mjs
var React3 = __toESM(require_react(), 1);
var __defProp4 = Object.defineProperty;
var __name4 = (target, value) => __defProp4(target, "name", { value, configurable: true });
function createSlot(ownerName) {
  const Slot2 = React3.forwardRef((props, forwardedRef) => {
    let { children, ...slotProps } = props;
    let slottableElement = null;
    let hasSlottable = false;
    const newChildren = [];
    if (isLazyComponent(children) && typeof use === "function") {
      children = use(children._payload);
    }
    React3.Children.forEach(children, (maybeSlottable) => {
      var _a;
      if (isSlottable(maybeSlottable)) {
        hasSlottable = true;
        const slottable = maybeSlottable;
        let child = "child" in slottable.props ? slottable.props.child : slottable.props.children;
        if (isLazyComponent(child) && typeof use === "function") {
          child = use(child._payload);
        }
        slottableElement = getSlottableElementFromSlottable(slottable, child);
        newChildren.push((_a = slottableElement == null ? void 0 : slottableElement.props) == null ? void 0 : _a.children);
      } else {
        newChildren.push(maybeSlottable);
      }
    });
    if (slottableElement) {
      slottableElement = React3.cloneElement(slottableElement, void 0, newChildren);
    } else if (
      // A `Slottable` was found but it didn't resolve to a single element (e.g.
      // it wrapped multiple elements, text, or a render-prop `child` that
      // wasn't an element). Don't fall back to treating the `Slottable` wrapper
      // itself as the slot target — throw a descriptive error below instead.
      !hasSlottable && React3.Children.count(children) === 1 && React3.isValidElement(children)
    ) {
      slottableElement = children;
    }
    const slottableElementRef = slottableElement ? getElementRef(slottableElement) : void 0;
    const composedRef = useComposedRefs(forwardedRef, slottableElementRef);
    if (!slottableElement) {
      if (children || children === 0) {
        throw new Error(
          hasSlottable ? createSlottableError(ownerName) : createSlotError(ownerName)
        );
      }
      return children;
    }
    const mergedProps = mergeProps(slotProps, slottableElement.props ?? {});
    if (slottableElement.type !== React3.Fragment) {
      mergedProps.ref = forwardedRef ? composedRef : slottableElementRef;
    }
    return React3.cloneElement(slottableElement, mergedProps);
  });
  Slot2.displayName = `${ownerName}.Slot`;
  return Slot2;
}
__name4(createSlot, "createSlot");
var Slot = createSlot("Slot");
var SLOTTABLE_IDENTIFIER = Symbol.for("radix.slottable");
function createSlottable(ownerName) {
  const Slottable2 = __name4((props) => "child" in props ? props.children(props.child) : props.children, "Slottable");
  Slottable2.displayName = `${ownerName}.Slottable`;
  Slottable2.__radixId = SLOTTABLE_IDENTIFIER;
  return Slottable2;
}
__name4(createSlottable, "createSlottable");
var Slottable = createSlottable("Slottable");
var getSlottableElementFromSlottable = __name4((slottable, child) => {
  if ("child" in slottable.props) {
    const child2 = slottable.props.child;
    if (!React3.isValidElement(child2)) return null;
    return React3.cloneElement(child2, void 0, slottable.props.children(child2.props.children));
  }
  return React3.isValidElement(child) ? child : null;
}, "getSlottableElementFromSlottable");
function mergeProps(slotProps, childProps) {
  const overrideProps = { ...childProps };
  for (const propName in childProps) {
    const slotPropValue = slotProps[propName];
    const childPropValue = childProps[propName];
    const isHandler = /^on[A-Z]/.test(propName);
    if (isHandler) {
      if (slotPropValue && childPropValue) {
        overrideProps[propName] = (...args) => {
          const result = childPropValue(...args);
          slotPropValue(...args);
          return result;
        };
      } else if (slotPropValue) {
        overrideProps[propName] = slotPropValue;
      }
    } else if (propName === "style") {
      overrideProps[propName] = { ...slotPropValue, ...childPropValue };
    } else if (propName === "className") {
      overrideProps[propName] = [slotPropValue, childPropValue].filter(Boolean).join(" ");
    }
  }
  return { ...slotProps, ...overrideProps };
}
__name4(mergeProps, "mergeProps");
function getElementRef(element) {
  var _a, _b;
  let getter = (_a = Object.getOwnPropertyDescriptor(element.props, "ref")) == null ? void 0 : _a.get;
  let mayWarn = getter && "isReactWarning" in getter && getter.isReactWarning;
  if (mayWarn) {
    return element.ref;
  }
  getter = (_b = Object.getOwnPropertyDescriptor(element, "ref")) == null ? void 0 : _b.get;
  mayWarn = getter && "isReactWarning" in getter && getter.isReactWarning;
  if (mayWarn) {
    return element.props.ref;
  }
  return element.props.ref || element.ref;
}
__name4(getElementRef, "getElementRef");
function isSlottable(child) {
  return React3.isValidElement(child) && typeof child.type === "function" && "__radixId" in child.type && child.type.__radixId === SLOTTABLE_IDENTIFIER;
}
__name4(isSlottable, "isSlottable");
var REACT_LAZY_TYPE = Symbol.for("react.lazy");
function isLazyComponent(element) {
  return element != null && typeof element === "object" && "$$typeof" in element && element.$$typeof === REACT_LAZY_TYPE && "_payload" in element && isPromiseLike(element._payload);
}
__name4(isLazyComponent, "isLazyComponent");
function isPromiseLike(value) {
  return typeof value === "object" && value !== null && "then" in value;
}
__name4(isPromiseLike, "isPromiseLike");
var createSlotError = __name4((ownerName) => {
  return `${ownerName} failed to slot onto its children. Expected a single React element child or \`Slottable\`.`;
}, "createSlotError");
var createSlottableError = __name4((ownerName) => {
  return `${ownerName} failed to slot onto its \`Slottable\`. Expected \`Slottable\` to receive a single React element child.`;
}, "createSlottableError");
var use = React3[" use ".trim().toString()];

// ../../packages/ui/node_modules/@radix-ui/react-primitive/dist/index.mjs
var React4 = __toESM(require_react(), 1);
var ReactDOM = __toESM(require_react_dom(), 1);
var import_jsx_runtime2 = __toESM(require_jsx_runtime(), 1);
var __defProp5 = Object.defineProperty;
var __name5 = (target, value) => __defProp5(target, "name", { value, configurable: true });
var NODES = [
  "a",
  "button",
  "div",
  "form",
  "h2",
  "h3",
  "img",
  "input",
  "label",
  "li",
  "nav",
  "ol",
  "p",
  "select",
  "span",
  "svg",
  "ul"
];
var Primitive = NODES.reduce((primitive, node) => {
  const Slot2 = createSlot(`Primitive.${node}`);
  const Node = React4.forwardRef((props, forwardedRef) => {
    const { asChild, ...primitiveProps } = props;
    const Comp = asChild ? Slot2 : node;
    if (typeof window !== "undefined") {
      window[Symbol.for("radix-ui")] = true;
    }
    return (0, import_jsx_runtime2.jsx)(Comp, { ...primitiveProps, ref: forwardedRef });
  });
  Node.displayName = `Primitive.${node}`;
  return { ...primitive, [node]: Node };
}, {});
function dispatchDiscreteCustomEvent(target, event) {
  if (target) ReactDOM.flushSync(() => target.dispatchEvent(event));
}
__name5(dispatchDiscreteCustomEvent, "dispatchDiscreteCustomEvent");

// ../../packages/ui/node_modules/@radix-ui/react-use-layout-effect/dist/index.mjs
var React5 = __toESM(require_react(), 1);
var useLayoutEffect2 = (globalThis == null ? void 0 : globalThis.document) ? React5.useLayoutEffect : () => {
};

// ../../packages/ui/node_modules/@radix-ui/react-use-size/dist/index.mjs
var React6 = __toESM(require_react(), 1);
var __defProp6 = Object.defineProperty;
var __name6 = (target, value) => __defProp6(target, "name", { value, configurable: true });
function useSize(element) {
  const [size, setSize] = React6.useState(void 0);
  useLayoutEffect2(() => {
    if (element) {
      setSize({ width: element.offsetWidth, height: element.offsetHeight });
      const resizeObserver = new ResizeObserver((entries) => {
        if (!Array.isArray(entries)) {
          return;
        }
        if (!entries.length) {
          return;
        }
        const entry = entries[0];
        let width;
        let height;
        if ("borderBoxSize" in entry) {
          const borderSizeEntry = entry["borderBoxSize"];
          const borderSize = Array.isArray(borderSizeEntry) ? borderSizeEntry[0] : borderSizeEntry;
          width = borderSize["inlineSize"];
          height = borderSize["blockSize"];
        } else {
          width = element.offsetWidth;
          height = element.offsetHeight;
        }
        setSize({ width, height });
      });
      resizeObserver.observe(element, { box: "border-box" });
      return () => resizeObserver.unobserve(element);
    } else {
      setSize(void 0);
    }
  }, [element]);
  return size;
}
__name6(useSize, "useSize");

// ../../packages/ui/node_modules/@radix-ui/react-presence/dist/index.mjs
var React22 = __toESM(require_react(), 1);
var React7 = __toESM(require_react(), 1);
var __defProp7 = Object.defineProperty;
var __name7 = (target, value) => __defProp7(target, "name", { value, configurable: true });
function useStateMachine(initialState, machine) {
  return React7.useReducer((state, event) => {
    const nextState = machine[state][event];
    return nextState ?? state;
  }, initialState);
}
__name7(useStateMachine, "useStateMachine");
var Presence = __name7((props) => {
  const { present, children } = props;
  const presence = usePresence(present);
  const child = typeof children === "function" ? children({ present: presence.isPresent }) : React22.Children.only(children);
  const ref = useStableComposedRefs(presence.ref, getElementRef2(child));
  const forceMount = typeof children === "function";
  return forceMount || presence.isPresent ? React22.cloneElement(child, { ref }) : null;
}, "Presence");
function usePresence(present) {
  const [node, setNode] = React22.useState();
  const stylesRef = React22.useRef(null);
  const prevPresentRef = React22.useRef(present);
  const prevAnimationNameRef = React22.useRef("none");
  const mountAnimationNameRef = React22.useRef(void 0);
  const initialState = present ? "mounted" : "unmounted";
  const [state, send] = useStateMachine(initialState, {
    mounted: {
      UNMOUNT: "unmounted",
      ANIMATION_OUT: "unmountSuspended"
    },
    unmountSuspended: {
      MOUNT: "mounted",
      ANIMATION_END: "unmounted"
    },
    unmounted: {
      MOUNT: "mounted"
    }
  });
  React22.useEffect(() => {
    if (state === "mounted") {
      prevAnimationNameRef.current = mountAnimationNameRef.current ?? getAnimationName(stylesRef.current);
      mountAnimationNameRef.current = void 0;
    } else {
      prevAnimationNameRef.current = "none";
    }
  }, [state]);
  useLayoutEffect2(() => {
    const styles = stylesRef.current;
    const wasPresent = prevPresentRef.current;
    const hasPresentChanged = wasPresent !== present;
    if (hasPresentChanged) {
      const prevAnimationName = prevAnimationNameRef.current;
      const currentAnimationName = getAnimationName(styles);
      if (present) {
        mountAnimationNameRef.current = currentAnimationName;
        send("MOUNT");
      } else if (currentAnimationName === "none" || (styles == null ? void 0 : styles.display) === "none") {
        send("UNMOUNT");
      } else {
        const isAnimating = prevAnimationName !== currentAnimationName;
        if (wasPresent && isAnimating) {
          send("ANIMATION_OUT");
        } else {
          send("UNMOUNT");
        }
      }
      prevPresentRef.current = present;
    }
  }, [present, send]);
  useLayoutEffect2(() => {
    if (node) {
      let timeoutId;
      const ownerWindow = node.ownerDocument.defaultView ?? window;
      const handleAnimationEnd = __name7((event) => {
        const currentAnimationName = getAnimationName(stylesRef.current);
        const isCurrentAnimation = currentAnimationName.includes(CSS.escape(event.animationName));
        if (event.target === node && isCurrentAnimation) {
          send("ANIMATION_END");
          if (!prevPresentRef.current) {
            const currentFillMode = node.style.animationFillMode;
            node.style.animationFillMode = "forwards";
            timeoutId = ownerWindow.setTimeout(() => {
              if (node.style.animationFillMode === "forwards") {
                node.style.animationFillMode = currentFillMode;
              }
            });
          }
        }
      }, "handleAnimationEnd");
      const handleAnimationStart = __name7((event) => {
        if (event.target === node) {
          prevAnimationNameRef.current = getAnimationName(stylesRef.current);
        }
      }, "handleAnimationStart");
      node.addEventListener("animationstart", handleAnimationStart);
      node.addEventListener("animationcancel", handleAnimationEnd);
      node.addEventListener("animationend", handleAnimationEnd);
      return () => {
        ownerWindow.clearTimeout(timeoutId);
        node.removeEventListener("animationstart", handleAnimationStart);
        node.removeEventListener("animationcancel", handleAnimationEnd);
        node.removeEventListener("animationend", handleAnimationEnd);
      };
    } else {
      send("ANIMATION_END");
    }
  }, [node, send]);
  return {
    isPresent: ["mounted", "unmountSuspended"].includes(state),
    ref: React22.useCallback((node2) => {
      if (node2) {
        const styles = getComputedStyle(node2);
        stylesRef.current = styles;
        mountAnimationNameRef.current = getAnimationName(styles);
      } else {
        stylesRef.current = null;
      }
      setNode(node2);
    }, [])
  };
}
__name7(usePresence, "usePresence");
function setRef2(ref, value) {
  if (typeof ref === "function") {
    return ref(value);
  } else if (ref !== null && ref !== void 0) {
    ref.current = value;
  }
}
__name7(setRef2, "setRef");
function useStableComposedRefs(...refs) {
  const refsRef = React22.useRef(refs);
  refsRef.current = refs;
  return React22.useCallback((node) => {
    const currentRefs = refsRef.current;
    let hasCleanup = false;
    const cleanups = currentRefs.map((ref) => {
      const cleanup = setRef2(ref, node);
      if (!hasCleanup && typeof cleanup === "function") {
        hasCleanup = true;
      }
      return cleanup;
    });
    if (hasCleanup) {
      return () => {
        for (let i = 0; i < cleanups.length; i++) {
          const cleanup = cleanups[i];
          if (typeof cleanup === "function") {
            cleanup();
          } else {
            setRef2(currentRefs[i], null);
          }
        }
      };
    }
  }, []);
}
__name7(useStableComposedRefs, "useStableComposedRefs");
function getAnimationName(styles) {
  return (styles == null ? void 0 : styles.animationName) || "none";
}
__name7(getAnimationName, "getAnimationName");
function getElementRef2(element) {
  var _a, _b;
  let getter = (_a = Object.getOwnPropertyDescriptor(element.props, "ref")) == null ? void 0 : _a.get;
  let mayWarn = getter && "isReactWarning" in getter && getter.isReactWarning;
  if (mayWarn) {
    return element.ref;
  }
  getter = (_b = Object.getOwnPropertyDescriptor(element, "ref")) == null ? void 0 : _b.get;
  mayWarn = getter && "isReactWarning" in getter && getter.isReactWarning;
  if (mayWarn) {
    return element.props.ref;
  }
  return element.props.ref || element.ref;
}
__name7(getElementRef2, "getElementRef");

// ../../packages/ui/node_modules/@radix-ui/react-use-controllable-state/dist/index.mjs
var React9 = __toESM(require_react(), 1);

// ../../packages/ui/node_modules/@radix-ui/primitive/dist/internal/is-development.true.mjs
var IS_DEVELOPMENT = true;

// ../../packages/ui/node_modules/@radix-ui/react-use-controllable-state/dist/index.mjs
var React23 = __toESM(require_react(), 1);

// ../../packages/ui/node_modules/@radix-ui/react-use-effect-event/dist/index.mjs
var React8 = __toESM(require_react(), 1);
var __defProp8 = Object.defineProperty;
var __name8 = (target, value) => __defProp8(target, "name", { value, configurable: true });
var useReactEffectEvent = React8[" useEffectEvent ".trim().toString()];
var useReactInsertionEffect = React8[" useInsertionEffect ".trim().toString()];
function useEffectEvent(callback) {
  if (typeof useReactEffectEvent === "function") {
    return useReactEffectEvent(callback);
  }
  const ref = React8.useRef(() => {
    throw new Error("Cannot call an event handler while rendering.");
  });
  if (typeof useReactInsertionEffect === "function") {
    useReactInsertionEffect(() => {
      ref.current = callback;
    });
  } else {
    useLayoutEffect2(() => {
      ref.current = callback;
    });
  }
  return React8.useMemo(() => ((...args) => {
    var _a;
    return (_a = ref.current) == null ? void 0 : _a.call(ref, ...args);
  }), []);
}
__name8(useEffectEvent, "useEffectEvent");

// ../../packages/ui/node_modules/@radix-ui/react-use-controllable-state/dist/index.mjs
var __defProp9 = Object.defineProperty;
var __name9 = (target, value) => __defProp9(target, "name", { value, configurable: true });
var useInsertionEffect = React9[" useInsertionEffect ".trim().toString()] || useLayoutEffect2;
function useControllableState({
  prop,
  defaultProp,
  onChange = __name9(() => {
  }, "onChange"),
  caller
}) {
  const [uncontrolledProp, setUncontrolledProp, onChangeRef] = useUncontrolledState({
    defaultProp,
    onChange
  });
  const isControlled = prop !== void 0;
  const value = isControlled ? prop : uncontrolledProp;
  if (IS_DEVELOPMENT) {
    const isControlledRef = React9.useRef(prop !== void 0);
    React9.useEffect(() => {
      const wasControlled = isControlledRef.current;
      if (wasControlled !== isControlled) {
        const from = wasControlled ? "controlled" : "uncontrolled";
        const to = isControlled ? "controlled" : "uncontrolled";
        console.warn(
          `${caller} is changing from ${from} to ${to}. Components should not switch from controlled to uncontrolled (or vice versa). Decide between using a controlled or uncontrolled value for the lifetime of the component.`
        );
      }
      isControlledRef.current = isControlled;
    }, [isControlled, caller]);
  }
  const setValue = React9.useCallback(
    (nextValue) => {
      var _a;
      if (isControlled) {
        const value2 = isFunction(nextValue) ? nextValue(prop) : nextValue;
        if (value2 !== prop) {
          (_a = onChangeRef.current) == null ? void 0 : _a.call(onChangeRef, value2);
        }
      } else {
        setUncontrolledProp(nextValue);
      }
    },
    [isControlled, prop, setUncontrolledProp, onChangeRef]
  );
  return [value, setValue];
}
__name9(useControllableState, "useControllableState");
function useUncontrolledState({
  defaultProp,
  onChange
}) {
  const [value, setValue] = React9.useState(defaultProp);
  const prevValueRef = React9.useRef(value);
  const onChangeRef = React9.useRef(onChange);
  useInsertionEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);
  React9.useEffect(() => {
    var _a;
    if (prevValueRef.current !== value) {
      (_a = onChangeRef.current) == null ? void 0 : _a.call(onChangeRef, value);
      prevValueRef.current = value;
    }
  }, [value, prevValueRef]);
  return [value, setValue, onChangeRef];
}
__name9(useUncontrolledState, "useUncontrolledState");
function isFunction(value) {
  return typeof value === "function";
}
__name9(isFunction, "isFunction");
var SYNC_STATE = Symbol("RADIX:SYNC_STATE");
function useControllableStateReducer(reducer, userArgs, initialArg, init) {
  const { prop: controlledState, defaultProp, onChange: onChangeProp, caller } = userArgs;
  const isControlled = controlledState !== void 0;
  const onChange = useEffectEvent(onChangeProp);
  if (IS_DEVELOPMENT) {
    const isControlledRef = React23.useRef(controlledState !== void 0);
    React23.useEffect(() => {
      const wasControlled = isControlledRef.current;
      if (wasControlled !== isControlled) {
        const from = wasControlled ? "controlled" : "uncontrolled";
        const to = isControlled ? "controlled" : "uncontrolled";
        console.warn(
          `${caller} is changing from ${from} to ${to}. Components should not switch from controlled to uncontrolled (or vice versa). Decide between using a controlled or uncontrolled value for the lifetime of the component.`
        );
      }
      isControlledRef.current = isControlled;
    }, [isControlled, caller]);
  }
  const args = [{ ...initialArg, state: defaultProp }];
  if (init) {
    args.push(init);
  }
  const [internalState, dispatch] = React23.useReducer(
    (state2, action) => {
      if (action.type === SYNC_STATE) {
        return { ...state2, state: action.state };
      }
      const next = reducer(state2, action);
      if (isControlled && !Object.is(next.state, state2.state)) {
        onChange(next.state);
      }
      return next;
    },
    ...args
  );
  const uncontrolledState = internalState.state;
  const prevValueRef = React23.useRef(uncontrolledState);
  React23.useEffect(() => {
    if (prevValueRef.current !== uncontrolledState) {
      prevValueRef.current = uncontrolledState;
      if (!isControlled) {
        onChange(uncontrolledState);
      }
    }
  }, [uncontrolledState, prevValueRef, isControlled]);
  const state = React23.useMemo(() => {
    const isControlled2 = controlledState !== void 0;
    if (isControlled2) {
      return { ...internalState, state: controlledState };
    }
    return internalState;
  }, [internalState, controlledState]);
  React23.useEffect(() => {
    if (isControlled && !Object.is(controlledState, internalState.state)) {
      dispatch({ type: SYNC_STATE, state: controlledState });
    }
  }, [controlledState, internalState.state, isControlled]);
  return [state, dispatch];
}
__name9(useControllableStateReducer, "useControllableStateReducer");

export {
  composeEventHandlers,
  useComposedRefs,
  createContextScope,
  createSlot,
  createSlottable,
  Primitive,
  dispatchDiscreteCustomEvent,
  useLayoutEffect2,
  useSize,
  Presence,
  useControllableState
};
//# sourceMappingURL=chunk-IOAW2WVD.js.map
