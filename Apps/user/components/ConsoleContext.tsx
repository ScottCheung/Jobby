/** @format */

'use client';

import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  useTransition,
} from 'react';
import { usePathname } from 'next/navigation';
import { api } from '@/lib/api';
import { createClient } from '@/lib/supabase/client';
import { openGlobalAuthModal } from '@/lib/store/auth-modal-store';
import { showGlobalToast } from '@/lib/toast';
import { withMinimumLoadingTime } from '@/lib/loading';
import type {
  DesktopBotPlatform,
  DesktopBotState,
  DesktopConnectionConfig,
  DesktopConnectionConfigResult,
  DesktopRuntimeInfo,
  DesktopServiceStatus,
  ApplicationSettings,
  ApplicationPlanResponse,
  JobApplication,
  QuestionCacheEntry,
  RuntimeSettings,
  JobHuntingProfile,
  User,
  UserProfile,
} from '@/lib/types';
import { getApplicationDisplayDate, isStatusSubmitted } from '@/lib/types';
import { isDesktopRuntime, resolveApiBaseUrl, resolveSseBaseUrl } from '@/lib/runtime';

import {
  Briefcase,
  CheckCircle2,
  MessageSquareCode,
  ChevronLast,
  ArrowUpRight,
  ArrowDownRight,
  MoveRight,
  CalendarCheck,
} from 'lucide-react';

function getApplicationSortTimestamp(value?: string | null) {
  if (!value) return 0;
  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function sortApplications(items: JobApplication[]) {
  return [...items].sort((left, right) => {
    const updatedDiff =
      getApplicationSortTimestamp(right.status_updated_at) -
      getApplicationSortTimestamp(left.status_updated_at);
    if (updatedDiff !== 0) return updatedDiff;

    const appliedDiff =
      getApplicationSortTimestamp(right.date_applied) -
      getApplicationSortTimestamp(left.date_applied);
    if (appliedDiff !== 0) return appliedDiff;

    return (
      getApplicationSortTimestamp(right.created_at) -
      getApplicationSortTimestamp(left.created_at)
    );
  });
}

function mergeProfileApplicationInputs(profile: JobHuntingProfile | null | undefined) {
  if (!profile) return emptyJobHuntingProfile;
  return {
    ...profile,
    resume_path:
      profile.resume_path ||
      (typeof profile.extra_data?.default_resume_path === 'string' ?
        profile.extra_data.default_resume_path
      : ''),
  } as JobHuntingProfile;
}

export const emptyProfile: UserProfile = {
  preferred_name: '',
  first_name: '',
  middle_name: '',
  last_name: '',
  title: '',
  email: '',
  phone_number: '',
  current_city: '',
  street: '',
  state: '',
  zipcode: '',
  country: '',
  ethnicity: '',
  gender: '',
  gender_identity: '',
  disability_status: '',
  veteran_status: '',
  extra_data: {},
};

export const emptyJobHuntingProfile: JobHuntingProfile = {
  name: 'Default Search Profile',
  platform: 'linkedin',
  search_terms: [],
  search_location: '',
  filters: {},
  blacklist_rules: {},
  whitelist_rules: {},
  years_of_experience: '',
  require_visa: 'No',
  website: '',
  linkedin_url: '',
  resume_path: '',
  citizenship: '',
  desired_salary: '',
  current_ctc: '',
  notice_period: null,
  linkedin_headline: '',
  linkedin_summary: '',
  cover_letter: '',
  user_information_all: '',
  recent_employer: '',
  confidence_level: '',
  extra_data: {},
  is_default: true,
};

const legacyProfileSettingKeys = [
  'practiceShowAnswersPreference',
  'practiceAutoEvalPreference',
  'auto-job-ui-theme',
  'auto-job-ui-theme-color',
  'vite-ui-theme',
  'practiceModePreference',
  'practiceQuickRatingLocked',
  'saved-comment-ids',
  'scheduleViewMode',
  'automation-panel-corner',
];

function migrateLegacyProfileSettings(profile: UserProfile): {
  profile: UserProfile;
  changed: boolean;
} {
  if (typeof window === 'undefined') return { profile, changed: false };
  const extra = { ...(profile.extra_data ?? {}) };
  let changed = false;

  for (const key of legacyProfileSettingKeys) {
    const raw = window.localStorage.getItem(key);
    if (raw === null || extra[key] !== undefined) continue;
    try {
      extra[key] =
        key === 'practiceModePreference' ||
        key === 'practiceQuickRatingLocked' ||
        key === 'saved-comment-ids' ?
          JSON.parse(raw)
        : raw;
      changed = true;
    } catch {
      extra[key] = raw;
      changed = true;
    }
  }

  if (!changed) return { profile, changed: false };
  for (const key of legacyProfileSettingKeys) {
    window.localStorage.removeItem(key);
  }
  return { profile: { ...profile, extra_data: extra }, changed: true };
}

export const emptyRuntime: RuntimeSettings = {
  run_in_background: false,
  safe_mode: true,
  stealth_mode: true,
  click_gap: 5,
  pause_before_submit: true,
  pause_at_failed_question: true,
  overwrite_previous_answers: false,
  learn_from_manual_answers: true,
  question_similarity_threshold: 0.85,
  settings: {},
};

export const emptyApplicationSettings: ApplicationSettings = {
  automation: {
    execution_mode: 'human_confirmed',
    review_channel: 'browser',
    max_jobs_per_run: 30,
    max_retries: 2,
    require_submit_confirmation: true,
    stop_on_unknown_question: true,
  },
  ai: {
    enabled: false,
    provider: '',
    model: '',
    min_confidence: 0.7,
    max_calls_per_job: 3,
    daily_budget: 0,
    allow_tailored_resume: true,
  },
  resume: {
    master_resume_id: null,
    tailored_match_threshold: 0.8,
    require_tailored_review: true,
  },
  policy: {
    minimum_match_threshold: 0.55,
    only_easy_apply: false,
    blacklisted_companies: [],
    blacklisted_job_terms: [],
    whitelisted_companies: [],
  },
};



const DESKTOP_PLATFORMS: DesktopBotPlatform[] = [
  'linkedin',
  'seek',
  'third_party',
];

const createIdleBotState = (): DesktopBotState => ({
  status: 'idle',
  message: 'Idle',
  stats: { submitted: 0, skipped: 0, failed: 0 },
  logs: [],
});

async function sleep(ms: number) {
  await new Promise((resolve) => window.setTimeout(resolve, ms));
}

interface ConsoleContextType {
  user: User | null;
  profile: UserProfile;
  setProfile: React.Dispatch<React.SetStateAction<UserProfile>>;
  updateProfileExtra: (
    nextExtra:
      | Record<string, unknown>
      | ((currentExtra: Record<string, unknown>) => Record<string, unknown>),
  ) => Promise<UserProfile>;
  jobHuntingProfile: JobHuntingProfile;
  setJobHuntingProfile: React.Dispatch<React.SetStateAction<JobHuntingProfile>>;
  jobHuntingProfiles: JobHuntingProfile[];
  setJobHuntingProfiles: React.Dispatch<React.SetStateAction<JobHuntingProfile[]>>;
  runtimeSettings: RuntimeSettings;
  setRuntimeSettings: React.Dispatch<React.SetStateAction<RuntimeSettings>>;
  applicationSettings: ApplicationSettings;
  setApplicationSettings: React.Dispatch<React.SetStateAction<ApplicationSettings>>;
  questions: QuestionCacheEntry[];
  setQuestions: React.Dispatch<React.SetStateAction<QuestionCacheEntry[]>>;
  applications: JobApplication[];
  setApplications: React.Dispatch<React.SetStateAction<JobApplication[]>>;
  mainBotState: {
    status: string;
    message: string;
    stats: { submitted: number; skipped: number; failed: number };
    logs: Array<{ at: string; line: string }>;
  } | null;
  mainBotName: DesktopBotPlatform;
  processingApplicationsCount: number;
  expandedApplicationId: string;
  setExpandedApplicationId: (id: string) => void;
  notify: (message: string) => void;
  error: string;
  setError: (err: string) => void;
  isPending: boolean;
  hasLoadedInitialData: boolean;
  hasLoadedJobApplyData: boolean;
  jobApplyLoading: boolean;
  loadData: () => void;
  saveAvatar: (file: File) => Promise<void>;
  removeAvatar: () => Promise<void>;
  saveProfile: (updatedProfile?: UserProfile) => Promise<void>;
  saveJobHuntingProfile: (value?: JobHuntingProfile) => Promise<void>;
  createJobHuntingProfile: (value: JobHuntingProfile) => Promise<JobHuntingProfile>;
  activateJobHuntingProfile: (profileId: string) => Promise<void>;
  deleteJobHuntingProfile: (profileId: string) => Promise<void>;
  saveRuntime: (value?: RuntimeSettings) => Promise<void>;
  saveApplicationSettings: (value?: ApplicationSettings) => Promise<void>;
  saveQuestion: (entry: QuestionCacheEntry, answer: string) => Promise<void>;
  deleteQuestion: (entryId: string) => Promise<void>;
  saveApplicationPatch: (
    applicationId: string,
    payload: Partial<JobApplication>,
  ) => Promise<void>;
  applicationPlanAction: (
    applicationId: string,
    action: string,
    reason?: string,
  ) => Promise<ApplicationPlanResponse>;
  deleteApplication: (applicationId: string) => Promise<void>;
  startWorker: () => Promise<void>;
  stopWorker: () => Promise<void>;
  appStats: {
    total_applications: number;
    submitted: number;
    today_submitted: number;
    yesterday_submitted: number;
    today_processed: number;
    yesterday_processed: number;
    interviewing: number;
    skipped: number;
  } | null;
  stats: Array<{
    label: string;
    value: number;
    icon: any;
    iconColor: string;
    textColor: string;
    bgColor: string;
    borderColor: string;
    comparison?: string;
    comparisonColor?: string;
    comparisonIcon?: any;
  }>;
  dashboardData: {
    trend: Array<{ date: string; Submitted: number; Skipped: number }>;
    statusDistribution: Array<{ name: string; value: number; fill: string }>;
    skipReasons: Array<{ name: string; value: number; percentage: number }>;
    topCities: Array<{ name: string; value: number; fill: string }>;
    topCompanies: Array<{ name: string; applications: number }>;
    recentActivities: JobApplication[];
  };
  trendRange: 7 | 30;
  setTrendRange: (val: 7 | 30) => void;
  desktopRuntime: DesktopRuntimeInfo | null;
  desktopServiceStatus: DesktopServiceStatus | null;
  isDesktopApp: boolean;
  desktopConnectionConfig: DesktopConnectionConfig | null;
  saveDesktopConnectionConfig: (
    payload: DesktopConnectionConfig,
  ) => Promise<DesktopConnectionConfigResult>;
  resetDesktopConnectionConfig: () => Promise<DesktopConnectionConfigResult>;
  isGuest: boolean;
  requireAuth: (action: () => void | Promise<void>, reason?: string) => void;
  botStates: Record<DesktopBotPlatform, DesktopBotState>;
  startBot: (
    platform: DesktopBotPlatform,
    options?: { diagnostic?: boolean },
  ) => Promise<void>;
  stopBot: (platform: DesktopBotPlatform) => Promise<void>;
}

const ConsoleContext = createContext<ConsoleContextType | null>(null);

export function ConsoleProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [appStats, setAppStats] = useState<{
    total_applications: number;
    submitted: number;
    today_submitted: number;
    yesterday_submitted: number;
    today_processed: number;
    yesterday_processed: number;
    interviewing: number;
    skipped: number;
  } | null>(null);

  const loadAppStats = async () => {
    try {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const statsData = await api.applicationStats(tz);
      setAppStats(statsData);
    } catch (err) {
      console.error('Failed to load application stats:', err);
    }
  };
  const [profile, setProfile] = useState<UserProfile>(emptyProfile);
  const [jobHuntingProfile, setJobHuntingProfile] =
    useState<JobHuntingProfile>(emptyJobHuntingProfile);
  const [jobHuntingProfiles, setJobHuntingProfiles] = useState<JobHuntingProfile[]>([]);
  const [runtimeSettings, setRuntimeSettings] =
    useState<RuntimeSettings>(emptyRuntime);
  const [applicationSettings, setApplicationSettings] =
    useState<ApplicationSettings>(emptyApplicationSettings);
  const [questions, setQuestions] = useState<QuestionCacheEntry[]>([]);
  const [applications, setApplications] = useState<JobApplication[]>([]);
  const [expandedApplicationId, setExpandedApplicationId] = useState('');
  const [error, setError] = useState('');
  const [isPending, startTransition] = useTransition();
  const [hasLoadedInitialData, setHasLoadedInitialData] = useState(false);
  const [desktopRuntime, setDesktopRuntime] =
    useState<DesktopRuntimeInfo | null>(null);
  const [desktopServiceStatus, setDesktopServiceStatus] =
    useState<DesktopServiceStatus | null>(null);
  const [desktopConnectionConfig, setDesktopConnectionConfig] =
    useState<DesktopConnectionConfig | null>(null);
  const [botStates, setBotStates] = useState<
    Record<DesktopBotPlatform, DesktopBotState>
  >({
    linkedin: createIdleBotState(),
    seek: createIdleBotState(),
    third_party: createIdleBotState(),
  });

  const startBot = async (
    platform: DesktopBotPlatform,
    options: { diagnostic?: boolean } = {},
  ) => {
    if (isDesktopRuntime() && window.autoJobDesktop?.startBot) {
      setError('');

      const searchTerms = jobHuntingProfile.search_terms || [];
      if (!searchTerms.length || !searchTerms.some((t) => t.trim().length > 0)) {
        const msg =
          'Please add at least one Search Term in Settings > Job Search Profiles before starting auto apply.';
        setError(msg);
        notify(msg);
        return;
      }

      if (
        !options.diagnostic &&
        !profile.first_name?.trim() &&
        !profile.last_name?.trim()
      ) {
        const msg =
          'Please enter your First Name and Last Name in Settings > Profile before starting auto apply.';
        setError(msg);
        notify(msg);
        return;
      }

      notify(
        options.diagnostic ?
          `Starting ${platform.replace('_', ' ')} diagnostic run...`
        : platform === 'third_party' ?
          'Opening assisted apply mode...'
        : `Starting ${platform.replace('_', ' ')}...`,
      );

      const ensureLoginBrowserOpen = async () => {
        if (!window.autoJobDesktop?.openChromeSession) {
          return { ok: false, error: 'Could not open the login browser.' };
        }

        const managedProfilePath =
          String(runtimeSettings.settings?.browser_profile_path || '').trim() ||
          '~/.auto-job-apply-profile';

        notify('Opening login browser...');
        let openRes = await window.autoJobDesktop.openChromeSession(managedProfilePath);

        if (
          !openRes.ok &&
          openRes.code === 'close_other_chrome_windows' &&
          window.autoJobDesktop?.closeAllChromeWindows
        ) {
          notify('Closing other Chrome windows...');
          const closeRes = await window.autoJobDesktop.closeAllChromeWindows();
          if (!closeRes.ok) {
            return {
              ok: false,
              error: closeRes.error || 'Please close your other Chrome windows first.',
            };
          }

          await sleep(700);
          notify('Opening login browser...');
          openRes = await window.autoJobDesktop.openChromeSession(managedProfilePath);
        }

        if (!openRes.ok) {
          return {
            ok: false,
            error: openRes.error || 'Could not open the login browser.',
          };
        }

        notify('Login browser opened. Starting auto apply...');
        await sleep(1800);
        return { ok: true };
      };

      let res = await window.autoJobDesktop.startBot(
        platform,
        user?.email || profile?.email || undefined,
        options,
      );
      const needsManagedSession =
        platform === 'linkedin' &&
        (res.code === 'login_browser_required' ||
          res.error?.includes('requires an open managed browser session'));

      if (needsManagedSession) {
        const ensured = await ensureLoginBrowserOpen();
        if (!ensured.ok) {
          setError(ensured.error || 'Could not open the login browser.');
          return;
        }

        res = await window.autoJobDesktop.startBot(
          platform,
          user?.email || profile?.email || undefined,
          options,
        );
      }

      if (!res.ok) {
        setError(res.error || `Failed to start ${platform} bot`);
      }
    } else {
      setError('Direct bot controls are only supported in the desktop app.');
    }
  };

  const stopBot = async (platform: DesktopBotPlatform) => {
    if (isDesktopRuntime() && window.autoJobDesktop?.stopBot) {
      setError('');
      notify(
        platform === 'third_party' ?
          'Closing assisted apply mode...'
        : `Stopping ${platform.replace('_', ' ')}...`,
      );
      const res = await window.autoJobDesktop.stopBot(platform);
      if (!res.ok) {
        setError(res.error || `Failed to stop ${platform} bot`);
      }
    } else {
      setError('Direct bot controls are only supported in the desktop app.');
    }
  };

  const notify = (message: string) => {
    showGlobalToast(message);
  };

  const processingApplicationsCount = useMemo(
    () => applications.filter((item) => item.status === 'processing').length,
    [applications],
  );

  const pathname = usePathname();
  const isGuest = !user;

  const requireAuth = (action: () => void | Promise<void>, reason?: string) => {
    if (user) {
      void action();
    } else {
      openGlobalAuthModal({
        reason: reason || 'Please sign in to continue',
        onSuccess: () => {
          void action();
        },
      });
    }
  };

  const [hasLoadedJobApplyData, setHasLoadedJobApplyData] = useState(false);
  const [jobApplyLoading, setJobApplyLoading] = useState(false);
  const hasLoadedJobApplyDataRef = React.useRef(false);
  const jobApplyLoadingRef = React.useRef(false);

  const loadJobApplyData = async (force = false) => {
    if (jobApplyLoadingRef.current || (hasLoadedJobApplyDataRef.current && !force)) return;
    setJobApplyLoading(true);
    jobApplyLoadingRef.current = true;
    try {
      setError('');
      const jobHuntingProfilesPromise = api.jobHuntingProfiles().catch((err) => {
        console.warn('Falling back to single search profile endpoint', err);
        return [] as JobHuntingProfile[];
      });
      const [
        jobHuntingProfilesRows,
        defaultSearch,
        questionRows,
        applicationRows,
        runtimeConfig,
        applicationSettingsConfig,
        statsData,
      ] = await Promise.all([
        jobHuntingProfilesPromise.catch(() => [] as JobHuntingProfile[]),
        api.jobHuntingProfile().catch(() => null),
        Promise.resolve([] as QuestionCacheEntry[]),
        api.applications().catch(() => [] as JobApplication[]),
        api.runtimeSettings().catch(() => null),
        api.applicationSettings().catch(() => null),
        api.applicationStats(Intl.DateTimeFormat().resolvedOptions().timeZone).catch(() => null),
      ]);
      const resolvedJobHuntingProfiles =
        jobHuntingProfilesRows.length > 0 ?
          jobHuntingProfilesRows.map((item) => mergeProfileApplicationInputs(item))
        : defaultSearch ? [mergeProfileApplicationInputs(defaultSearch)]
        : [];
      const resolvedDefaultSearch =
        resolvedJobHuntingProfiles.find((profile) => profile.is_default) ??
        mergeProfileApplicationInputs(defaultSearch) ??
        resolvedJobHuntingProfiles[0] ??
        emptyJobHuntingProfile;
      setJobHuntingProfiles(resolvedJobHuntingProfiles);
      setJobHuntingProfile(resolvedDefaultSearch);
      setRuntimeSettings(runtimeConfig ?? emptyRuntime);
      setApplicationSettings(applicationSettingsConfig ?? emptyApplicationSettings);
      setQuestions(questionRows);
      setApplications(sortApplications(applicationRows));
      if (statsData) {
        setAppStats(statsData);
      }
      setHasLoadedJobApplyData(true);
      hasLoadedJobApplyDataRef.current = true;
    } catch (err) {
      console.error('Failed to load Job Apply data:', err);
      const msg = err instanceof Error ? err.message : 'Failed to load job search data';
      if (!msg.toLowerCase().includes('authentication') && !msg.toLowerCase().includes('sign in')) {
        setError(msg);
      }
    } finally {
      setJobApplyLoading(false);
      jobApplyLoadingRef.current = false;
    }
  };

  const loadData = () => {
    startTransition(async () => {
      try {
        setError('');
        const [
          me,
          currentProfile,
        ] = await withMinimumLoadingTime(
          Promise.all([
            api.me().catch(() => null),
            api.profile().catch(() => null),
          ]),
        );
        const profileWithDefaults = currentProfile ?? emptyProfile;
        const migratedProfile = migrateLegacyProfileSettings(profileWithDefaults);
        const resolvedProfile =
          migratedProfile.changed && me ?
            await api.updateProfile(migratedProfile.profile).catch(() => profileWithDefaults)
          : profileWithDefaults;
        setUser(me);
        setProfile(resolvedProfile);
        
        // Re-load or refresh job apply data if it was already loaded or in-progress
        if (hasLoadedJobApplyDataRef.current && me) {
          void loadJobApplyData(true);
        }
      } catch (loadError) {
        const errorMsg = loadError instanceof Error ? loadError.message : 'Failed to load data';
        if (!errorMsg.toLowerCase().includes('authentication') && !errorMsg.toLowerCase().includes('sign in')) {
          setError(errorMsg);
        }
      } finally {
        setHasLoadedInitialData(true);
      }
    });
  };

  useEffect(() => {
    loadData();

    const supabase = createClient();
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') {
        loadData();
      } else if (event === 'SIGNED_OUT') {
        setUser(null);
        setProfile(emptyProfile);
        setApplications([]);
        setJobHuntingProfiles([]);
        setAppStats(null);
      }
    });

    const handleUnauthorized = () => {
      openGlobalAuthModal({
        reason: '登录状态已失效或需要登录，请登录后继续',
        next: typeof window !== 'undefined' ? window.location.pathname + window.location.search : undefined,
      });
    };

    window.addEventListener('jobby:unauthorized', handleUnauthorized);

    return () => {
      subscription.unsubscribe();
      window.removeEventListener('jobby:unauthorized', handleUnauthorized);
    };
  }, []);

  useEffect(() => {
    if (!hasLoadedInitialData) return;

    const path = pathname || '';
    const isJobApplyRoute =
      path === '/' ||
      path.startsWith('/job-application') ||
      path.startsWith('/applications') ||
      path.startsWith('/settings') ||
      path.startsWith('/question-cache');

    if (isJobApplyRoute && user) {
      void loadJobApplyData();
    }
  }, [pathname, hasLoadedInitialData, user]);

  useEffect(() => {
    let sse: EventSource | null = null;
    let active = true;
    let reconnectTimer: number | undefined;
    let reconnectAttempt = 0;
    let hasConnected = false;

    const scheduleReconnect = () => {
      if (!active || reconnectTimer) return;
      const baseDelay = Math.min(30_000, 1_000 * 2 ** reconnectAttempt);
      const jitter = Math.round(baseDelay * (Math.random() * 0.4 - 0.2));
      reconnectAttempt += 1;
      reconnectTimer = window.setTimeout(() => {
        reconnectTimer = undefined;
        void initSSE();
      }, baseDelay + jitter);
    };

    async function initSSE() {
      try {
        const apiBaseUrl = await resolveSseBaseUrl();
        if (!active) return;

        const sseUrl = `${apiBaseUrl.replace(/\/$/, '')}/api/sse`;
        sse?.close();
        sse = new EventSource(sseUrl);
      } catch (error) {
        console.warn('[SSE] Could not create connection. Retrying.', error);
        scheduleReconnect();
        return;
      }

      const connection = sse;
      connection.onopen = () => {
        const reconnected = hasConnected;
        hasConnected = true;
        reconnectAttempt = 0;
        if (reconnectTimer) {
          window.clearTimeout(reconnectTimer);
          reconnectTimer = undefined;
        }
        // Reconcile state after an interrupted stream so no event is lost.
        if (reconnected) void loadData();
      };

      ['comment.created', 'comment.updated', 'comment.deleted', 'comment.reaction_updated'].forEach((eventName) => {
        connection.addEventListener(eventName, (event) => {
          try {
            window.dispatchEvent(
              new CustomEvent('jobby:comment-event', {
                detail: { ...JSON.parse(event.data), event_type: eventName },
              }),
            );
          } catch {
            // Ignore malformed optional realtime events.
          }
        });
      });
      [
        'answer.reaction_updated',
        'answer.comment_created',
        'answer.comment_updated',
        'answer.comment_deleted',
        'answer.comment_reaction_updated',
      ].forEach((eventName) => {
        connection.addEventListener(eventName, (event) => {
          try {
            window.dispatchEvent(
              new CustomEvent('jobby:answer-event', {
                detail: { ...JSON.parse(event.data), event_type: eventName },
              }),
            );
          } catch {
            // Ignore malformed optional realtime events.
          }
        });
      });
      connection.addEventListener('notification.created', (event) => {
        try { window.dispatchEvent(new CustomEvent('jobby:notification-event', { detail: JSON.parse(event.data) })); }
        catch { /* Ignore malformed optional realtime events. */ }
      });
      connection.addEventListener('career_profile.processed', (event) => {
        try { window.dispatchEvent(new CustomEvent('jobby:career-profile-event', { detail: JSON.parse(event.data) })); }
        catch { /* Ignore malformed optional realtime events. */ }
      });
      connection.addEventListener('tailored_resume.processed', (event) => {
        try { window.dispatchEvent(new CustomEvent('jobby:tailored-resume-event', { detail: JSON.parse(event.data) })); }
        catch { /* Ignore malformed optional realtime events. */ }
      });

      connection.addEventListener('application_created', (event) => {
        try {
          const newApp = JSON.parse(event.data) as JobApplication;
          console.log('[SSE] Application created:', newApp);
          setApplications((current) => {
            if (current.some((app) => app.id === newApp.id)) return current;
            return sortApplications([newApp, ...current]);
          });
          void loadAppStats();
        } catch (e) {
          console.error('[SSE] Failed to parse application_created data', e);
        }
      });

      connection.addEventListener('application_updated', (event) => {
        try {
          const updatedApp = JSON.parse(event.data) as JobApplication;
          console.log('[SSE] Application updated:', updatedApp);
          setApplications((current) => {
            const exists = current.some((app) => app.id === updatedApp.id);
            if (!exists) {
              return sortApplications([updatedApp, ...current]);
            }
            return sortApplications(
              current.map((app) =>
                app.id === updatedApp.id ? updatedApp : app,
              ),
            );
          });
          void loadAppStats();
        } catch (e) {
          console.error('[SSE] Failed to parse application_updated data', e);
        }
      });

      connection.addEventListener('application_deleted', (event) => {
        try {
          const { id } = JSON.parse(event.data) as { id: string };
          console.log('[SSE] Application deleted:', id);
          setApplications((current) => current.filter((app) => app.id !== id));
          void loadAppStats();
        } catch (e) {
          console.error('[SSE] Failed to parse application_deleted data', e);
        }
      });

      connection.addEventListener('question_cache_created', (event) => {
        try {
          const newEntry = JSON.parse(event.data) as QuestionCacheEntry;
          setQuestions((current) => {
            if (current.some((item) => item.id === newEntry.id)) return current;
            return [newEntry, ...current];
          });
        } catch (e) {
          console.error('[SSE] Failed to parse question_cache_created data', e);
        }
      });

      connection.addEventListener('question_cache_upserted', (event) => {
        try {
          const updatedEntry = JSON.parse(event.data) as QuestionCacheEntry;
          setQuestions((current) => {
            const exists = current.some((item) => item.id === updatedEntry.id);
            if (!exists) {
              return [updatedEntry, ...current];
            }
            return current.map((item) =>
              item.id === updatedEntry.id ? updatedEntry : item,
            );
          });
        } catch (e) {
          console.error(
            '[SSE] Failed to parse question_cache_upserted data',
            e,
          );
        }
      });

      connection.addEventListener('question_cache_updated', (event) => {
        try {
          const updatedEntry = JSON.parse(event.data) as QuestionCacheEntry;
          setQuestions((current) =>
            current.map((item) =>
              item.id === updatedEntry.id ? updatedEntry : item,
            ),
          );
        } catch (e) {
          console.error('[SSE] Failed to parse question_cache_updated data', e);
        }
      });

      connection.addEventListener('question_cache_deleted', (event) => {
        try {
          const { id } = JSON.parse(event.data) as { id: string };
          setQuestions((current) => current.filter((item) => item.id !== id));
        } catch (e) {
          console.error('[SSE] Failed to parse question_cache_deleted data', e);
        }
      });

      connection.onerror = () => {
        if (!active || sse !== connection) return;
        connection.close();
        sse = null;
        scheduleReconnect();
      };
    }

    const reconnectNow = () => {
      if (!active || sse?.readyState === EventSource.OPEN) return;
      if (reconnectTimer) {
        window.clearTimeout(reconnectTimer);
        reconnectTimer = undefined;
      }
      void initSSE();
    };

    void initSSE();
    window.addEventListener('online', reconnectNow);
    document.addEventListener('visibilitychange', reconnectNow);

    return () => {
      active = false;
      if (reconnectTimer) window.clearTimeout(reconnectTimer);
      window.removeEventListener('online', reconnectNow);
      document.removeEventListener('visibilitychange', reconnectNow);
      sse?.close();
    };
  }, []);

  useEffect(() => {
    if (!isDesktopRuntime() || !window.autoJobDesktop) {
      return;
    }

    let unsubscribe: (() => void) | undefined;

    const syncDesktopRuntime = async () => {
      try {
        const [runtimeInfo, serviceStatus, savedConnectionConfig] =
          await Promise.all([
            window.autoJobDesktop?.getRuntimeInfo?.(),
            window.autoJobDesktop?.getServiceStatus?.(),
            window.autoJobDesktop?.getConnectionConfig?.(),
          ]);
        setDesktopRuntime(runtimeInfo ?? null);
        setDesktopServiceStatus(serviceStatus ?? null);
        setDesktopConnectionConfig(savedConnectionConfig ?? null);
      } catch (runtimeError) {
        setError(
          runtimeError instanceof Error ?
            runtimeError.message
          : 'Failed to load desktop runtime state',
        );
      }
    };

    syncDesktopRuntime();

    if (window.autoJobDesktop.onServiceStatus) {
      unsubscribe = window.autoJobDesktop.onServiceStatus((payload) => {
        setDesktopServiceStatus(payload);
      });
    }

    return () => {
      unsubscribe?.();
    };
  }, [setError]);

  const saveDesktopConnectionConfig = async (
    payload: DesktopConnectionConfig,
  ) => {
    if (!window.autoJobDesktop?.saveConnectionConfig) {
      return {
        ok: false,
        config: payload,
        error: 'Desktop connection config is unavailable in the browser',
      };
    }

    const result = await window.autoJobDesktop.saveConnectionConfig(payload);
    setDesktopConnectionConfig(result.config);
    if (result.ok) {
      notify('Desktop connection updated');
    } else if (result.error) {
      setError(result.error);
    }
    return result;
  };

  const resetDesktopConnectionConfig = async () => {
    if (!window.autoJobDesktop?.resetConnectionConfig) {
      return {
        ok: false,
        config: desktopConnectionConfig ?? {
          environmentName: 'Production',
          deploymentTarget: 'cloud',
          apiUrl: '',
          dashboardUrl: '',
          apiMode: 'external',
          dashboardMode: 'external',
          workerMode: 'local-python',
        },
        error: 'Desktop connection config is unavailable in the browser',
      };
    }

    const result = await window.autoJobDesktop.resetConnectionConfig();
    setDesktopConnectionConfig(result.config);
    if (result.ok) {
      notify('Desktop connection reset');
    }
    return result;
  };

  const saveProfile = async (updatedProfile?: UserProfile) => {
    try {
      setError('');
      const target = updatedProfile ?? profile;
      const savedProfile = await api.updateProfile(target);
      setProfile(savedProfile);
      if (savedProfile.preferred_name?.trim()) {
        setUser({
          ...(user ?? await api.me()),
          display_name: savedProfile.preferred_name.trim(),
        });
      }
      notify('Profile saved');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save profile');
      throw err;
    }
  };

  const updateProfileExtra = async (
    nextExtra:
      | Record<string, unknown>
      | ((currentExtra: Record<string, unknown>) => Record<string, unknown>),
  ) => {
    const currentExtra = profile.extra_data ?? {};
    const resolvedExtra =
      typeof nextExtra === 'function' ? nextExtra(currentExtra) : nextExtra;
    const nextProfile = {
      ...profile,
      extra_data: {
        ...currentExtra,
        ...resolvedExtra,
      },
    };
    setProfile(nextProfile);
    const savedProfile = await api.updateProfile(nextProfile);
    setProfile(savedProfile);
    return savedProfile;
  };

  const saveAvatar = async (file: File) => {
    try {
      setError('');
      setUser(await api.uploadAvatar(file));
      notify('Avatar updated');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to upload avatar');
      throw err;
    }
  };

  const removeAvatar = async () => {
    try {
      setError('');
      setUser(await api.removeAvatar());
      notify('Avatar removed');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove avatar');
      throw err;
    }
  };

  const saveJobHuntingProfile = async (value?: JobHuntingProfile) => {
    try {
      setError('');
      const payload = value ?? jobHuntingProfile;
      const saved =
        payload.id ?
          await api.updateJobHuntingProfileById(payload.id, payload)
        : await api.createJobHuntingProfile(payload);
      const normalizedSaved = mergeProfileApplicationInputs(saved);
      setJobHuntingProfile(normalizedSaved);
      setJobHuntingProfiles((current) => {
        const exists = current.some((item) => item.id === normalizedSaved.id);
        const next =
          exists ?
            current.map((item) =>
              item.id === normalizedSaved.id ? normalizedSaved : item,
            )
          : [normalizedSaved, ...current];
        return next.sort((left, right) => Number(Boolean(right.is_default)) - Number(Boolean(left.is_default)));
      });
      notify('Search config saved');
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to save search config',
      );
    }
  };

  const createJobHuntingProfile = async (value: JobHuntingProfile) => {
    try {
      setError('');
      const created = mergeProfileApplicationInputs(
        await api.createJobHuntingProfile(value),
      );
      setJobHuntingProfiles((current) => [created, ...current.filter((item) => item.id !== created.id)]);
      setJobHuntingProfile(created);
      notify('Search profile created');
      return created;
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to create search profile',
      );
      throw err;
    }
  };

  const activateJobHuntingProfile = async (profileId: string) => {
    try {
      setError('');
      const activated = mergeProfileApplicationInputs(
        await api.activateJobHuntingProfile(profileId),
      );
      setJobHuntingProfiles((current) =>
        current
          .map((item) => ({
            ...item,
            is_default: item.id === activated.id,
          }))
          .sort(
            (left, right) =>
              Number(Boolean(right.is_default)) - Number(Boolean(left.is_default)),
          ),
      );
      setJobHuntingProfile(activated);
      notify('Active search profile updated');
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to activate search profile',
      );
    }
  };

  const deleteJobHuntingProfile = async (profileId: string) => {
    try {
      setError('');
      await api.deleteJobHuntingProfile(profileId);
      setJobHuntingProfiles((current) => {
        const next = current.filter((item) => item.id !== profileId);
        const nextDefault = next.find((item) => item.is_default) ?? next[0];
        if (nextDefault) {
          setJobHuntingProfile(nextDefault);
        }
        return next;
      });
      notify('Search profile deleted');
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to delete search profile',
      );
    }
  };

  const saveRuntime = async (value?: RuntimeSettings) => {
    try {
      setError('');
      setRuntimeSettings(
        await api.updateRuntimeSettings(value ?? runtimeSettings),
      );
      notify('Runtime settings saved');
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to save runtime settings',
      );
    }
  };

  const saveApplicationSettings = async (value?: ApplicationSettings) => {
    try {
      setError('');
      setApplicationSettings(
        await api.updateApplicationSettings(value ?? applicationSettings),
      );
      notify('Application settings saved');
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to save application settings',
      );
    }
  };

  const saveQuestion = async (entry: QuestionCacheEntry, answer: string) => {
    const updated = await api.updateQuestionCache({ ...entry, answer });
    setQuestions((current) =>
      current.map((item) => (item.id === updated.id ? updated : item)),
    );
    notify('Answer updated');
  };

  const deleteQuestion = async (entryId: string) => {
    await api.deleteQuestionCache(entryId);
    setQuestions((current) => current.filter((item) => item.id !== entryId));
    notify('Question cache entry deleted');
  };

  const saveApplicationPatch = async (
    applicationId: string,
    payload: Partial<JobApplication>,
  ) => {
    const updated = await api.updateApplication(applicationId, payload);
    setApplications((current) =>
      sortApplications(
        current.map((item) => (item.id === updated.id ? updated : item)),
      ),
    );
    notify('Application updated');
    void loadAppStats();
  };

  const applicationPlanAction = async (
    applicationId: string,
    action: string,
    reason?: string,
  ): Promise<ApplicationPlanResponse> => {
    const response = await api.applicationPlanAction(applicationId, action, reason);
    const nextState = response.plan.state;
    const nextStatus = nextState === 'submitted' ? 'submitted' :
      nextState === 'skipped' || nextState === 'rejected' ? 'skipped' :
      nextState === 'awaiting_user_review' ? 'interrupted' : undefined;
    setApplications((current) => sortApplications(current.map((item) => item.id !== applicationId ? item : {
      ...item,
      ...(nextStatus ? { status: nextStatus } : {}),
      skip_reason: response.plan.review_reason ?? item.skip_reason,
      raw_data: { ...(item.raw_data || {}), application_plan: response.plan },
    })));
    notify(action === 'reject' ? 'Application plan rejected' : 'Application plan updated');
    return response;
  };



  const deleteApplication = async (applicationId: string) => {
    await api.deleteApplication(applicationId);
    setApplications((current) =>
      current.filter((item) => item.id !== applicationId),
    );
    notify('Application deleted');
    void loadAppStats();
  };

  const startWorker = async () => {
    setError('Legacy worker controls have been removed.');
  };

  const stopWorker = async () => {
    setError('Legacy worker controls have been removed.');
  };

  const mainBotState = botStates.linkedin ?? null;
  const mainBotName = 'linkedin';

  useEffect(() => {
    if (!isDesktopRuntime() || !window.autoJobDesktop) {
      return;
    }

    const loadInitialBotStates = async () => {
      if (window.autoJobDesktop?.getBotState) {
        try {
          const states = await Promise.all(
            DESKTOP_PLATFORMS.map(async (platform) => [
              platform,
              (await window.autoJobDesktop?.getBotState?.(platform)) ||
                createIdleBotState(),
            ]),
          );
          setBotStates(
            Object.fromEntries(states) as Record<
              DesktopBotPlatform,
              DesktopBotState
            >,
          );
        } catch (err) {
          // Ignore initial sync errors
        }
      }
    };
    loadInitialBotStates();

    let unsubscribe: (() => void) | undefined;
    if (window.autoJobDesktop.onBotStatus) {
      unsubscribe = window.autoJobDesktop.onBotStatus(({ platform, state }) => {
        setBotStates((prev) => ({
          ...prev,
          [platform]: state,
        }));

        if (state.status === 'failed' && state.message) {
          const formattedPlatform = platform === 'third_party' ? 'Assisted Apply' : platform.toUpperCase();
          const errorMsg = `${formattedPlatform} error: ${state.message}`;
          setError(errorMsg);
          showGlobalToast(errorMsg);
        }
      });
    }

    return () => {
      unsubscribe?.();
    };
  }, []);

  const [trendRange, setTrendRange] = useState<7 | 30>(7);

  const stats = useMemo(() => {
    const getComparisonDetails = (todayVal: number, yesterdayVal: number) => {
      const diff = todayVal - yesterdayVal;
      if (diff > 0) {
        return {
          comparison: `+${diff} vs yesterday`,
          comparisonColor: 'text-emerald-500 dark:text-emerald-400',
          comparisonIcon: ArrowUpRight,
        };
      } else if (diff < 0) {
        return {
          comparison: `-${Math.abs(diff)} vs yesterday`,
          comparisonColor: 'text-rose-500 dark:text-rose-400',
          comparisonIcon: ArrowDownRight,
        };
      } else {
        return {
          comparison: 'Same as yesterday',
          comparisonColor: 'text-ink-primary0 dark:text-zinc-400',
          comparisonIcon: MoveRight,
        };
      }
    };

    return [
      {
        label: 'Processing',
        value: appStats?.total_applications ?? 0,
        icon: Briefcase,
        iconColor: 'text-blue-500/50 dark:text-blue-400',
        textColor: 'text-blue-600 dark:text-blue-400',
        bgColor: 'bg-blue-500/5 dark:bg-blue-500/20',
        borderColor: 'border-blue-500/20',
      },
      {
        label: 'Submitted',
        value: appStats?.submitted ?? 0,
        icon: CheckCircle2,
        iconColor: 'text-emerald-500/50 dark:text-emerald-400',
        textColor: 'text-emerald-600 dark:text-emerald-400',
        bgColor: 'bg-emerald-500/5 dark:bg-emerald-500/20',
        borderColor: 'border-emerald-500/20',
      },
      {
        label: 'Interviewing',
        value: appStats?.interviewing ?? 0,
        icon: MessageSquareCode,
        iconColor: 'text-purple-500/50 dark:text-purple-400',
        textColor: 'text-purple-600 dark:text-purple-400',
        bgColor: 'bg-purple-500/5 dark:bg-purple-500/20',
        borderColor: 'border-purple-500/20',
      },
      {
        label: 'Skipped',
        value: appStats?.skipped ?? 0,
        icon: ChevronLast,
        iconColor: 'text-amber-500/50 dark:text-amber-400',
        textColor: 'text-amber-500 dark:text-amber-400',
        bgColor: 'bg-amber-500/5 dark:bg-amber-500/20',
        borderColor: 'border-amber-500/20',
      },
    ];
  }, [appStats]);

  const dashboardData = useMemo(() => {
    interface DayTrend {
      rawDateStr: string;
      displayDate: string;
      Submitted: number;
      Skipped: number;
    }
    const days: DayTrend[] = [];
    for (let i = trendRange - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const dateVal = String(d.getDate()).padStart(2, '0');
      const dateStr = `${year}-${month}-${dateVal}`;

      days.push({
        rawDateStr: dateStr,
        displayDate: d.toLocaleDateString(undefined, {
          month: 'short',
          day: 'numeric',
        }),
        Submitted: 0,
        Skipped: 0,
      });
    }

    applications.forEach((app) => {
      const applicationDate = getApplicationDisplayDate(app);
      if (!applicationDate) return;
      const d = new Date(applicationDate);
      if (Number.isNaN(d.getTime())) return;
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const dateVal = String(d.getDate()).padStart(2, '0');
      const appDateStr = `${year}-${month}-${dateVal}`;
      const match = days.find((day) => day.rawDateStr === appDateStr);
      if (match) {
        const statusLower = app.status.toLowerCase();
        if (isStatusSubmitted(app.status)) {
          match.Submitted += 1;
        } else if (statusLower.includes('skip')) {
          match.Skipped += 1;
        }
      }
    });

    const trend = days.map((day) => ({
      date: day.displayDate,
      Submitted: day.Submitted,
      Skipped: day.Skipped,
    }));

    const statusCounts: Record<string, number> = {};
    applications.forEach((app) => {
      let status = 'Other';
      const s = app.status.toLowerCase();
      if (isStatusSubmitted(app.status)) status = 'Submitted';
      else if (s.includes('skip')) status = 'Skipped';
      else if (s.includes('cancel')) status = 'Cancelled';
      else if (s.includes('pending') || s.includes('process'))
        status = 'Pending';
      statusCounts[status] = (statusCounts[status] || 0) + 1;
    });

    const statusColors: Record<string, string> = {
      Submitted: '#10b981',
      Skipped: '#f59e0b',
      Pending: '#3b82f6',
      Cancelled: '#ef4444',
      Other: '#71717a',
    };

    const statusDistribution = Object.keys(statusCounts).map((name) => ({
      name,
      value: statusCounts[name],
      fill: statusColors[name] || '#71717a',
    }));

    const skipReasonCounts: Record<string, number> = {};
    let totalSkipped = 0;
    applications.forEach((app) => {
      const s = app.status.toLowerCase();
      if (s.includes('skip')) {
        totalSkipped += 1;
        const rawReason = app.skip_reason || 'unknown_reason';
        let reason = rawReason;
        if (
          reason.includes('blacklist_rules.company') ||
          reason.includes('company_blacklist')
        ) {
          reason = 'Blacklisted Company';
        } else if (
          reason.includes('blacklist_rules.title') ||
          reason.includes('title_blacklist')
        ) {
          reason = 'Blacklisted Job Title';
        } else if (reason.includes('require_visa') || reason.includes('visa')) {
          reason = 'Visa Sponsorship Required';
        } else if (
          reason.includes('years_of_experience') ||
          reason.includes('experience')
        ) {
          reason = 'Experience Requirements Mismatch';
        } else if (reason.includes('resume') || reason.includes('no_resume')) {
          reason = 'Missing Resume';
        } else if (reason.includes('whitelist')) {
          reason = 'Whitelist Check Failed';
        } else if (reason.startsWith('no_') || reason.includes('missing')) {
          reason = `Missing required field: ${reason.replace('no_', '').replace('_', ' ')}`;
        } else {
          reason = reason
            .replace(/_/g, ' ')
            .replace(/\b\w/g, (char) => char.toUpperCase());
        }
        skipReasonCounts[reason] = (skipReasonCounts[reason] || 0) + 1;
      }
    });

    const skipReasons = Object.keys(skipReasonCounts)
      .map((name) => ({
        name,
        value: skipReasonCounts[name],
        percentage:
          totalSkipped > 0 ?
            Math.round((skipReasonCounts[name] / totalSkipped) * 100)
          : 0,
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);

    const cityCounts: Record<string, number> = {};
    applications.forEach((app) => {
      if (app.work_location) {
        const city = app.work_location.trim();
        if (city && city.toLowerCase() !== 'unknown') {
          cityCounts[city] = (cityCounts[city] || 0) + 1;
        }
      }
    });

    const cityColors = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899'];
    const topCities = Object.keys(cityCounts)
      .map((name) => ({
        name,
        value: cityCounts[name],
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5)
      .map((item, index) => ({
        ...item,
        fill: cityColors[index % cityColors.length],
      }));

    const companyCounts: Record<string, number> = {};
    applications.forEach((app) => {
      if (app.status.toLowerCase().includes('submit') && app.company) {
        companyCounts[app.company] = (companyCounts[app.company] || 0) + 1;
      }
    });

    const topCompanies = Object.keys(companyCounts)
      .map((name) => ({
        name,
        applications: companyCounts[name],
      }))
      .sort((a, b) => b.applications - a.applications)
      .slice(0, 5);

    const recentActivities = [...applications]
      .sort((a, b) => {
        const aDisplayDate = getApplicationDisplayDate(a);
        const bDisplayDate = getApplicationDisplayDate(b);
        const da = aDisplayDate ? new Date(aDisplayDate).getTime() : 0;
        const db = bDisplayDate ? new Date(bDisplayDate).getTime() : 0;
        return db - da;
      })
      .slice(0, 5);

    return {
      trend,
      statusDistribution,
      skipReasons,
      topCities,
      topCompanies,
      recentActivities,
    };
  }, [applications, trendRange]);

  const contextValue: ConsoleContextType = {
    user,
    profile,
    setProfile,
    updateProfileExtra,
    jobHuntingProfile,
    setJobHuntingProfile,
    jobHuntingProfiles,
    setJobHuntingProfiles,
    runtimeSettings,
    setRuntimeSettings,
    applicationSettings,
    setApplicationSettings,
    questions,
    setQuestions,
    applications,
    setApplications,
    mainBotState,
    mainBotName,
    processingApplicationsCount,
    expandedApplicationId,
    setExpandedApplicationId,
    notify,
    error,
    setError,
    isPending,
    hasLoadedInitialData,
    hasLoadedJobApplyData,
    jobApplyLoading,
    loadData,
    saveAvatar,
    removeAvatar,
    saveProfile,
    saveJobHuntingProfile,
    createJobHuntingProfile,
    activateJobHuntingProfile,
    deleteJobHuntingProfile,
    saveRuntime,
    saveApplicationSettings,
    saveQuestion,
    deleteQuestion,
    saveApplicationPatch,
    applicationPlanAction,
    deleteApplication,
    startWorker,
    stopWorker,
    appStats,
    stats,
    dashboardData,
    trendRange,
    setTrendRange,
    desktopRuntime,
    desktopServiceStatus,
    isDesktopApp: isDesktopRuntime(),
    desktopConnectionConfig,
    saveDesktopConnectionConfig,
    resetDesktopConnectionConfig,
    isGuest,
    requireAuth,
    botStates,
    startBot,
    stopBot,
  };

  return (
    <ConsoleContext.Provider value={contextValue}>
      {children}
    </ConsoleContext.Provider>
  );
}

export function useConsole() {
  const context = useContext(ConsoleContext);
  if (!context) {
    throw new Error('useConsole must be used within a ConsoleProvider');
  }
  return context;
}
