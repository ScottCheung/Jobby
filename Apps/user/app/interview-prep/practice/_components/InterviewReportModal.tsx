/** @format */

'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  X,
  Building2,
  Briefcase,
  Calendar,
  MapPin,
  Navigation,
} from 'lucide-react';
import { Button, Modal } from '@jobby/ui';
import { showGlobalToast } from '@/lib/toast';
import { useConsole } from '@/components/ConsoleContext';
import { cn } from '@/lib/utils';

export interface InterviewReportData {
  company: string;
  role?: string;
  happened_at: string; // ISO date string
  location?: string;
}

const COMMON_COMPANIES = [
  'Google',
  'Meta',
  'Amazon',
  'Apple',
  'Microsoft',
  'ByteDance',
  'Stripe',
  'Netflix',
];

const MAJOR_CITIES: Array<{
  name: string;
  lat: number;
  lng: number;
  region: 'AU_NZ' | 'US_CA' | 'EU' | 'ASIA' | 'OTHER';
  tzPrefixes: string[];
}> = [
  // ── Australia & New Zealand ──
  {
    name: 'Brisbane',
    lat: -27.4705,
    lng: 153.026,
    region: 'AU_NZ',
    tzPrefixes: ['Australia/Brisbane', 'Australia/Queensland'],
  },
  {
    name: 'Sydney',
    lat: -33.8688,
    lng: 151.2093,
    region: 'AU_NZ',
    tzPrefixes: ['Australia/Sydney', 'Australia/NSW'],
  },
  {
    name: 'Melbourne',
    lat: -37.8136,
    lng: 144.9631,
    region: 'AU_NZ',
    tzPrefixes: ['Australia/Melbourne', 'Australia/Victoria'],
  },
  {
    name: 'Perth',
    lat: -31.9505,
    lng: 115.8605,
    region: 'AU_NZ',
    tzPrefixes: ['Australia/Perth'],
  },
  {
    name: 'Adelaide',
    lat: -34.9285,
    lng: 138.6007,
    region: 'AU_NZ',
    tzPrefixes: ['Australia/Adelaide'],
  },
  {
    name: 'Gold Coast',
    lat: -28.0167,
    lng: 153.4,
    region: 'AU_NZ',
    tzPrefixes: ['Australia/Brisbane'],
  },
  {
    name: 'Canberra',
    lat: -35.2809,
    lng: 149.13,
    region: 'AU_NZ',
    tzPrefixes: ['Australia/Canberra', 'Australia/Sydney'],
  },
  {
    name: 'Auckland',
    lat: -36.8485,
    lng: 174.7633,
    region: 'AU_NZ',
    tzPrefixes: ['Pacific/Auckland'],
  },
  {
    name: 'Wellington',
    lat: -41.2865,
    lng: 174.7762,
    region: 'AU_NZ',
    tzPrefixes: ['Pacific/Auckland'],
  },

  // ── North America ──
  {
    name: 'San Francisco',
    lat: 37.7749,
    lng: -122.4194,
    region: 'US_CA',
    tzPrefixes: ['America/Los_Angeles'],
  },
  {
    name: 'San Jose',
    lat: 37.3382,
    lng: -121.8863,
    region: 'US_CA',
    tzPrefixes: ['America/Los_Angeles'],
  },
  {
    name: 'Seattle',
    lat: 47.6062,
    lng: -122.3321,
    region: 'US_CA',
    tzPrefixes: ['America/Los_Angeles', 'America/Vancouver'],
  },
  {
    name: 'Los Angeles',
    lat: 34.0522,
    lng: -118.2437,
    region: 'US_CA',
    tzPrefixes: ['America/Los_Angeles'],
  },
  {
    name: 'New York',
    lat: 40.7128,
    lng: -74.006,
    region: 'US_CA',
    tzPrefixes: ['America/New_York'],
  },
  {
    name: 'Austin',
    lat: 30.2672,
    lng: -97.7431,
    region: 'US_CA',
    tzPrefixes: ['America/Chicago'],
  },
  {
    name: 'Chicago',
    lat: 41.8781,
    lng: -87.6298,
    region: 'US_CA',
    tzPrefixes: ['America/Chicago'],
  },
  {
    name: 'Boston',
    lat: 42.3601,
    lng: -71.0589,
    region: 'US_CA',
    tzPrefixes: ['America/New_York'],
  },
  {
    name: 'Toronto',
    lat: 43.6532,
    lng: -79.3832,
    region: 'US_CA',
    tzPrefixes: ['America/Toronto'],
  },
  {
    name: 'Vancouver',
    lat: 49.2827,
    lng: -123.1207,
    region: 'US_CA',
    tzPrefixes: ['America/Vancouver'],
  },
  {
    name: 'Montreal',
    lat: 45.5017,
    lng: -73.5673,
    region: 'US_CA',
    tzPrefixes: ['America/Toronto', 'America/Montreal'],
  },

  // ── Europe ──
  {
    name: 'London',
    lat: 51.5074,
    lng: -0.1278,
    region: 'EU',
    tzPrefixes: ['Europe/London'],
  },
  {
    name: 'Berlin',
    lat: 52.52,
    lng: 13.405,
    region: 'EU',
    tzPrefixes: ['Europe/Berlin'],
  },
  {
    name: 'Paris',
    lat: 48.8566,
    lng: 2.3522,
    region: 'EU',
    tzPrefixes: ['Europe/Paris'],
  },
  {
    name: 'Amsterdam',
    lat: 52.3676,
    lng: 4.9041,
    region: 'EU',
    tzPrefixes: ['Europe/Amsterdam'],
  },
  {
    name: 'Dublin',
    lat: 53.3498,
    lng: -6.2603,
    region: 'EU',
    tzPrefixes: ['Europe/Dublin'],
  },
  {
    name: 'Zurich',
    lat: 47.3769,
    lng: 8.5417,
    region: 'EU',
    tzPrefixes: ['Europe/Zurich'],
  },

  // ── Asia & Pacific ──
  {
    name: 'Singapore',
    lat: 1.3521,
    lng: 103.8198,
    region: 'ASIA',
    tzPrefixes: ['Asia/Singapore'],
  },
  {
    name: 'Tokyo',
    lat: 35.6762,
    lng: 139.6503,
    region: 'ASIA',
    tzPrefixes: ['Asia/Tokyo'],
  },
  {
    name: 'Hong Kong',
    lat: 22.3193,
    lng: 114.1694,
    region: 'ASIA',
    tzPrefixes: ['Asia/Hong_Kong'],
  },
  {
    name: 'Beijing',
    lat: 39.9042,
    lng: 116.4074,
    region: 'ASIA',
    tzPrefixes: ['Asia/Shanghai', 'Asia/Chongqing'],
  },
  {
    name: 'Shanghai',
    lat: 31.2304,
    lng: 121.4737,
    region: 'ASIA',
    tzPrefixes: ['Asia/Shanghai'],
  },
  {
    name: 'Shenzhen',
    lat: 22.5431,
    lng: 114.0579,
    region: 'ASIA',
    tzPrefixes: ['Asia/Shanghai', 'Asia/Hong_Kong'],
  },
  {
    name: 'Hangzhou',
    lat: 30.2741,
    lng: 120.1551,
    region: 'ASIA',
    tzPrefixes: ['Asia/Shanghai'],
  },
  {
    name: 'Guangzhou',
    lat: 23.1291,
    lng: 113.2644,
    region: 'ASIA',
    tzPrefixes: ['Asia/Shanghai'],
  },
  {
    name: 'Taipei',
    lat: 25.033,
    lng: 121.5654,
    region: 'ASIA',
    tzPrefixes: ['Asia/Taipei'],
  },
  {
    name: 'Seoul',
    lat: 37.5665,
    lng: 126.978,
    region: 'ASIA',
    tzPrefixes: ['Asia/Seoul'],
  },
  {
    name: 'Bengaluru',
    lat: 12.9716,
    lng: 77.5946,
    region: 'ASIA',
    tzPrefixes: ['Asia/Kolkata'],
  },
  {
    name: 'Dubai',
    lat: 25.2048,
    lng: 55.2708,
    region: 'OTHER',
    tzPrefixes: ['Asia/Dubai'],
  },
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

interface InterviewReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: InterviewReportData) => Promise<void>;
  isSubmitting?: boolean;
}

export function InterviewReportModal({
  isOpen,
  onClose,
  onSubmit,
  isSubmitting = false,
}: InterviewReportModalProps) {
  const { profile, jobHuntingProfiles } = useConsole();
  const [company, setCompany] = useState('');
  const [role, setRole] = useState('');
  const [happenedAt, setHappenedAt] = useState('');
  const [location, setLocation] = useState('');
  const [suggestedRoles, setSuggestedRoles] = useState<string[]>([]);
  const [nearbyCities, setNearbyCities] = useState<string[]>([]);
  const [isDetectingLocation, setIsDetectingLocation] = useState(false);

  // Helper for 5 nearby cities detection (auto-runs on modal open or user click)
  const autoDetectLocation = useCallback((autoFill = false) => {
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
            'Brisbane',
            'Sydney',
            'Melbourne',
            'Perth',
            'Adelaide',
          ];
        } else if (userTz.includes('America')) {
          regionCities = [
            'San Francisco',
            'New York',
            'Seattle',
            'Los Angeles',
            'Austin',
          ];
        } else if (userTz.includes('Europe')) {
          regionCities = ['London', 'Berlin', 'Paris', 'Amsterdam', 'Dublin'];
        } else if (userTz.includes('Asia')) {
          regionCities = [
            'Singapore',
            'Tokyo',
            'Hong Kong',
            'Beijing',
            'Shanghai',
          ];
        } else {
          regionCities = [
            'Brisbane',
            'Sydney',
            'Melbourne',
            'San Francisco',
            'London',
          ];
        }

        setNearbyCities(regionCities);
        if (autoFill && regionCities.length > 0) {
          setLocation(regionCities[0]);
        }
      } catch {
        const defaultTop5 = [
          'Brisbane',
          'Sydney',
          'Melbourne',
          'Perth',
          'Adelaide',
        ];
        setNearbyCities(defaultTop5);
        if (autoFill) setLocation(defaultTop5[0]);
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
            detectedCity = geoData.city || geoData.locality || '';
          }
        } catch {
          // Ignore network reverse-geocode failures and use distance sorting
        }

        const sorted = [...MAJOR_CITIES].sort(
          (a, b) =>
            getDistanceKm(latitude, longitude, a.lat, a.lng) -
            getDistanceKm(latitude, longitude, b.lat, b.lng),
        );

        const list: string[] = [];
        if (detectedCity) {
          list.push(detectedCity);
        }

        sorted.forEach((c) => {
          if (!list.includes(c.name)) {
            list.push(c.name);
          }
        });

        const top5 = list.slice(0, 5);
        setNearbyCities(top5);

        if (autoFill && top5.length > 0) {
          setLocation(top5[0]);
        }

        setIsDetectingLocation(false);
      },
      (err) => {
        console.warn(
          'Browser location lookup skipped or denied:',
          err?.message,
        );
        fallbackByTimezone();
      },
      { timeout: 5000, enableHighAccuracy: false },
    );
  }, []);

  // Initialize fields on open
  useEffect(() => {
    if (isOpen) {
      setCompany('');
      setRole('');
      setLocation('');
      const today = new Date().toISOString().split('T')[0];
      setHappenedAt(today);
      autoDetectLocation(false);
    }
  }, [isOpen, autoDetectLocation]);

  // Extract suggested roles from user profile
  useEffect(() => {
    if (isOpen) {
      const seen = new Set<string>();
      const roles: string[] = [];
      const addRole = (r: string) => {
        const cleaned = r.trim();
        if (!cleaned) return;
        const lower = cleaned.toLowerCase();
        if (!seen.has(lower)) {
          seen.add(lower);
          roles.push(cleaned);
        }
      };

      if (jobHuntingProfiles && Array.isArray(jobHuntingProfiles)) {
        jobHuntingProfiles.forEach((p) => {
          if (Array.isArray(p.search_terms)) {
            p.search_terms.forEach((term) => addRole(term));
          }
          const jobTitles = p.filters?.job_titles;
          if (Array.isArray(jobTitles)) {
            jobTitles.forEach((title) => addRole(title));
          }
        });
      }

      if (profile && profile.extra_data) {
        const extra = profile.extra_data;
        ['role', 'job_title', 'title', 'desired_role'].forEach((key) => {
          const val = extra[key];
          if (typeof val === 'string') {
            addRole(val);
          }
        });
      }

      setSuggestedRoles(roles);
    }
  }, [isOpen, jobHuntingProfiles, profile]);

  const getOffsetDate = (days: number, months = 0) => {
    const d = new Date();
    if (days) d.setDate(d.getDate() - days);
    if (months) d.setMonth(d.getMonth() - months);
    return d.toISOString().split('T')[0];
  };

  const getButtonClass = (isActive: boolean) =>
    cn(
      'text-[10px] px-2 py-1 rounded-md transition-colors font-medium cursor-pointer select-none',
      isActive ?
        'bg-primary text-primary-foreground font-semibold shadow-sm'
      : 'bg-background-secondary hover:bg-primary/10 hover:text-primary text-ink-secondary',
    );

  const setDateOffset = (days: number) => {
    setHappenedAt(getOffsetDate(days));
  };

  const setMonthOffset = (months: number) => {
    setHappenedAt(getOffsetDate(0, months));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!company.trim()) {
      showGlobalToast('Company name is required');
      return;
    }
    if (!happenedAt) {
      showGlobalToast('Interview date is required');
      return;
    }

    let dateToSubmit = new Date().toISOString();
    if (happenedAt) {
      const parsedDate = new Date(happenedAt);
      if (!isNaN(parsedDate.getTime())) {
        dateToSubmit = parsedDate.toISOString();
      }
    }

    try {
      await onSubmit({
        company: company.trim(),
        role: role.trim() || undefined,
        happened_at: dateToSubmit,
        location: location.trim() || undefined,
      });
      onClose();
    } catch (err) {
      console.error('Error submitting report:', err);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      layoutId='Seen in Interview'
      className='w-[92vw] max-w-3xl'
    >
      {/* Header */}
      <div className='header'>
        <div>
          <h3 className='title-sub'>Seen in Interview</h3>
          <p className='body-sm text-ink-secondary mt-0.5'>
            Help others by sharing where you saw this question!
          </p>
        </div>
        <button
          type='button'
          onClick={onClose}
          className='p-2 rounded-lg hover:bg-background-secondary transition-colors'
        >
          <X className='w-4 h-4 text-ink-secondary' />
        </button>
      </div>

      <form onSubmit={handleSubmit} className='flex flex-col flex-1'>
        <div className='flex-1 overflow-y-auto grid grid-cols-1 overflow-x-hidden md:grid-cols-2 gap-4 custom-scrollbar-primary body  flex-col '>
          {/* 1. Company (Required *) */}
          <div className='flex flex-col gap-1.5'>
            <label className='label flex items-center gap-1.5'>
              <Building2 className='w-4 h-4 text-ink-secondary' /> Company{' '}
              <span className='text-rose-500 font-bold'>*</span>
            </label>
            <input
              type='text'
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              placeholder='e.g. Google, Meta, Startup Inc.'
              className='input'
              required
            />
            <div className='flex flex-wrap gap-1 mt-1'>
              {COMMON_COMPANIES.map((c) => (
                <button
                  key={c}
                  type='button'
                  onClick={() => setCompany(c)}
                  className={getButtonClass(company === c)}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>

          {/* 2. Date (Required *) */}
          <div className='flex flex-col gap-1.5'>
            <label className='label flex items-center gap-1.5'>
              <Calendar className='w-4 h-4 text-ink-secondary' /> Date{' '}
              <span className='text-rose-500 font-bold'>*</span>
            </label>
            <div className='flex flex-wrap gap-1 mb-1'>
              <button
                type='button'
                onClick={() => setDateOffset(0)}
                className={getButtonClass(happenedAt === getOffsetDate(0))}
              >
                Today
              </button>

              {Array.from({ length: 6 }, (_, i) => i + 1).map((days) => (
                <button
                  key={`day-${days}`}
                  type='button'
                  onClick={() => setDateOffset(days)}
                  className={getButtonClass(happenedAt === getOffsetDate(days))}
                >
                  {days}d ago
                </button>
              ))}
              <button
                type='button'
                onClick={() => setDateOffset(7)}
                className={getButtonClass(happenedAt === getOffsetDate(7))}
              >
                About 1w ago
              </button>
              <button
                type='button'
                onClick={() => setDateOffset(14)}
                className={getButtonClass(happenedAt === getOffsetDate(14))}
              >
                About 2w ago
              </button>
              <button
                type='button'
                onClick={() => setMonthOffset(1)}
                className={getButtonClass(happenedAt === getOffsetDate(0, 1))}
              >
                About 1mo ago
              </button>
              <button
                type='button'
                onClick={() => setMonthOffset(2)}
                className={getButtonClass(happenedAt === getOffsetDate(0, 2))}
              >
                About 2mon ago
              </button>
            </div>
            <input
              type='date'
              value={happenedAt}
              onChange={(e) => setHappenedAt(e.target.value)}
              className=' flex-1 bg-panel px-3 py-2 rounded-full border border-border focus:outline-none focus:border-primary text-ink-primary'
              required
            />
          </div>

          {/* 3. Location (Optional) */}
          <div className='flex flex-col gap-1.5'>
            <div className='flex items-center justify-between'>
              <label className='label flex items-center gap-1.5'>
                <MapPin className='w-4 h-4 text-ink-secondary' /> Location{' '}
                <span className='text-ink-secondary font-normal text-xs'>
                  (Optional)
                </span>
              </label>
              <button
                type='button'
                onClick={() => autoDetectLocation(true)}
                disabled={isDetectingLocation}
                className='text-[10px] flex items-center gap-1 text-primary hover:underline font-medium cursor-pointer'
              >
                <Navigation
                  className={cn(
                    'w-3 h-3',
                    isDetectingLocation && 'animate-spin',
                  )}
                />
                {isDetectingLocation ? 'Detecting...' : 'Auto Detect'}
              </button>
            </div>
            <input
              type='text'
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder='e.g. San Francisco, CA / Remote / Sydney'
              className='input'
            />
            {nearbyCities.length > 0 && (
              <div className='flex flex-wrap gap-1 mt-1 items-center'>
                <span className='text-[9px] text-ink-secondary/70 font-semibold mr-0.5'>
                  Nearby Cities:
                </span>
                {nearbyCities.map((city) => (
                  <button
                    key={city}
                    type='button'
                    onClick={() => setLocation(city)}
                    className={getButtonClass(location === city)}
                  >
                    {city}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* 4. Role (Optional) */}
          <div className='flex flex-col gap-1.5'>
            <label className='label flex items-center gap-1.5'>
              <Briefcase className='w-4 h-4 text-ink-secondary' /> Role{' '}
              <span className='text-ink-secondary font-normal text-xs'>
                (Optional)
              </span>
            </label>
            <input
              type='text'
              value={role}
              onChange={(e) => setRole(e.target.value)}
              placeholder='e.g. Frontend Engineer, Product Manager'
              className='input'
            />
            {suggestedRoles.length > 0 && (
              <div className='flex flex-wrap gap-1 mt-1'>
                {suggestedRoles.map((r) => (
                  <button
                    key={r}
                    type='button'
                    onClick={() => setRole(r)}
                    className={getButtonClass(role === r)}
                  >
                    {r}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className='footer mt-4'>
          <Button
            type='button'
            variant='ghost'
            onClick={onClose}
            className='flex-1'
          >
            Cancel
          </Button>
          <Button
            type='submit'
            className='flex-1'
            isLoading={isSubmitting}
            disabled={!company.trim() || !happenedAt || isSubmitting}
          >
            Submit Report
          </Button>
        </div>
      </form>
    </Modal>
  );
}
