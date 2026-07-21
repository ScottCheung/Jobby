/** @format */

'use client';

import React, { useEffect, useState } from 'react';
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
} from 'lucide-react';
import { api } from '@/lib/api';
import { Tooltip } from '@/components/UI/tooltip';
import { showGlobalToast } from '@/lib/toast';
import { showCelebrationEvent } from '@/lib/celebration';
import { cn } from '@/lib/utils';
import { useConsole } from '@/components/ConsoleContext';

export function GamificationStats() {
  const { appStats } = useConsole();
  const [dailySummary, setDailySummary] = useState<any>(null);
  const [libraryCount, setLibraryCount] = useState<number>(0);
  const [isCheckingIn, setIsCheckingIn] = useState(false);
  const [isOpeningBox, setIsOpeningBox] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isBackpackOpen, setIsBackpackOpen] = useState(false);

  const fetchData = async () => {
    try {
      const [summary, questions] = await Promise.all([
        api.gamificationSummary().catch(() => null),
        api.interviewQuestions().catch(() => []),
      ]);
      if (summary) setDailySummary(summary);
      setLibraryCount(questions.length);
    } catch (err) {
      console.error('Failed to fetch gamification stats in navbar:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void fetchData();

    const handleUpdate = () => {
      void fetchData();
    };

    window.addEventListener('playbookGamificationUpdated', handleUpdate);
    window.addEventListener('playbookLibraryUpdated', handleUpdate);
    window.addEventListener('playbookPlanChanged', handleUpdate);

    return () => {
      window.removeEventListener('playbookGamificationUpdated', handleUpdate);
      window.removeEventListener('playbookLibraryUpdated', handleUpdate);
      window.removeEventListener('playbookPlanChanged', handleUpdate);
    };
  }, []);

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

  const handleOpenLootBox = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (
      isOpeningBox ||
      !dailySummary?.loot_boxes ||
      dailySummary.loot_boxes <= 0
    )
      return;
    setIsOpeningBox(true);
    try {
      const res = await api.openLootBox();
      showGlobalToast(`Loot box opened: +${res.coins_won} coins!`);
      showCelebrationEvent(
        'loot_box_opened',
        `Loot box: +${res.coins_won} coins`,
      );
      window.dispatchEvent(new Event('playbookGamificationUpdated'));
    } catch (err) {
      console.error('Loot box opening failed:', err);
      showGlobalToast('Failed to open loot box.');
    } finally {
      setIsOpeningBox(false);
    }
  };

  if (isLoading && !dailySummary) {
    return (
      <div className='flex items-center justify-center h-8 px-4'>
        <Loader2 className='w-4 h-4 animate-spin text-ink-secondary' />
      </div>
    );
  }

  const hasLootBoxes = dailySummary?.loot_boxes > 0;

  return (
    <div className='flex items-center '>
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
                'text-ink-primary   cursor-default'
              : 'text-success/80  cursor-pointer',
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
        <div className='flex items-center gap-1.5 px-4 py-1.5 rounded-full cursor-pointer  transition-colors text-[13px] font-bold text-info select-none'>
          <Send className='w-4 h-4  ' />
          <span> {appStats ? appStats.today_submitted : 0}</span>
        </div>
      </Tooltip>

      <div className='w-0.5 h-2 bg-primary/40' />

      {/* Today's Practice Count */}
      <Tooltip
        content={
          <p className='label-sm text-center leading-relaxed'>
            Today's Practice Questions
          </p>
        }
        side='bottom'
      >
        <div className='flex items-center gap-1.5 px-4 py-1.5 rounded-full cursor-pointer  transition-colors text-[13px] font-bold text-red-600 dark:text-red-400 select-none'>
          <Dumbbell className='w-4 h-4 text-red-500' />
          <span> {dailySummary?.completed_questions || 0}</span>
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
        <div className='flex items-center gap-1.5 px-4 py-1.5 rounded-full cursor-pointer  transition-colors text-[13px] font-bold text-amber-600 dark:text-amber-500 select-none'>
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
        <div className='flex items-center gap-1.5 px-4 py-1.5 rounded-full cursor-pointer  transition-colors text-[13px] font-bold text-sky-600 dark:text-sky-400 select-none'>
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
        <div className='flex items-center gap-1.5 px-4 py-1.5 rounded-full cursor-pointer  transition-colors text-[13px] font-bold text-green-800 dark:text-green-300 select-none'>
          <UserStar className='w-4 h-4 ' />
          <span className='flex items-baseline  text-ink-primary'>
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
        <div className='flex items-center gap-1.5 px-4 py-1.5 rounded-full cursor-pointer  transition-colors text-[13px] font-bold text-yellow-600 dark:text-yellow-400 select-none'>
          <CircleDollarSign className='w-4 h-4 text-yellow-500' />
          <span>{dailySummary?.total_coins || 0}</span>
        </div>
      </Tooltip>

      <div className='w-0.5 h-2 bg-primary/40' />

      {/* Loot Boxes */}
      <div className='relative'>
        <Tooltip
          content={
            <p className='label-sm text-center leading-relaxed'>
              Your Inventory
            </p>
          }
          side='bottom'
        >
          <button
            onClick={() => setIsBackpackOpen(!isBackpackOpen)}
            className={cn(
              'flex items-center gap-1.5 px-4 py-1.5 rounded-full text-[13px] font-bold transition-all select-none active:scale-95 duration-200 cursor-pointer',
              hasLootBoxes ?
                'text-pink-600 dark:text-pink-400 hover:bg-pink-500/25 '
              : 'text-ink-secondary/70 hover:bg-background-secondary',
            )}
          >
            <Gift
              className={cn(
                'w-4 h-4',
                hasLootBoxes ? 'text-pink-500 ' : 'text-ink-secondary/70',
              )}
            />
            <span>{dailySummary?.loot_boxes || 0}</span>
          </button>
        </Tooltip>

        {isBackpackOpen && (
          <>
            {/* Click-away backdrop to close popover */}
            <div
              className='fixed inset-0 z-40 cursor-default'
              onClick={() => setIsBackpackOpen(false)}
            />

            {/* Backpack Inventory Popover Panel */}
            <div className='absolute right-0 mt-2 w-2xl panel-xl backdrop-blur-md rounded-2xl shadow-xl z-50 animate-in fade-in slide-in-from-top-2 duration-200'>
              <div className='flex items-center gap-2 mb-3 border-b border-border/40  select-none'>
                <Gift className='w-4 h-4 text-pink-500' />
                <h4 className='label'>Your Inventory</h4>
              </div>

              <div className='grid grid-cols-3 gap-x-4 gap-y-2 justify-items-center'>
                {/* Slot 1: Loot Box with superscript quantity */}
                <div className='relative w-full h-[120px] rounded-xl border border-border/60 bg-background/40 flex items-center justify-center group overflow-visible'>
                  {hasLootBoxes ?
                    <button
                      onClick={handleOpenLootBox}
                      disabled={isOpeningBox}
                      className={cn(
                        'w-full h-full flex items-center justify-center rounded-xl transition-all cursor-pointer relative hover:bg-pink-500/10 active:scale-95',
                        isOpeningBox && 'opacity-50 cursor-not-allowed',
                      )}
                      title='Click to Open'
                    >
                      {isOpeningBox ?
                        <Loader2 className='w-6 h-6 animate-spin text-pink-500' />
                      : <>
                          <img
                            src='/loot-box.png'
                            alt='Loot Box'
                            className='w-30 h-30 object-contain group-hover:scale-110 transition-transform duration-200'
                          />
                          <span className='absolute -top-1.5 -right-1.5 min-w-[20px] h-5 px-1.5 rounded-full bg-pink-500 text-white font-black text-[10px] flex items-center justify-center shadow-md animate-bounce'>
                            {dailySummary.loot_boxes}
                          </span>
                        </>
                      }
                    </button>
                  : <div className='w-full h-full flex items-center justify-center opacity-30 select-none'>
                      <Gift className='w-8 h-8 text-ink-secondary/50' />
                    </div>
                  }
                </div>

                {/* Empty Slot 2 */}
                <div
                  className='label-sm w-30 h-30 rounded-xl border border-dashed border-border/40 bg-background/20 flex items-center justify-center text-ink-secondary/20 select-none'
                  title='空闲插槽'
                >
                  <img
                    src='/loot-box.png'
                    alt='Loot Box'
                    className='w-30 h-30 object-contain grayscale-100  transition-transform duration-200'
                  />
                </div>
              </div>

              {hasLootBoxes && (
                <p className='text-[10px] text-center text-ink-secondary mt-3 font-semibold select-none'>
                  {isOpeningBox ?
                    'Opening...'
                  : '💡 Open the treasure chest in your backpack to start'}
                </p>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
