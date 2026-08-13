/** @format */

'use client';
import { Tooltip } from '@jobby/ui';

import React, { useEffect, useState, useRef } from 'react';
import {
  Flame,
  Trophy,
  CircleDollarSign,
  CalendarCheck,
  Library,
  Gift,
  Loader2,
  Send,
  UserStar,
  Dumbbell,
  Package,
  X,
  ShieldCheck,
  Sparkles,
  Clock,
  CheckCircle2,
} from 'lucide-react';
import { api } from '@/lib/api';

import { showGlobalToast } from '@/lib/toast';
import { showCelebrationEvent } from '@/lib/celebration';
import { cn } from '@/lib/utils';
import { useConsole } from '@/components/ConsoleContext';
import type { UserInventoryResponse } from '@/lib/types';

// ─── Item Definitions ────────────────────────────────────────────────────────
const ITEM_DEFS = [
  {
    key: 'loot_box',
    label: 'Mystic Loot Box',
    desc: 'Open to receive 10–50 gold coins and random bonuses.',
    icon: '/loot-box.png',
    color: 'purple',
    badge: null,
    action: 'Open Box',
    actioningLabel: 'Opening…',
  },
  {
    key: 'streak_card',
    label: 'Streak Saver',
    desc: 'Passive — auto-protects your streak if you miss a day.',
    icon: '/streak-card.png',
    color: 'amber',
    badge: 'Passive',
    action: null,
    actioningLabel: null,
  },
  {
    key: 'double_xp',
    label: '2× XP Booster',
    desc: 'Doubles XP from all practice sessions for 24 hours.',
    icon: '/double-xp-card.png',
    color: 'sky',
    badge: null,
    action: 'Activate (24h)',
    actioningLabel: 'Activating…',
  },
  {
    key: 'vip_days',
    label: '3-Day VIP Pass',
    desc: 'Waives 100% of AI evaluation coin costs for 3 days.',
    icon: '/vip-card.png',
    color: 'purple',
    badge: null,
    action: 'Activate VIP',
    actioningLabel: 'Activating…',
  },
] as const;

const COLOR_MAP: Record<
  string,
  {
    card: string;
    badge: string;
    btn: string;
    owned: string;
    dot: string;
    stageBg: string;
    stageBorder: string;
    stageGlow: string;
    ringFront: string;
  }
> = {
  purple: {
    card: 'hover:border-purple-500/50 hover:bg-purple-500/5',
    badge: 'bg-purple-500/15 text-purple-300 border-purple-500/30',
    btn: 'bg-purple-600 hover:bg-purple-500 shadow-purple-600/25',
    owned: 'text-purple-400',
    dot: 'bg-purple-400',
    stageBg:
      'bg-gradient-to-b from-purple-500/30 via-purple-600/10 to-transparent',
    stageBorder: 'border-purple-400/50',
    stageGlow: 'shadow-[0_0_15px_rgba(168,85,247,0.35)]',
    ringFront: 'border-purple-400/70',
  },
  amber: {
    card: 'hover:border-amber-500/50 hover:bg-amber-500/5',
    badge: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
    btn: 'bg-amber-600 hover:bg-amber-500 shadow-amber-600/25',
    owned: 'text-amber-400',
    dot: 'bg-amber-400',
    stageBg:
      'bg-gradient-to-b from-amber-500/30 via-amber-600/10 to-transparent',
    stageBorder: 'border-amber-400/50',
    stageGlow: 'shadow-[0_0_15px_rgba(245,158,11,0.35)]',
    ringFront: 'border-amber-400/70',
  },
  sky: {
    card: 'hover:border-sky-500/50 hover:bg-sky-500/5',
    badge: 'bg-sky-500/15 text-sky-300 border-sky-500/30',
    btn: 'bg-sky-600 hover:bg-sky-500 shadow-sky-600/25',
    owned: 'text-sky-400',
    dot: 'bg-sky-400',
    stageBg: 'bg-gradient-to-b from-sky-500/30 via-sky-600/10 to-transparent',
    stageBorder: 'border-sky-400/50',
    stageGlow: 'shadow-[0_0_15px_rgba(99,102,241,0.35)]',
    ringFront: 'border-sky-400/70',
  },
  yellow: {
    card: 'hover:border-yellow-500/50 hover:bg-yellow-500/5',
    badge: 'bg-yellow-500/15 text-yellow-300 border-yellow-500/30',
    btn: 'bg-yellow-500 hover:bg-yellow-400 text-black shadow-yellow-500/25',
    owned: 'text-yellow-400',
    dot: 'bg-yellow-400',
    stageBg:
      'bg-gradient-to-b from-yellow-500/30 via-yellow-600/10 to-transparent',
    stageBorder: 'border-yellow-400/50',
    stageGlow: 'shadow-[0_0_15px_rgba(234,179,8,0.35)]',
    ringFront: 'border-yellow-400/70',
  },
};

// ─── Main Component ───────────────────────────────────────────────────────────
export function GamificationStats() {
  const { appStats } = useConsole();
  const [dailySummary, setDailySummary] = useState<any>(null);
  const [libraryCount, setLibraryCount] = useState<number>(0);
  const [isCheckingIn, setIsCheckingIn] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Backpack state
  const [isBackpackOpen, setIsBackpackOpen] = useState(false);
  const [invData, setInvData] = useState<UserInventoryResponse | null>(null);
  const [invLoading, setInvLoading] = useState(false);
  const [usingItem, setUsingItem] = useState<string | null>(null);
  const [actionMsg, setActionMsg] = useState<string | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // ── Fetch gamification summary ────────────────────────────────────────────
  const fetchData = async () => {
    try {
      const summary = await api.gamificationSummary().catch(() => null);
      if (summary) {
        setDailySummary(summary);
        // Use library_count from summary if available, otherwise keep current value
        if (typeof (summary as any).library_count === 'number') {
          setLibraryCount((summary as any).library_count);
        }
      }
    } catch (err) {
      console.error('Failed to fetch gamification stats in navbar:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Sync library count from page-level components that already load questions
  useEffect(() => {
    const handleLibraryCount = (e: Event) => {
      const count = (e as CustomEvent<number>).detail;
      if (typeof count === 'number') setLibraryCount(count);
    };
    window.addEventListener('jobby:libraryCountUpdated', handleLibraryCount);
    return () =>
      window.removeEventListener(
        'jobby:libraryCountUpdated',
        handleLibraryCount,
      );
  }, []);

  useEffect(() => {
    void fetchData();
    const handleUpdate = () => void fetchData();
    window.addEventListener('playbookGamificationUpdated', handleUpdate);
    window.addEventListener('playbookLibraryUpdated', handleUpdate);
    window.addEventListener('playbookPlanChanged', handleUpdate);
    return () => {
      window.removeEventListener('playbookGamificationUpdated', handleUpdate);
      window.removeEventListener('playbookLibraryUpdated', handleUpdate);
      window.removeEventListener('playbookPlanChanged', handleUpdate);
    };
  }, []);

  // ── Fetch inventory when backpack opens ────────────────────────────────────
  const fetchInventory = async () => {
    setInvLoading(true);
    try {
      const res = await api.getInventory();
      setInvData(res);
    } catch (err) {
      console.error('Failed to fetch inventory:', err);
    } finally {
      setInvLoading(false);
    }
  };

  useEffect(() => {
    if (isBackpackOpen) {
      setActionMsg(null);
      void fetchInventory();
    }
  }, [isBackpackOpen]);

  // ── Click-away ─────────────────────────────────────────────────────────────
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setIsBackpackOpen(false);
      }
    };
    if (isBackpackOpen) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [isBackpackOpen]);

  // ── Check-in ───────────────────────────────────────────────────────────────
  const handleCheckIn = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isCheckingIn || dailySummary?.has_checked_in_today) return;
    setIsCheckingIn(true);
    try {
      const res = await api.gamificationCheckin();
      showGlobalToast(
        `Checked in: +${res.xp_earned} XP, +${res.coins_earned} Coins`,
      );
      if (
        res.xp_earned > 0 ||
        res.coins_earned > 0 ||
        res.loot_boxes_earned > 0
      ) {
        showCelebrationEvent('daily_checkin');
      }
      window.dispatchEvent(new Event('playbookGamificationUpdated'));
    } catch (err) {
      console.error('Check-in failed:', err);
      showGlobalToast('Check-in failed. Please try again.');
    } finally {
      setIsCheckingIn(false);
    }
  };

  // ── Use item ───────────────────────────────────────────────────────────────
  const handleUseItem = async (itemKey: string) => {
    setUsingItem(itemKey);
    setActionMsg(null);
    try {
      const res = await api.useInventoryItem(itemKey);
      setActionMsg(res.message);
      if (itemKey === 'loot_box') {
        showCelebrationEvent(
          'loot_box_opened',
          `Loot Box Opened! Won +${(res as any).coins_won || 0} Coins!`,
        );
      } else {
        showCelebrationEvent('reward_claimed', res.message);
      }
      await fetchInventory();
      window.dispatchEvent(new Event('playbookGamificationUpdated'));
    } catch (err: any) {
      setActionMsg(err?.message || 'Failed to use item');
    } finally {
      setUsingItem(null);
    }
  };

  if (isLoading && !dailySummary) {
    return (
      <div className='flex items-center justify-center h-8 px-4'>
        <Loader2 className='w-4 h-4 animate-spin text-ink-secondary' />
      </div>
    );
  }

  // Derived values
  const inventory = invData?.inventory || dailySummary?.inventory || {};
  const boosters =
    invData?.active_boosters || dailySummary?.active_boosters || {};
  const isDoubleXpActive =
    boosters.double_xp_until && new Date(boosters.double_xp_until) > new Date();
  const isVipActive =
    boosters.vip_until && new Date(boosters.vip_until) > new Date();
  const totalItems = ITEM_DEFS.reduce(
    (acc, d) => acc + (inventory[d.key] || 0),
    0,
  );

  return (
    <div className='flex items-center'>
      {/* Check In */}
      {!dailySummary?.has_checked_in_today && (
        <Tooltip
          content={
            <p className='label-sm text-center leading-relaxed'>
              {dailySummary?.has_checked_in_today ?
                'Today check-in completed'
              : 'Claim Daily Check-in'}
            </p>
          }
          side='bottom'
        >
          <button
            onClick={handleCheckIn}
            disabled={dailySummary?.has_checked_in_today || isCheckingIn}
            className={cn(
              'flex items-center hover:bg-success/10 gap-2 px-4 py-1.5 rounded-full text-[13px] font-bold transition-all select-none active:scale-95 duration-200',
              dailySummary?.has_checked_in_today ?
                'text-ink-primary cursor-default'
              : 'text-success/80 cursor-pointer',
            )}
          >
            {isCheckingIn ?
              <Loader2 className='w-4 h-4 animate-spin' />
            : <CalendarCheck
                className={cn(
                  'w-4 h-4',
                  dailySummary?.has_checked_in_today ? 'text-primary' : (
                    'text-success'
                  ),
                )}
              />
            }
            <span>
              {dailySummary?.has_checked_in_today ? 'Claimed' : 'Check in'}
            </span>
          </button>
        </Tooltip>
      )}

      {/* Today's Submitted Applications Count */}
      <Tooltip
        content={
          <p className='label-sm text-center leading-relaxed'>
            Today's Submitted Applications
          </p>
        }
        side='bottom'
      >
        <div className='flex items-center gap-1.5 px-4 py-1.5 rounded-full cursor-pointer transition-colors text-[13px] font-bold text-info select-none'>
          <Send className='w-4 h-4' />
          <span>{appStats ? appStats.today_submitted : 0}</span>
        </div>
      </Tooltip>

      <div className='w-0.5 h-2 bg-primary/40' />

      {/* Practice Count */}
      <Tooltip
        content={
          <p className='label-sm text-center leading-relaxed'>
            Today's Practice Questions
          </p>
        }
        side='bottom'
      >
        <div className='flex items-center gap-1.5 px-4 py-1.5 rounded-full cursor-pointer transition-colors text-[13px] font-bold text-red-600 dark:text-red-400 select-none'>
          <Dumbbell className='w-4 h-4 text-red-500' />
          <span>{dailySummary?.completed_questions || 0}</span>
        </div>
      </Tooltip>

      <div className='w-0.5 h-2 bg-primary/40' />

      {/* Streak */}
      <Tooltip
        content={
          <p className='label-sm text-center leading-relaxed'>Current Streak</p>
        }
        side='bottom'
      >
        <div className='flex items-center gap-1.5 px-4 py-1.5 rounded-full cursor-pointer transition-colors text-[13px] font-bold text-amber-600 dark:text-amber-500 select-none'>
          <Flame className='w-4 h-4 text-amber-500 fill-amber-500/10' />
          <span>{dailySummary?.current_streak || 0}</span>
        </div>
      </Tooltip>

      <div className='w-0.5 h-2 bg-primary/40' />

      {/* Library Count */}
      <Tooltip
        content={
          <p className='label-sm text-center leading-relaxed'>
            Library Questions
          </p>
        }
        side='bottom'
      >
        <div className='flex items-center gap-1.5 px-4 py-1.5 rounded-full cursor-pointer transition-colors text-[13px] font-bold text-sky-600 dark:text-sky-400 select-none'>
          <Library className='w-4 h-4 text-sky-500' />
          <span>{libraryCount}</span>
        </div>
      </Tooltip>

      <div className='w-0.5 h-2 bg-primary/40' />

      {/* Level */}
      <Tooltip
        content={
          <div className='body-sm text-center text-ink-secondary'>
            <p className='font-medium'>Level {dailySummary?.level || 1}</p>
            {dailySummary?.max_daily_xp_gain != null && (
              <p className='mt-1 text-[10px] opacity-80'>
                Daily XP: {dailySummary?.xp_gained_today || 0}/
                {dailySummary.max_daily_xp_gain}
              </p>
            )}
          </div>
        }
        side='bottom'
      >
        <div className='flex items-center gap-1.5 px-4 py-1.5 rounded-full cursor-pointer transition-colors text-[13px] font-bold text-green-800 dark:text-green-300 select-none'>
          <UserStar className='w-4 h-4' />
          <span className='flex items-baseline text-ink-primary'>
            <span className='text-ink-primary/50 text-[10px]'>Lv.</span>
            {dailySummary?.level || 1}
          </span>
        </div>
      </Tooltip>

      <div className='w-0.5 h-2 bg-primary/40' />

      {/* Coins */}
      <Tooltip
        content={
          <div className='body-sm text-center text-ink-secondary'>
            <p className='font-medium'>
              Total Coins: {dailySummary?.total_coins || 0}
            </p>
            {dailySummary?.max_daily_coin_gain != null && (
              <p className='mt-1 text-[10px] opacity-80'>
                Daily Coins: {dailySummary?.coins_gained_today || 0}/
                {dailySummary.max_daily_coin_gain}
              </p>
            )}
          </div>
        }
        side='bottom'
      >
        <div className='flex items-center gap-1.5 px-4 py-1.5 rounded-full cursor-pointer transition-colors text-[13px] font-bold text-yellow-600 dark:text-yellow-400 select-none'>
          <CircleDollarSign className='w-4 h-4 text-yellow-500' />
          <span>{dailySummary?.total_coins || 0}</span>
        </div>
      </Tooltip>

      <div className='w-0.5 h-2 bg-primary/40' />

      {/* ── Backpack Button + Popover ──────────────────────────────────────── */}
      <div className='relative' ref={panelRef}>
        <Tooltip
          content={
            <p className='label-sm text-center leading-relaxed'>Backpack</p>
          }
          side='bottom'
        >
          <button
            onClick={() => setIsBackpackOpen((v) => !v)}
            className='flex items-center gap-1.5 px-4 py-1.5 rounded-full cursor-pointer transition-colors text-[13px] font-bold text-purple-600 dark:text-purple-400 select-none'
          >
            <Gift className='w-4 h-4 text-purple-500' />
            <span>{totalItems}</span>
          </button>
        </Tooltip>

        {/* ── Backpack Popover Panel ─────────────────────────────────────── */}
        {isBackpackOpen && (
          <div
            className='absolute right-0 top-[calc(100%+10px)] w-[420px] z-50 rounded-2xl shadow-2xl border border-white/10 bg-zinc-900/95 backdrop-blur-xl overflow-hidden'
            style={{
              animation:
                'backpackSlideIn 0.18s cubic-bezier(0.16,1,0.3,1) both',
            }}
          >
            {/* Header */}
            <div className='flex items-center justify-between px-4 py-3 border-b border-white/8'>
              <div className='flex items-center gap-2.5'>
                <div className='w-7 h-7 rounded-xl bg-primary/20 border border-primary/30 flex items-center justify-center text-primary'>
                  <Package className='w-3.5 h-3.5' />
                </div>
                <div>
                  <p className='text-[13px] font-black text-white leading-none'>
                    Backpack
                  </p>
                  <p className='text-[10px] text-white/40 mt-0.5 font-medium'>
                    {totalItems} item{totalItems !== 1 ? 's' : ''} in your
                    inventory
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsBackpackOpen(false)}
                className='w-6 h-6 rounded-full flex items-center justify-center text-white/40 hover:text-white hover:bg-white/10 transition-colors'
              >
                <X className='w-3.5 h-3.5' />
              </button>
            </div>

            {/* Active Booster Strip */}
            {(isDoubleXpActive || isVipActive) && (
              <div className='flex items-center gap-2 px-4 py-2 bg-emerald-500/10 border-b border-emerald-500/20 text-emerald-300 text-[11px] font-semibold'>
                <Sparkles className='w-3.5 h-3.5 shrink-0' />
                <span>
                  Active:{' '}
                  {[
                    isDoubleXpActive && '2× XP Booster',
                    isVipActive && 'VIP Pass',
                  ]
                    .filter(Boolean)
                    .join(' + ')}
                </span>
              </div>
            )}

            {/* Action message */}
            {actionMsg && (
              <div className='flex items-center gap-2 px-4 py-2 bg-primary/15 border-b border-primary/20 text-primary text-[11px] font-semibold'>
                <Sparkles className='w-3.5 h-3.5 shrink-0' />
                <span>{actionMsg}</span>
              </div>
            )}

            {/* Items */}
            <div className='p-3 flex flex-col gap-2'>
              {invLoading ?
                <div className='flex items-center justify-center py-8 gap-2 text-white/40 text-xs font-medium'>
                  <Loader2 className='w-4 h-4 animate-spin' />
                  <span>Loading inventory…</span>
                </div>
              : ITEM_DEFS.map((def) => {
                  const count = inventory[def.key] || 0;
                  const colors = COLOR_MAP[def.color];
                  const isEmpty = count === 0;

                  // Booster-active state
                  const isActive =
                    (def.key === 'double_xp' && isDoubleXpActive) ||
                    (def.key === 'vip_days' && isVipActive);

                  return (
                    <div
                      key={def.key}
                      className={cn(
                        'flex items-center gap-3 p-3 group/stage  rounded-xl border border-white/8 transition-all duration-150',
                        isEmpty ?
                          'opacity-40 hover:opacity-100 '
                        : colors.card + ' group/stage',
                      )}
                    >
                      {/* Icon - 3D Perspective Pedestal / Portal Stage */}
                      <div className='relative w-16 h-16 sm:w-18 sm:h-18 flex items-center justify-center shrink-0 [perspective:500px] select-none '>
                        {/* 1. Tilted Perspective Ellipse Base (Behind card upper body) */}
                        <div
                          className={cn(
                            'absolute bottom-0 w-15 h-7 rounded-[100%] border-2 transition-all duration-300 [transform:rotateX(68deg)]',
                            isEmpty ?
                              'bg-white/5 border-white/10'
                            : `${colors.stageBg} ${colors.stageBorder} ${colors.stageGlow}`,
                          )}
                        />

                        {/* Inner Track Ring for 3D depth */}
                        <div
                          className={cn(
                            'absolute bottom-1 w-11 h-4 group-hover/stage:animate-text-shimmer-primary animate-text-shimmer rounded-[100%] border border-dashed transition-all duration-300 [transform:rotateX(98deg)] opacity-60',
                            isEmpty ? 'border-white/10' : colors.stageBorder,
                          )}
                        />

                        {/* 2. Floating Item Image (Obscures the back half of the ring, pops up in 3D) */}
                        <img
                          src={def.icon}
                          alt={def.label}
                          className={cn(
                            `relative z-10 w-20 h-20 object-contain -translate-y-1.5 e group-hover/stage:drop-shadow-[0_8px_6px_rgba(245,158,11,0.8)] transition-all duration-300  scale-75`,
                            isEmpty ?
                              'grayscale group-hover/stage:grayscale-0 opacity-45 group-hover/stage:opacity-100 group-hover/stage:-translate-y-3 group-hover/stage:scale-110 '
                            : 'group-hover/stage:-translate-y-10 group-hover/stage:scale-110',
                          )}
                        />

                        {/* 3. Front Arc of the Ellipse Ring (Creates the "emerging/passing through" clipping effect) */}
                        <div
                          className={cn(
                            'absolute bottom-0 w-15  h-3.5 group-hover/stage:translate-y-1 group-hover/stage:scale-110 rounded-b-full border-b-2 pointer-events-none z-20 transition-all duration-300',
                            isEmpty ? 'border-white/10 ' : colors.ringFront,
                          )}
                        />
                      </div>
                      {/* Info */}
                      <div className='flex-1 min-w-0'>
                        <div className='flex items-center gap-1.5 mb-0.5'>
                          <span className='text-[12px] font-black text-white leading-none'>
                            {def.label}
                          </span>
                          {isActive && (
                            <span className='flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 text-[9px] font-bold'>
                              <CheckCircle2 className='w-2.5 h-2.5' /> Active
                            </span>
                          )}
                          {def.badge && !isActive && (
                            <span
                              className={cn(
                                'px-1.5 py-0.5 rounded-full border text-[9px] font-bold',
                                colors.badge,
                              )}
                            >
                              {def.badge}
                            </span>
                          )}
                        </div>
                        <p className='text-[10px] text-white/45 font-medium leading-snug line-clamp-1'>
                          {def.desc}
                        </p>
                        <p
                          className={cn(
                            'text-[10px] font-extrabold mt-1',
                            isEmpty ? 'text-white/25' : colors.owned,
                          )}
                        >
                          {count === 0 ? 'None' : `× ${count} owned`}
                        </p>
                      </div>
                      {/* Action */}
                      {!isEmpty && (
                        <div className='shrink-0'>
                          {def.action === null ?
                            // Passive items — just show shield icon
                            <div
                              className={cn(
                                'w-8 h-8 rounded-xl flex items-center justify-center',
                                isEmpty ? 'bg-white/5' : 'bg-amber-500/15',
                              )}
                            >
                              <ShieldCheck
                                className={cn(
                                  'w-4 h-4',
                                  isEmpty ? 'text-white/20' : 'text-amber-400',
                                )}
                              />
                            </div>
                          : isActive ?
                            <span
                              className={cn(
                                'flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-[10px] font-bold border',
                                colors.badge,
                              )}
                            >
                              <Clock className='w-3 h-3 animate-spin' /> On
                            </span>
                          : <button
                              disabled={isEmpty || usingItem === def.key}
                              onClick={() => handleUseItem(def.key)}
                              className={cn(
                                'px-3 py-1.5 rounded-xl text-white text-[11px] font-bold transition-all shadow-md disabled:opacity-30 disabled:cursor-not-allowed active:scale-95',
                                colors.btn,
                              )}
                            >
                              {usingItem === def.key ?
                                <span className='flex items-center gap-1'>
                                  <Loader2 className='w-3 h-3 animate-spin' />
                                  {def.actioningLabel}
                                </span>
                              : def.action}
                            </button>
                          }
                        </div>
                      )}
                    </div>
                  );
                })
              }
            </div>

            {/* Footer hint */}
            <div className='px-4 py-2.5 border-t border-white/8 text-center text-[10px] text-white/30 font-medium select-none'>
              Items are added when you claim stage rewards 🎁
            </div>
          </div>
        )}
      </div>

      {/* Keyframe animation */}
      <style>{`
        @keyframes backpackSlideIn {
          from { opacity: 0; transform: translateY(-8px) scale(0.97); }
          to   { opacity: 1; transform: translateY(0)    scale(1);    }
        }
      `}</style>
    </div>
  );
}
