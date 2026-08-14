/** @format */

import { api } from '@/lib/api';

export type CelebrationType =
  | 'basic'
  | 'fireworks'
  | 'side-cannons'
  | 'stars';

export type CelebrationEventKey =
  | 'welcome_bonus'
  | 'membership_upgrade'
  | 'reward_claimed'
  | 'quest_unlocked'
  | 'practice_completed'
  | 'daily_checkin'
  | 'loot_box_opened'
  | 'answer_completed'
  | 'level_up';

export interface CelebrationStyleConfig {
  type: CelebrationType;
  label: string;
  description: string;
  durationMs: number;
  overlayOpacity: number;
  overlayBlurPx: number;
  panelEnabled: boolean;
  panelOpacity: number;
  particleMultiplier: number;
}

export interface CelebrationEventConfig {
  key: CelebrationEventKey;
  label: string;
  description: string;
  styleType: CelebrationType;
  defaultMessage: string;
  durationMs: number | null;
  enabled: boolean;
}

export interface CelebrationConfigSnapshot {
  styles: Record<CelebrationType, CelebrationStyleConfig>;
  events: Record<CelebrationEventKey, CelebrationEventConfig>;
}

export const CELEBRATION_STYLE_ORDER: CelebrationType[] = [
  'basic',
  'fireworks',
  'side-cannons',
  'stars',
];

export const CELEBRATION_EVENT_ORDER: CelebrationEventKey[] = [
  'welcome_bonus',
  'membership_upgrade',
  'reward_claimed',
  'quest_unlocked',
  'practice_completed',
  'daily_checkin',
  'loot_box_opened',
  'answer_completed',
  'level_up',
];

const DEFAULT_STYLES: Record<CelebrationType, CelebrationStyleConfig> = {
  basic: {
    type: 'basic',
    label: 'Soft Burst',
    description: 'Short center burst with light overlay.',
    durationMs: 1800,
    overlayOpacity: 4,
    overlayBlurPx: 0,
    panelEnabled: true,
    panelOpacity: 92,
    particleMultiplier: 0.85,
  },
  fireworks: {
    type: 'fireworks',
    label: 'Fireworks',
    description: 'Layered fireworks for big upgrades and milestones.',
    durationMs: 2400,
    overlayOpacity: 6,
    overlayBlurPx: 1,
    panelEnabled: true,
    panelOpacity: 94,
    particleMultiplier: 1,
  },
  'side-cannons': {
    type: 'side-cannons',
    label: 'Side Cannons',
    description: 'Fast side launch with low visual obstruction.',
    durationMs: 1600,
    overlayOpacity: 0,
    overlayBlurPx: 0,
    panelEnabled: true,
    panelOpacity: 88,
    particleMultiplier: 0.75,
  },
  stars: {
    type: 'stars',
    label: 'Golden Stars',
    description: 'Shiny star burst for loot, rewards, and bonus moments.',
    durationMs: 2100,
    overlayOpacity: 5,
    overlayBlurPx: 0,
    panelEnabled: true,
    panelOpacity: 90,
    particleMultiplier: 0.9,
  },
};

const DEFAULT_EVENTS: Record<CelebrationEventKey, CelebrationEventConfig> = {
  welcome_bonus: {
    key: 'welcome_bonus',
    label: 'Welcome Bonus',
    description: 'Starter rewards or first-time welcome gifts.',
    styleType: 'fireworks',
    defaultMessage: 'Welcome gift claimed',
    durationMs: 2800,
    enabled: true,
  },
  membership_upgrade: {
    key: 'membership_upgrade',
    label: 'Membership Upgrade',
    description: 'Used when a user unlocks a paid or premium tier.',
    styleType: 'fireworks',
    defaultMessage: 'Membership upgraded',
    durationMs: 2600,
    enabled: true,
  },
  reward_claimed: {
    key: 'reward_claimed',
    label: 'Reward Claimed',
    description: 'Generic reward collection feedback.',
    styleType: 'basic',
    defaultMessage: 'Reward claimed',
    durationMs: null,
    enabled: true,
  },
  quest_unlocked: {
    key: 'quest_unlocked',
    label: 'Quest Unlocked',
    description: 'New plan, quest, or badge unlock moment.',
    styleType: 'basic',
    defaultMessage: 'Quest and badges unlocked',
    durationMs: null,
    enabled: true,
  },
  practice_completed: {
    key: 'practice_completed',
    label: 'Practice Completed',
    description: 'Practice finish reward feedback.',
    styleType: 'basic',
    defaultMessage: 'Practice reward earned',
    durationMs: null,
    enabled: true,
  },
  daily_checkin: {
    key: 'daily_checkin',
    label: 'Daily Check-in',
    description: 'Used for routine streak or check-in reward moments.',
    styleType: 'side-cannons',
    defaultMessage: 'Check-in reward claimed',
    durationMs: null,
    enabled: true,
  },
  loot_box_opened: {
    key: 'loot_box_opened',
    label: 'Loot Box Opened',
    description: 'Animated reward reveal after opening a loot box.',
    styleType: 'stars',
    defaultMessage: 'Loot box opened',
    durationMs: null,
    enabled: true,
  },
  answer_completed: {
    key: 'answer_completed',
    label: 'Answer Completed',
    description: 'Used when completing a question or answer flow.',
    styleType: 'basic',
    defaultMessage: 'Question completed',
    durationMs: null,
    enabled: true,
  },
  level_up: {
    key: 'level_up',
    label: 'Level Up',
    description: 'Used for XP milestone promotions.',
    styleType: 'fireworks',
    defaultMessage: 'Level up',
    durationMs: 2600,
    enabled: true,
  },
};

function cloneConfig<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function normalizeStyle(
  type: CelebrationType,
  input?: Partial<CelebrationStyleConfig>,
): CelebrationStyleConfig {
  const fallback = DEFAULT_STYLES[type];

  return {
    ...fallback,
    ...input,
    type,
    durationMs: clampNumber(input?.durationMs, fallback.durationMs, 900, 5000),
    overlayOpacity: clampNumber(
      input?.overlayOpacity,
      fallback.overlayOpacity,
      0,
      20,
    ),
    overlayBlurPx: clampNumber(
      input?.overlayBlurPx,
      fallback.overlayBlurPx,
      0,
      8,
    ),
    panelOpacity: clampNumber(
      input?.panelOpacity,
      fallback.panelOpacity,
      35,
      100,
    ),
    particleMultiplier: clampNumber(
      input?.particleMultiplier,
      fallback.particleMultiplier,
      0.3,
      2.5,
    ),
    panelEnabled: input?.panelEnabled ?? fallback.panelEnabled,
  };
}

function normalizeEvent(
  key: CelebrationEventKey,
  input?: Partial<CelebrationEventConfig>,
): CelebrationEventConfig {
  const fallback = DEFAULT_EVENTS[key];
  const nextDuration =
    input?.durationMs == null ? null : clampNumber(input.durationMs, 1800, 900, 5000);

  return {
    ...fallback,
    ...input,
    key,
    styleType:
      input?.styleType && CELEBRATION_STYLE_ORDER.includes(input.styleType) ?
        input.styleType
      : fallback.styleType,
    defaultMessage: input?.defaultMessage?.trim() || fallback.defaultMessage,
    durationMs: nextDuration,
    enabled: input?.enabled ?? fallback.enabled,
  };
}

function clampNumber(
  value: number | undefined,
  fallback: number,
  min: number,
  max: number,
) {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return fallback;
  }
  return Math.min(max, Math.max(min, value));
}

export function getDefaultCelebrationConfig(): CelebrationConfigSnapshot {
  return {
    styles: cloneConfig(DEFAULT_STYLES),
    events: cloneConfig(DEFAULT_EVENTS),
  };
}

export function normalizeCelebrationConfig(
  input?: Partial<CelebrationConfigSnapshot> | null,
): CelebrationConfigSnapshot {
  const defaults = getDefaultCelebrationConfig();

  return {
    styles: {
      basic: normalizeStyle('basic', input?.styles?.basic),
      fireworks: normalizeStyle('fireworks', input?.styles?.fireworks),
      'side-cannons': normalizeStyle(
        'side-cannons',
        input?.styles?.['side-cannons'],
      ),
      stars: normalizeStyle('stars', input?.styles?.stars),
    },
    events: {
      welcome_bonus: normalizeEvent(
        'welcome_bonus',
        input?.events?.welcome_bonus,
      ),
      membership_upgrade: normalizeEvent(
        'membership_upgrade',
        input?.events?.membership_upgrade,
      ),
      reward_claimed: normalizeEvent(
        'reward_claimed',
        input?.events?.reward_claimed,
      ),
      quest_unlocked: normalizeEvent(
        'quest_unlocked',
        input?.events?.quest_unlocked,
      ),
      practice_completed: normalizeEvent(
        'practice_completed',
        input?.events?.practice_completed,
      ),
      daily_checkin: normalizeEvent(
        'daily_checkin',
        input?.events?.daily_checkin,
      ),
      loot_box_opened: normalizeEvent(
        'loot_box_opened',
        input?.events?.loot_box_opened,
      ),
      answer_completed: normalizeEvent(
        'answer_completed',
        input?.events?.answer_completed,
      ),
      level_up: normalizeEvent('level_up', input?.events?.level_up),
    },
  };
}

export function loadCelebrationConfig(): CelebrationConfigSnapshot {
  return getDefaultCelebrationConfig();
}

export async function loadCelebrationConfigFromServer() {
  try {
    const response = await api.gamificationAdminConfig();
    if (!response.config.celebration_config) {
      return loadCelebrationConfig();
    }
    return normalizeCelebrationConfig(
      response.config.celebration_config as Partial<CelebrationConfigSnapshot> | undefined,
    );
  } catch (error) {
    console.error('Failed to load celebration config from server:', error);
    return loadCelebrationConfig();
  }
}

export async function saveCelebrationConfig(config: CelebrationConfigSnapshot) {
  const normalized = normalizeCelebrationConfig(config);
  const current = await api.gamificationAdminConfig();
  const response = await api.updateGamificationAdminConfig({
    ...current.config,
    celebration_config: normalized,
  });
  const saved = normalizeCelebrationConfig(
    response.config.celebration_config as Partial<CelebrationConfigSnapshot> | undefined,
  );
  return saved;
}

export async function resetCelebrationConfig() {
  return saveCelebrationConfig(getDefaultCelebrationConfig());
}

export function resolveCelebrationStyle(
  type: CelebrationType = 'basic',
  config?: CelebrationConfigSnapshot,
) {
  const snapshot = config ?? loadCelebrationConfig();
  return snapshot.styles[type] ?? getDefaultCelebrationConfig().styles[type];
}

export function resolveCelebrationEvent(
  key: CelebrationEventKey,
  config?: CelebrationConfigSnapshot,
) {
  const snapshot = config ?? loadCelebrationConfig();
  return snapshot.events[key] ?? getDefaultCelebrationConfig().events[key];
}
