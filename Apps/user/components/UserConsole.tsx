/** @format */

'use client';

import { Fragment, useEffect, useMemo, useState, useTransition } from 'react';
import { api } from '@/lib/api';
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
        'p-2 rounded-xl transition-all border border-zinc-200/60 dark:border-zinc-805/60 bg-white hover:bg-zinc-50 text-zinc-500 hover:text-zinc-900 dark:bg-[#181C26] dark:hover:bg-zinc-800/40 dark:text-zinc-400 dark:hover:text-zinc-100 flex items-center justify-center shrink-0 disabled:opacity-40 disabled:pointer-events-none active:scale-[0.96] shadow-xs cursor-pointer',
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
          api.applications(statusFilter || undefined),
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
  }, [statusFilter]);

  const filteredApplications = useMemo(() => {
    const query = searchText.trim().toLowerCase();
    if (!query) return applications;
    return applications.filter((item) =>
      [item.title, item.company, item.job_id, item.status].some((value) =>
        String(value ?? '')
          .toLowerCase()
          .includes(query),
      ),
    );
  }, [applications, searchText]);

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
      { label: 'Applications', value: applications.length },
      { label: 'Submitted', value: submitted },
      { label: 'Interviewing', value: interviewing },
      { label: 'Skipped', value: skipped },
    ];
  }, [applications, questions]);

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
          'h-screen sticky top-0 flex flex-col justify-between bg-white dark:bg-[#181C26] border-r border-zinc-200/50 dark:border-zinc-800/50 p-4 transition-all duration-300 ease-in-out z-20 shrink-0',
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
            className='absolute -right-12 top-1/2 w-12 h-12 rounded-full border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#181C26] flex items-center justify-center text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 shadow-sm z-30 transition-transform hover:scale-105 cursor-pointer'
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
                    'bg-zinc-900 text-white dark:bg-white dark:text-zinc-955 shadow-xs font-semibold'
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
                        'bg-white/10 text-white dark:bg-zinc-900/10 dark:text-zinc-950'
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
                    'bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white shadow-xs',
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
                    'bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white shadow-xs',
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
                    'bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white shadow-xs',
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
      <main className='flex-1 min-w-0 p-8 overflow-y-auto'>
        <div className='max-w-[1200px] mx-auto space-y-8'>
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
          <div className='grid grid-cols-2 md:grid-cols-4 gap-4'>
            {stats.map((item) => (
              <div
                className='bg-white dark:bg-[#181C26] border border-zinc-200/60 dark:border-zinc-800/60 rounded-2xl p-5 shadow-xs flex flex-col justify-between transition-all duration-300 hover:-translate-y-0.5 hover:shadow-sm'
                key={item.label}
              >
                <strong className='text-3xl font-extrabold text-zinc-900 dark:text-zinc-50 tracking-tight'>
                  {item.value}
                </strong>
                <span className='text-xs font-semibold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider mt-2 block'>
                  {item.label}
                </span>
              </div>
            ))}
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
            <div className='grid grid-cols-1 md:grid-cols-2 gap-6'>
              {/* Current Search Panel */}
              <div className='bg-white dark:bg-[#181C26] border border-zinc-200/60 dark:border-zinc-800/60 rounded-2xl p-6 shadow-xs flex flex-col justify-between'>
                <div>
                  <h2 className='text-lg font-bold text-zinc-900 dark:text-zinc-50 mb-4 flex items-center gap-2'>
                    <Search className='w-5 h-5 text-emerald-500' />
                    Current Search
                  </h2>
                  <div className='space-y-4'>
                    <div>
                      <p className='text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider'>
                        Location
                      </p>
                      <h3 className='text-base font-semibold text-zinc-800 dark:text-zinc-200 mt-1'>
                        {searchProfile.search_location || 'Not set'}
                      </h3>
                    </div>
                    <div>
                      <p className='text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider'>
                        Search terms
                      </p>
                      <p className='text-sm text-zinc-600 dark:text-zinc-400 mt-1 leading-relaxed'>
                        {searchProfile.search_terms.join(', ') ||
                          'No terms yet'}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Worker Status Panel */}
              <div className='bg-white dark:bg-[#181C26] border border-zinc-200/60 dark:border-zinc-800/60 rounded-2xl p-6 shadow-xs flex flex-col justify-between'>
                <div>
                  <h2 className='text-lg font-bold text-zinc-900 dark:text-zinc-50 mb-4 flex items-center gap-2'>
                    <Bot className='w-5 h-5 text-emerald-500' />
                    Worker Status
                  </h2>
                  <div className='space-y-4'>
                    <div>
                      <p className='text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider mb-2'>
                        State
                      </p>
                      <span
                        className={cn(
                          'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wider',
                          (latestRun?.status ?? 'idle') === 'failed' ?
                            'bg-red-500/10 text-red-600 dark:bg-red-900/20 dark:text-red-400'
                          : (latestRun?.status ?? 'idle') === 'pending' ?
                            'bg-amber-500/10 text-amber-600 dark:bg-amber-900/20 dark:text-amber-400'
                          : 'bg-green-500/10 text-green-600 dark:bg-green-900/20 dark:text-green-400',
                        )}
                      >
                        {latestRun?.status ?? 'idle'}
                      </span>
                    </div>
                    <div>
                      <p className='text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider'>
                        Activity Log
                      </p>
                      <p className='text-sm text-zinc-600 dark:text-zinc-400 mt-1 leading-relaxed italic'>
                        {latestRun?.current_message ??
                          'No worker run has been started from this console yet.'}
                      </p>
                    </div>
                  </div>
                </div>
                <div className='flex justify-end mt-6'>
                  <button
                    className='inline-flex items-center gap-2 rounded-xl border border-zinc-200 hover:bg-zinc-50 text-zinc-900 px-4 py-2 text-sm font-semibold dark:border-zinc-800 dark:text-zinc-100 dark:hover:bg-zinc-900 transition-all active:scale-[0.98] cursor-pointer shadow-xs'
                    onClick={loadData}
                  >
                    <RotateCw className='w-4 h-4' />
                    Refresh
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'profile' && (
            <div className='grid grid-cols-1 md:grid-cols-2 gap-6'>
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
            <div className='bg-white dark:bg-[#181C26] border border-zinc-200/60 dark:border-zinc-800/60 rounded-2xl p-6 shadow-xs'>
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
                              className='w-full text-sm rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-1.5 focus:bg-white focus:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-900/60 dark:focus:bg-zinc-900 dark:focus:border-zinc-700 focus:outline-none transition-all'
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
            <div className='bg-white dark:bg-[#181C26] border border-zinc-200/60 dark:border-zinc-800/60 rounded-2xl p-6 shadow-xs'>
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
                      className='pl-9 pr-4 py-2 w-full text-sm rounded-xl border border-zinc-200 bg-white dark:bg-zinc-950 dark:border-zinc-800 focus:outline-none focus:border-zinc-400 dark:focus:border-zinc-750 focus:ring-1 focus:ring-zinc-400 dark:focus:ring-zinc-750 transition-all text-zinc-900 dark:text-zinc-100'
                    />
                  </div>
                  <select
                    value={statusFilter}
                    onChange={(event) => setStatusFilter(event.target.value)}
                    className='px-3 py-2 text-sm rounded-xl border border-zinc-200 bg-white dark:bg-zinc-950 dark:border-zinc-800 focus:outline-none focus:border-zinc-400 dark:focus:border-zinc-750 transition-all text-zinc-900 dark:text-zinc-100 cursor-pointer'
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
        <div className='fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-zinc-900 text-white dark:bg-white dark:text-zinc-950 px-4 py-3 rounded-xl shadow-md border border-zinc-800 dark:border-zinc-200 text-xs font-semibold animate-in fade-in slide-in-from-bottom-2 duration-300'>
          {toast}
        </div>
      )}
    </div>
  );
}

export default UserConsole;
