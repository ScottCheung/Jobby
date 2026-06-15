/** @format */

'use client';

import { Fragment, useEffect, useMemo, useState, useTransition } from 'react';
import { api } from '@/lib/api';
import { H1, H2, H3 } from '@/components/UI/text/typography';
import CardWithNorth from '@/components/UI/card/CardWithNorth';
import type {
  AutomationRun,
  JobApplication,
  JobPreferences,
  QuestionCacheEntry,
  RuntimeSettings,
  SearchProfile,
  User,
  UserProfile,
} from '@/lib/types';
import { ApplicationDetails } from './ApplicationDetails';
import { PreferencesForm, ProfileForm, RuntimeForm, SearchForm } from './forms';
import { useTheme } from './theme-provider';
import { cn } from '../lib/utils';
import { Chart } from '@/components/UI/Chart';
import { ToggleGroup } from '@/components/UI/toggle-group';
import {
  LayoutDashboard,
  User as UserIcon,
  Search,
  MessageSquareCode,
  Briefcase,
  ChevronLeft,
  ChevronRight,
  Bot,
  Sun,
  Moon,
  Laptop,
  LogOut,
  RefreshCw,
  Trash2,
  ExternalLink,
  RotateCw,
  Square,
  Play,
  Settings,
  CheckCircle2,
  XCircle,
} from 'lucide-react';

type Tab = 'overview' | 'profile' | 'search' | 'questions' | 'applications';

const tabs: Array<{ id: Tab; label: string; hint: string }> = [
  { id: 'overview', label: 'Overview', hint: 'pulse' },
  { id: 'profile', label: 'Profile', hint: 'identity' },
  { id: 'search', label: 'Search', hint: 'targets' },
  { id: 'questions', label: 'Question Cache', hint: 'answers' },
  { id: 'applications', label: 'Applications', hint: 'history' },
];

const emptyProfile: UserProfile = {
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

const emptyPreferences: JobPreferences = {
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

const emptySearch: SearchProfile = {
  name: 'Default Search Profile',
  platform: 'linkedin',
  search_terms: [],
  search_location: '',
  filters: {},
  blacklist_rules: {},
  whitelist_rules: {},
  is_default: true,
};

const emptyRuntime: RuntimeSettings = {
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

function formatDate(iso: string | null | undefined) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function statusClass(status: string) {
  if (status === 'submitted') return 'badge success';
  if (status === 'skipped') return 'badge neutral';
  return 'badge pending';
}

function IconButton({
  label,
  icon,
  onClick,
  disabled = false,
  danger = false,
}: {
  label: string;
  icon: 'async' | 'edit' | 'delete' | 'open';
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
}) {
  const Icon = {
    async: RefreshCw,
    edit: Settings,
    delete: Trash2,
    open: ExternalLink,
  }[icon];

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={cn(
        'p-2 rounded-xl transition-all border border-zinc-200/60 dark:border-zinc-805/60 bg-panel hover:bg-zinc-50 text-zinc-500 hover:text-zinc-900 dark:hover:bg-zinc-800/40 dark:text-zinc-400 dark:hover:text-zinc-100 flex items-center justify-center shrink-0 disabled:opacity-40 disabled:pointer-events-none active:scale-[0.96] shadow-xs cursor-pointer',
        danger &&
          'text-red-500 hover:text-red-600 dark:text-red-400 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-950/20 border-red-100 dark:border-red-900/30',
      )}
    >
      <Icon className='w-4 h-4' />
    </button>
  );
}

export function UserConsole() {
  const { theme, setTheme } = useTheme();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>('overview');
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
          api.applications(), // Fetch all applications so dashboard calculations are complete
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
  }, []); // Only fetch on mount, filter in memory afterwards

  const filteredApplications = useMemo(() => {
    let result = applications;
    if (statusFilter) {
      result = result.filter(
        (item) => item.status.toLowerCase() === statusFilter.toLowerCase(),
      );
    }
    const query = searchText.trim().toLowerCase();
    if (!query) return result;
    return result.filter((item) =>
      [item.title, item.company, item.job_id, item.status].some((value) =>
        String(value ?? '')
          .toLowerCase()
          .includes(query),
      ),
    );
  }, [applications, statusFilter, searchText]);

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
        iconColor: 'text-blue-500 dark:text-blue-400',
        textColor: 'text-blue-600 dark:text-blue-400',
        bgColor: 'bg-blue-500/10 dark:bg-blue-500/20',
        borderColor: 'border-blue-500/20',
      },
      {
        label: 'Submitted',
        value: submitted,
        icon: CheckCircle2,
        iconColor: 'text-emerald-500 dark:text-emerald-400',
        textColor: 'text-emerald-600 dark:text-emerald-400',
        bgColor: 'bg-emerald-500/10 dark:bg-emerald-500/20',
        borderColor: 'border-emerald-500/20',
      },
      {
        label: 'Interviewing',
        value: interviewing,
        icon: MessageSquareCode,
        iconColor: 'text-purple-500 dark:text-purple-400',
        textColor: 'text-purple-600 dark:text-purple-400',
        bgColor: 'bg-purple-500/10 dark:bg-purple-500/20',
        borderColor: 'border-purple-500/20',
      },
      {
        label: 'Skipped',
        value: skipped,
        icon: XCircle,
        iconColor: 'text-rose-500 dark:text-rose-400',
        textColor: 'text-rose-600 dark:text-rose-400',
        bgColor: 'bg-rose-500/10 dark:bg-rose-500/20',
        borderColor: 'border-rose-500/20',
      },
    ];
  }, [applications, questions]);

  const [trendRange, setTrendRange] = useState<7 | 30>(7);

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
    const confirmed = window.confirm(
      'Delete this application record? This is a soft delete and will not affect LinkedIn.',
    );
    if (!confirmed) return;

    await api.deleteApplication(applicationId);
    setApplications((current) =>
      current.filter((item) => item.id !== applicationId),
    );
    notify('Application deleted');
  };

  const startWorker = async () => {
    const confirmed = window.confirm(
      'This will start the local Python auto-apply worker on this machine. It may open Chrome and begin applying to jobs using the current database configuration. Start now?',
    );
    if (!confirmed) return;

    try {
      const run = await api.startLocalWorker();
      setLatestRun(run);
      notify(
        run.status === 'pending' ?
          'Start request queued for host worker'
        : 'Local worker started',
      );
    } catch (startError) {
      setError(
        startError instanceof Error ?
          startError.message
        : 'Failed to start local worker',
      );
    }
  };

  const stopWorker = async () => {
    const confirmed = window.confirm(
      'Stop the currently running local auto-apply worker?',
    );
    if (!confirmed) return;

    try {
      const run = await api.stopLocalWorker();
      setLatestRun(run);
      notify('Local worker stopped');
    } catch (stopError) {
      setError(
        stopError instanceof Error ?
          stopError.message
        : 'Failed to stop local worker',
      );
    }
  };

  const tabIcons = {
    overview: LayoutDashboard,
    profile: UserIcon,
    search: Search,
    questions: MessageSquareCode,
    applications: Briefcase,
  };

  const workerIsActive =
    latestRun?.status === 'running' ||
    latestRun?.status === 'pending' ||
    latestRun?.status === 'cancel_requested';

  return (
    <div className='min-h-screen bg-[#F4F4F6] dark:bg-[#0E1116] text-zinc-900 dark:text-zinc-100 flex transition-colors duration-300'>
      {/* Sidebar */}
      <aside
        className={cn(
          'h-screen sticky top-0 flex flex-col justify-between bg-panel border-r border-zinc-200/50 dark:border-zinc-800/50 p-4 transition-all duration-300 ease-in-out z-20 shrink-0',
          isCollapsed ? 'w-[80px]' : 'w-[260px]',
        )}
      >
        {/* Top Header */}
        <div className='relative'>
          <div className='flex items-center gap-3 px-2 py-1.5 overflow-hidden'>
            <div className='w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-600 to-green-700 flex items-center justify-center text-white font-extrabold text-lg shadow-md shrink-0'>
              <Bot className='w-5 h-5 text-white' />
            </div>
            {!isCollapsed && (
              <div className='flex flex-col min-w-0'>
                <span className='font-bold tracking-tight text-zinc-800 dark:text-zinc-100 text-sm truncate'>
                  AutoApplyAI
                </span>
                <span className='text-[10px] font-medium text-zinc-400 dark:text-zinc-500 uppercase tracking-wider'>
                  Control Panel
                </span>
              </div>
            )}
          </div>

          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className='absolute -right-12 top-1/2 w-12 h-12 rounded-full border border-zinc-200 dark:border-zinc-800 bg-panel flex items-center justify-center text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 shadow-sm z-30 transition-transform hover:scale-105 cursor-pointer'
          >
            {isCollapsed ?
              <ChevronRight className='w-3.5 h-3.5' />
            : <ChevronLeft className='w-3.5 h-3.5' />}
          </button>
        </div>

        {/* Navigation Section */}
        <nav className='flex flex-col gap-1 mt-6 flex-1'>
          {!isCollapsed && (
            <span className='text-[10px] font-bold text-zinc-400 dark:text-zinc-500 tracking-wider mb-2 px-3'>
              MAIN MENU
            </span>
          )}
          {tabs.map((tab) => {
            const Icon = tabIcons[tab.id];
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  'group relative flex items-center gap-3 rounded-xl transition-all duration-200 py-2.5 cursor-pointer',
                  isCollapsed ? 'justify-center px-2' : 'px-3',
                  isActive ?
                    'bg-zinc-900 text-white dark:bg-panel dark:text-zinc-955 shadow-xs font-semibold'
                  : 'text-zinc-500 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800/40',
                )}
                title={isCollapsed ? tab.label : undefined}
              >
                <Icon className='w-5 h-5 shrink-0' />
                {!isCollapsed && (
                  <span className='text-sm tracking-tight flex-1 text-left'>
                    {tab.label}
                  </span>
                )}
                {!isCollapsed && tab.hint && (
                  <span
                    className={cn(
                      'text-[10px] px-1.5 py-0.5 rounded-full font-medium shrink-0',
                      isActive ?
                        'bg-panel/10 text-white dark:bg-zinc-900/10 dark:text-zinc-950'
                      : 'bg-zinc-100 text-zinc-400 dark:bg-zinc-800 dark:text-zinc-500',
                    )}
                  >
                    {tab.hint}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Footer / User Details & Theme Toggle */}
        <div className='flex flex-col gap-4 border-t border-zinc-200/50 dark:border-zinc-800/50 pt-4'>
          {/* Theme Switcher */}
          <div
            className={cn(
              'flex items-center justify-between',
              isCollapsed ? 'justify-center' : 'px-2',
            )}
          >
            {!isCollapsed && (
              <span className='text-xs text-zinc-400 dark:text-zinc-500'>
                Theme
              </span>
            )}
            <div
              className={cn(
                'flex bg-zinc-100 dark:bg-zinc-800/60 p-0.5 rounded-lg',
                isCollapsed && 'flex-col',
              )}
            >
              <button
                onClick={() => setTheme('light')}
                className={cn(
                  'p-1 rounded-md text-zinc-500 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-zinc-100 cursor-pointer',
                  theme === 'light' &&
                    'bg-panel dark:bg-zinc-700 text-zinc-900 dark:text-white shadow-xs',
                )}
                title='Light Theme'
              >
                <Sun className='w-3.5 h-3.5' />
              </button>
              <button
                onClick={() => setTheme('dark')}
                className={cn(
                  'p-1 rounded-md text-zinc-500 hover:text-zinc-955 dark:text-zinc-400 dark:hover:text-zinc-100 cursor-pointer',
                  theme === 'dark' &&
                    'bg-panel dark:bg-zinc-700 text-zinc-900 dark:text-white shadow-xs',
                )}
                title='Dark Theme'
              >
                <Moon className='w-3.5 h-3.5' />
              </button>
              <button
                onClick={() => setTheme('system')}
                className={cn(
                  'p-1 rounded-md text-zinc-500 hover:text-zinc-955 dark:text-zinc-400 dark:hover:text-zinc-100 cursor-pointer',
                  theme === 'system' &&
                    'bg-panel dark:bg-zinc-700 text-zinc-900 dark:text-white shadow-xs',
                )}
                title='System Theme'
              >
                <Laptop className='w-3.5 h-3.5' />
              </button>
            </div>
          </div>

          {/* Profile Section */}
          <div
            className={cn(
              'flex items-center gap-3',
              isCollapsed ? 'justify-center' : 'px-2',
            )}
          >
            <div className='relative shrink-0'>
              <div className='w-10 h-10 rounded-full bg-emerald-600/10 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400 font-bold flex items-center justify-center border border-emerald-500/20 shadow-xs'>
                {user?.display_name ?
                  user.display_name.slice(0, 2).toUpperCase()
                : 'LU'}
              </div>
              <span className='absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 border-2 border-white dark:border-[#181C26] rounded-full'></span>
            </div>

            {!isCollapsed && (
              <div className='flex flex-col min-w-0 flex-1'>
                <span className='text-sm font-semibold text-zinc-800 dark:text-zinc-200 truncate leading-tight'>
                  {user?.display_name ?? 'Local Admin'}
                </span>
                <span className='text-[11px] text-zinc-400 dark:text-zinc-500 capitalize truncate'>
                  {user?.role ?? 'admin'}
                </span>
              </div>
            )}

            {!isCollapsed && (
              <button
                onClick={stopWorker}
                className='p-1.5 text-zinc-400 hover:text-red-500 dark:hover:text-red-400 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800/40 transition-colors shrink-0 cursor-pointer'
                title='Stop Worker'
              >
                <LogOut className='w-4 h-4' />
              </button>
            )}
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className='flex-1 min-w-0 p-page overflow-y-auto'>
        <div className='max-w-[1200px] mx-auto grid gap-8'>
          {/* Hero Header */}

          <header className='hero  bg-gradient-to-br from-green-800 via-emerald-900 to-zinc-950'>
            <span className='inline-block text-[10px] font-bold uppercase tracking-wider text-emerald-300 mb-2 px-2 py-0.5 rounded-md bg-emerald-500/20'>
              PostgreSQL backed workspace
            </span>
            <h1>Manage once. Let the local worker apply with clean data.</h1>
            <p>
              This console reads and writes through the API layer, so profile
              changes, saved answers, and application history now live in
              PostgreSQL instead of scattered files.
            </p>
          </header>

          {/* Stats Bar */}
          <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 pb-8'>
            {stats.map((item) => {
              const Icon = item.icon;
              return (
                <CardWithNorth
                  key={item.label}
                  title={item.label}
                  className='transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md'
                >
                  <div className='flex items-end justify-between h-full min-h-[80px] pt-2'>
                    <H1
                      className={cn(
                        'text-5xl font-extrabold tracking-tight leading-none',
                        item.textColor,
                      )}
                    >
                      {item.value}
                    </H1>
                    <div
                      className={cn(
                        'absolute rounded-xl border',
                        item.bgColor,
                        item.borderColor,
                      )}
                    >
                      <Icon className={cn('w-6 h-6', item.iconColor)} />
                    </div>
                  </div>
                </CardWithNorth>
              );
            })}
          </div>

          {error && (
            <div className='p-4 text-sm rounded-2xl border border-red-200/60 bg-red-500/5 text-red-600 dark:border-red-900/30 dark:text-red-400 flex items-center justify-center'>
              API is not reachable yet: {error}
            </div>
          )}
          {isPending && (
            <div className='p-4 text-sm rounded-2xl border border-zinc-200/60 bg-zinc-50 text-zinc-500 dark:border-zinc-800/60 dark:bg-zinc-900/40 dark:text-zinc-400 flex items-center justify-center gap-2'>
              <RefreshCw className='w-4 h-4 animate-spin' />
              Refreshing data...
            </div>
          )}

          {/* Tab Content Panels */}
          {activeTab === 'overview' && (
            <div className='grid grid-cols-12 gap-6'>
              {/* Row 1: Trend & Distribution Charts */}
              {/* Trend Chart - Span 2 Columns */}
              <div className='cols-span-12 md:col-span-7   bg-panel  rounded-card p-card  '>
                <div className='flex items-center justify-between mb-2'>
                  <div>
                    <H2>Application History</H2>
                    <p className='text-xs text-zinc-400 dark:text-zinc-500'>
                      Daily tracking of submitted vs skipped applications
                    </p>
                  </div>
                  <ToggleGroup
                    id='trend-range-toggle'
                    items={[
                      {
                        value: '7',
                        label: '7 Days',
                        icon: ({ className }) => (
                          <span
                            className={cn(
                              'text-[10px] font-bold flex items-center justify-center',
                              className,
                            )}
                          >
                            7d
                          </span>
                        ),
                      },
                      {
                        value: '30',
                        label: '30 Days',
                        icon: ({ className }) => (
                          <span
                            className={cn(
                              'text-[9px] font-bold flex items-center justify-center',
                              className,
                            )}
                          >
                            30d
                          </span>
                        ),
                      },
                    ]}
                    value={String(trendRange)}
                    onValueChange={(val) =>
                      setTrendRange(Number(val) as 7 | 30)
                    }
                  />
                </div>

                <div className='w-full h-72 mt-4'>
                  <Chart
                    type='area'
                    data={dashboardData.trend}
                    xKey='date'
                    yKeys={['Submitted', 'Skipped']}
                    showLegend
                    stacked
                    gradientFill
                    showDots='visible'
                    className='h-full'
                  />
                </div>
              </div>

              {/* Donut Chart - Span 1 Column */}
              <div className='cols-span-12 md:col-span-5 h-full  bg-panel  rounded-card p-card '>
                <div>
                  <H2>Application Status Breakdown</H2>
                  <p className='text-xs text-zinc-400 dark:text-zinc-500 mb-4'>
                    Proportions of all logged job application states
                  </p>
                </div>

                <div className='w-full flex h-80 items-center justify-center relative'>
                  <Chart
                    type='pie'
                    data={dashboardData.statusDistribution}
                    nameKey='name'
                    valueKey='value'
                    showLegend
                    className='h-full flex'
                  />
                </div>
              </div>

              {/* Row 2: Insights & Work Style Breakdown */}
              {/* Skip Reasons Card */}
              <div className='cols-span-12 md:col-span-6   bg-panel  rounded-card p-card '>
                <div>
                  <H2>Top Skip Reasons</H2>
                  <p className='text-xs text-zinc-400 dark:text-zinc-500 mb-4'>
                    Main constraints preventing automatic job application
                  </p>

                  <div className='space-y-4 mt-2'>
                    {dashboardData.skipReasons.length > 0 ?
                      dashboardData.skipReasons.map((item, index) => (
                        <div key={index} className='space-y-1'>
                          <div className='flex items-center justify-between text-xs'>
                            <span className='font-semibold text-zinc-750 dark:text-zinc-300 truncate max-w-[280px]'>
                              {item.name}
                            </span>
                            <span className='text-zinc-500 dark:text-zinc-500 font-mono'>
                              {item.value} ({item.percentage}%)
                            </span>
                          </div>
                          <div className='w-full bg-zinc-100 dark:bg-zinc-900 h-2 rounded-full overflow-hidden border border-zinc-200/20'>
                            <div
                              className='h-full rounded-full bg-gradient-to-r from-green-400 to-amber-600 dark:from-amber-500 dark:to-amber-700 transition-all duration-1000'
                              style={{ width: `${item.percentage}%` }}
                            />
                          </div>
                        </div>
                      ))
                    : <div className='py-8 text-center text-zinc-500 dark:text-zinc-500 italic text-sm'>
                        No skipped applications recorded yet.
                      </div>
                    }
                  </div>
                </div>
              </div>

              {/* Job Environment & Company Card */}
              <div className='cols-span-12 md:col-span-6   bg-panel  rounded-card p-card '>
                <div>
                  <H2>Distribution</H2>
                  <p className='text-xs text-zinc-400 dark:text-zinc-500 mb-4'>
                    Analysis of top cities and applied companies
                  </p>

                  <div className='grid grid-cols-1 sm:grid-cols-2 gap-6'>
                    {/* Top Cities details */}
                    <div className='space-y-3'>
                      <h4 className='text-xs font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider'>
                        Top Cities
                      </h4>
                      <div className='space-y-2.5'>
                        {(
                          dashboardData.topCities &&
                          dashboardData.topCities.length > 0
                        ) ?
                          dashboardData.topCities.map((item, index) => (
                            <div
                              key={index}
                              className='flex items-center justify-between text-xs p-2 rounded-lg bg-zinc-50/50 dark:bg-zinc-900/25 border border-zinc-100/50 dark:border-zinc-800/50'
                            >
                              <div className='flex items-center gap-1.5 min-w-0'>
                                <span
                                  className='w-2.5 h-2.5 rounded-full shrink-0'
                                  style={{ backgroundColor: item.fill }}
                                />
                                <span
                                  className='font-semibold text-zinc-700 dark:text-zinc-300 truncate'
                                  title={item.name}
                                >
                                  {item.name}
                                </span>
                              </div>
                              <span className='font-mono font-bold text-zinc-900 dark:text-zinc-200 shrink-0 ml-2'>
                                {item.value}
                              </span>
                            </div>
                          ))
                        : <div className='text-zinc-400 italic text-xs py-2'>
                            No city data
                          </div>
                        }
                      </div>
                    </div>

                    {/* Top Companies bar chart */}
                    <div className='space-y-3 flex flex-col'>
                      <h4 className='text-xs font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider'>
                        Top applied companies
                      </h4>
                      <div className='flex-1 min-h-[180px] w-full mt-2'>
                        {(
                          dashboardData.topCompanies &&
                          dashboardData.topCompanies.length > 0
                        ) ?
                          <Chart
                            type='bar'
                            data={dashboardData.topCompanies}
                            xKey='name'
                            yKey='applications'
                            layout='vertical'
                            showXAxis={true}
                            showYAxis={true}
                            className='h-full w-full'
                          />
                        : <div className='text-zinc-400 italic text-xs py-8 text-center'>
                            No submitted companies yet.
                          </div>
                        }
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Row 3: Recent Activity Feed */}
              <div className='cols-span-12 md:col-span-12   bg-panel  rounded-card p-card '>
                <div className='flex items-center justify-between mb-4'>
                  <div>
                    <H2>Recent Automation Feed</H2>
                    <p className='text-xs text-zinc-400 dark:text-zinc-500'>
                      The latest application attempts by the automation bot
                    </p>
                  </div>
                  <button
                    onClick={() => setActiveTab('applications')}
                    className='inline-flex items-center gap-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:underline cursor-pointer'
                  >
                    View all history <ChevronRight className='w-3.5 h-3.5' />
                  </button>
                </div>

                <div className='overflow-x-auto'>
                  <table className='w-full text-left border-collapse text-sm'>
                    <thead>
                      <tr className='border-b border-zinc-100 dark:border-zinc-800 text-[10px] font-bold text-zinc-500 dark:text-zinc-500 uppercase tracking-wider'>
                        <th className='pb-3 pr-4'>Position</th>
                        <th className='pb-3 px-4'>Company</th>
                        <th className='pb-3 px-4'>Workplace Style</th>
                        <th className='pb-3 px-4'>Status</th>
                        <th className='pb-3 pl-4 text-right'>Applied Date</th>
                      </tr>
                    </thead>
                    <tbody className='divide-y divide-zinc-100 dark:divide-zinc-800/50'>
                      {(
                        dashboardData.recentActivities &&
                        dashboardData.recentActivities.length > 0
                      ) ?
                        dashboardData.recentActivities.map((item) => (
                          <tr
                            key={item.id}
                            className='text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50/50 dark:hover:bg-zinc-900/10 transition-colors'
                          >
                            <td className='py-3 pr-4'>
                              <div className='font-bold text-zinc-900 dark:text-zinc-100 truncate max-w-xs'>
                                {item.title || 'Untitled Role'}
                              </div>
                              <span className='text-[10px] text-zinc-400 font-mono'>
                                ID: {item.job_id}
                              </span>
                            </td>
                            <td className='py-3 px-4 font-semibold text-zinc-800 dark:text-zinc-200 truncate max-w-[150px]'>
                              {item.company || 'Unknown'}
                            </td>
                            <td className='py-3 px-4 text-xs text-zinc-500 dark:text-zinc-400 capitalize'>
                              {item.work_style || 'Not Specified'}
                              {item.work_location && ` (${item.work_location})`}
                            </td>
                            <td className='py-3 px-4'>
                              <span
                                className={cn(
                                  'inline-flex items-center rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider',
                                  item.status === 'submitted' ?
                                    'bg-green-500/10 text-green-600 dark:bg-green-900/20 dark:text-green-400'
                                  : item.status === 'skipped' ?
                                    'bg-amber-500/10 text-amber-600 dark:bg-amber-900/20 dark:text-amber-400'
                                  : 'bg-zinc-500/10 text-zinc-600 dark:bg-zinc-850/20 dark:text-zinc-400',
                                )}
                              >
                                {item.status}
                              </span>
                              {item.skip_reason && (
                                <p
                                  className='text-[9px] text-zinc-400 dark:text-zinc-500 italic max-w-[150px] truncate'
                                  title={item.skip_reason}
                                >
                                  {item.skip_reason}
                                </p>
                              )}
                            </td>
                            <td className='py-3 pl-4 text-right text-xs text-zinc-450 dark:text-zinc-500 whitespace-nowrap'>
                              {formatDate(item.date_applied)}
                            </td>
                          </tr>
                        ))
                      : <tr>
                          <td
                            colSpan={5}
                            className='py-8 text-center text-zinc-500 dark:text-zinc-500 italic'
                          >
                            No application activities recorded yet.
                          </td>
                        </tr>
                      }
                    </tbody>
                  </table>
                </div>
              </div>
              {/* Row 4: Quick Config & Control Cards */}

              {/* Worker Controller Card */}
              <div className='cols-span-12 md:col-span-5   bg-panel  rounded-card p-card '>
                <div>
                  <div className='flex items-center justify-between mb-4'>
                    <H3 className='flex items-center gap-2'>
                      <Bot className='w-5 h-5 text-emerald-500' />
                      Worker Console
                    </H3>
                    <span
                      className={cn(
                        'inline-flex items-center bg-panel rounded-full px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wider',
                        workerIsActive ? 'bg-primary' : 'bg-panel',
                      )}
                    >
                      {latestRun?.status ?? 'idle'}
                    </span>
                  </div>

                  <p className='text-xs text-zinc-400 dark:text-zinc-500 uppercase font-bold tracking-wider mb-1'>
                    Latest Log Message
                  </p>
                  <div className='bg-zinc-50 dark:bg-zinc-900/50 rounded-xl p-3 border border-zinc-100 dark:border-zinc-800 min-h-[64px] flex items-center mb-4'>
                    <p className='text-sm text-zinc-650 dark:text-zinc-300 leading-relaxed italic line-clamp-2'>
                      {latestRun?.current_message ?? 'No worker runs recorded.'}
                    </p>
                  </div>
                </div>

                <div className='flex items-center gap-2 pt-2 border-t border-zinc-100 dark:border-zinc-800/50'>
                  <button
                    onClick={() =>
                      void (workerIsActive ? stopWorker() : startWorker())
                    }
                    className={cn(
                      'flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-sm font-semibold text-white shadow-xs cursor-pointer transition-all active:scale-[0.98]',
                      workerIsActive ?
                        'bg-gradient-to-tr from-red-650 to-rose-700 hover:from-red-700 hover:to-rose-800'
                      : 'bg-gradient-to-tr from-green-600 to-emerald-700 hover:from-green-700 hover:to-emerald-800',
                    )}
                  >
                    {workerIsActive ?
                      <>
                        <Square className='w-3.5 h-3.5 fill-white' /> Stop
                        Worker
                      </>
                    : <>
                        <Play className='w-3.5 h-3.5 fill-white' /> Start Worker
                      </>
                    }
                  </button>
                  <button
                    onClick={loadData}
                    className='p-2 rounded-xl border border-zinc-200 hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-800 text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100 cursor-pointer active:scale-[0.96] transition-all'
                    title='Refresh data'
                  >
                    <RotateCw className='w-4 h-4' />
                  </button>
                </div>
              </div>

              {/* Current Search Target Card */}
              <div className='cols-span-12 md:col-span-7   bg-panel  rounded-card p-card '>
                <div>
                  <H3 className='flex items-center gap-2'>
                    <Search className='w-5 h-5 text-emerald-500' />
                    Search Parameters
                  </H3>

                  <div className='space-y-3'>
                    <div>
                      <p className='text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider'>
                        Target Location
                      </p>
                      <h3 className='text-sm font-semibold text-zinc-800 dark:text-zinc-200 mt-0.5 truncate'>
                        {searchProfile.search_location || 'Not configured'}
                      </h3>
                    </div>
                    <div>
                      <p className='text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider'>
                        Keywords
                      </p>
                      <div className='flex flex-wrap gap-1 mt-1 max-h-[70px] overflow-y-auto pr-1'>
                        {(
                          searchProfile.search_terms &&
                          searchProfile.search_terms.length > 0
                        ) ?
                          searchProfile.search_terms.map((term, i) => (
                            <span
                              key={i}
                              className='text-[10px] px-1.5 py-0.5 rounded-md bg-emerald-50 text-emerald-600 dark:bg-emerald-950/30 dark:text-emerald-400 font-medium border border-emerald-100/50 dark:border-emerald-900/30'
                            >
                              {term}
                            </span>
                          ))
                        : <span className='text-xs text-zinc-400 italic'>
                            No terms added yet
                          </span>
                        }
                      </div>
                    </div>
                  </div>
                </div>

                <div className='pt-4 border-t border-zinc-100 dark:border-zinc-800/50 text-right'>
                  <button
                    onClick={() => setActiveTab('search')}
                    className='inline-flex items-center gap-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:underline cursor-pointer'
                  >
                    Configure search <ChevronRight className='w-3 h-3' />
                  </button>
                </div>

                {/* Bot Settings Rules Card */}

                <div>
                  <H3 className='flex items-center gap-2'>
                    <Settings className='w-5 h-5 text-emerald-500' />
                    Runtime Rules
                  </H3>

                  <div className='grid grid-cols-2 gap-3'>
                    <div className='flex flex-col p-2.5 rounded-xl bg-zinc-50/50 dark:bg-zinc-900/30 border border-zinc-100 dark:border-zinc-800/50'>
                      <span className='text-[9px] font-bold text-zinc-400 dark:text-zinc-500 uppercase'>
                        Safe Mode
                      </span>
                      <span
                        className={cn(
                          'text-xs font-semibold mt-1',
                          runtimeSettings.safe_mode ?
                            'text-green-600 dark:text-green-400'
                          : 'text-zinc-400',
                        )}
                      >
                        {runtimeSettings.safe_mode ? 'Enabled' : 'Disabled'}
                      </span>
                    </div>
                    <div className='flex flex-col p-2.5 rounded-xl bg-zinc-50/50 dark:bg-zinc-900/30 border border-zinc-100 dark:border-zinc-800/50'>
                      <span className='text-[9px] font-bold text-zinc-400 dark:text-zinc-500 uppercase'>
                        Stealth Mode
                      </span>
                      <span
                        className={cn(
                          'text-xs font-semibold mt-1',
                          runtimeSettings.stealth_mode ?
                            'text-green-600 dark:text-green-400'
                          : 'text-zinc-400',
                        )}
                      >
                        {runtimeSettings.stealth_mode ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                    <div className='flex flex-col p-2.5 rounded-xl bg-zinc-50/50 dark:bg-zinc-900/30 border border-zinc-100 dark:border-zinc-800/50'>
                      <span className='text-[9px] font-bold text-zinc-400 dark:text-zinc-500 uppercase'>
                        Click Interval
                      </span>
                      <span className='text-xs font-semibold mt-1 text-zinc-650 dark:text-zinc-350'>
                        ~{runtimeSettings.click_gap} seconds
                      </span>
                    </div>
                    <div className='flex flex-col p-2.5 rounded-xl bg-zinc-50/50 dark:bg-zinc-900/30 border border-zinc-100 dark:border-zinc-800/50'>
                      <span className='text-[9px] font-bold text-zinc-400 dark:text-zinc-500 uppercase'>
                        Visa Required
                      </span>
                      <span className='text-xs font-semibold mt-1 text-zinc-650 dark:text-zinc-350'>
                        {preferences.require_visa || 'No'}
                      </span>
                    </div>
                  </div>
                </div>

                <div className='pt-4 border-t border-zinc-100 dark:border-zinc-800/50 text-right'>
                  <button
                    onClick={() => setActiveTab('search')}
                    className='inline-flex items-center gap-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:underline cursor-pointer'
                  >
                    Adjust settings <ChevronRight className='w-3 h-3' />
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'profile' && (
            <div className='grid grid-cols-1  gap-6'>
              <ProfileForm
                value={profile}
                onChange={setProfile}
                onSave={saveProfile}
              />
              <PreferencesForm
                value={preferences}
                onChange={setPreferences}
                onSave={savePreferences}
              />
            </div>
          )}

          {activeTab === 'search' && (
            <div className='grid grid-cols-1 md:grid-cols-2 gap-6'>
              <SearchForm
                value={searchProfile}
                onChange={setSearchProfile}
                onSave={saveSearch}
              />
              <RuntimeForm
                value={runtimeSettings}
                onChange={setRuntimeSettings}
                onSave={saveRuntime}
              />
            </div>
          )}

          {activeTab === 'questions' && (
            <div className='bg-panel  rounded-2xl p-6 shadow-xs'>
              <h2 className='text-lg font-bold text-zinc-900 dark:text-zinc-50 mb-4 flex items-center gap-2'>
                <MessageSquareCode className='w-5 h-5 text-emerald-500' />
                Question Cache
              </h2>
              {questions.length === 0 ?
                <div className='p-8 text-center text-zinc-500 dark:text-zinc-400'>
                  No saved answers yet.
                </div>
              : <div className='overflow-x-auto'>
                  <table className='w-full text-left border-collapse text-sm'>
                    <thead>
                      <tr className='border-b border-zinc-100 dark:border-zinc-800 text-[11px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider'>
                        <th className='pb-3 pr-4'>Question</th>
                        <th className='pb-3 px-4'>Type</th>
                        <th className='pb-3 px-4'>Answer</th>
                        <th className='pb-3 px-4'>Used</th>
                        <th className='pb-3 pl-4'></th>
                      </tr>
                    </thead>
                    <tbody className='divide-y divide-zinc-100 dark:divide-zinc-800/50'>
                      {questions.map((entry) => (
                        <tr
                          key={entry.id}
                          className='text-zinc-700 dark:text-zinc-300'
                        >
                          <td className='py-4 pr-4'>
                            <strong className='text-zinc-900 dark:text-zinc-100 block'>
                              {entry.original_label}
                            </strong>
                            <p className='text-xs text-zinc-400 dark:text-zinc-500 mt-0.5'>
                              {entry.companies?.slice(0, 3).join(', ')}
                            </p>
                          </td>
                          <td className='py-4 px-4 whitespace-nowrap text-xs text-zinc-500 font-mono'>
                            {entry.field_type}
                          </td>
                          <td className='py-4 px-4 min-w-[200px]'>
                            <input
                              defaultValue={entry.answer ?? ''}
                              className='w-full text-sm rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-1.5 focus:bg-panel focus:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-900/60 dark:focus:bg-zinc-900 dark:focus:border-zinc-700 focus:outline-none transition-all'
                              onBlur={(event) => {
                                if (
                                  event.target.value !== (entry.answer ?? '')
                                ) {
                                  void saveQuestion(entry, event.target.value);
                                }
                              }}
                            />
                          </td>
                          <td className='py-4 px-4 whitespace-nowrap text-zinc-500'>
                            {entry.times_used}
                          </td>
                          <td className='py-4 pl-4 text-right'>
                            <button
                              className='px-2.5 py-1.5 rounded-lg text-xs font-semibold text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/20 transition-all cursor-pointer'
                              onClick={() => void deleteQuestion(entry.id)}
                            >
                              Delete
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              }
            </div>
          )}

          {activeTab === 'applications' && (
            <div className='bg-panel  rounded-2xl p-6 shadow-xs'>
              <h2 className='text-lg font-bold text-zinc-900 dark:text-zinc-50 mb-4 flex items-center gap-2'>
                <Briefcase className='w-5 h-5 text-emerald-500' />
                Application History
              </h2>

              {/* Toolbar */}
              <div className='flex flex-wrap gap-4 items-center justify-between bg-zinc-50 dark:bg-zinc-900/40 p-4 rounded-xl border border-zinc-100 dark:border-zinc-800/60 mb-6'>
                <div className='flex flex-wrap gap-3 flex-1'>
                  <div className='relative flex-1 min-w-[200px] max-w-md'>
                    <Search className='absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400' />
                    <input
                      placeholder='Search title, company, job id...'
                      value={searchText}
                      onChange={(event) => setSearchText(event.target.value)}
                      className='pl-9 pr-4 py-2 w-full text-sm rounded-xl border border-zinc-200 bg-panel dark:bg-zinc-950 dark:border-zinc-800 focus:outline-none focus:border-zinc-400 dark:focus:border-zinc-750 focus:ring-1 focus:ring-zinc-400 dark:focus:ring-zinc-750 transition-all text-zinc-900 dark:text-zinc-100'
                    />
                  </div>
                  <select
                    value={statusFilter}
                    onChange={(event) => setStatusFilter(event.target.value)}
                    className='px-3 py-2 text-sm rounded-xl border border-zinc-200 bg-panel dark:bg-zinc-950 dark:border-zinc-800 focus:outline-none focus:border-zinc-400 dark:focus:border-zinc-750 transition-all text-zinc-900 dark:text-zinc-100 cursor-pointer'
                  >
                    <option value=''>All statuses</option>
                    <option value='submitted'>Submitted</option>
                    <option value='skipped'>Skipped</option>
                    <option value='cancelled'>Cancelled</option>
                  </select>
                </div>
                <button
                  className='inline-flex items-center gap-2 rounded-xl border border-zinc-200 hover:bg-zinc-50 text-zinc-900 px-4 py-2 text-sm font-semibold dark:border-zinc-800 dark:text-zinc-100 dark:hover:bg-zinc-900 transition-all active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none cursor-pointer'
                  onClick={() => void batchAsyncApplications()}
                  disabled={batchSyncing}
                >
                  <RefreshCw
                    className={cn('w-4 h-4', batchSyncing && 'animate-spin')}
                  />
                  {batchSyncing ? 'Syncing...' : 'Sync Missing Details'}
                </button>
              </div>

              {filteredApplications.length === 0 ?
                <div className='p-8 text-center text-zinc-500 dark:text-zinc-400'>
                  No applications match this view.
                </div>
              : <div className='overflow-x-auto'>
                  <table className='w-full text-left border-collapse text-sm'>
                    <thead>
                      <tr className='border-b border-zinc-100 dark:border-zinc-800 text-[11px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider'>
                        <th className='pb-3 pr-4'>Role</th>
                        <th className='pb-3 px-4'>Company</th>
                        <th className='pb-3 px-4'>Status</th>
                        <th className='pb-3 px-4'>Applied</th>
                        <th className='pb-3 pl-4 text-right'>Actions</th>
                      </tr>
                    </thead>
                    <tbody className='divide-y divide-zinc-100 dark:divide-zinc-800/50'>
                      {filteredApplications.slice(0, 120).map((item) => (
                        <Fragment key={item.id}>
                          <tr className='text-zinc-700 dark:text-zinc-300'>
                            <td className='py-4 pr-4'>
                              <strong className='text-zinc-900 dark:text-zinc-100 block'>
                                {item.title || 'Untitled role'}
                              </strong>
                              <div className='flex items-center gap-2 mt-1'>
                                <span className='text-[10px] px-1.5 py-0.5 rounded-md bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400 font-mono'>
                                  ID: {item.job_id}
                                </span>
                                <span className='text-xs text-zinc-400 dark:text-zinc-500'>
                                  {[item.work_location, item.work_style]
                                    .filter(Boolean)
                                    .join(' · ') || 'Location not recorded'}
                                </span>
                              </div>
                            </td>
                            <td className='py-4 px-4 font-semibold text-zinc-800 dark:text-zinc-200'>
                              {item.company || 'Unknown'}
                            </td>
                            <td className='py-4 px-4'>
                              <span
                                className={cn(
                                  'inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider',
                                  item.status === 'submitted' ?
                                    'bg-green-500/10 text-green-600 dark:bg-green-900/20 dark:text-green-400'
                                  : item.status === 'skipped' ?
                                    'bg-amber-500/10 text-amber-600 dark:bg-amber-900/20 dark:text-amber-400'
                                  : 'bg-zinc-500/10 text-zinc-600 dark:bg-zinc-800/20 dark:text-zinc-400',
                                )}
                              >
                                {item.status}
                              </span>
                              {item.skip_reason && (
                                <p
                                  className='text-[10px] text-zinc-400 dark:text-zinc-500 mt-1 italic max-w-[180px] truncate'
                                  title={item.skip_reason}
                                >
                                  {item.skip_reason}
                                </p>
                              )}
                            </td>
                            <td className='py-4 px-4 text-xs text-zinc-400 dark:text-zinc-500 whitespace-nowrap'>
                              {formatDate(item.date_applied)}
                            </td>
                            <td className='py-4 pl-4 text-right'>
                              <div className='inline-flex gap-1.5'>
                                {item.job_link && (
                                  <IconButton
                                    label='Open link'
                                    icon='open'
                                    onClick={() =>
                                      window.open(
                                        item.job_link ?? '',
                                        '_blank',
                                        'noopener,noreferrer',
                                      )
                                    }
                                  />
                                )}
                                <IconButton
                                  label='Async from link'
                                  icon='async'
                                  onClick={() => void asyncApplication(item.id)}
                                  disabled={
                                    !item.job_link ||
                                    syncingApplicationId === item.id
                                  }
                                />
                                <IconButton
                                  label='Edit application'
                                  icon='edit'
                                  onClick={() =>
                                    setExpandedApplicationId((current) =>
                                      current === item.id ? '' : item.id,
                                    )
                                  }
                                />
                                <IconButton
                                  label='Delete application'
                                  icon='delete'
                                  onClick={() =>
                                    void deleteApplication(item.id)
                                  }
                                  danger
                                />
                              </div>
                            </td>
                          </tr>
                          {expandedApplicationId === item.id && (
                            <tr className='bg-zinc-50/50 dark:bg-zinc-900/20'>
                              <td colSpan={5} className='p-0 border-t-0'>
                                <div className='p-6 border-t border-zinc-100 dark:border-zinc-800'>
                                  <ApplicationDetails
                                    application={item}
                                    onSave={saveApplicationPatch}
                                  />
                                </div>
                              </td>
                            </tr>
                          )}
                        </Fragment>
                      ))}
                    </tbody>
                  </table>
                </div>
              }
            </div>
          )}
        </div>
      </main>

      {/* Floating Launch Button */}
      <div className='fixed bottom-6 right-6 z-40'>
        <button
          className={cn(
            'relative group flex flex-col items-start gap-0.5 rounded-2xl px-6 py-4 shadow-lg border text-white transition-all duration-300 hover:scale-[1.03] active:scale-[0.98] cursor-pointer',
            workerIsActive ?
              'bg-gradient-to-tr from-red-600 to-rose-700 border-red-500/20'
            : 'bg-gradient-to-tr from-green-600 to-emerald-700 border-green-500/20 disabled:opacity-50 disabled:pointer-events-none',
          )}
          onClick={() => void (workerIsActive ? stopWorker() : startWorker())}
          disabled={!workerIsActive && !user?.can_use_auto_apply}
        >
          {/* Pulsing glow ring when active */}
          {!workerIsActive && user?.can_use_auto_apply && (
            <span className='absolute inset-0 rounded-2xl bg-green-500/20 animate-pulse pointer-events-none z-0'></span>
          )}
          {workerIsActive && (
            <span className='absolute inset-0 rounded-2xl bg-red-500/20 animate-pulse pointer-events-none z-0'></span>
          )}

          <span className='text-[10px] uppercase font-bold tracking-wider opacity-80 z-10'>
            {latestRun?.status === 'pending' ?
              'Waiting for host agent'
            : workerIsActive ?
              latestRun?.status
            : 'Ready on this machine'}
          </span>
          <strong className='text-sm font-extrabold tracking-tight z-10 flex items-center gap-1.5'>
            {workerIsActive ?
              <Square className='w-3.5 h-3.5 fill-white' />
            : <Play className='w-3.5 h-3.5 fill-white' />}
            {workerIsActive ? 'Stop Auto Apply' : 'Start Auto Apply'}
          </strong>
        </button>
      </div>

      {toast && (
        <div className='fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-zinc-900 text-white dark:bg-panel dark:text-zinc-950 px-4 py-3 rounded-xl shadow-md border border-zinc-800 dark:border-zinc-200 text-xs font-semibold animate-in fade-in slide-in-from-bottom-2 duration-300'>
          {toast}
        </div>
      )}
    </div>
  );
}

export default UserConsole;
