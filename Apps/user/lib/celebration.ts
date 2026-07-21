/** @format */

'use client';

import type {
  CelebrationConfigSnapshot,
  CelebrationEventConfig,
  CelebrationEventKey,
  CelebrationStyleConfig,
  CelebrationType,
} from '@/lib/celebration-config';
import {
  loadCelebrationConfig,
  loadCelebrationConfigFromServer,
  resolveCelebrationEvent,
  resolveCelebrationStyle,
} from '@/lib/celebration-config';
import { useLayoutStore } from '@/lib/store/layout-store';

export function showCelebration(
  message?: string,
  duration = 2600,
  type: CelebrationType = 'basic',
) {
  const style = resolveCelebrationStyle(type);

  useLayoutStore.getState().actions.triggerCelebration({
    message,
    duration: duration || style.durationMs,
    type: style.type,
    style,
  });
}

function triggerCelebrationWithConfig(
  event: CelebrationEventConfig,
  style: CelebrationStyleConfig,
  message?: string,
) {
  useLayoutStore.getState().actions.triggerCelebration({
    eventKey: event.key,
    message: message || event.defaultMessage,
    duration: event.durationMs ?? style.durationMs,
    type: style.type,
    style,
  });
}

export async function showCelebrationEvent(
  key: CelebrationEventKey,
  message?: string,
  config?: CelebrationConfigSnapshot,
) {
  const snapshot = config ?? await loadCelebrationConfigFromServer();
  const event = resolveCelebrationEvent(key, snapshot);
  if (!event.enabled) return;

  const style = resolveCelebrationStyle(event.styleType, snapshot);
  triggerCelebrationWithConfig(event, style, message);
}

export function previewCelebrationStyle(
  style: CelebrationStyleConfig,
  message?: string,
) {
  useLayoutStore.getState().actions.triggerCelebration({
    message: message || `${style.label} preview`,
    duration: style.durationMs,
    type: style.type,
    style,
  });
}

export function previewCelebrationEvent(
  event: CelebrationEventConfig,
  config?: CelebrationConfigSnapshot,
) {
  const snapshot = config ?? loadCelebrationConfig();
  const style = resolveCelebrationStyle(event.styleType, snapshot);
  triggerCelebrationWithConfig(event, style);
}
