/** @format */

'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Package,
  X,
  Coins,
  Zap,
  Flame,
  Crown,
  Sparkles,
  Gift,
  CheckCircle2,
  Clock,
  ShieldCheck,
} from 'lucide-react';
import { api } from '@/lib/api';
import type { UserInventoryResponse } from '@/lib/types';
import { showCelebrationEvent } from '@/lib/celebration';

interface InventoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onInventoryUpdated?: () => void;
}

export function InventoryModal({
  isOpen,
  onClose,
  onInventoryUpdated,
}: InventoryModalProps) {
  const [data, setData] = useState<UserInventoryResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [usingItem, setUsingItem] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const fetchInventory = async () => {
    setIsLoading(true);
    try {
      const res = await api.getInventory();
      setData(res);
    } catch (err) {
      console.error('Failed to fetch inventory:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      void fetchInventory();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleUseItem = async (itemType: string) => {
    setUsingItem(itemType);
    setMessage(null);
    try {
      const res = await api.useInventoryItem(itemType);
      setMessage(res.message);
      if (itemType === 'loot_box') {
        showCelebrationEvent(
          'loot_box_opened',
          `Loot Box Opened! Won +${res.coins_won || 0} Coins!`,
        );
      } else {
        showCelebrationEvent('reward_claimed', res.message);
      }
      await fetchInventory();
      if (onInventoryUpdated) onInventoryUpdated();
    } catch (err: any) {
      setMessage(err?.message || 'Failed to use item');
    } finally {
      setUsingItem(null);
    }
  };

  const inventory = data?.inventory || {};
  const boosters = data?.active_boosters || {};

  const isDoubleXpActive =
    boosters.double_xp_until &&
    new Date(boosters.double_xp_until) > new Date();
  const isVipActive =
    boosters.vip_until && new Date(boosters.vip_until) > new Date();

  return (
    <div className='fixed inset-0 z-50 flex items-center justify-center p-4'>
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className='absolute inset-0 bg-black/70 backdrop-blur-md'
        onClick={onClose}
      />

      {/* Modal Container */}
      <motion.div
        initial={{ scale: 0.95, opacity: 0, y: 15 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.95, opacity: 0, y: 15 }}
        className='relative w-full max-w-xl bg-zinc-900 border border-white/15 rounded-3xl p-6 shadow-2xl text-white z-10 flex flex-col gap-5 overflow-hidden'
      >
        {/* Header */}
        <div className='flex items-center justify-between border-b border-white/10 pb-4'>
          <div className='flex items-center gap-3'>
            <div className='w-10 h-10 rounded-2xl bg-primary/20 border border-primary/40 flex items-center justify-center text-primary shadow-lg shadow-primary/20'>
              <Package className='w-5 h-5' />
            </div>
            <div>
              <h2 className='text-lg font-black tracking-tight text-white flex items-center gap-2'>
                Backpack & Props
              </h2>
              <p className='text-xs text-white/60 font-medium'>
                Manage your booster items and rewards
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className='p-2 rounded-full text-white/60 hover:text-white hover:bg-white/10 transition-colors'
          >
            <X className='w-5 h-5' />
          </button>
        </div>

        {/* Currency & Active Boosters Bar */}
        <div className='grid grid-cols-2 sm:grid-cols-4 gap-2.5 p-3 rounded-2xl bg-white/5 border border-white/10 text-xs'>
          <div className='flex items-center gap-2 px-2.5 py-1.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300'>
            <Coins className='w-4 h-4 text-amber-400 shrink-0' />
            <div className='flex flex-col min-w-0'>
              <span className='text-[9px] text-white/50 uppercase font-bold'>
                Coins
              </span>
              <span className='font-black truncate'>{data?.coins || 0}</span>
            </div>
          </div>

          <div className='flex items-center gap-2 px-2.5 py-1.5 rounded-xl bg-primary/10 border border-primary/20 text-primary-foreground'>
            <Zap className='w-4 h-4 text-primary shrink-0' />
            <div className='flex flex-col min-w-0'>
              <span className='text-[9px] text-white/50 uppercase font-bold'>
                Level {data?.level || 1}
              </span>
              <span className='font-black truncate text-white'>
                {data?.xp || 0} XP
              </span>
            </div>
          </div>

          <div className='flex items-center gap-2 px-2.5 py-1.5 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-300'>
            <Gift className='w-4 h-4 text-purple-400 shrink-0' />
            <div className='flex flex-col min-w-0'>
              <span className='text-[9px] text-white/50 uppercase font-bold'>
                Loot Boxes
              </span>
              <span className='font-black truncate'>
                {inventory.loot_box || 0}
              </span>
            </div>
          </div>

          <div className='flex items-center gap-2 px-2.5 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300'>
            <ShieldCheck className='w-4 h-4 text-emerald-400 shrink-0' />
            <div className='flex flex-col min-w-0'>
              <span className='text-[9px] text-white/50 uppercase font-bold'>
                Boosters
              </span>
              <span className='font-black truncate text-[10px]'>
                {isDoubleXpActive && isVipActive ?
                  '2X XP & VIP'
                : isDoubleXpActive ?
                  '2X XP Active'
                : isVipActive ?
                  'VIP Active'
                : 'None'}
              </span>
            </div>
          </div>
        </div>

        {/* Action Message Toast */}
        <AnimatePresence>
          {message && (
            <motion.div
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              className='p-3 rounded-xl bg-primary/20 border border-primary/40 text-primary text-xs font-semibold flex items-center gap-2'
            >
              <Sparkles className='w-4 h-4 shrink-0' />
              <span>{message}</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Props Items Grid */}
        <div className='grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[340px] overflow-y-auto pr-1 custom-scrollbar'>
          {/* 1. Loot Box */}
          <div className='p-4 rounded-2xl bg-white/5 border border-white/10 flex flex-col justify-between gap-3 hover:border-purple-500/40 transition-all'>
            <div className='flex items-start gap-3'>
              <div className='w-12 h-12 rounded-xl bg-purple-500/15 border border-purple-500/30 flex items-center justify-center shrink-0 p-1'>
                <img
                  src='/loot-box.png'
                  alt='Mystic Loot Box'
                  className='w-full h-full object-contain'
                />
              </div>
              <div className='flex flex-col min-w-0'>
                <span className='text-xs font-black text-white'>
                  Mystic Loot Box
                </span>
                <span className='text-[10px] text-white/60 mt-0.5 line-clamp-2'>
                  Open for 10-50 Gold Coins and random bonuses.
                </span>
              </div>
            </div>
            <div className='flex items-center justify-between pt-2 border-t border-white/5'>
              <span className='text-xs font-extrabold text-purple-400'>
                Owned: {inventory.loot_box || 0}
              </span>
              <button
                disabled={(inventory.loot_box || 0) <= 0 || usingItem === 'loot_box'}
                onClick={() => handleUseItem('loot_box')}
                className='px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-40 disabled:hover:bg-purple-600 text-white font-bold text-xs transition-all shadow-md shadow-purple-600/30'
              >
                {usingItem === 'loot_box' ? 'Opening...' : 'Open Box'}
              </button>
            </div>
          </div>

          {/* 2. Streak Saver Card */}
          <div className='p-4 rounded-2xl bg-white/5 border border-white/10 flex flex-col justify-between gap-3 hover:border-amber-500/40 transition-all'>
            <div className='flex items-start gap-3'>
              <div className='w-12 h-12 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center shrink-0 p-1'>
                <img
                  src='/streak-card.png'
                  alt='Streak Saver Card'
                  className='w-full h-full object-contain'
                />
              </div>
              <div className='flex flex-col min-w-0'>
                <span className='text-xs font-black text-white flex items-center gap-1'>
                  Streak Saver Card <Flame className='w-3 h-3 text-amber-500' />
                </span>
                <span className='text-[10px] text-white/60 mt-0.5 line-clamp-2'>
                  Passive protection. Automatically saves your streak if you miss a day.
                </span>
              </div>
            </div>
            <div className='flex items-center justify-between pt-2 border-t border-white/5'>
              <span className='text-xs font-extrabold text-amber-400'>
                Owned: {inventory.streak_card || 0}
              </span>
              <span className='px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-300 border border-amber-500/20 text-[10px] font-bold'>
                Passive Protection
              </span>
            </div>
          </div>

          {/* 3. 2X XP Booster Card */}
          <div className='p-4 rounded-2xl bg-white/5 border border-white/10 flex flex-col justify-between gap-3 hover:border-primary/40 transition-all'>
            <div className='flex items-start gap-3'>
              <div className='w-12 h-12 rounded-xl bg-primary/15 border border-primary/30 flex items-center justify-center shrink-0 p-1'>
                <img
                  src='/double-xp-card.png'
                  alt='2X XP Booster Card'
                  className='w-full h-full object-contain'
                />
              </div>
              <div className='flex flex-col min-w-0'>
                <span className='text-xs font-black text-white flex items-center gap-1'>
                  2X XP Booster Card <Zap className='w-3 h-3 text-primary' />
                </span>
                <span className='text-[10px] text-white/60 mt-0.5 line-clamp-2'>
                  Doubles XP earned from all practice sessions for 24 hours.
                </span>
              </div>
            </div>
            <div className='flex items-center justify-between pt-2 border-t border-white/5'>
              <span className='text-xs font-extrabold text-primary'>
                Owned: {inventory.double_xp || 0}
              </span>
              {isDoubleXpActive ?
                <span className='px-2.5 py-1 rounded-full bg-primary/20 text-primary border border-primary/40 text-[10px] font-bold flex items-center gap-1'>
                  <Clock className='w-3 h-3 animate-spin' /> 24h Active
                </span>
              : <button
                  disabled={
                    (inventory.double_xp || 0) <= 0 || usingItem === 'double_xp'
                  }
                  onClick={() => handleUseItem('double_xp')}
                  className='px-3 py-1.5 rounded-xl bg-primary hover:opacity-95 disabled:opacity-40 text-primary-foreground font-bold text-xs transition-all shadow-md shadow-primary/30'
                >
                  {usingItem === 'double_xp' ? 'Activating...' : 'Activate (24h)'}
                </button>
              }
            </div>
          </div>

          {/* 4. 3-Day VIP Pass */}
          <div className='p-4 rounded-2xl bg-white/5 border border-white/10 flex flex-col justify-between gap-3 hover:border-yellow-500/40 transition-all'>
            <div className='flex items-start gap-3'>
              <div className='w-12 h-12 rounded-xl bg-yellow-500/15 border border-yellow-500/30 flex items-center justify-center shrink-0 p-1'>
                <img
                  src='/vip-card.png'
                  alt='3-Day VIP Pass'
                  className='w-full h-full object-contain'
                />
              </div>
              <div className='flex flex-col min-w-0'>
                <span className='text-xs font-black text-white flex items-center gap-1'>
                  3-Day VIP Pass <Crown className='w-3 h-3 text-yellow-400' />
                </span>
                <span className='text-[10px] text-white/60 mt-0.5 line-clamp-2'>
                  Waives 100% of AI evaluation coin costs for 3 days.
                </span>
              </div>
            </div>
            <div className='flex items-center justify-between pt-2 border-t border-white/5'>
              <span className='text-xs font-extrabold text-yellow-400'>
                Owned: {inventory.vip_days || 0}
              </span>
              {isVipActive ?
                <span className='px-2.5 py-1 rounded-full bg-yellow-500/20 text-yellow-300 border border-yellow-500/40 text-[10px] font-bold flex items-center gap-1'>
                  <CheckCircle2 className='w-3 h-3' /> VIP Active
                </span>
              : <button
                  disabled={
                    (inventory.vip_days || 0) <= 0 || usingItem === 'vip_days'
                  }
                  onClick={() => handleUseItem('vip_days')}
                  className='px-3 py-1.5 rounded-xl bg-yellow-500 hover:bg-yellow-400 disabled:opacity-40 text-black font-bold text-xs transition-all shadow-md shadow-yellow-500/30'
                >
                  {usingItem === 'vip_days' ? 'Activating...' : 'Activate VIP'}
                </button>
              }
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className='pt-2 border-t border-white/10 flex justify-end'>
          <button
            onClick={onClose}
            className='px-5 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-white font-bold text-xs transition-all'
          >
            Close Backpack
          </button>
        </div>
      </motion.div>
    </div>
  );
}
