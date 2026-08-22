"use client";
import __vite__cjsImport0_react from "/vendor/.vite-deps-react.js__v--22c5bc1a.js"; const useLayoutEffect = __vite__cjsImport0_react["useLayoutEffect"]; const useMemo = __vite__cjsImport0_react["useMemo"]; const useRef = __vite__cjsImport0_react["useRef"]; const useState = __vite__cjsImport0_react["useState"];
import { clampSmartScale, scaleResumeTemplate } from "/vendor/fs-Users-xianzhezhang-Projects-Jobby-Jobby-packages-ui-src-components-UI-Resume-scale.ts.js";
export function useSmartOnePage(config, data) {
  const pageRef = useRef(null);
  const runKey = useMemo(
    () => JSON.stringify({ config, data }),
    [config, data]
  );
  const activeRunKey = useRef("");
  const naturalRatio = useRef(null);
  const iteration = useRef(0);
  const [scale, setScale] = useState(1);
  const [settled, setSettled] = useState(false);
  const scaledConfig = useMemo(
    () => scaleResumeTemplate(config, scale),
    [config, scale]
  );
  useLayoutEffect(() => {
    const page = pageRef.current;
    const content = page?.querySelector("[data-resume-content]");
    if (!page || !content) return;
    if (activeRunKey.current !== runKey) {
      activeRunKey.current = runKey;
      naturalRatio.current = null;
      iteration.current = 0;
      setSettled(false);
      if (scale !== 1) {
        setScale(1);
        return;
      }
    } else if (settled) {
      return;
    }
    const availableHeight = config.paper.heightPx - (scaledConfig.paper.paddingTop + scaledConfig.paper.paddingBottom) * config.paper.cssPixelsPerPoint;
    const ratio = content.scrollHeight / availableHeight;
    if (naturalRatio.current === null) naturalRatio.current = ratio;
    const natural = naturalRatio.current;
    const eligible = config.smartOnePage.enabled && natural >= config.smartOnePage.minFillRatio && natural <= config.smartOnePage.maxOverflowRatio;
    if (!eligible) {
      if (scale !== 1) setScale(1);
      setSettled(true);
      return;
    }
    const target = config.smartOnePage.targetFillRatio;
    const nextScale = clampSmartScale(config, scale * (target / ratio));
    const atScaleLimit = nextScale === config.smartOnePage.minScale || nextScale === config.smartOnePage.maxScale;
    const isSettled = Math.abs(target - ratio) <= config.smartOnePage.tolerance || Math.abs(nextScale - scale) <= 1e-3 || iteration.current >= config.smartOnePage.maxIterations || atScaleLimit;
    if (isSettled) {
      if (Math.abs(nextScale - scale) > 1e-3) setScale(nextScale);
      setSettled(true);
      return;
    }
    iteration.current += 1;
    setScale(nextScale);
  }, [config, runKey, scale, scaledConfig, settled]);
  return {
    config: scaledConfig,
    pageRef,
    scale,
    applied: settled && Math.abs(scale - 1) > 1e-3,
    settled
  };
}
