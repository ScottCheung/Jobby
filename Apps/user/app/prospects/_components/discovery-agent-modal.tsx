/** @format */

'use client';

import React, { useEffect, useState, useCallback } from 'react';
import {
  Sparkles,
  CheckCircle2,
  AlertCircle,
  X,
  Copy,
  Check,
  Users,
  Save,
  Briefcase,
  UserCheck,
  Zap,
  FileText,
  Sliders,
  User,
  MapPin,
  Code2,
  Navigation,
  Edit3,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button, Modal } from '@jobby/ui';
import { api } from '@/lib/api';
import { createClient } from '@/lib/supabase/client';
import type {
  Prospect,
  ProspectDiscoveryResponse,
  ProspectAgentLogEntry,
} from '@/lib/types';
import { cn } from '@/lib/utils';

interface DiscoveryAgentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export type PromptIntent = 'referral' | 'networking' | 'manager_pitch';

const DOSSIER_CACHE_KEY = 'jobby_candidate_discovery_dossier';

const MAJOR_CITIES = [
  {
    name: 'San Francisco',
    lat: 37.7749,
    lng: -122.4194,
    tz: 'America/Los_Angeles',
  },
  { name: 'New York', lat: 40.7128, lng: -74.006, tz: 'America/New_York' },
  { name: 'Seattle', lat: 47.6062, lng: -122.3321, tz: 'America/Los_Angeles' },
  { name: 'Austin', lat: 30.2672, lng: -97.7431, tz: 'America/Chicago' },
  {
    name: 'Los Angeles',
    lat: 34.0522,
    lng: -118.2437,
    tz: 'America/Los_Angeles',
  },
  { name: 'London', lat: 51.5074, lng: -0.1278, tz: 'Europe/London' },
  { name: 'Sydney', lat: -33.8688, lng: 151.2093, tz: 'Australia/Sydney' },
  {
    name: 'Melbourne',
    lat: -37.8136,
    lng: 144.9631,
    tz: 'Australia/Melbourne',
  },
  { name: 'Brisbane', lat: -27.4705, lng: 153.026, tz: 'Australia/Brisbane' },
  { name: 'Tokyo', lat: 35.6762, lng: 139.6503, tz: 'Asia/Tokyo' },
  { name: 'Singapore', lat: 1.3521, lng: 103.8198, tz: 'Asia/Singapore' },
];

function getDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function DiscoveryAgentModal({
  isOpen,
  onClose,
  onSuccess,
}: DiscoveryAgentModalProps) {
  const [promptIntent, setPromptIntent] = useState<PromptIntent>('referral');
  const [targetCount, setTargetCount] = useState<number>(3);
  const [customCountInput, setCustomCountInput] = useState<string>('');

  // Compact Display vs Edit State for Dossier Card (Default is READ-ONLY Display State)
  const [isEditingDossier, setIsEditingDossier] = useState<boolean>(false);

  // Candidate Profile Dossier State (Real User Data + Cached)
  const [userName, setUserName] = useState<string>('Candidate');
  const [userEmail, setUserEmail] = useState<string>('scott5443003@gmail.com');
  const [customRoles, setCustomRoles] = useState<string>(
    'Senior Full Stack Engineer, Engineering Manager',
  );
  const [customLocations, setCustomLocations] = useState<string>('');
  const [nearbyCities, setNearbyCities] = useState<string[]>([
    'San Francisco, CA',
    'Remote',
    'New York, NY',
  ]);
  const [isDetectingLocation, setIsDetectingLocation] = useState(false);

  const [resumeSkills, setResumeSkills] = useState<string>(
    'TypeScript, React, Next.js, Python, Node.js, Cloud Architecture',
  );
  const [resumeSummary, setResumeSummary] = useState<string>(
    'Senior Full Stack Engineer specializing in modern web frameworks, high-throughput APIs, and cloud platform scaling.',
  );

  // Staged Preview & Save State
  const [stagedProspects, setStagedProspects] = useState<Prospect[]>([]);
  const [selectedStagedIds, setSelectedStagedIds] = useState<Set<string>>(
    new Set(),
  );
  const [isSavingAll, setIsSavingAll] = useState(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);

  const [isRunning, setIsRunning] = useState(false);
  const [response, setResponse] = useState<ProspectDiscoveryResponse | null>(
    null,
  );
  const [displayedLogs, setDisplayedLogs] = useState<ProspectAgentLogEntry[]>(
    [],
  );
  const [error, setError] = useState<string | null>(null);
  const [copiedPrompt, setCopiedPrompt] = useState(false);

  // Helper to persist edits to localStorage
  const saveDossierCache = (
    roles: string,
    locs: string,
    skills: string,
    summary: string,
  ) => {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(
        DOSSIER_CACHE_KEY,
        JSON.stringify({
          customRoles: roles,
          customLocations: locs,
          resumeSkills: skills,
          resumeSummary: summary,
        }),
      );
    } catch {
      // Ignore
    }
  };

  // Auto Geolocation & Timezone Detection
  const autoDetectLocation = useCallback(
    (autoFill = false) => {
      setIsDetectingLocation(true);

      const fallbackByTimezone = () => {
        try {
          const userTz = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
          let regionCities: string[] = [];

          if (
            userTz.includes('Australia') ||
            userTz.includes('Pacific/Auckland')
          ) {
            regionCities = [
              'Brisbane, QLD',
              'Sydney, NSW',
              'Melbourne, VIC',
              'Remote',
            ];
          } else if (userTz.includes('America')) {
            regionCities = [
              'San Francisco, CA',
              'New York, NY',
              'Seattle, WA',
              'Remote',
            ];
          } else if (userTz.includes('Europe')) {
            regionCities = [
              'London, UK',
              'Berlin, DE',
              'Amsterdam, NL',
              'Remote',
            ];
          } else if (userTz.includes('Asia')) {
            regionCities = ['Singapore', 'Tokyo', 'Hong Kong', 'Remote'];
          } else {
            regionCities = ['San Francisco, CA', 'Remote', 'New York, NY'];
          }

          setNearbyCities(regionCities);
          if (autoFill && regionCities.length > 0) {
            const locStr = regionCities.slice(0, 2).join(', ');
            setCustomLocations(locStr);
            saveDossierCache(customRoles, locStr, resumeSkills, resumeSummary);
          }
        } catch {
          const defaults = ['San Francisco, CA', 'Remote', 'New York, NY'];
          setNearbyCities(defaults);
          if (autoFill) setCustomLocations(defaults.slice(0, 2).join(', '));
        } finally {
          setIsDetectingLocation(false);
        }
      };

      if (typeof window === 'undefined' || !navigator.geolocation) {
        fallbackByTimezone();
        return;
      }

      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          const { latitude, longitude } = pos.coords;
          let detectedCity = '';

          try {
            const res = await fetch(
              `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=en`,
            );
            if (res.ok) {
              const geoData = await res.json();
              const city = geoData.city || geoData.locality || '';
              const principal =
                geoData.principalSubdivisionCode ||
                geoData.principalSubdivision ||
                '';
              if (city) {
                detectedCity = principal ? `${city}, ${principal}` : city;
              }
            }
          } catch {
            // Ignore
          }

          const sorted = [...MAJOR_CITIES].sort(
            (a, b) =>
              getDistanceKm(latitude, longitude, a.lat, a.lng) -
              getDistanceKm(latitude, longitude, b.lat, b.lng),
          );

          const list: string[] = [];
          if (detectedCity) list.push(detectedCity);
          sorted.forEach((c) => {
            if (!list.includes(c.name)) list.push(`${c.name}`);
          });
          if (!list.includes('Remote')) list.push('Remote');

          const top4 = list.slice(0, 4);
          setNearbyCities(top4);

          if (autoFill && top4.length > 0) {
            const locStr = top4.slice(0, 2).join(', ');
            setCustomLocations(locStr);
            saveDossierCache(customRoles, locStr, resumeSkills, resumeSummary);
          }
          setIsDetectingLocation(false);
        },
        () => {
          fallbackByTimezone();
        },
        { timeout: 5000, enableHighAccuracy: false },
      );
    },
    [customRoles, resumeSkills, resumeSummary],
  );

  useEffect(() => {
    async function loadUserData() {
      try {
        const supabase = createClient();
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (session?.user?.email) {
          setUserEmail(session.user.email);
          if (session.user.user_metadata?.full_name) {
            setUserName(session.user.user_metadata.full_name);
          } else {
            setUserName(session.user.email.split('@')[0]);
          }
        }

        // Check Local Storage Cache first!
        let hasCache = false;
        if (typeof window !== 'undefined') {
          try {
            const cachedRaw = localStorage.getItem(DOSSIER_CACHE_KEY);
            if (cachedRaw) {
              const cached = JSON.parse(cachedRaw);
              if (cached.customRoles) setCustomRoles(cached.customRoles);
              if (cached.customLocations)
                setCustomLocations(cached.customLocations);
              if (cached.resumeSkills) setResumeSkills(cached.resumeSkills);
              if (cached.resumeSummary) setResumeSummary(cached.resumeSummary);
              hasCache = true;
            }
          } catch {
            // Ignore
          }
        }

        // If no cache, fetch system APIs
        let loadedLocation = '';
        if (!hasCache) {
          try {
            const jobProfile = await api.jobHuntingProfile();
            if (jobProfile) {
              if (
                jobProfile.search_terms &&
                jobProfile.search_terms.length > 0
              ) {
                setCustomRoles(jobProfile.search_terms.join(', '));
              }
              if (jobProfile.search_location) {
                loadedLocation = jobProfile.search_location;
                setCustomLocations(jobProfile.search_location);
              }
            }
          } catch {
            // Ignore
          }

          try {
            const masterResume = await api.masterResume();
            if (masterResume && masterResume.resume_data) {
              const rData = masterResume.resume_data as Record<string, any>;
              if (rData.personal_info?.full_name) {
                setUserName(rData.personal_info.full_name);
              }
              if (rData.personal_info?.location && !loadedLocation) {
                loadedLocation = rData.personal_info.location;
                setCustomLocations(rData.personal_info.location);
              }
              if (rData.summary) {
                setResumeSummary(rData.summary);
              }
              if (
                rData.core_competencies &&
                Array.isArray(rData.core_competencies)
              ) {
                setResumeSkills(rData.core_competencies.join(', '));
              } else if (rData.skills && Array.isArray(rData.skills)) {
                const skillList = rData.skills.flatMap(
                  (s: any) => s.skills || [],
                );
                if (skillList.length > 0)
                  setResumeSkills(skillList.slice(0, 8).join(', '));
              }
            }
          } catch {
            // Ignore
          }

          if (!loadedLocation) {
            autoDetectLocation(true);
          } else {
            autoDetectLocation(false);
          }
        } else {
          autoDetectLocation(false);
        }
      } catch {
        autoDetectLocation(true);
      }
    }

    if (isOpen) {
      setIsEditingDossier(false);
      loadUserData();
    }
  }, [isOpen, autoDetectLocation]);

  const toggleSelectStaged = (id: string) => {
    setSelectedStagedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAllStaged = () => {
    if (selectedStagedIds.size === stagedProspects.length) {
      setSelectedStagedIds(new Set());
    } else {
      setSelectedStagedIds(new Set(stagedProspects.map((p) => p.id)));
    }
  };

  // CONFIRM & SAVE ALL PROSPECTS TO DB (BATCH)
  const handleSaveAllStaged = async () => {
    const toSave = stagedProspects.filter((p) => selectedStagedIds.has(p.id));
    if (toSave.length === 0) return;

    setIsSavingAll(true);
    setError(null);

    try {
      const payload = toSave.map((p) => ({
        name: p.name,
        title: p.title,
        company: p.company,
        role_type: p.role_type,
        location: p.location,
        linkedin_url: p.linkedin_url,
        has_active_job: p.has_active_job,
        active_job_title: p.active_job_title,
        active_job_url: p.active_job_url,
        priority_score: p.priority_score,
        score_breakdown: p.score_breakdown || {
          hiring_power: 93,
          reply_probability: 88,
          company_match: 95,
          experience_match: 90,
          overall: p.priority_score || 92,
        },
        match_level: p.match_level,
        recommendation_reason: p.recommendation_reason,
        status: 'recommended' as const,
        notes: p.notes,
      }));

      const createdList = await api.createProspectsBatch(payload);
      const savedCount = createdList.length;

      setSaveSuccessMsg(
        `Successfully saved ${savedCount} prospect${savedCount > 1 ? 's' : ''} to Jobby!`,
      );
      setIsSavingAll(false);
      onSuccess();
      setTimeout(() => {
        onClose();
      }, 1500);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to save prospects to DB',
      );
      setIsSavingAll(false);
    }
  };

  const getIntentInstructions = (intent: PromptIntent) => {
    switch (intent) {
      case 'referral':
        return `OUTREACH SCENARIO: DIRECT JOB REFERRAL REQUEST
Goal: Identify hiring decision-makers and recruiters with active open requisitions matching candidate's stack.
Outreach Tone: Professional, warm, requesting direct internal referral or screening chat.`;
      case 'networking':
        return `OUTREACH SCENARIO: INDUSTRY NETWORKING & TECH CHAT
Goal: Connect with Engineering Managers and Staff Engineers to exchange platform architecture insights and team culture.
Outreach Tone: Collaborative, peer-to-peer technical exchange without immediate high-pressure pitch.`;
      case 'manager_pitch':
        return `OUTREACH SCENARIO: DIRECT HIRING MANAGER PITCH
Goal: Pitch directly to VP of Engineering or Hiring Manager highlighting high-impact project outcomes.
Outreach Tone: High-signal, outcome-driven, demonstrating immediate value for core engineering initiatives.`;
    }
  };

  const agentPrompt = `Act as the Jobby AI Networking Assistant Agent for Candidate ${userName}.

CANDIDATE DOSSIER & STRATEGIC BACKGROUND:
- Candidate Name: ${userName}
- Contact Email: ${userEmail}
- Target Job Titles: [${customRoles}]
- Preferred Locations: [${customLocations || 'San Francisco, CA, Remote'}]
- Top Technical Stack & Competencies: [${resumeSkills}]
- Career Focus & Summary: "${resumeSummary}"

${getIntentInstructions(promptIntent)}

OBJECTIVE:
Discover exactly ${targetCount} high-value contacts (Recruiters, Hiring Managers, Engineering Managers). Batch upload discovered candidates to Jobby DB in a single request.

AI MULTI-DIMENSIONAL MATCH SCORE SPECIFICATION:
For each candidate discovered, evaluate and calculate the following 5 structured score dimensions (1-100):
- Hiring Power (招聘决策力/决策权)
- Reply Probability (回复概率/外联响应率)
- Company Match (公司方向契合度)
- Experience Match (背景与技能契合度)
- Overall (综合评估得分)

EXECUTION STEPS:
1. READ EXISTING JOBBY DATA (Deduplication):
   HTTP GET http://localhost:8000/api/prospects (Header: X-User-Email: ${userEmail})
   Skip existing contacts.

2. SEARCH & EVALUATE CANDIDATES:
   Search LinkedIn, tech company engineering orgs, and hiring teams matching candidate's target roles [${customRoles}] and locations [${customLocations || 'San Francisco, CA, Remote'}].
   Verify active job requisitions matching candidate's target roles [${customRoles}] and stack [${resumeSkills}].
   Calculate priority match score and 5-dimensional score breakdown.
   Generate recommendation rationale explaining specifically how Candidate ${userName}'s background in [${resumeSkills}] aligns with the prospect's team.

3. BATCH POST DISCOVERED PROSPECTS TO JOBBY API (SINGLE BATCH REQUEST):
   HTTP POST http://localhost:8000/api/prospects/batch
   Headers: Content-Type: application/json, X-User-Email: ${userEmail}
   Body (JSON Array of ${targetCount} candidates):
   [
     {
       "name": "Candidate Full Name",
       "title": "Exact LinkedIn Job Title",
       "company": "Company Name",
       "linkedin_url": "https://www.linkedin.com/in/candidate",
       "role_type": "hiring_manager",
       "location": "${(customLocations || 'San Francisco, CA').split(',')[0].trim()}",
       "has_active_job": true,
       "active_job_title": "Senior Software Engineer",
       "active_job_url": "https://company.com/careers/...",
       "priority_score": 92,
       "score_breakdown": {
         "hiring_power": 93,
         "reply_probability": 88,
         "company_match": 95,
         "experience_match": 90,
         "overall": 92
       },
       "match_level": "high",
       "recommendation_reason": "Tailored rationale explaining why candidate ${userName} with stack [${resumeSkills}] matches this team.",
       "status": "recommended"
     }
   ]

4. COMPLETION:
   Stop after uploading exactly ${targetCount} records in batch. Print summary report.`;

  const handleCopyPrompt = () => {
    navigator.clipboard.writeText(agentPrompt);
    setCopiedPrompt(true);
    setTimeout(() => setCopiedPrompt(false), 2000);
  };

  const presetCounts = [3, 5, 8, 10, 15, 20];

  if (!isOpen) return null;

  return (
    <div className='w-full max-w-3xl flex flex-col max-h-[92vh] overflow-hidden panel-xl'>
      {/* Top Bar Header */}
      <div className='header'>
        <div className='flex items-center gap-3'>
          <div className='flex size-10 items-center justify-center rounded-xl bg-primary-gradient text-white shadow-xs'>
            <Sparkles className='size-5' />
          </div>
          <div>
            <h2 className='text-lg font-bold text-ink-primary flex items-center gap-2'>
              AI Networking Assistant Discovery
            </h2>
            <p className='text-xs text-ink-secondary'>
              System of Record:{' '}
              <span className='font-mono font-semibold text-primary'>
                Jobby API
              </span>{' '}
              | Candidate Persona:{' '}
              <span className='font-semibold text-primary'>{userName}</span>
            </p>
          </div>
        </div>

        <button
          onClick={onClose}
          disabled={isRunning || isSavingAll}
          className='rounded-full p-2 text-ink-secondary hover:bg-background-secondary hover:text-ink-primary transition-colors disabled:opacity-50 cursor-pointer'
        >
          <X className='size-5' />
        </button>
      </div>

      {/* Main Body Content */}
      <div className='body'>
        {/* 1. OUTREACH INTENT STRATEGY SELECTION */}
        <div className='rounded-2xl bg-background-secondary/40 p-4 space-y-3'>
          <span className='font-bold text-ink-primary block text-[11px] uppercase tracking-wider text-ink-secondary flex items-center gap-1.5'>
            <Sliders className='size-3.5 text-primary' /> Outreach Strategy &
            Intent Scenario
          </span>
          <div className='grid grid-cols-1 md:grid-cols-3 gap-2.5'>
            {[
              {
                id: 'referral',
                label: 'Referral Request',
                desc: 'Focus on recruiters & hiring managers with active requisitions',
                icon: (
                  <UserCheck className='size-4 text-emerald-500 shrink-0' />
                ),
              },
              {
                id: 'networking',
                label: 'Industry Networking',
                desc: 'Focus on tech stack & architecture peer exchange',
                icon: <Users className='size-4 text-blue-500 shrink-0' />,
              },
              {
                id: 'manager_pitch',
                label: 'Manager Direct Pitch',
                desc: 'Focus on high-impact project value & direct leadership pitch',
                icon: <Zap className='size-4 text-amber-500 shrink-0' />,
              },
            ].map((scen) => (
              <button
                key={scen.id}
                type='button'
                onClick={() => setPromptIntent(scen.id as PromptIntent)}
                className={`flex flex-col text-left p-3.5 rounded-xl transition-all cursor-pointer ${
                  promptIntent === scen.id ?
                    'bg-primary/10 text-ink-primary shadow-xs'
                  : 'bg-panel hover:bg-background-secondary text-ink-secondary hover:text-ink-primary'
                }`}
              >
                <div className='flex items-center gap-2 font-bold text-ink-primary text-xs'>
                  {scen.icon}
                  <span>{scen.label}</span>
                </div>
                <span className='text-[10px] text-ink-secondary mt-1.5 leading-snug'>
                  {scen.desc}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* 2. TARGET PROSPECT QUANTITY SELECTOR */}
        <div className='rounded-2xl bg-background-secondary/40 p-4 space-y-3'>
          <div className='flex items-center justify-between'>
            <div className='flex items-center gap-2'>
              <Users className='size-4 text-primary' />
              <span className='font-bold text-ink-primary text-xs uppercase tracking-wider text-ink-secondary'>
                Target Prospect Quantity
              </span>
            </div>
            <span className='text-xs font-extrabold text-primary bg-primary/10 px-3 py-1 rounded-full'>
              {targetCount} Prospects Selected
            </span>
          </div>

          {/* Responsive 2-Row Grid for breathing room */}
          <div className='grid grid-cols-3 sm:grid-cols-4 md:grid-cols-7 gap-2 pt-1'>
            {presetCounts.map((num) => (
              <button
                key={num}
                type='button'
                onClick={() => {
                  setTargetCount(num);
                  setCustomCountInput('');
                }}
                className={`py-2 px-1 rounded-xl text-xs font-bold transition-all text-center cursor-pointer ${
                  targetCount === num && !customCountInput ?
                    'bg-primary text-white shadow-xs scale-105'
                  : 'bg-panel text-ink-primary hover:bg-background-secondary'
                }`}
              >
                {num}
              </button>
            ))}

            {/* Custom Numeric Input Pill */}
            <div className='col-span-2 sm:col-span-1 flex items-center justify-center gap-1 bg-panel rounded-xl px-2 py-1.5'>
              <span className='text-[10px] text-ink-secondary font-semibold shrink-0'>
                Custom:
              </span>
              <input
                type='number'
                min={1}
                max={50}
                value={customCountInput}
                onChange={(e) => {
                  const val = e.target.value;
                  setCustomCountInput(val);
                  const parsed = parseInt(val, 10);
                  if (parsed > 0) {
                    setTargetCount(parsed);
                  }
                }}
                placeholder='25'
                className='w-10 bg-transparent text-xs font-bold text-ink-primary focus:outline-hidden text-center'
              />
            </div>
          </div>
        </div>

        {/* 3. CANDIDATE PROFILE & LOCATION PREFERENCES */}
        <div className='rounded-2xl bg-background-secondary/40 p-4 space-y-3'>
          <div className='flex items-center justify-between pb-2.5'>
            <div className='flex items-center gap-2 min-w-0'>
              <User className='size-4 text-primary shrink-0' />
              <span className='font-bold text-ink-primary text-xs uppercase tracking-wider text-ink-secondary truncate'>
                Candidate Profile & Location Preferences
              </span>
            </div>

            <div className='flex items-center gap-2 shrink-0'>
              <button
                type='button'
                onClick={() => setIsEditingDossier(!isEditingDossier)}
                className='flex items-center gap-1.5 rounded-xl bg-panel px-3 py-1 text-xs font-semibold text-primary hover:bg-primary/10 transition-colors cursor-pointer'
              >
                <Edit3 className='size-3.5' />
                <span>
                  {isEditingDossier ? 'Done Editing' : 'Customize Profile'}
                </span>
              </button>
            </div>
          </div>

          {/* READ-ONLY COMPACT DISPLAY STATE (Default) */}
          {!isEditingDossier ?
            <div className='grid gap-1.5 text-xs w-full min-w-0'>
              <div className='grid grid-cols-[80px_minmax(0,1fr)] gap-1.5 items-baseline'>
                <span className='text-ink-secondary text-[11px] font-medium'>
                  Candidate:
                </span>
                <span className='font-semibold text-ink-primary break-words'>
                  {userName} {userEmail ? `(${userEmail})` : ''}
                </span>
              </div>

              <div className='grid grid-cols-[80px_minmax(0,1fr)] gap-1.5 items-baseline'>
                <span className='text-ink-secondary text-[11px] font-medium'>
                  Roles:
                </span>
                <span className='font-semibold text-ink-primary break-words'>
                  {customRoles || 'Not Specified'}
                </span>
              </div>

              <div className='grid grid-cols-[80px_minmax(0,1fr)] gap-1.5 items-baseline'>
                <span className='text-ink-secondary text-[11px] font-medium'>
                  Locations:
                </span>
                <span className='font-semibold text-ink-primary break-words'>
                  {customLocations || 'San Francisco, CA, Remote'}
                </span>
              </div>

              {resumeSkills && (
                <div className='grid grid-cols-[80px_minmax(0,1fr)] gap-1.5 items-baseline'>
                  <span className='text-ink-secondary text-[11px] font-medium'>
                    Stack:
                  </span>
                  <span className='font-semibold text-ink-primary break-words'>
                    {resumeSkills}
                  </span>
                </div>
              )}
            </div>
          : /* EDITABLE FORM STATE (Expands when user clicks Customize Profile) */
            <div className='grid grid-cols-1 md:grid-cols-2 gap-3 pt-1'>
              {/* Target Job Roles */}
              <div className='space-y-1'>
                <label className='text-[11px] font-semibold text-ink-secondary flex items-center gap-1.5'>
                  <Briefcase className='size-3 text-primary' /> Target Job
                  Titles:
                </label>
                <input
                  type='text'
                  value={customRoles}
                  onChange={(e) => {
                    const val = e.target.value;
                    setCustomRoles(val);
                    saveDossierCache(
                      val,
                      customLocations,
                      resumeSkills,
                      resumeSummary,
                    );
                  }}
                  placeholder='e.g. Senior Full Stack Engineer, Engineering Manager'
                  className='w-full rounded-xl bg-panel p-2.5 text-xs text-ink-primary font-medium focus:outline-hidden'
                />
              </div>

              {/* Target Locations with Auto Detect & Nearby Cities (支持反选/取消选中) */}
              <div className='space-y-1.5'>
                <div className='flex items-center justify-between'>
                  <label className='text-[11px] font-semibold text-ink-secondary flex items-center gap-1.5'>
                    <MapPin className='size-3 text-primary' /> Target Locations:
                  </label>
                  <button
                    type='button'
                    onClick={() => autoDetectLocation(true)}
                    disabled={isDetectingLocation}
                    className='text-[10px] flex items-center gap-1 text-primary hover:underline font-bold cursor-pointer'
                  >
                    <Navigation
                      className={cn(
                        'size-3',
                        isDetectingLocation && 'animate-spin',
                      )}
                    />
                    <span>
                      {isDetectingLocation ? 'Detecting...' : 'Auto Detect GPS'}
                    </span>
                  </button>
                </div>
                <input
                  type='text'
                  value={customLocations}
                  onChange={(e) => {
                    const val = e.target.value;
                    setCustomLocations(val);
                    saveDossierCache(
                      customRoles,
                      val,
                      resumeSkills,
                      resumeSummary,
                    );
                  }}
                  placeholder='e.g. San Francisco, CA / Remote / Sydney'
                  className='w-full rounded-xl bg-panel p-2.5 text-xs text-ink-primary font-medium focus:outline-hidden'
                />

                {/* Nearby Cities Pills (支持点击选中与反选/取消选中) */}
                {nearbyCities.length > 0 && (
                  <div className='flex flex-wrap items-center gap-1 pt-1'>
                    <span className='text-[10px] text-ink-secondary/70 font-semibold mr-0.5'>
                      Nearby Cities:
                    </span>
                    {nearbyCities.map((city) => {
                      let currentArr =
                        customLocations ?
                          customLocations
                            .split(',')
                            .map((s) => s.trim())
                            .filter(Boolean)
                        : [];
                      const isSelected = currentArr.some(
                        (c) => c.toLowerCase() === city.toLowerCase(),
                      );

                      return (
                        <button
                          key={city}
                          type='button'
                          onClick={() => {
                            let nextArr = [...currentArr];
                            if (isSelected) {
                              // TOGGLE OFF: Remove city from locations
                              nextArr = nextArr.filter(
                                (c) => c.toLowerCase() !== city.toLowerCase(),
                              );
                            } else {
                              // TOGGLE ON: Append city to locations
                              nextArr.push(city);
                            }
                            const nextLoc = nextArr.join(', ');
                            setCustomLocations(nextLoc);
                            saveDossierCache(
                              customRoles,
                              nextLoc,
                              resumeSkills,
                              resumeSummary,
                            );
                          }}
                          className={`rounded-md px-2 py-0.5 text-[10px] font-medium transition-all cursor-pointer ${
                            isSelected ?
                              'bg-primary text-white font-bold shadow-xs'
                            : 'bg-background-secondary hover:bg-primary/10 hover:text-primary text-ink-secondary'
                          }`}
                        >
                          {isSelected ? `✓ ${city}` : `+ ${city}`}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Technical Skills */}
              <div className='space-y-1 md:col-span-2'>
                <label className='text-[11px] font-semibold text-ink-secondary flex items-center gap-1.5'>
                  <Code2 className='size-3 text-primary' /> Core Technical Stack
                  & Skills:
                </label>
                <input
                  type='text'
                  value={resumeSkills}
                  onChange={(e) => {
                    const val = e.target.value;
                    setResumeSkills(val);
                    saveDossierCache(
                      customRoles,
                      customLocations,
                      val,
                      resumeSummary,
                    );
                  }}
                  placeholder='e.g. TypeScript, React, Next.js, Python, PostgreSQL, Node.js'
                  className='w-full rounded-xl bg-panel p-2.5 text-xs text-ink-primary font-medium focus:outline-hidden'
                />
              </div>

              {/* Candidate Summary */}
              <div className='space-y-1 md:col-span-2'>
                <label className='text-[11px] font-semibold text-ink-secondary flex items-center gap-1.5'>
                  <FileText className='size-3 text-primary' /> Candidate
                  Background & Highlights:
                </label>
                <textarea
                  rows={2}
                  value={resumeSummary}
                  onChange={(e) => {
                    const val = e.target.value;
                    setResumeSummary(val);
                    saveDossierCache(
                      customRoles,
                      customLocations,
                      resumeSkills,
                      val,
                    );
                  }}
                  placeholder='Summary of candidate achievements and technical focus...'
                  className='w-full rounded-xl bg-panel p-2.5 text-xs text-ink-primary font-medium focus:outline-hidden leading-relaxed'
                />
              </div>
            </div>
          }
        </div>

        {/* 4. PRIMARY AGENT PROMPT COPY BOX */}
        <div className='rounded-2xl bg-background-secondary/40 p-4 space-y-3'>
          <div className='flex items-center justify-between'>
            <div className='flex items-center gap-2'>
              <Sparkles className='size-4 text-primary animate-pulse' />
              <span className='font-bold text-ink-primary text-xs uppercase tracking-wider text-ink-secondary'>
                Codex Agent Prompt ({targetCount} Prospects - {userName})
              </span>
            </div>
          </div>
          <textarea
            readOnly
            value={agentPrompt}
            rows={8}
            className=' w-full rounded-xl bg-ink-primary p-3.5 text-primary-foreground font-mono text-[11px] leading-relaxed focus:outline-hidden custom-scrollbar-primary'
          />
        </div>

        {/* 5. STAGED PROSPECTS PREVIEW SECTION */}
        {stagedProspects.length > 0 && !isRunning && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className='rounded-2xl bg-primary/5 p-4 flex flex-col gap-4 shadow-xs'
          >
            <div className='flex items-center justify-between pb-3'>
              <div className='flex items-center gap-2'>
                <UserCheck className='size-5 text-primary' />
                <div>
                  <h3 className='text-sm font-bold text-ink-primary'>
                    Discovered Prospects Preview ({stagedProspects.length})
                  </h3>
                  <p className='text-[11px] text-ink-secondary'>
                    Review discovered candidates below. Only selected candidates
                    will be written to Jobby DB when you click{' '}
                    <span className='font-semibold text-primary'>
                      "Save All Prospects"
                    </span>
                    .
                  </p>
                </div>
              </div>

              <button
                onClick={toggleSelectAllStaged}
                className='text-xs font-semibold text-primary hover:underline'
              >
                {selectedStagedIds.size === stagedProspects.length ?
                  'Deselect All'
                : 'Select All'}
              </button>
            </div>

            {/* Preview Candidate Cards List */}
            <div className='flex flex-col gap-3 max-h-[320px] overflow-y-auto pr-1 no-scrollbar'>
              {stagedProspects.map((p) => {
                const isSelected = selectedStagedIds.has(p.id);
                return (
                  <div
                    key={p.id}
                    onClick={() => toggleSelectStaged(p.id)}
                    className={`cursor-pointer rounded-xl p-3.5 transition-all flex items-start gap-3 ${
                      isSelected ?
                        'bg-panel shadow-xs'
                      : 'bg-background/50 opacity-60'
                    }`}
                  >
                    <input
                      type='checkbox'
                      checked={isSelected}
                      onChange={() => toggleSelectStaged(p.id)}
                      className='mt-1 size-4 rounded text-primary focus:ring-primary/40'
                    />

                    <div className='flex-1 min-w-0 space-y-1 text-xs'>
                      <div className='flex items-center justify-between gap-2'>
                        <div className='flex items-center gap-2 truncate'>
                          <span className='font-bold text-ink-primary text-sm truncate'>
                            {p.name}
                          </span>
                          <span className='text-ink-secondary text-xs truncate'>
                            • {p.title} @{' '}
                            <strong className='text-ink-primary'>
                              {p.company}
                            </strong>
                          </span>
                        </div>

                        <div className='flex items-center gap-1 shrink-0 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-[11px] font-bold text-emerald-600 dark:text-emerald-400'>
                          <Sparkles className='size-3' />
                          <span>
                            {p.score_breakdown?.overall || p.priority_score}%
                            Overall Score
                          </span>
                        </div>
                      </div>

                      {/* Multi-Dimensional Score Breakdown Tag */}
                      <div className='grid grid-cols-4 gap-2 text-[10px] bg-background-secondary/60 p-2 rounded-lg font-semibold text-ink-secondary'>
                        <div>
                          Hiring Power:{' '}
                          <strong className='text-emerald-600 dark:text-emerald-400'>
                            {p.score_breakdown?.hiring_power || 93}
                          </strong>
                        </div>
                        <div>
                          Reply Prob:{' '}
                          <strong className='text-blue-600 dark:text-blue-400'>
                            {p.score_breakdown?.reply_probability || 88}%
                          </strong>
                        </div>
                        <div>
                          Company Match:{' '}
                          <strong className='text-indigo-600 dark:text-indigo-400'>
                            {p.score_breakdown?.company_match || 95}%
                          </strong>
                        </div>
                        <div>
                          Experience:{' '}
                          <strong className='text-amber-600 dark:text-amber-400'>
                            {p.score_breakdown?.experience_match || 90}%
                          </strong>
                        </div>
                      </div>

                      {p.has_active_job && p.active_job_title && (
                        <div className='flex items-center gap-1.5 text-[11px] text-blue-600 dark:text-blue-400 font-medium'>
                          <Briefcase className='size-3' />
                          <span>Active Requisition: {p.active_job_title}</span>
                        </div>
                      )}

                      <p className='text-ink-secondary text-[11px] line-clamp-2 leading-relaxed bg-background-secondary/50 p-2 rounded-lg'>
                        <strong>Recommendation Reason:</strong>{' '}
                        {p.recommendation_reason}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}

        {saveSuccessMsg && (
          <div className='rounded-2xl bg-emerald-500/10 p-4 text-xs text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-2'>
            <CheckCircle2 className='size-4' />
            <span>{saveSuccessMsg}</span>
          </div>
        )}

        {error && (
          <div className='rounded-2xl bg-red-500/10 p-4 text-xs text-red-600 dark:text-red-400 flex items-center gap-2'>
            <AlertCircle className='size-4 shrink-0' />
            <span>{error}</span>
          </div>
        )}
      </div>

      {/* Footer Controls */}
      <div className='footer'>
        <Button variant={'ghost'} onClick={onClose}>
          <span>Close</span>
        </Button>

        <div className='flex items-center gap-3'>
          {stagedProspects.length > 0 ?
            <Button
              onClick={handleSaveAllStaged}
              Icon={Save}
              disabled={isSavingAll || selectedStagedIds.size === 0}
              variant={'ghost'}
            >
              <span>
                {isSavingAll ?
                  'Saving to Jobby DB...'
                : `Save All Prospects (${selectedStagedIds.size})`}
              </span>
            </Button>
          : <Button
              Icon={copiedPrompt ? Check : Copy}
              onClick={handleCopyPrompt}
            >
              <span>
                {copiedPrompt ?
                  'Copied Prompt!'
                : `Copy Agent Prompt (${targetCount} Prospects)`}
              </span>
            </Button>
          }
        </div>
      </div>
    </div>
  );
}
