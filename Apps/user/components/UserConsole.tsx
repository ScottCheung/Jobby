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

type Tab = 'overview' | 'profile' | 'search' | 'questions' | 'applications';

const tabs: Array<{ id: Tab; label: string; hint: string }> = [
  { id: 'overview', label: 'Overview', hint: 'pulse' },
  { id: 'profile', label: 'Profile', hint: 'identity' },
  { id: 'search', label: 'Search', hint: 'targets' },
  { id: 'questions', label: 'Question Cache', hint: 'answers' },
  { id: 'applications', label: 'Applications', hint: 'history' },
];

const emptyProfile: UserProfile = { extra_data: {} };
const emptyPreferences: JobPreferences = { extra_data: {} };
const emptySearch: SearchProfile = {
  name: 'Default LinkedIn Search',
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
  click_gap: 2,
  pause_before_submit: true,
  pause_at_failed_question: true,
  overwrite_previous_answers: false,
  learn_from_manual_answers: true,
  question_similarity_threshold: '0.85',
  settings: {},
};

function statusClass(status: string) {
  const normalized = status.toLowerCase();
  if (
    normalized.includes('fail') ||
    normalized.includes('skip') ||
    normalized.includes('cancel')
  )
    return 'badge failed';
  if (normalized.includes('pending') || normalized.includes('request'))
    return 'badge pending';
  return 'badge';
}

function formatDate(value?: string | null) {
  if (!value) return 'Not recorded';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

function getLinkAsyncWarning(application: JobApplication) {
  const warning = application.raw_data?.link_async_warning;
  return typeof warning === 'string' && warning.trim() ? warning : '';
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
  const paths = {
    async:
      'M4 12a8 8 0 0 1 13.66-5.66M20 12A8 8 0 0 1 6.34 17.66M18 4v4h-4M6 20v-4h4',
    edit: 'M4 20h4l10.5-10.5a2.8 2.8 0 0 0-4-4L4 16v4M13.5 6.5l4 4',
    delete: 'M5 7h14M9 7V5h6v2M8 7l1 13h6l1-13',
    open: 'M7 7h10v10M17 7 7 17M6 6h5M6 6v5',
  };
  return (
    <button
      className={`icon-button ${danger ? 'danger-icon' : ''}`}
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
    >
      <svg viewBox='0 0 24 24' aria-hidden='true'>
        <path d={paths[icon]} />
      </svg>
    </button>
  );
}

export default function UserConsole() {
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

  const workerIsActive =
    latestRun?.status === 'running' ||
    latestRun?.status === 'pending' ||
    latestRun?.status === 'cancel_requested';

  return (
    <main className='shell'>
      <div className='console'>
        <aside className='sidebar'>
          <div className='brand-mark'>AJ</div>
          <p className='eyebrow'>User Console</p>
          <h1 className='title'>Job control room</h1>
          <p className='subtitle'>
            A calm place to manage the data your local auto-apply worker uses.
          </p>

          <nav className='nav'>
            {tabs.map((tab) => (
              <button
                key={tab.id}
                className={`nav-button ${activeTab === tab.id ? 'active' : ''}`}
                onClick={() => setActiveTab(tab.id)}
              >
                <span>{tab.label}</span>
                <span>{tab.hint}</span>
              </button>
            ))}
          </nav>

          <div className='role-card'>
            <strong>{user?.display_name ?? 'Local user'}</strong>
            <p>
              Role: {user?.role ?? 'loading'} · Auto apply{' '}
              {user?.can_use_auto_apply ? 'enabled' : 'disabled'}
            </p>
          </div>
        </aside>

        <section className='main'>
          <header className='hero'>
            <p className='eyebrow'>PostgreSQL backed workspace</p>
            <h1>Manage once. Let the local worker apply with clean data.</h1>
            <p>
              This console reads and writes through the API layer, so profile
              changes, saved answers, and application history now live in
              PostgreSQL instead of scattered files.
            </p>
          </header>

          <div className='stats'>
            {stats.map((item) => (
              <div className='stat' key={item.label}>
                <strong>{item.value}</strong>
                <span>{item.label}</span>
              </div>
            ))}
          </div>

          {error && (
            <div className='empty'>API is not reachable yet: {error}</div>
          )}
          {isPending && <div className='empty'>Refreshing data...</div>}

          {activeTab === 'overview' && (
            <div className='grid two'>
              <section className='panel'>
                <h2>Current Search</h2>
                <p className='muted'>Location</p>
                <h3>{searchProfile.search_location || 'Not set'}</h3>
                <p className='muted'>Search terms</p>
                <p>{searchProfile.search_terms.join(', ') || 'No terms yet'}</p>
              </section>
              <section className='panel'>
                <h2>Worker Data Source</h2>
                <p className='muted'>
                  The local worker now loads config through the API before
                  running.
                </p>
                <p>
                  <span className={statusClass(latestRun?.status ?? 'idle')}>
                    {latestRun?.status ?? 'idle'}
                  </span>
                </p>
                <p className='muted'>
                  {latestRun?.current_message ??
                    'No worker run has been started from this console yet.'}
                </p>
                <div className='actions'>
                  <button className='ghost' onClick={loadData}>
                    Refresh
                  </button>
                </div>
              </section>
            </div>
          )}

          {activeTab === 'profile' && (
            <div className='grid'>
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
            <div className='grid'>
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
            <section className='panel'>
              <h2>Question Cache</h2>
              {questions.length === 0 ?
                <div className='empty'>No saved answers yet.</div>
              : <table className='table'>
                  <thead>
                    <tr>
                      <th>Question</th>
                      <th>Type</th>
                      <th>Answer</th>
                      <th>Used</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {questions.map((entry) => (
                      <tr key={entry.id}>
                        <td>
                          <strong>{entry.original_label}</strong>
                          <p className='muted'>
                            {entry.companies?.slice(0, 3).join(', ')}
                          </p>
                        </td>
                        <td>{entry.field_type}</td>
                        <td>
                          <input
                            defaultValue={entry.answer ?? ''}
                            onBlur={(event) => {
                              if (event.target.value !== (entry.answer ?? '')) {
                                void saveQuestion(entry, event.target.value);
                              }
                            }}
                          />
                        </td>
                        <td>{entry.times_used}</td>
                        <td>
                          <button
                            className='danger'
                            onClick={() => void deleteQuestion(entry.id)}
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              }
            </section>
          )}

          {activeTab === 'applications' && (
            <section className='panel'>
              <h2>Application History</h2>
              <div className='toolbar'>
                <input
                  placeholder='Search title, company, job id...'
                  value={searchText}
                  onChange={(event) => setSearchText(event.target.value)}
                />
                <select
                  value={statusFilter}
                  onChange={(event) => setStatusFilter(event.target.value)}
                >
                  <option value=''>All statuses</option>
                  <option value='submitted'>Submitted</option>
                  <option value='skipped'>Skipped</option>
                  <option value='cancelled'>Cancelled</option>
                </select>
                <button
                  className='ghost toolbar-action'
                  onClick={() => void batchAsyncApplications()}
                  disabled={batchSyncing}
                >
                  {batchSyncing ? 'Async...' : 'Async missing'}
                </button>
              </div>
              {filteredApplications.length === 0 ?
                <div className='empty'>No applications match this view.</div>
              : <table className='table applications-table'>
                  <thead>
                    <tr>
                      <th>Role</th>
                      <th>Company</th>
                      <th>Status</th>
                      <th>Applied</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredApplications.slice(0, 120).map((item) => (
                      <Fragment key={item.id}>
                        <tr>
                          <td>
                            <strong>{item.title || 'Untitled role'}</strong>
                            <p className='muted'>{item.job_id}</p>
                            <p className='muted'>
                              {[item.work_location, item.work_style]
                                .filter(Boolean)
                                .join(' · ') || 'Location not recorded'}
                            </p>
                          </td>
                          <td>{item.company || 'Unknown'}</td>
                          <td>
                            <span className={statusClass(item.status)}>
                              {item.status}
                            </span>
                            {item.skip_reason && (
                              <p className='muted'>{item.skip_reason}</p>
                            )}
                          </td>
                          <td>{formatDate(item.date_applied)}</td>
                          <td>
                            <div className='row-actions compact-actions'>
                              {item.job_link && (
                                <IconButton
                                  label='Open link'
                                  icon='open'
                                  onClick={() => window.open(item.job_link ?? '', '_blank', 'noopener,noreferrer')}
                                />
                              )}
                              <IconButton
                                label='Async from link'
                                icon='async'
                                onClick={() => void asyncApplication(item.id)}
                                disabled={!item.job_link || syncingApplicationId === item.id}
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
                                onClick={() => void deleteApplication(item.id)}
                                danger
                              />
                            </div>
                          </td>
                        </tr>
                        {expandedApplicationId === item.id && (
                          <tr className='details-row'>
                            <td colSpan={5}>
                              <ApplicationDetails
                                application={item}
                                onSave={saveApplicationPatch}
                              />
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    ))}
                  </tbody>
                </table>
              }
            </section>
          )}
        </section>
      </div>
      <button
        className={`launch-worker ${workerIsActive ? 'stop' : ''}`}
        onClick={() => void (workerIsActive ? stopWorker() : startWorker())}
        disabled={!workerIsActive && !user?.can_use_auto_apply}
      >
        <span>
          {latestRun?.status === 'pending' ?
            'Waiting for host agent'
          : workerIsActive ?
            latestRun?.status
          : 'Ready on this machine'}
        </span>
        <strong>
          {workerIsActive ? 'Stop Auto Apply' : 'Start Auto Apply'}
        </strong>
      </button>
      {toast && <div className='toast'>{toast}</div>}
    </main>
  );
}
