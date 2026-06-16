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
import { api } from '@/lib/api';
import type {
  AutomationRun,
  DesktopConnectionConfig,
  DesktopConnectionConfigResult,
  DesktopRuntimeInfo,
  DesktopServiceStatus,
  JobApplication,
  JobPreferences,
  QuestionCacheEntry,
  RuntimeSettings,
  SearchProfile,
  User,
  UserProfile,
} from '@/lib/types';
import { isDesktopRuntime } from '@/lib/runtime';

import {
  Briefcase,
  CheckCircle2,
  MessageSquareCode,
  ChevronLast,
} from 'lucide-react';

export const emptyProfile: UserProfile = {
  first_name: '',
  middle_name: '',
  last_name: '',
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
};

export const emptyPreferences: JobPreferences = {
  years_of_experience: '',
  require_visa: 'No',
  website: '',
  linkedin_url: '',
  resume_path: '',
  us_citizenship: '',
  desired_salary: '',
  current_ctc: '',
  notice_period: null,
  linkedin_headline: '',
  linkedin_summary: '',
  cover_letter: '',
  user_information_all: '',
  recent_employer: '',
  confidence_level: '',
};

export const emptySearch: SearchProfile = {
  name: 'Default Search Profile',
  platform: 'linkedin',
  search_terms: [],
  search_location: '',
  filters: {},
  blacklist_rules: {},
  whitelist_rules: {},
  is_default: true,
};

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

function getLinkAsyncWarning(application: JobApplication) {
  if (application.status === 'skipped') {
    return `Warning: Link async resulted in 'skipped'. Reason: ${application.skip_reason ?? 'unknown'}`;
  }
  return '';
}

function isAutomationRunActive(status: string | null | undefined) {
  return ['pending', 'running', 'cancel_requested'].includes(
    String(status || '').toLowerCase(),
  );
}

function isAutomationRunTerminal(status: string | null | undefined) {
  return ['success', 'failed', 'cancelled'].includes(
    String(status || '').toLowerCase(),
  );
}

function readHeartbeatAt(run: AutomationRun | null) {
  const heartbeatAt = run?.summary?.heartbeat_at;
  return typeof heartbeatAt === 'string' ? heartbeatAt : null;
}

async function sleep(ms: number) {
  await new Promise((resolve) => window.setTimeout(resolve, ms));
}

interface ConsoleContextType {
  user: User | null;
  profile: UserProfile;
  setProfile: React.Dispatch<React.SetStateAction<UserProfile>>;
  preferences: JobPreferences;
  setPreferences: React.Dispatch<React.SetStateAction<JobPreferences>>;
  searchProfile: SearchProfile;
  setSearchProfile: React.Dispatch<React.SetStateAction<SearchProfile>>;
  runtimeSettings: RuntimeSettings;
  setRuntimeSettings: React.Dispatch<React.SetStateAction<RuntimeSettings>>;
  questions: QuestionCacheEntry[];
  setQuestions: React.Dispatch<React.SetStateAction<QuestionCacheEntry[]>>;
  applications: JobApplication[];
  setApplications: React.Dispatch<React.SetStateAction<JobApplication[]>>;
  latestRun: AutomationRun | null;
  latestStatusUpdatedAt: string | null;
  statusFilter: string;
  setStatusFilter: (s: string) => void;
  searchText: string;
  setSearchText: (s: string) => void;
  syncingApplicationId: string;
  batchSyncing: boolean;
  expandedApplicationId: string;
  setExpandedApplicationId: (id: string) => void;
  toast: string;
  notify: (message: string) => void;
  error: string;
  setError: (err: string) => void;
  isPending: boolean;
  workerIsStarting: boolean;
  workerIsActive: boolean;
  workerIsStopping: boolean;
  loadData: () => void;
  saveProfile: () => Promise<void>;
  savePreferences: () => Promise<void>;
  saveSearch: () => Promise<void>;
  saveRuntime: () => Promise<void>;
  saveQuestion: (entry: QuestionCacheEntry, answer: string) => Promise<void>;
  deleteQuestion: (entryId: string) => Promise<void>;
  saveApplicationPatch: (
    applicationId: string,
    payload: Partial<JobApplication>,
  ) => Promise<void>;
  asyncApplication: (applicationId: string) => Promise<void>;
  batchAsyncApplications: () => Promise<void>;
  deleteApplication: (applicationId: string) => Promise<void>;
  startWorker: () => Promise<void>;
  stopWorker: () => Promise<void>;
  stats: Array<{
    label: string;
    value: number;
    icon: any;
    iconColor: string;
    textColor: string;
    bgColor: string;
    borderColor: string;
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
}

const ConsoleContext = createContext<ConsoleContextType | null>(null);

export function ConsoleProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile>(emptyProfile);
  const [preferences, setPreferences] =
    useState<JobPreferences>(emptyPreferences);
  const [searchProfile, setSearchProfile] =
    useState<SearchProfile>(emptySearch);
  const [runtimeSettings, setRuntimeSettings] =
    useState<RuntimeSettings>(emptyRuntime);
  const [questions, setQuestions] = useState<QuestionCacheEntry[]>([]);
  const [applications, setApplications] = useState<JobApplication[]>([]);
  const [latestRun, setLatestRun] = useState<AutomationRun | null>(null);
  const [statusFilter, setStatusFilter] = useState('');
  const [searchText, setSearchText] = useState('');
  const [syncingApplicationId, setSyncingApplicationId] = useState('');
  const [batchSyncing, setBatchSyncing] = useState(false);
  const [expandedApplicationId, setExpandedApplicationId] = useState('');
  const [toast, setToast] = useState('');
  const [error, setError] = useState('');
  const [isPending, startTransition] = useTransition();
  const [desktopRuntime, setDesktopRuntime] =
    useState<DesktopRuntimeInfo | null>(null);
  const [desktopServiceStatus, setDesktopServiceStatus] =
    useState<DesktopServiceStatus | null>(null);
  const [desktopConnectionConfig, setDesktopConnectionConfig] =
    useState<DesktopConnectionConfig | null>(null);
  const [workerActionState, setWorkerActionState] = useState<
    'idle' | 'starting' | 'stopping'
  >('idle');

  const notify = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(''), 2600);
  };

  const loadData = () => {
    startTransition(async () => {
      try {
        setError('');
        const [
          me,
          currentProfile,
          jobPrefs,
          defaultSearch,
          questionRows,
          applicationRows,
          currentRun,
          runtimeConfig,
        ] = await Promise.all([
          api.me(),
          api.profile(),
          api.jobPreferences(),
          api.searchProfile(),
          api.questionCache(),
          api.applications(),
          api.latestAutomationRun(),
          api.runtimeSettings(),
        ]);
        setUser(me);
        setProfile(currentProfile ?? emptyProfile);
        setPreferences(jobPrefs ?? emptyPreferences);
        setSearchProfile(defaultSearch ?? emptySearch);
        setRuntimeSettings(runtimeConfig ?? emptyRuntime);
        setQuestions(questionRows);
        setApplications(applicationRows);
        setLatestRun(currentRun);
      } catch (loadError) {
        setError(
          loadError instanceof Error ?
            loadError.message
          : 'Failed to load data',
        );
      }
    });
  };

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    const interval = window.setInterval(async () => {
      try {
        const currentRun = await api.latestAutomationRun();
        setLatestRun(currentRun);
      } catch {
        // Keep polling lightweight; the existing page-level error banner is enough.
      }

      if (isDesktopRuntime() && window.autoJobDesktop?.getServiceStatus) {
        try {
          const serviceStatus = await window.autoJobDesktop.getServiceStatus();
          setDesktopServiceStatus(serviceStatus ?? null);
        } catch {
          // Ignore background desktop status polling failures.
        }
      }
    }, 1000);

    return () => {
      window.clearInterval(interval);
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

  useEffect(() => {
    const latestStatus = String(latestRun?.status || '').toLowerCase();

    if (
      workerActionState === 'starting' &&
      isAutomationRunActive(latestStatus)
    ) {
      setWorkerActionState('idle');
    }

    if (
      workerActionState === 'stopping' &&
      isAutomationRunTerminal(latestStatus)
    ) {
      setWorkerActionState('idle');
    }
  }, [latestRun, workerActionState]);

  const waitForLatestRunStatus = async (
    predicate: (run: AutomationRun | null) => boolean,
    timeoutMs = 15000,
  ) => {
    const deadline = Date.now() + timeoutMs;
    let currentRun: AutomationRun | null = null;

    while (Date.now() < deadline) {
      currentRun = await api.latestAutomationRun();
      setLatestRun(currentRun);
      if (predicate(currentRun)) {
        return currentRun;
      }
      await sleep(300);
    }

    return currentRun;
  };

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

  const saveProfile = async () => {
    setProfile(await api.updateProfile(profile));
    notify('Profile saved');
  };

  const savePreferences = async () => {
    setPreferences(await api.updateJobPreferences(preferences));
    notify('Preferences saved');
  };

  const saveSearch = async () => {
    setSearchProfile(await api.updateSearchProfile(searchProfile));
    notify('Search config saved');
  };

  const saveRuntime = async () => {
    setRuntimeSettings(await api.updateRuntimeSettings(runtimeSettings));
    notify('Runtime settings saved');
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
      current.map((item) => (item.id === updated.id ? updated : item)),
    );
    notify('Application updated');
  };

  const asyncApplication = async (applicationId: string) => {
    try {
      setError('');
      setSyncingApplicationId(applicationId);
      const updated = await api.asyncApplicationFromLink(applicationId);
      setApplications((current) =>
        current.map((item) => (item.id === updated.id ? updated : item)),
      );
      notify(getLinkAsyncWarning(updated) || 'Application async completed');
    } catch (asyncError) {
      setError(
        asyncError instanceof Error ?
          asyncError.message
        : 'Failed to async application from link',
      );
    } finally {
      setSyncingApplicationId('');
    }
  };

  const batchAsyncApplications = async () => {
    try {
      setError('');
      setBatchSyncing(true);
      const result = await api.batchAsyncApplicationsFromLink(100);
      notify(
        `Async finished: ${result.synced} synced, ${result.failed} failed`,
      );
      loadData();
    } catch (batchError) {
      setError(
        batchError instanceof Error ?
          batchError.message
        : 'Failed to batch async applications',
      );
    } finally {
      setBatchSyncing(false);
    }
  };

  const deleteApplication = async (applicationId: string) => {
    await api.deleteApplication(applicationId);
    setApplications((current) =>
      current.filter((item) => item.id !== applicationId),
    );
    notify('Application deleted');
  };

  const startWorker = async () => {
    try {
      setError('');
      setWorkerActionState('starting');
      notify('Starting Auto Apply...');
      const run = await api.startLocalWorker();
      setLatestRun(run);
      await waitForLatestRunStatus(
        (currentRun) => isAutomationRunActive(currentRun?.status),
        10000,
      );
      notify(
        run.status === 'pending' ?
          'Start request queued for host worker'
        : 'Local worker started',
      );
      loadData();
    } catch (startError) {
      setWorkerActionState('idle');
      setError(
        startError instanceof Error ?
          startError.message
        : 'Failed to start local worker',
      );
    }
  };

  const stopWorker = async () => {
    try {
      setError('');
      setWorkerActionState('stopping');
      notify('Stopping Auto Apply...');
      const run = await api.stopLocalWorker();
      setLatestRun(run);
      const settledRun = await waitForLatestRunStatus(
        (currentRun) => isAutomationRunTerminal(currentRun?.status),
        15000,
      );
      if (settledRun && !isAutomationRunTerminal(settledRun.status)) {
        setWorkerActionState('idle');
      }
      notify('Local worker stopped');
      loadData();
    } catch (stopError) {
      setWorkerActionState('idle');
      setError(
        stopError instanceof Error ?
          stopError.message
        : 'Failed to stop local worker',
      );
    }
  };

  const latestStatus = String(latestRun?.status || '').toLowerCase();
  const latestHeartbeatAt = readHeartbeatAt(latestRun);
  const latestStatusUpdatedAt = latestHeartbeatAt ?? latestRun?.updated_at ?? null;
  const workerIsStarting = workerActionState === 'starting';
  const workerIsStopping =
    workerActionState === 'stopping' || latestStatus === 'cancel_requested';
  const workerIsActive =
    !workerIsStarting &&
    !workerIsStopping &&
    isAutomationRunActive(latestStatus);

  const [trendRange, setTrendRange] = useState<7 | 30>(7);

  const stats = useMemo(() => {
    const skipped = applications.filter((item) =>
      item.status.toLowerCase().includes('skip'),
    ).length;
    const submitted = applications.filter((item) =>
      item.status.toLowerCase().includes('submit'),
    ).length;
    const interviewing = applications.filter(
      (item) => item.pipeline_stage === 'interviewing',
    ).length;
    return [
      {
        label: 'Applications',
        value: applications.length,
        icon: Briefcase,
        iconColor: 'text-blue-500/50 hover:text-white dark:text-blue-400',
        textColor: 'text-blue-600 dark:text-blue-400',
        bgColor: 'bg-blue-500/5 dark:bg-blue-500/20',
        borderColor: 'border-blue-500/20',
      },
      {
        label: 'Submitted',
        value: submitted,
        icon: CheckCircle2,
        iconColor: 'text-emerald-500/50 dark:text-emerald-400',
        textColor: 'text-emerald-600 dark:text-emerald-400',
        bgColor: 'bg-emerald-500/5 dark:bg-emerald-500/20',
        borderColor: 'border-emerald-500/20',
      },
      {
        label: 'Interviewing',
        value: interviewing,
        icon: MessageSquareCode,
        iconColor: 'text-purple-500/50 dark:text-purple-400',
        textColor: 'text-purple-600 dark:text-purple-400',
        bgColor: 'bg-purple-500/5 dark:bg-purple-500/20',
        borderColor: 'border-purple-500/20',
      },
      {
        label: 'Skipped',
        value: skipped,
        icon: ChevronLast,
        iconColor: 'text-amber-500/50 dark:text-amber-400',
        textColor: 'text-amber-500 dark:text-amber-400',
        bgColor: 'bg-amber-500/5 dark:bg-amber-500/20',
        borderColor: 'border-amber-500/20',
      },
    ];
  }, [applications]);

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
      if (!app.date_applied) return;
      const appDateStr = app.date_applied.split('T')[0];
      const match = days.find((day) => day.rawDateStr === appDateStr);
      if (match) {
        const statusLower = app.status.toLowerCase();
        if (statusLower.includes('submit')) {
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
      if (s.includes('submit')) status = 'Submitted';
      else if (s.includes('skip')) status = 'Skipped';
      else if (s.includes('cancel')) status = 'Cancelled';
      else if (s.includes('pending')) status = 'Pending';
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
        const da = a.date_applied ? new Date(a.date_applied).getTime() : 0;
        const db = b.date_applied ? new Date(b.date_applied).getTime() : 0;
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

  return (
    <ConsoleContext.Provider
      value={{
        user,
        profile,
        setProfile,
        preferences,
        setPreferences,
        searchProfile,
        setSearchProfile,
        runtimeSettings,
        setRuntimeSettings,
        questions,
        setQuestions,
        applications,
        setApplications,
        latestRun,
        latestStatusUpdatedAt,
        statusFilter,
        setStatusFilter,
        searchText,
        setSearchText,
        syncingApplicationId,
        batchSyncing,
        expandedApplicationId,
        setExpandedApplicationId,
        toast,
        notify,
        error,
        setError,
        isPending,
        workerIsStarting,
        workerIsActive,
        workerIsStopping,
        loadData,
        saveProfile,
        savePreferences,
        saveSearch,
        saveRuntime,
        saveQuestion,
        deleteQuestion,
        saveApplicationPatch,
        asyncApplication,
        batchAsyncApplications,
        deleteApplication,
        startWorker,
        stopWorker,
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
      }}
    >
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
