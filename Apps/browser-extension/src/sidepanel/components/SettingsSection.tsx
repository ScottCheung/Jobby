/** @format */

import { useEffect, useState } from 'react';
import { Trash2, RotateCcw } from 'lucide-react';
import { Switch } from '@jobby/ui/components/UI/switch';
import type { ThemeColor, ThemeMode } from '../hooks/useThemeSync';

interface SettingsSectionProps {
  themeColor: ThemeColor;
  themeMode: ThemeMode;
  onSetThemeColor: (color: ThemeColor) => void;
  onSetThemeMode: (mode: ThemeMode) => void;
  onInspectPage?: () => void;
  onInspectForm?: () => void;
}

const THEME_COLORS: Array<{ id: ThemeColor; label: string; bgClass: string }> = [
  { id: 'green', label: 'Green', bgClass: 'bg-[#0d9488]' },
  { id: 'blue', label: 'Blue', bgClass: 'bg-[#2563eb]' },
  { id: 'purple', label: 'Purple', bgClass: 'bg-[#7c3aed]' },
  { id: 'orange', label: 'Orange', bgClass: 'bg-[#ea580c]' },
  { id: 'rose', label: 'Rose', bgClass: 'bg-[#e11d48]' },
];

const THEME_MODES: Array<{ id: ThemeMode; label: string }> = [
  { id: 'system', label: 'System' },
  { id: 'light', label: 'Light' },
  { id: 'dark', label: 'Dark' },
];

export function SettingsSection({
  themeColor,
  themeMode,
  onSetThemeColor,
  onSetThemeMode,
  onInspectPage,
  onInspectForm,
}: SettingsSectionProps) {
  const [disabledAllPages, setDisabledAllPages] = useState<boolean>(false);
  const [disabledDomains, setDisabledDomains] = useState<string[]>([]);
  const [autoShowJobDialog, setAutoShowJobDialog] = useState<boolean>(true);

  const loadSettings = () => {
    if (typeof chrome !== 'undefined' && chrome.storage?.local) {
      chrome.storage.local.get(
        [
          'jobby_disabled_all_pages',
          'jobby_disabled_domains',
          'jobby_auto_show_job_dialog',
        ],
        (res) => {
          setDisabledAllPages(Boolean(res.jobby_disabled_all_pages));
          setDisabledDomains(
            Array.isArray(res.jobby_disabled_domains)
              ? res.jobby_disabled_domains
              : [],
          );
          setAutoShowJobDialog(res.jobby_auto_show_job_dialog !== false);
        },
      );
    }
  };

  useEffect(() => {
    loadSettings();

    const onStorageChange = (
      changes: Record<string, chrome.storage.StorageChange>,
      areaName: string,
    ) => {
      if (areaName !== 'local') return;
      if (changes.jobby_disabled_all_pages !== undefined) {
        setDisabledAllPages(Boolean(changes.jobby_disabled_all_pages.newValue));
      }
      if (changes.jobby_disabled_domains !== undefined) {
        setDisabledDomains(
          Array.isArray(changes.jobby_disabled_domains.newValue)
            ? changes.jobby_disabled_domains.newValue
            : [],
        );
      }
      if (changes.jobby_auto_show_job_dialog !== undefined) {
        setAutoShowJobDialog(
          changes.jobby_auto_show_job_dialog.newValue !== false,
        );
      }
    };

    if (typeof chrome !== 'undefined' && chrome.storage?.onChanged) {
      chrome.storage.onChanged.addListener(onStorageChange);
      return () => {
        chrome.storage.onChanged.removeListener(onStorageChange);
      };
    }
  }, []);

  const handleToggleFloatingBall = (enable: boolean) => {
    const newDisabledAllPages = !enable;
    setDisabledAllPages(newDisabledAllPages);
    if (typeof chrome !== 'undefined' && chrome.storage?.local) {
      chrome.storage.local.set(
        { jobby_disabled_all_pages: newDisabledAllPages },
        () => {
          if (enable) {
            try {
              sessionStorage.removeItem('jobby-floating-ball-dismissed');
            } catch {}
          }
        },
      );
    }
  };

  const handleRemoveDisabledDomain = (domainToRemove: string) => {
    const updated = disabledDomains.filter((d) => d !== domainToRemove);
    setDisabledDomains(updated);
    if (typeof chrome !== 'undefined' && chrome.storage?.local) {
      chrome.storage.local.set({ jobby_disabled_domains: updated });
    }
  };

  const handleResetFloatingBall = () => {
    setDisabledAllPages(false);
    setDisabledDomains([]);
    if (typeof chrome !== 'undefined' && chrome.storage?.local) {
      chrome.storage.local.set({
        jobby_disabled_all_pages: false,
        jobby_disabled_domains: [],
      });
      try {
        sessionStorage.removeItem('jobby-floating-ball-dismissed');
      } catch {}
    }
  };

  const handleToggleAutoShowJobDialog = (enable: boolean) => {
    setAutoShowJobDialog(enable);
    if (typeof chrome !== 'undefined' && chrome.storage?.local) {
      chrome.storage.local.set({ jobby_auto_show_job_dialog: enable });
    }
  };

  const isBallActive = !disabledAllPages;

  return (
    <div className='flex flex-col gap-3 w-full'>
      {/* ── 1. Floating Ball ─────────────────────────────────────────── */}
      <section className='flex flex-col gap-1.5'>
        <p className='menu-label px-1'>Floating Ball</p>
        <div className='flex flex-col gap-1 rounded-xl bg-panel p-2.5 shadow-xs'>
          <div className='flex items-center justify-between py-1 px-1'>
            <span className='text-xs font-medium text-foreground'>
              Show Floating Ball
            </span>
            <Switch
              checked={isBallActive}
              onCheckedChange={handleToggleFloatingBall}
              aria-label='Show Floating Ball'
            />
          </div>

          {disabledDomains.length > 0 && (
            <div className='flex flex-col gap-1 pt-1.5 mt-1 border-t border-muted/20'>
              <div className='flex items-center justify-between px-1 text-[11px] text-muted-foreground'>
                <span>Disabled Websites ({disabledDomains.length})</span>
                <button
                  type='button'
                  onClick={() => {
                    setDisabledDomains([]);
                    if (typeof chrome !== 'undefined' && chrome.storage?.local) {
                      chrome.storage.local.set({ jobby_disabled_domains: [] });
                    }
                  }}
                  className='text-[10px] text-destructive hover:underline quiet'
                >
                  Clear all
                </button>
              </div>
              <div className='flex flex-col gap-1 max-h-28 overflow-y-auto custom-scrollbar'>
                {disabledDomains.map((domain) => (
                  <div
                    key={domain}
                    className='flex items-center justify-between rounded-lg bg-muted/30 px-2 py-1 text-xs'
                  >
                    <span className='truncate font-mono text-[11px] text-foreground/80 max-w-[220px]'>
                      {domain}
                    </span>
                    <button
                      type='button'
                      onClick={() => handleRemoveDisabledDomain(domain)}
                      className='text-muted-foreground hover:text-destructive p-0.5'
                      aria-label={`Remove ${domain}`}
                    >
                      <Trash2 className='h-3 w-3' />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {(disabledAllPages || disabledDomains.length > 0) && (
            <button
              type='button'
              onClick={handleResetFloatingBall}
              className='mt-1 flex items-center justify-center gap-1 rounded-lg bg-muted/30 py-1.5 text-xs text-primary hover:bg-muted/50 transition-colors'
            >
              <RotateCcw className='h-3 w-3' />
              <span>Reset Display Rules</span>
            </button>
          )}
        </div>
      </section>

      {/* ── 2. Smart Detection ───────────────────────────────────────── */}
      <section className='flex flex-col gap-1.5'>
        <p className='menu-label px-1'>Recognition & Tools</p>
        <div className='flex flex-col gap-1.5 rounded-xl bg-panel p-2.5 shadow-xs'>
          <div className='flex items-center justify-between py-1 px-1'>
            <span className='text-xs font-medium text-foreground'>
              Auto-Show Job Results
            </span>
            <Switch
              checked={autoShowJobDialog}
              onCheckedChange={handleToggleAutoShowJobDialog}
              aria-label='Auto-Show Job Results'
            />
          </div>

          {(onInspectPage || onInspectForm) && (
            <div className='grid grid-cols-2 gap-1.5 pt-1'>
              {onInspectPage && (
                <button
                  type='button'
                  onClick={onInspectPage}
                  className='rounded-lg bg-muted/30 py-1.5 text-xs font-medium text-foreground hover:bg-muted/50 transition-colors'
                >
                  Inspect Page
                </button>
              )}
              {onInspectForm && (
                <button
                  type='button'
                  onClick={onInspectForm}
                  className='rounded-lg bg-muted/30 py-1.5 text-xs font-medium text-foreground hover:bg-muted/50 transition-colors'
                >
                  Inspect Form
                </button>
              )}
            </div>
          )}
        </div>
      </section>

      {/* ── 3. Theme & Appearance ────────────────────────────────────── */}
      <section className='flex flex-col gap-1.5'>
        <p className='menu-label px-1'>Appearance</p>
        <div className='flex flex-col gap-2 rounded-xl bg-panel p-2.5 shadow-xs'>
          {/* Mode Selector */}
          <div className='grid grid-cols-3 gap-1 rounded-lg bg-muted/30 p-1'>
            {THEME_MODES.map(({ id, label }) => {
              const isActive = themeMode === id;
              return (
                <button
                  key={id}
                  type='button'
                  onClick={() => onSetThemeMode(id)}
                  className={`rounded-md py-1 text-xs font-medium transition-all ${
                    isActive
                      ? 'bg-panel text-primary shadow-xs font-semibold'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>

          {/* Color Selector */}
          <div className='flex items-center justify-between px-1 pt-1'>
            <span className='text-xs font-medium text-foreground'>Theme Color</span>
            <div className='flex items-center gap-1.5'>
              {THEME_COLORS.map(({ id, label, bgClass }) => {
                const isActive = themeColor === id;
                return (
                  <button
                    key={id}
                    type='button'
                    onClick={() => onSetThemeColor(id)}
                    title={label}
                    aria-label={label}
                    className={`h-5 w-5 rounded-full transition-transform ${bgClass} ${
                      isActive
                        ? 'ring-2 ring-offset-2 ring-offset-panel ring-primary scale-110'
                        : 'opacity-70 hover:opacity-100 hover:scale-105'
                    }`}
                  />
                );
              })}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
