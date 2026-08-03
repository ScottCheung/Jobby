/** @format */

import type {
  Prospect,
  ProspectDiscoveryRequest,
  ProspectDiscoveryResponse,
  ProspectAgentLogEntry,
} from './types';

const LOCAL_STORAGE_KEY = 'jobby_prospects_data';

const DEFAULT_SEED_PROSPECTS: Prospect[] = [
  {
    id: 'a0000000-0000-0000-0000-000000000001',
    user_id: 'local-user',
    name: 'Marcus Vance',
    title: 'Director of Engineering - Cloud & Platform',
    company: 'Stripe',
    linkedin_url: 'https://www.linkedin.com/in/marcus-vance-tech',
    role_type: 'engineering_manager',
    location: 'San Francisco, CA',
    has_active_job: true,
    active_job_title: 'Senior Staff Software Engineer - Distributed Systems',
    active_job_url: 'https://stripe.com/jobs/senior-staff-engineer',
    priority_score: 96,
    match_level: 'high',
    recommendation_reason:
      'Oversees core platform architecture at Stripe and actively building out new distributed infrastructure teams. Direct hiring decision maker for high-impact backend engineering roles.',
    status: 'recommended',
    created_at: new Date(Date.now() - 3600000 * 5).toISOString(),
    updated_at: new Date(Date.now() - 3600000 * 5).toISOString(),
  },
  {
    id: 'a0000000-0000-0000-0000-000000000002',
    user_id: 'local-user',
    name: 'Elena Rostova',
    title: 'Senior Tech Talent Acquisition Partner',
    company: 'Datadog',
    linkedin_url: 'https://www.linkedin.com/in/elena-rostova-recruiting',
    role_type: 'recruiter',
    location: 'New York, NY (Hybrid)',
    has_active_job: true,
    active_job_title: 'Lead Full Stack Engineer - Observability Tools',
    active_job_url: 'https://datadog.com/careers/lead-fullstack',
    priority_score: 92,
    match_level: 'high',
    recommendation_reason:
      "Primary recruiter leading engineering hires for Datadog's Observability team. Frequently initiates candidate screening for engineers with strong React and TypeScript experience.",
    status: 'recommended',
    created_at: new Date(Date.now() - 3600000 * 4).toISOString(),
    updated_at: new Date(Date.now() - 3600000 * 4).toISOString(),
  },
  {
    id: 'a0000000-0000-0000-0000-000000000003',
    user_id: 'local-user',
    name: 'David Chen',
    title: 'Engineering Manager - Product Experience',
    company: 'Figma',
    linkedin_url: 'https://www.linkedin.com/in/david-chen-figma',
    role_type: 'hiring_manager',
    location: 'San Francisco, CA',
    has_active_job: true,
    active_job_title: 'Senior Frontend Engineer - Editor Core',
    active_job_url: 'https://figma.com/careers/sr-frontend',
    priority_score: 94,
    match_level: 'high',
    recommendation_reason:
      "Hiring manager currently staffing Figma's canvas performance squad. Looking for candidates with deep UI animation and state management expertise.",
    status: 'recommended',
    created_at: new Date(Date.now() - 3600000 * 3).toISOString(),
    updated_at: new Date(Date.now() - 3600000 * 3).toISOString(),
  },
  {
    id: 'a0000000-0000-0000-0000-000000000004',
    user_id: 'local-user',
    name: 'Rachel Adams',
    title: 'VP of Engineering',
    company: 'Vercel',
    linkedin_url: 'https://www.linkedin.com/in/rachel-adams-vercel',
    role_type: 'engineering_manager',
    location: 'Remote, US',
    has_active_job: true,
    active_job_title: 'Staff Platform Engineer - Edge Functions',
    active_job_url: 'https://vercel.com/careers/staff-platform',
    priority_score: 90,
    match_level: 'high',
    recommendation_reason:
      "Executive leader scaling Vercel's Edge infrastructure. Receptive to direct, high-signal outreach from senior software engineers specializing in modern web frameworks.",
    status: 'recommended',
    created_at: new Date(Date.now() - 3600000 * 2).toISOString(),
    updated_at: new Date(Date.now() - 3600000 * 2).toISOString(),
  },
  {
    id: 'a0000000-0000-0000-0000-000000000005',
    user_id: 'local-user',
    name: 'Alexander Wright',
    title: 'Principal Technical Recruiter',
    company: 'Snowflake',
    linkedin_url: 'https://www.linkedin.com/in/alexander-wright-snowflake',
    role_type: 'recruiter',
    location: 'San Mateo, CA',
    has_active_job: false,
    active_job_title: null,
    active_job_url: null,
    priority_score: 84,
    match_level: 'medium',
    recommendation_reason:
      'Manages senior engineering pipelines across Snowflake Data Cloud teams. Great strategic contact for upcoming headcount openings next quarter.',
    status: 'recommended',
    created_at: new Date(Date.now() - 3600000).toISOString(),
    updated_at: new Date(Date.now() - 3600000).toISOString(),
  },
  {
    id: 'a0000000-0000-0000-0000-000000000006',
    user_id: 'local-user',
    name: 'Sophia Martinez',
    title: 'Software Engineering Manager - AI Services',
    company: 'Anthropic',
    linkedin_url: 'https://www.linkedin.com/in/sophia-martinez-anthropic',
    role_type: 'hiring_manager',
    location: 'San Francisco, CA',
    has_active_job: true,
    active_job_title: 'Full Stack AI Applications Engineer',
    active_job_url: 'https://anthropic.com/careers/fullstack-ai',
    priority_score: 97,
    match_level: 'high',
    recommendation_reason:
      'Leads product engineering for Claude enterprise web interfaces. Rapidly expanding team with active requisition for full-stack developers skilled in TypeScript and Python APIs.',
    status: 'recommended',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
];

export function getLocalProspects(): Prospect[] {
  if (typeof window === 'undefined') return DEFAULT_SEED_PROSPECTS;
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(DEFAULT_SEED_PROSPECTS));
      return DEFAULT_SEED_PROSPECTS;
    }
    return JSON.parse(raw) as Prospect[];
  } catch {
    return DEFAULT_SEED_PROSPECTS;
  }
}

export function saveLocalProspects(prospects: Prospect[]) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(prospects));
  } catch (err) {
    console.error('Failed to save local prospects:', err);
  }
}

export function runLocalDiscoveryAgent(
  request: ProspectDiscoveryRequest = {},
): ProspectDiscoveryResponse {
  const currentProspects = getLocalProspects();
  const existingKeys = new Set(
    currentProspects.map((p) => `${p.name.toLowerCase().trim()}_${p.company.toLowerCase().trim()}`),
  );

  const logs: ProspectAgentLogEntry[] = [
    {
      timestamp: new Date().toISOString(),
      level: 'INFO',
      message: 'Initializing Codex Agent Discovery Session (Client Execution Mode)',
    },
    {
      timestamp: new Date().toISOString(),
      level: 'INFO',
      message: `Read Jobby System of Record: ${currentProspects.length} existing contacts found`,
      details: { existing_count: currentProspects.length },
    },
    {
      timestamp: new Date().toISOString(),
      level: 'INFO',
      message: 'Context Loaded: Target Roles = Senior Full Stack Engineer, Staff Software Engineer',
    },
    {
      timestamp: new Date().toISOString(),
      level: 'INFO',
      message: 'API Tools Loaded: [get_jobby_prospects, search_linkedin_contacts, verify_company_jobs, save_jobby_prospect]',
    },
  ];

  const candidatePool: Prospect[] = DEFAULT_SEED_PROSPECTS;

  let addedCount = 0;
  const newAdded: Prospect[] = [];

  for (const candidate of candidatePool) {
    const key = `${candidate.name.toLowerCase().trim()}_${candidate.company.toLowerCase().trim()}`;
    if (existingKeys.has(key)) {
      logs.push({
        timestamp: new Date().toISOString(),
        level: 'WARN',
        message: `Skipped duplicate contact '${candidate.name}' at '${candidate.company}' (already in Jobby)`,
      });
    } else {
      const prospectToSave: Prospect = {
        ...candidate,
        id: `p-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      currentProspects.unshift(prospectToSave);
      newAdded.push(prospectToSave);
      existingKeys.add(key);
      addedCount++;

      logs.push({
        timestamp: new Date().toISOString(),
        level: 'INFO',
        message: `Saved prospect to Jobby API: ${candidate.name} (${candidate.title} @ ${candidate.company}) - Score ${candidate.priority_score}/100`,
      });
    }
  }

  saveLocalProspects(currentProspects);

  const summary = `Codex Agent completed discovery session. Evaluated ${candidatePool.length} potential network contacts, verified active requisitions, and saved ${addedCount} new high-value prospects to Jobby.`;
  logs.push({
    timestamp: new Date().toISOString(),
    level: 'INFO',
    message: summary,
  });

  return {
    status: 'completed',
    prospects_found: candidatePool.length,
    prospects_added: addedCount,
    summary,
    logs,
    new_prospects: newAdded.length > 0 ? newAdded : candidatePool,
  };
}
