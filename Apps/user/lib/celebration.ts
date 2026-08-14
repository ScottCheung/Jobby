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
  emotionId?: number,
) {
  const style = resolveCelebrationStyle(type);

  useLayoutStore.getState().actions.triggerCelebration({
    message,
    duration: duration || style.durationMs,
    type: style.type,
    style,
    emotionId: emotionId ?? 14,
  });
}

function triggerCelebrationWithConfig(
  event: CelebrationEventConfig,
  style: CelebrationStyleConfig,
  message?: string,
  emotionId?: number,
) {
  useLayoutStore.getState().actions.triggerCelebration({
    eventKey: event.key,
    message: message || event.defaultMessage,
    duration: event.durationMs ?? style.durationMs,
    type: style.type,
    style,
    emotionId: emotionId ?? 14,
  });
}

export async function showCelebrationEvent(
  key: CelebrationEventKey,
  message?: string,
  config?: CelebrationConfigSnapshot,
  emotionId?: number,
) {
  const snapshot = config ?? await loadCelebrationConfigFromServer();
  const event = resolveCelebrationEvent(key, snapshot);
  if (!event.enabled) return;

  const style = resolveCelebrationStyle(event.styleType, snapshot);
  triggerCelebrationWithConfig(event, style, message, emotionId);
}

export function previewCelebrationStyle(
  style: CelebrationStyleConfig,
  message?: string,
  emotionId?: number,
) {
  useLayoutStore.getState().actions.triggerCelebration({
    message: message || `${style.label} preview`,
    duration: style.durationMs,
    type: style.type,
    style,
    emotionId: emotionId ?? 14,
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
