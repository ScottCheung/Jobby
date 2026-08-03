"use client";

import { useLayoutEffect, useMemo, useRef, useState } from "react";
import type { MasterResumeData } from "@/lib/types";
import { clampSmartScale, scaleResumeTemplate } from "./scale";
import type { ResumeTemplateConfig } from "./types";

export type SmartOnePageResult = {
  config: ResumeTemplateConfig;
  pageRef: React.RefObject<HTMLElement | null>;
  scale: number;
  applied: boolean;
  settled: boolean;
};

export function useSmartOnePage(
  config: ResumeTemplateConfig,
  data: MasterResumeData,
): SmartOnePageResult {
  const pageRef = useRef<HTMLElement>(null);
  const runKey = useMemo(
    () => JSON.stringify({ config, data }),
    [config, data],
  );
  const activeRunKey = useRef("");
  const naturalRatio = useRef<number | null>(null);
  const iteration = useRef(0);
  const [scale, setScale] = useState(1);
  const [settled, setSettled] = useState(false);
  const scaledConfig = useMemo(
    () => scaleResumeTemplate(config, scale),
    [config, scale],
  );

  useLayoutEffect(() => {
    const page = pageRef.current;
    const content = page?.querySelector<HTMLElement>("[data-resume-content]");
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

    const availableHeight =
      config.paper.heightPx -
      (scaledConfig.paper.paddingTop + scaledConfig.paper.paddingBottom) *
        config.paper.cssPixelsPerPoint;
    const ratio = content.scrollHeight / availableHeight;

    if (naturalRatio.current === null) naturalRatio.current = ratio;
    const natural = naturalRatio.current;
    const eligible =
      config.smartOnePage.enabled &&
      natural >= config.smartOnePage.minFillRatio &&
      natural <= config.smartOnePage.maxOverflowRatio;

    if (!eligible) {
      if (scale !== 1) setScale(1);
      setSettled(true);
      return;
    }

    const target = config.smartOnePage.targetFillRatio;
    const nextScale = clampSmartScale(config, scale * (target / ratio));
    const atScaleLimit =
      nextScale === config.smartOnePage.minScale ||
      nextScale === config.smartOnePage.maxScale;
    const isSettled =
      Math.abs(target - ratio) <= config.smartOnePage.tolerance ||
      Math.abs(nextScale - scale) <= 0.001 ||
      iteration.current >= config.smartOnePage.maxIterations ||
      atScaleLimit;

    if (isSettled) {
      if (Math.abs(nextScale - scale) > 0.001) setScale(nextScale);
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
    applied: settled && Math.abs(scale - 1) > 0.001,
    settled,
  };
}
