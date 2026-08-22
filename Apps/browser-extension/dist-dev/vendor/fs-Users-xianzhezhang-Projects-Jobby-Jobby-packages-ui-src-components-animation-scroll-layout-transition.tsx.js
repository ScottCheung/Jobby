import { createHotContext as __vite__createHotContext } from "/vendor/vite-client.js";import.meta.hot = __vite__createHotContext("/vendor/fs-Users-xianzhezhang-Projects-Jobby-Jobby-packages-ui-src-components-animation-scroll-layout-transition.tsx.js");import __vite__cjsImport0_react_jsxDevRuntime from "/vendor/.vite-deps-react_jsx-dev-runtime.js__v--f5b0ea50.js"; const jsxDEV = __vite__cjsImport0_react_jsxDevRuntime["jsxDEV"];
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
  window.$RefreshReg$ = RefreshRuntime.getRefreshReg("/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/animation/scroll-layout-transition.tsx");
  window.$RefreshSig$ = RefreshRuntime.createSignatureFunctionForTransform;
}
"use client";
var _s = $RefreshSig$(), _s2 = $RefreshSig$(), _s3 = $RefreshSig$();
import __vite__cjsImport3_react from "/vendor/.vite-deps-react.js__v--f5b0ea50.js"; const createContext = __vite__cjsImport3_react["createContext"]; const useContext = __vite__cjsImport3_react["useContext"]; const useRef = __vite__cjsImport3_react["useRef"]; const useState = __vite__cjsImport3_react["useState"]; const useEffect = __vite__cjsImport3_react["useEffect"]; const useCallback = __vite__cjsImport3_react["useCallback"]






;
import {
  motion,
  useScroll,
  useTransform,
  useMotionValue
} from "/vendor/.vite-deps-framer-motion.js__v--788107dc.js";
const ScrollLayoutContext = createContext(null);
const ScrollLayoutRoot = ({
  children,
  progressRange = [0, 200],
  scrollContainerRef,
  heightRange
}) => {
  _s();
  const [isMounted, setIsMounted] = useState(false);
  useEffect(() => {
    setIsMounted(true);
  }, []);
  const hasContainer = isMounted && scrollContainerRef && scrollContainerRef.current;
  const { scrollY } = useScroll({
    container: hasContainer ? scrollContainerRef : void 0
  });
  const topToLeftRef = useRef(null);
  const progress = useTransform(scrollY, progressRange, [0, 1], {
    clamp: true
  });
  const y = useTransform(progress, [0, 1], [-40, 0]);
  const height = useTransform(progress, [0, 1], heightRange || [110, 110]);
  return /* @__PURE__ */ jsxDEV(
    ScrollLayoutContext.Provider,
    {
      value: { progress, topToLeftRef, scrollContainerRef },
      children: /* @__PURE__ */ jsxDEV(
        motion.div,
        {
          className: "flex items-center gap-4  w-full relative",
          style: heightRange ? { y, height } : { y },
          children
        },
        void 0,
        false,
        {
          fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/animation/scroll-layout-transition.tsx",
          lineNumber: 85,
          columnNumber: 7
        },
        this
      )
    },
    void 0,
    false,
    {
      fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/animation/scroll-layout-transition.tsx",
      lineNumber: 82,
      columnNumber: 5
    },
    this
  );
};
_s(ScrollLayoutRoot, "3h8TqATs+iByYC7gkME0tA2elNQ=", false, function() {
  return [useScroll, useTransform, useTransform, useTransform];
});
_c = ScrollLayoutRoot;
const TopToLeft = ({ children }) => {
  _s2();
  const { progress, topToLeftRef } = useContext(ScrollLayoutContext);
  const y = useTransform(progress, [0, 1], [30, 0]);
  const scale = useTransform(progress, [0, 1], [1, 0.9]);
  return /* @__PURE__ */ jsxDEV(motion.div, { ref: topToLeftRef, className: "shrink-0", children: /* @__PURE__ */ jsxDEV(motion.div, { className: " ", style: { y, scale }, children }, void 0, false, {
    fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/animation/scroll-layout-transition.tsx",
    lineNumber: 103,
    columnNumber: 7
  }, this) }, void 0, false, {
    fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/animation/scroll-layout-transition.tsx",
    lineNumber: 102,
    columnNumber: 5
  }, this);
};
_s2(TopToLeft, "5/XQ6Jyw8czxplFB8ovjKDh9Fug=", false, function() {
  return [useTransform, useTransform];
});
_c2 = TopToLeft;
const BtmToRight = ({ children }) => {
  _s3();
  const { progress, topToLeftRef, scrollContainerRef } = useContext(ScrollLayoutContext);
  const [dimensions, setDimensions] = useState({
    startWidth: 0,
    endWidth: 0,
    startX: 0,
    startY: 0
  });
  const width = useMotionValue(dimensions.startWidth);
  const x = useMotionValue(dimensions.startX);
  const y = useMotionValue(dimensions.startY);
  const updateDimensions = useCallback(() => {
    if (!topToLeftRef.current || !scrollContainerRef?.current) {
      return;
    }
    const topToLeftRect = topToLeftRef.current.getBoundingClientRect();
    const scrollContainerRect = scrollContainerRef.current.getBoundingClientRect();
    const startWidth = scrollContainerRect.width;
    const endWidth = Math.max(0, startWidth - topToLeftRect.width - 16);
    const startX = -(topToLeftRect.width + 16);
    const startY = topToLeftRect.height + 40;
    setDimensions((previous) => {
      if (previous.startWidth === startWidth && previous.endWidth === endWidth && previous.startX === startX && previous.startY === startY) {
        return previous;
      }
      return {
        startWidth,
        endWidth,
        startX,
        startY
      };
    });
  }, [scrollContainerRef, topToLeftRef]);
  useEffect(() => {
    if (!topToLeftRef.current || !scrollContainerRef?.current) {
      return;
    }
    let frameId = 0;
    const scheduleUpdate = () => {
      cancelAnimationFrame(frameId);
      frameId = window.requestAnimationFrame(updateDimensions);
    };
    scheduleUpdate();
    const topToLeftResizeObserver = new ResizeObserver(scheduleUpdate);
    topToLeftResizeObserver.observe(topToLeftRef.current);
    const scrollContainerResizeObserver = new ResizeObserver(scheduleUpdate);
    scrollContainerResizeObserver.observe(scrollContainerRef.current);
    window.addEventListener("resize", scheduleUpdate);
    return () => {
      cancelAnimationFrame(frameId);
      window.removeEventListener("resize", scheduleUpdate);
      topToLeftResizeObserver.disconnect();
      scrollContainerResizeObserver.disconnect();
    };
  }, [scrollContainerRef, topToLeftRef, updateDimensions]);
  useEffect(() => {
    const unsubscribe = progress.on("change", (latest) => {
      const interpolatedWidth = dimensions.startWidth + (dimensions.endWidth - dimensions.startWidth) * latest;
      width.set(interpolatedWidth);
      const interpolatedX = dimensions.startX + (0 - dimensions.startX) * latest;
      x.set(interpolatedX);
      const interpolatedY = dimensions.startY + (0 - dimensions.startY) * latest;
      y.set(interpolatedY);
    });
    const currentProgress = progress.get();
    width.set(
      dimensions.startWidth + (dimensions.endWidth - dimensions.startWidth) * currentProgress
    );
    x.set(dimensions.startX + (0 - dimensions.startX) * currentProgress);
    y.set(dimensions.startY + (0 - dimensions.startY) * currentProgress);
    return () => unsubscribe();
  }, [progress, dimensions, width, x, y]);
  return /* @__PURE__ */ jsxDEV(motion.div, { style: { x, y, width }, className: "flex", children }, void 0, false, {
    fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/animation/scroll-layout-transition.tsx",
    lineNumber: 220,
    columnNumber: 5
  }, this);
};
_s3(BtmToRight, "BDvAaE1hbKaFOcAT/sTZZaTGnsM=", false, function() {
  return [useMotionValue, useMotionValue, useMotionValue];
});
_c3 = BtmToRight;
export const Static = ({
  children
}) => {
  return /* @__PURE__ */ jsxDEV("div", { className: "", children }, void 0, false, {
    fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/animation/scroll-layout-transition.tsx",
    lineNumber: 229,
    columnNumber: 10
  }, this);
};
_c4 = Static;
export const ScrollLayout = Object.assign(ScrollLayoutRoot, {
  BtmToRight,
  TopToLeft
});
_c5 = ScrollLayout;
var _c, _c2, _c3, _c4, _c5;
$RefreshReg$(_c, "ScrollLayoutRoot");
$RefreshReg$(_c2, "TopToLeft");
$RefreshReg$(_c3, "BtmToRight");
$RefreshReg$(_c4, "Static");
$RefreshReg$(_c5, "ScrollLayout");
if (import.meta.hot && !inWebWorker) {
  window.$RefreshReg$ = prevRefreshReg;
  window.$RefreshSig$ = prevRefreshSig;
}
if (import.meta.hot && !inWebWorker) {
  RefreshRuntime.__hmr_import(import.meta.url).then((currentExports) => {
    RefreshRuntime.registerExportsForReactRefresh("/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/animation/scroll-layout-transition.tsx", currentExports);
    import.meta.hot.accept((nextExports) => {
      if (!nextExports) return;
      const invalidateMessage = RefreshRuntime.validateRefreshBoundaryAndEnqueueUpdate("/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/animation/scroll-layout-transition.tsx", currentExports, nextExports);
      if (invalidateMessage) import.meta.hot.invalidate(invalidateMessage);
    });
  });
}
