/** @format */

'use client';

import React, { useEffect, useState } from 'react';
import {
  Award,
  ChevronDown,
  CirclePlus,
  Gift,
  Loader2,
  Save,
  ShieldCheck,
  Sparkles,
  Target,
  Zap,
} from 'lucide-react';
import { api } from '@/lib/api';
import { useConsole } from '@/components/ConsoleContext';
import type {
  GamificationAdminConfig,
  GamificationBadgeConfig,
  GamificationEventConfig,
  GamificationQuestConfig,
} from '@/lib/types';

type Tab = 'economy' | 'quests' | 'badges' | 'rewards';

const METRICS = [
  ['practice_completed_today', 'Practice completed today'],
  ['practice_completed_week', 'Practice completed this week'],
  ['practice_completed_total', 'Practice completed in total'],
  ['practice_high_confidence_today', 'High-confidence answers today'],
  ['practice_high_confidence_total', 'High-confidence answers in total'],
  ['practice_streak_days', 'Current practice streak'],
  ['applications_submitted_today', 'Applications submitted today'],
  ['applications_submitted_week', 'Applications submitted this week'],
  ['applications_submitted_total', 'Applications submitted in total'],
  ['applications_manual_submitted_today', 'Manual applications today'],
  ['applications_manual_submitted_total', 'Manual applications in total'],
  ['applications_auto_submitted_today', 'Auto applications today'],
  ['applications_auto_submitted_total', 'Auto applications in total'],
  ['applications_auto_skipped_today', 'Auto applications skipped today'],
  ['applications_auto_skipped_total', 'Auto applications skipped in total'],
  ['applications_offer_today', 'Offers received today'],
  ['applications_offer_total', 'Offers received in total'],
  ['coins_balance', 'Coin balance'],
  ['loot_boxes_balance', 'Loot box balance'],
] as const;

const REWARD_EVENTS = [
  ['practice_completed', 'Practice completed', 'First completion of a question each day.'],
  ['question_survey_completed', 'Question rating submitted', 'Awarded once after both ratings are given.'],
  ['streak_bonus_7', 'Seven-day streak', 'Awarded when a practice streak reaches a multiple of seven.'],
  ['daily_checkin', 'Daily check-in', 'Awarded when a user checks in for the day.'],
  ['application_submitted_manual', 'Manual application submitted', 'Awarded when a manual application is submitted.'],
  ['application_submitted_auto', 'Auto application submitted', 'Awarded when an automated application is submitted.'],
  ['application_skipped_auto', 'Auto application skipped', 'Awarded when an automated application is skipped.'],
  ['application_interrupted_auto', 'Auto application needs review', 'Triggered when automation is interrupted. Negative values are supported.'],
  ['application_offer_received', 'Offer received', 'Awarded when an application reaches the offer stage.'],
] as const;

const inputClass =
  'body-md w-full rounded-lg border border-border/70 bg-background px-3 py-2 text-ink-primary outline-none transition focus:border-primary/60';

function metricLabel(metricKey: string) {
  return METRICS.find(([key]) => key === metricKey)?.[1] ?? metricKey;
}

function number(value: string, minimum = 0) {
  return Math.max(minimum, Number(value) || 0);
}

function updateRow<T>(rows: T[], index: number, patch: Partial<T>) {
  return rows.map((row, rowIndex) =>
    rowIndex === index ? { ...row, ...patch } : row,
  );
}

function rewardSummary(xp: number, coins: number, boxes: number) {
  const parts = [
    xp && `${xp} XP`,
    coins && `${coins} coins`,
    boxes && `${boxes} boxes`,
  ].filter(Boolean);
  return parts.length ? parts.join(' + ') : 'No reward';
}

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (value: boolean) => void; label: string }) {
  return (
    <button
      type='button'
      aria-pressed={checked}
      onClick={() => onChange(!checked)}
      className='inline-flex items-center gap-2 text-sm font-medium text-ink-secondary'
    >
      <span className={`relative h-6 w-10 rounded-full transition ${checked ? 'bg-primary' : 'bg-border'}`}>
        <span className={`absolute top-1 h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${checked ? 'translate-x-5' : 'translate-x-1'}`} />
      </span>
      {label}
    </button>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className='block space-y-1.5'>
      <span className='label-sm text-ink-primary'>{label}</span>
      {children}
      {hint && <span className='body-sm block text-ink-secondary'>{hint}</span>}
    </label>
  );
}

function RewardInputs({ event, onChange }: { event: GamificationEventConfig; onChange: (patch: Partial<GamificationEventConfig>) => void }) {
  return (
    <div className='grid grid-cols-3 gap-3'>
      <Field label='XP'>
        <input type='number' className={inputClass} value={event.xp} onChange={(entry) => onChange({ xp: Number(entry.target.value) || 0 })} />
      </Field>
      <Field label='Coins'>
        <input type='number' className={inputClass} value={event.coins} onChange={(entry) => onChange({ coins: Number(entry.target.value) || 0 })} />
      </Field>
      <Field label='Loot boxes'>
        <input type='number' className={inputClass} value={event.loot_boxes} onChange={(entry) => onChange({ loot_boxes: Number(entry.target.value) || 0 })} />
      </Field>
    </div>
  );
}

export default function IncentiveAdminPage() {
  const { user, notify } = useConsole();
  const [config, setConfig] = useState<GamificationAdminConfig | null>(null);
  const [tab, setTab] = useState<Tab>('economy');
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!user) return;
    if (user.role !== 'admin') {
      setIsLoading(false);
      return;
    }
    void (async () => {
      try {
        const response = await api.gamificationAdminConfig();
        setConfig(response.config);
        setUpdatedAt(response.updated_at ?? null);
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : 'Failed to load incentive rules.');
      } finally {
        setIsLoading(false);
      }
    })();
  }, [user]);

  const save = async () => {
    if (!config) return;
    setIsSaving(true);
    setError('');
    try {
      const response = await api.updateGamificationAdminConfig(config);
      setConfig(response.config);
      setUpdatedAt(response.updated_at ?? null);
      notify('Incentive rules saved.');
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Failed to save incentive rules.');
    } finally {
      setIsSaving(false);
    }
  };

  const updateConfig = (patch: Partial<GamificationAdminConfig>) =>
    setConfig((current) => (current ? { ...current, ...patch } : current));

  const updateReward = (eventKey: string, patch: Partial<GamificationEventConfig>) => {
    setConfig((current) => {
      if (!current) return current;
      return {
        ...current,
        reward_events: current.reward_events.map((event) =>
          event.event_key === eventKey ? { ...event, ...patch } : event,
        ),
      };
    });
  };

  if (isLoading) return <section className='body-md panel p-6 text-ink-secondary'>Loading incentive rules...</section>;
  if (!user || user.role !== 'admin') {
    return <section className='panel p-8 text-center'><ShieldCheck className='mx-auto h-8 w-8 text-amber-600' /><h1 className='title-section mt-4'>Admin access required</h1></section>;
  }
  if (!config) return <section className='body-md panel p-6 text-rose-600'>{error || 'Could not load incentive rules.'}</section>;

  const tabs: Array<[Tab, string, React.ElementType]> = [
    ['economy', 'Economy', Zap], ['quests', 'Daily quests', Target], ['badges', 'Badges', Award], ['rewards', 'Reward actions', Gift],
  ];
  const lootBoxCost = config.spend_events.find((event) => event.event_key === 'loot_box_open');

  return (
    <div className='mx-auto flex max-w-6xl flex-col gap-5 pb-10'>
      <header className='flex flex-col gap-4 border-b border-border/60 pb-5 lg:flex-row lg:items-end lg:justify-between'>
        <div>
          <div className='mb-2 flex items-center gap-2 text-primary'><Sparkles className='h-4 w-4' /><span className='label-sm'>GAMIFICATION CONTROL</span></div>
          <h1 className='title-section'>Incentives</h1>
          <p className='body-md mt-1 max-w-2xl text-ink-secondary'>Set the rewards that shape daily practice, applications, and progress. Every control on this page maps to an active backend rule.</p>
          {updatedAt && <p className='body-sm mt-2 text-ink-secondary'>Last saved {new Date(updatedAt).toLocaleString()}</p>}
        </div>
        <button type='button' onClick={save} disabled={isSaving} className='label inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-primary px-4 text-primary-foreground disabled:opacity-60'>
          {isSaving ? <Loader2 className='h-4 w-4 animate-spin' /> : <Save className='h-4 w-4' />}{isSaving ? 'Saving...' : 'Save changes'}
        </button>
      </header>

      {error && <div className='rounded-lg border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-700'>{error}</div>}

      <nav className='flex gap-1 overflow-x-auto border-b border-border/60' aria-label='Incentive settings'>
        {tabs.map(([id, label, Icon]) => <button key={id} type='button' onClick={() => setTab(id)} className={`inline-flex shrink-0 items-center gap-2 border-b-2 px-3 py-3 text-sm font-semibold transition ${tab === id ? 'border-primary text-primary' : 'border-transparent text-ink-secondary hover:text-ink-primary'}`}><Icon className='h-4 w-4' />{label}</button>)}
      </nav>

      {tab === 'economy' && <div className='grid gap-5 lg:grid-cols-2'>
        <section className='border border-border/60 bg-panel/50 p-5'>
          <h2 className='title-sub'>Daily earning limits</h2><p className='body-sm mt-1 text-ink-secondary'>Caps apply to XP and coins earned from configured rewards. Loot boxes are not capped.</p>
          <div className='mt-5 grid gap-4 sm:grid-cols-2'>
            <Field label='Maximum XP per day'><input type='number' min={0} className={inputClass} value={config.max_daily_xp_gain ?? 500} onChange={(entry) => updateConfig({ max_daily_xp_gain: number(entry.target.value) })} /></Field>
            <Field label='Maximum coins per day'><input type='number' min={0} className={inputClass} value={config.max_daily_coin_gain ?? 100} onChange={(entry) => updateConfig({ max_daily_coin_gain: number(entry.target.value) })} /></Field>
          </div>
        </section>
        <section className='border border-border/60 bg-panel/50 p-5'>
          <h2 className='title-sub'>New member gift</h2><p className='body-sm mt-1 text-ink-secondary'>Granted only once when a member claims their welcome bonus.</p>
          <div className='mt-5 grid gap-4 sm:grid-cols-3'>
            <Field label='Coins'><input type='number' min={0} className={inputClass} value={config.welcome_bonus_coins ?? 100} onChange={(entry) => updateConfig({ welcome_bonus_coins: number(entry.target.value) })} /></Field>
            <Field label='XP'><input type='number' min={0} className={inputClass} value={config.welcome_bonus_xp ?? 50} onChange={(entry) => updateConfig({ welcome_bonus_xp: number(entry.target.value) })} /></Field>
            <Field label='Loot boxes'><input type='number' min={0} className={inputClass} value={config.welcome_bonus_loot_boxes ?? 1} onChange={(entry) => updateConfig({ welcome_bonus_loot_boxes: number(entry.target.value) })} /></Field>
          </div>
        </section>
        <section className='border border-border/60 bg-panel/50 p-5 lg:col-span-2'>
          <h2 className='title-sub'>Loot box opening cost</h2><p className='body-sm mt-1 text-ink-secondary'>This is now enforced by the opening endpoint. Set zero to make boxes free to open.</p>
          {lootBoxCost ? <div className='mt-4 max-w-xs'><Field label='Boxes consumed'><input type='number' min={0} className={inputClass} value={Math.max(0, -lootBoxCost.loot_boxes)} onChange={(entry) => updateConfig({ spend_events: config.spend_events.map((event) => event.event_key === 'loot_box_open' ? { ...event, loot_boxes: -number(entry.target.value) } : event) })} /></Field></div> : <p className='body-sm mt-4 text-amber-700'>The loot box cost rule is missing from this configuration.</p>}
        </section>
      </div>}

      {tab === 'quests' && <section className='space-y-4'>
        <div className='flex flex-col justify-between gap-3 sm:flex-row sm:items-end'><div><h2 className='title-sub'>Daily quest templates</h2><p className='body-sm mt-1 text-ink-secondary'>Each day, the platform randomly selects up to the chosen number of enabled, visible templates.</p></div><div className='w-44'><Field label='Shown per day'><input type='number' min={1} className={inputClass} value={config.daily_selection_count} onChange={(entry) => updateConfig({ daily_selection_count: Math.max(1, number(entry.target.value, 1)) })} /></Field></div></div>
        {config.daily_quest_pool.map((quest, index) => <details key={quest.id} className='border border-border/60 bg-panel/50'><summary className='flex cursor-pointer list-none items-center gap-3 p-4'><ChevronDown className='h-4 w-4 shrink-0 transition group-open:rotate-180' /><div className='min-w-0 flex-1'><div className='font-semibold text-ink-primary'>{quest.title}</div><div className='body-sm mt-1 text-ink-secondary'>{metricLabel(quest.metric_key)}: {quest.target_value} | {rewardSummary(quest.reward_xp, quest.reward_coins, quest.reward_loot_boxes)}</div></div><Toggle checked={quest.enabled} label={quest.enabled ? 'Active' : 'Paused'} onChange={(enabled) => updateConfig({ daily_quest_pool: updateRow(config.daily_quest_pool, index, { enabled }) })} /></summary><div className='grid gap-4 border-t border-border/60 p-4 md:grid-cols-2'><Field label='Quest title'><input className={inputClass} value={quest.title} onChange={(entry) => updateConfig({ daily_quest_pool: updateRow(config.daily_quest_pool, index, { title: entry.target.value }) })} /></Field><Field label='Complete when'><select className={inputClass} value={quest.metric_key} onChange={(entry) => updateConfig({ daily_quest_pool: updateRow(config.daily_quest_pool, index, { metric_key: entry.target.value }) })}>{METRICS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></Field><Field label='Target'><input type='number' min={1} className={inputClass} value={quest.target_value} onChange={(entry) => updateConfig({ daily_quest_pool: updateRow(config.daily_quest_pool, index, { target_value: Math.max(1, number(entry.target.value, 1)) }) })} /></Field><div className='grid grid-cols-3 gap-3'><Field label='XP'><input type='number' className={inputClass} value={quest.reward_xp} onChange={(entry) => updateConfig({ daily_quest_pool: updateRow(config.daily_quest_pool, index, { reward_xp: Number(entry.target.value) || 0 }) })} /></Field><Field label='Coins'><input type='number' className={inputClass} value={quest.reward_coins} onChange={(entry) => updateConfig({ daily_quest_pool: updateRow(config.daily_quest_pool, index, { reward_coins: Number(entry.target.value) || 0 }) })} /></Field><Field label='Boxes'><input type='number' className={inputClass} value={quest.reward_loot_boxes} onChange={(entry) => updateConfig({ daily_quest_pool: updateRow(config.daily_quest_pool, index, { reward_loot_boxes: Number(entry.target.value) || 0 }) })} /></Field></div><Field label='Member-facing description'><input className={inputClass} value={quest.description} onChange={(entry) => updateConfig({ daily_quest_pool: updateRow(config.daily_quest_pool, index, { description: entry.target.value }) })} /></Field><div className='flex items-end'><Toggle checked={quest.visible} label={quest.visible ? 'Shown to members' : 'Hidden from rotation'} onChange={(visible) => updateConfig({ daily_quest_pool: updateRow(config.daily_quest_pool, index, { visible }) })} /></div></div></details>)}
        <button type='button' className='label inline-flex items-center gap-2 rounded-lg border border-border/60 px-3 py-2 text-primary' onClick={() => updateConfig({ daily_quest_pool: [...config.daily_quest_pool, { id: `daily_${Date.now()}`, title: 'New daily quest', description: '', metric_key: 'practice_completed_today', target_value: 1, category: 'daily', enabled: true, visible: true, reward_xp: 0, reward_coins: 0, reward_loot_boxes: 0 }] })}><CirclePlus className='h-4 w-4' />Add daily quest</button>
      </section>}

      {tab === 'badges' && <section className='space-y-4'><div><h2 className='title-sub'>Badge milestones</h2><p className='body-sm mt-1 text-ink-secondary'>Badges are evaluated after practice completion. Identifiers are intentionally fixed after creation so unlocked history remains consistent.</p></div>{config.badges.map((badge, index) => <details key={badge.badge_id} className='border border-border/60 bg-panel/50'><summary className='flex cursor-pointer list-none items-center gap-3 p-4'><ChevronDown className='h-4 w-4 shrink-0' /><div className='min-w-0 flex-1'><div className='font-semibold'>{badge.badge_name}</div><div className='body-sm mt-1 text-ink-secondary'>{metricLabel(badge.metric_key)}: {badge.target_value}</div></div><Toggle checked={badge.enabled} label={badge.enabled ? 'Active' : 'Paused'} onChange={(enabled) => updateConfig({ badges: updateRow(config.badges, index, { enabled }) })} /></summary><div className='grid gap-4 border-t border-border/60 p-4 md:grid-cols-2'><Field label='Badge name'><input className={inputClass} value={badge.badge_name} onChange={(entry) => updateConfig({ badges: updateRow(config.badges, index, { badge_name: entry.target.value }) })} /></Field><Field label='Unlock when'><select className={inputClass} value={badge.metric_key} onChange={(entry) => updateConfig({ badges: updateRow(config.badges, index, { metric_key: entry.target.value }) })}>{METRICS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></Field><Field label='Target'><input type='number' min={1} className={inputClass} value={badge.target_value} onChange={(entry) => updateConfig({ badges: updateRow(config.badges, index, { target_value: Math.max(1, number(entry.target.value, 1)) }) })} /></Field><Field label='Member-facing description'><input className={inputClass} value={badge.description} onChange={(entry) => updateConfig({ badges: updateRow(config.badges, index, { description: entry.target.value }) })} /></Field></div></details>)}<button type='button' className='label inline-flex items-center gap-2 rounded-lg border border-border/60 px-3 py-2 text-primary' onClick={() => updateConfig({ badges: [...config.badges, { badge_id: `badge_${Date.now()}`, badge_name: 'New badge', description: '', metric_key: 'practice_completed_total', target_value: 1, enabled: true, visible: true }] })}><CirclePlus className='h-4 w-4' />Add badge</button></section>}

      {tab === 'rewards' && <section className='space-y-4'><div><h2 className='title-sub'>Reward actions</h2><p className='body-sm mt-1 text-ink-secondary'>These are the product actions that the backend currently emits. They cannot be renamed or deleted, so changing a value always affects the expected action.</p></div>{REWARD_EVENTS.map(([key, label, description]) => { const event = config.reward_events.find((item) => item.event_key === key); if (!event) return <div key={key} className='border border-amber-500/30 bg-amber-500/5 p-4 text-sm text-amber-800'>{label} is missing from the saved configuration.</div>; return <section key={key} className='border border-border/60 bg-panel/50 p-4'><div className='mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between'><div><h3 className='font-semibold text-ink-primary'>{label}</h3><p className='body-sm mt-1 text-ink-secondary'>{description}</p></div><Toggle checked={event.enabled} label={event.enabled ? 'Enabled' : 'Disabled'} onChange={(enabled) => updateReward(key, { enabled })} /></div><RewardInputs event={event} onChange={(patch) => updateReward(key, patch)} /></section>; })}</section>}
    </div>
  );
}
