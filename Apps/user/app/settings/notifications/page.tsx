/** @format */

'use client';

import React, { useState } from 'react';
import { useConsole } from '@/components/ConsoleContext';
import { Bell, BellOff, MessageSquare, Heart, Settings, Save } from 'lucide-react';
import { cn } from '@/lib/utils';
import { H3, H4 } from '@/components/UI/text/typography';
import { showGlobalToast } from '@/lib/toast';

export default function SettingsPage() {
  const { profile, setProfile, saveProfile } = useConsole();
  const [isSaving, setIsSaving] = useState(false);

  // Parse existing preferences
  const prefs: any = profile?.extra_data?.notification_preferences || {};
  const dnd = Boolean(prefs.dnd);
  
  // By default, if enabled_kinds is undefined, everything is enabled.
  const enabledKinds: string[] = prefs.enabled_kinds || ['comment_like', 'comment_reply', 'system'];
  
  const hasKind = (kind: string) => enabledKinds.includes(kind);

  const updatePrefs = (newPrefs: any) => {
    if (!profile) return;
    setProfile({
      ...profile,
      extra_data: {
        ...profile.extra_data,
        notification_preferences: {
          ...prefs,
          ...newPrefs,
        }
      }
    });
  };

  const toggleKind = (kind: string, enabled: boolean) => {
    let nextKinds = [...enabledKinds];
    if (enabled) {
      if (!nextKinds.includes(kind)) nextKinds.push(kind);
    } else {
      nextKinds = nextKinds.filter((k) => k !== kind);
    }
    updatePrefs({ enabled_kinds: nextKinds });
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await saveProfile();
      showGlobalToast('Settings saved successfully!');
    } catch (err) {
      console.error(err);
      showGlobalToast('Failed to save settings.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className='flex flex-col gap-8 max-w-3xl p-6'>
      <div>
        <H3 className='mb-2'>Settings</H3>
        <p className='text-ink-secondary'>Manage your account preferences and notifications.</p>
      </div>

      <div className='panel-lg flex flex-col gap-6 p-6'>
        <div className='flex items-center gap-3 border-b border-border pb-4'>
          <div className='flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary'>
            <Bell className='h-5 w-5' />
          </div>
          <div>
            <H4>Notification Preferences</H4>
            <p className='label-sm text-ink-secondary'>Control how and when you receive notifications.</p>
          </div>
        </div>

        {/* Do Not Disturb Toggle */}
        <div className='flex items-center justify-between rounded-xl bg-background-secondary p-4'>
          <div className='flex items-center gap-4'>
            <div className={cn('flex h-10 w-10 items-center justify-center rounded-full', dnd ? 'bg-rose-500/10 text-rose-500' : 'bg-ink-secondary/10 text-ink-secondary')}>
              {dnd ? <BellOff className='h-5 w-5' /> : <Bell className='h-5 w-5' />}
            </div>
            <div>
              <p className='font-bold text-ink-primary'>Do Not Disturb</p>
              <p className='text-sm text-ink-secondary'>Mute all incoming notifications</p>
            </div>
          </div>
          <label className='relative inline-flex cursor-pointer items-center'>
            <input 
              type='checkbox' 
              className='peer sr-only' 
              checked={dnd}
              onChange={(e) => updatePrefs({ dnd: e.target.checked })}
            />
            <div className="peer h-6 w-11 rounded-full bg-border after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:border after:border-gray-300 after:bg-white after:transition-all after:content-[''] peer-checked:bg-primary peer-checked:after:translate-x-full peer-checked:after:border-white peer-focus:outline-none dark:border-gray-600 dark:bg-gray-700"></div>
          </label>
        </div>

        {/* Granular Toggles */}
        <div className={cn('flex flex-col gap-4 transition-opacity duration-300', dnd && 'pointer-events-none opacity-50')}>
          <p className='label-sm mt-2 text-ink-secondary'>SELECTIVE NOTIFICATIONS</p>
          
          {/* Likes */}
          <div className='flex items-center justify-between'>
            <div className='flex items-center gap-3'>
              <Heart className='h-5 w-5 text-rose-500' />
              <div>
                <p className='font-medium text-ink-primary'>Likes</p>
                <p className='text-xs text-ink-secondary'>Notify when someone likes your comments</p>
              </div>
            </div>
            <label className='relative inline-flex cursor-pointer items-center'>
              <input 
                type='checkbox' 
                className='peer sr-only' 
                checked={hasKind('comment_like')}
                onChange={(e) => toggleKind('comment_like', e.target.checked)}
              />
              <div className="peer h-6 w-11 rounded-full bg-border after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:border after:border-gray-300 after:bg-white after:transition-all after:content-[''] peer-checked:bg-primary peer-checked:after:translate-x-full peer-checked:after:border-white peer-focus:outline-none dark:border-gray-600 dark:bg-gray-700"></div>
            </label>
          </div>

          {/* Comments and Replies */}
          <div className='flex items-center justify-between'>
            <div className='flex items-center gap-3'>
              <MessageSquare className='h-5 w-5 text-blue-500' />
              <div>
                <p className='font-medium text-ink-primary'>Comments & Replies</p>
                <p className='text-xs text-ink-secondary'>Notify when someone replies to you</p>
              </div>
            </div>
            <label className='relative inline-flex cursor-pointer items-center'>
              <input 
                type='checkbox' 
                className='peer sr-only' 
                checked={hasKind('comment_reply')}
                onChange={(e) => toggleKind('comment_reply', e.target.checked)}
              />
              <div className="peer h-6 w-11 rounded-full bg-border after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:border after:border-gray-300 after:bg-white after:transition-all after:content-[''] peer-checked:bg-primary peer-checked:after:translate-x-full peer-checked:after:border-white peer-focus:outline-none dark:border-gray-600 dark:bg-gray-700"></div>
            </label>
          </div>

          {/* System */}
          <div className='flex items-center justify-between'>
            <div className='flex items-center gap-3'>
              <Settings className='h-5 w-5 text-emerald-500' />
              <div>
                <p className='font-medium text-ink-primary'>System Notifications</p>
                <p className='text-xs text-ink-secondary'>Important updates from the platform</p>
              </div>
            </div>
            <label className='relative inline-flex cursor-pointer items-center'>
              <input 
                type='checkbox' 
                className='peer sr-only' 
                checked={hasKind('system')}
                onChange={(e) => toggleKind('system', e.target.checked)}
              />
              <div className="peer h-6 w-11 rounded-full bg-border after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:border after:border-gray-300 after:bg-white after:transition-all after:content-[''] peer-checked:bg-primary peer-checked:after:translate-x-full peer-checked:after:border-white peer-focus:outline-none dark:border-gray-600 dark:bg-gray-700"></div>
            </label>
          </div>
        </div>
      </div>

      <div className='flex justify-end'>
        <button
          onClick={handleSave}
          disabled={isSaving}
          className='flex items-center gap-2 rounded-xl bg-primary px-6 py-3 font-bold text-primary-foreground shadow-lg shadow-primary/20 transition-transform hover:scale-105 active:scale-95 disabled:opacity-50'
        >
          <Save className='h-5 w-5' />
          {isSaving ? 'Saving...' : 'Save Settings'}
        </button>
      </div>
    </div>
  );
}
