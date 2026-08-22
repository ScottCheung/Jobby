/** @format */

'use client';

import React, { useState } from 'react';
import { Navigation } from 'lucide-react';
import { Select } from '@jobby/ui';
import { Field } from '@/components/forms';
import { cn } from '@/lib/utils';
import { PillGroup } from '../PillGroup';
import { ProfileSectionCard } from '../ProfileSectionCard';

const PHONE_TYPES = ['Mobile', 'Home', 'Work'];

const COUNTRY_DIALING_CODES = [
  { code: '+61', label: '+61 (AU 🇦🇺)' },
  { code: '+1', label: '+1 (US/CA 🇺🇸/🇨🇦)' },
  { code: '+44', label: '+44 (UK 🇬🇧)' },
  { code: '+86', label: '+86 (CN 🇨🇳)' },
  { code: '+64', label: '+64 (NZ 🇳🇿)' },
  { code: '+65', label: '+65 (SG 🇸🇬)' },
  { code: '+91', label: '+91 (IN 🇮🇳)' },
  { code: '+49', label: '+49 (DE 🇩🇪)' },
  { code: '+33', label: '+33 (FR 🇫🇷)' },
  { code: '+81', label: '+81 (JP 🇯🇵)' },
  { code: '+82', label: '+82 (KR 🇰🇷)' },
  { code: '+852', label: '+852 (HK 🇭🇰)' },
  { code: '+886', label: '+886 (TW 🇹🇼)' },
  { code: '+353', label: '+353 (IE 🇮🇪)' },
  { code: '+31', label: '+31 (NL 🇳🇱)' },
];

const POPULAR_COUNTRIES = [
  'Australia',
  'United States',
  'United Kingdom',
  'Canada',
  'New Zealand',
  'Singapore',
  'China',
  'India',
  'Germany',
  'France',
  'Ireland',
  'Netherlands',
  'Japan',
  'South Korea',
  'Hong Kong',
];

const AUSTRALIAN_AND_GLOBAL_STATES = [
  'New South Wales',
  'Victoria',
  'Queensland',
  'Western Australia',
  'South Australia',
  'Tasmania',
  'Australian Capital Territory',
  'Northern Territory',
  'California',
  'New York',
  'Texas',
  'Washington',
  'Massachusetts',
  'Illinois',
  'Ontario',
  'British Columbia',
  'England',
  'Auckland',
];

interface CityRef {
  name: string;
  lat: number;
  lng: number;
  state?: string;
  country: string;
  dialing: string;
}

const MAJOR_CITIES: CityRef[] = [
  { name: 'Brisbane', lat: -27.4698, lng: 153.0251, state: 'Queensland', country: 'Australia', dialing: '+61' },
  { name: 'Sydney', lat: -33.8688, lng: 151.2093, state: 'New South Wales', country: 'Australia', dialing: '+61' },
  { name: 'Melbourne', lat: -37.8136, lng: 144.9631, state: 'Victoria', country: 'Australia', dialing: '+61' },
  { name: 'Perth', lat: -31.9505, lng: 115.8605, state: 'Western Australia', country: 'Australia', dialing: '+61' },
  { name: 'Adelaide', lat: -34.9285, lng: 138.6007, state: 'South Australia', country: 'Australia', dialing: '+61' },
  { name: 'Canberra', lat: -35.2809, lng: 149.13, state: 'Australian Capital Territory', country: 'Australia', dialing: '+61' },
  { name: 'Hobart', lat: -42.8821, lng: 147.3272, state: 'Tasmania', country: 'Australia', dialing: '+61' },
  { name: 'Gold Coast', lat: -28.0167, lng: 153.4, state: 'Queensland', country: 'Australia', dialing: '+61' },
  { name: 'Auckland', lat: -36.8485, lng: 174.7633, state: 'Auckland', country: 'New Zealand', dialing: '+64' },
  { name: 'San Francisco', lat: 37.7749, lng: -122.4194, state: 'California', country: 'United States', dialing: '+1' },
  { name: 'New York', lat: 40.7128, lng: -74.006, state: 'New York', country: 'United States', dialing: '+1' },
  { name: 'Seattle', lat: 47.6062, lng: -122.3321, state: 'Washington', country: 'United States', dialing: '+1' },
  { name: 'Los Angeles', lat: 34.0522, lng: -118.2437, state: 'California', country: 'United States', dialing: '+1' },
  { name: 'Chicago', lat: 41.8781, lng: -87.6298, state: 'Illinois', country: 'United States', dialing: '+1' },
  { name: 'Boston', lat: 42.3601, lng: -71.0589, state: 'Massachusetts', country: 'United States', dialing: '+1' },
  { name: 'Austin', lat: 30.2672, lng: -97.7431, state: 'Texas', country: 'United States', dialing: '+1' },
  { name: 'London', lat: 51.5074, lng: -0.1278, state: 'England', country: 'United Kingdom', dialing: '+44' },
  { name: 'Singapore', lat: 1.3521, lng: 103.8198, state: 'Singapore', country: 'Singapore', dialing: '+65' },
  { name: 'Toronto', lat: 43.6532, lng: -79.3832, state: 'Ontario', country: 'Canada', dialing: '+1' },
  { name: 'Vancouver', lat: 49.2827, lng: -123.1207, state: 'British Columbia', country: 'Canada', dialing: '+1' },
  { name: 'Tokyo', lat: 35.6762, lng: 139.6503, state: 'Tokyo', country: 'Japan', dialing: '+81' },
  { name: 'Hong Kong', lat: 22.3193, lng: 114.1694, state: 'Hong Kong', country: 'Hong Kong', dialing: '+852' },
  { name: 'Shanghai', lat: 31.2304, lng: 121.4737, state: 'Shanghai', country: 'China', dialing: '+86' },
  { name: 'Beijing', lat: 39.9042, lng: 116.4074, state: 'Beijing', country: 'China', dialing: '+86' },
  { name: 'Berlin', lat: 52.52, lng: 13.405, state: 'Berlin', country: 'Germany', dialing: '+49' },
  { name: 'Paris', lat: 48.8566, lng: 2.3522, state: 'Île-de-France', country: 'France', dialing: '+33' },
  { name: 'Amsterdam', lat: 52.3676, lng: 4.9041, state: 'North Holland', country: 'Netherlands', dialing: '+31' },
  { name: 'Dublin', lat: 53.3498, lng: -6.2603, state: 'Leinster', country: 'Ireland', dialing: '+353' },
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

interface ContactLocationSectionProps {
  values: {
    email?: string | null;
    phone_type?: string | null;
    phone_country_code?: string | null;
    phone_number?: string | null;
    street?: string | null;
    suburb?: string | null;
    city?: string | null;
    state?: string | null;
    postal_code?: string | null;
    country?: string | null;
    current_location?: string | null;
  };
  onChange: (key: string, value: string) => void;
}

export function ContactLocationSection({
  values,
  onChange,
}: ContactLocationSectionProps) {
  const [isDetecting, setIsDetecting] = useState(false);
  const [nearbyCities, setNearbyCities] = useState<CityRef[]>([]);

  const applyCityDetails = (cityObj: Partial<CityRef> & { city?: string; postcode?: string; suburb?: string }) => {
    if (cityObj.city) onChange('city', cityObj.city);
    if (cityObj.name && !cityObj.city) onChange('city', cityObj.name);
    if (cityObj.state) onChange('state', cityObj.state);
    if (cityObj.country) onChange('country', cityObj.country);
    if (cityObj.postcode) onChange('postal_code', cityObj.postcode);
    if (cityObj.suburb) onChange('suburb', cityObj.suburb);
    if (cityObj.dialing && !values.phone_country_code) onChange('phone_country_code', cityObj.dialing);

    const cityName = cityObj.city || cityObj.name || '';
    const stateName = cityObj.state || '';
    const countryName = cityObj.country || '';
    const summary = [cityName, stateName, countryName].filter(Boolean).join(', ');
    if (summary) onChange('current_location', summary);
  };

  const handleAutoDetectLocation = () => {
    setIsDetecting(true);

    const fallbackByTimezone = () => {
      try {
        const userTz = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
        let matched = MAJOR_CITIES.filter((c) => {
          if (userTz.includes('Australia')) return c.country === 'Australia';
          if (userTz.includes('Auckland')) return c.country === 'New Zealand';
          if (userTz.includes('America')) return c.country === 'United States' || c.country === 'Canada';
          if (userTz.includes('Europe')) return c.country === 'United Kingdom' || c.country === 'Germany';
          if (userTz.includes('Asia')) return c.country === 'Singapore' || c.country === 'Japan';
          return false;
        });

        if (matched.length === 0) {
          matched = MAJOR_CITIES.slice(0, 5);
        }

        setNearbyCities(matched.slice(0, 5));
        if (matched.length > 0) {
          applyCityDetails(matched[0]);
        }
      } finally {
        setIsDetecting(false);
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
        let detectedState = '';
        let detectedCountry = '';
        let detectedPostcode = '';
        let detectedSuburb = '';
        let detectedDialing = '';

        try {
          const res = await fetch(
            `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=en`,
          );
          if (res.ok) {
            const geoData = await res.json();
            detectedCity = geoData.city || geoData.locality || '';
            detectedSuburb = geoData.locality || '';
            detectedState = geoData.principalSubdivision || '';
            detectedCountry = geoData.countryName || '';
            detectedPostcode = geoData.postcode || '';

            if (geoData.countryCode === 'AU') detectedDialing = '+61';
            else if (['US', 'CA'].includes(geoData.countryCode)) detectedDialing = '+1';
            else if (geoData.countryCode === 'GB') detectedDialing = '+44';
            else if (geoData.countryCode === 'CN') detectedDialing = '+86';
            else if (geoData.countryCode === 'NZ') detectedDialing = '+64';
            else if (geoData.countryCode === 'SG') detectedDialing = '+65';
          }
        } catch {
          // ignore API error and fallback to sorted nearest city
        }

        const sorted = [...MAJOR_CITIES].sort(
          (a, b) =>
            getDistanceKm(latitude, longitude, a.lat, a.lng) -
            getDistanceKm(latitude, longitude, b.lat, b.lng),
        );

        const nearest = sorted[0];
        setNearbyCities(sorted.slice(0, 5));

        applyCityDetails({
          city: detectedCity || nearest.name,
          suburb: detectedSuburb,
          state: detectedState || nearest.state,
          country: detectedCountry || nearest.country,
          postcode: detectedPostcode,
          dialing: detectedDialing || nearest.dialing,
        });

        setIsDetecting(false);
      },
      (err) => {
        console.warn('Geolocation failed or denied, using timezone fallback', err);
        fallbackByTimezone();
      },
      { timeout: 8000, enableHighAccuracy: false },
    );
  };

  const autoDetectAction = (
    <button
      type='button'
      onClick={handleAutoDetectLocation}
      disabled={isDetecting}
      className='inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold text-primary hover:bg-primary/10 rounded-lg transition-colors cursor-pointer disabled:opacity-50 select-none'
    >
      <Navigation
        className={cn('w-3.5 h-3.5', isDetecting && 'animate-spin')}
      />
      <span>{isDetecting ? 'Detecting...' : 'Auto Detect'}</span>
    </button>
  );

  return (
    <ProfileSectionCard
      id='contact'
      title='Contact & Address'
      action={autoDetectAction}
    >
      <div className='flex flex-col gap-4'>
        {/* Contact Info Grid */}
        <div className='grid grid-cols-1 gap-3 sm:grid-cols-3'>
          <div className='sm:col-span-3'>
            <Field
              label='Email address'
              type='email'
              value={values.email || ''}
              placeholder='your.name@example.com'
              onChange={(val) => onChange('email', val)}
            />
          </div>

          <div className='sm:col-span-1'>
            <PillGroup
              label='Phone type'
              options={PHONE_TYPES}
              value={values.phone_type || 'Mobile'}
              onChange={(val) => onChange('phone_type', val)}
            />
          </div>

          <div className='sm:col-span-1'>
            <Select
              label='Country code'
              value={values.phone_country_code || '+61'}
              onChange={(e) => onChange('phone_country_code', e.target.value)}
            >
              <option value=''>Select country code</option>
              {values.phone_country_code &&
                !COUNTRY_DIALING_CODES.some(
                  (c) => c.code === values.phone_country_code,
                ) && (
                  <option value={values.phone_country_code}>
                    {values.phone_country_code}
                  </option>
                )}
              {COUNTRY_DIALING_CODES.map((item) => (
                <option key={item.code} value={item.code}>
                  {item.label}
                </option>
              ))}
            </Select>
          </div>

          <div className='sm:col-span-1'>
            <Field
              label='Phone number'
              type='tel'
              value={values.phone_number || ''}
              placeholder='0412 345 678'
              onChange={(val) => onChange('phone_number', val)}
            />
          </div>
        </div>

        {/* Address Grid */}
        <div className='grid grid-cols-1 gap-3 sm:grid-cols-3 pt-1'>
          <div className='sm:col-span-3'>
            <Field
              label='Street address'
              value={values.street || ''}
              placeholder='e.g. 123 George Street'
              onChange={(val) => onChange('street', val)}
            />
          </div>

          <div>
            <Field
              label='Suburb / District'
              value={values.suburb || ''}
              placeholder='e.g. Surry Hills'
              onChange={(val) => onChange('suburb', val)}
            />
          </div>

          <div>
            <Field
              label='City'
              value={values.city || ''}
              placeholder='e.g. Sydney'
              onChange={(val) => onChange('city', val)}
            />
          </div>

          <div>
            <Select
              label='State / province'
              value={values.state || ''}
              onChange={(e) => onChange('state', e.target.value)}
            >
              <option value=''>Select state...</option>
              {values.state &&
                !AUSTRALIAN_AND_GLOBAL_STATES.includes(values.state) && (
                  <option value={values.state}>{values.state}</option>
                )}
              {AUSTRALIAN_AND_GLOBAL_STATES.map((state) => (
                <option key={state} value={state}>
                  {state}
                </option>
              ))}
            </Select>
          </div>

          <div>
            <Field
              label='Postal code'
              value={values.postal_code || ''}
              placeholder='e.g. 2000'
              onChange={(val) => onChange('postal_code', val)}
            />
          </div>

          <div>
            <Select
              label='Country'
              value={values.country || 'Australia'}
              onChange={(e) => onChange('country', e.target.value)}
            >
              <option value=''>Select country...</option>
              {values.country &&
                !POPULAR_COUNTRIES.includes(values.country) && (
                  <option value={values.country}>{values.country}</option>
                )}
              {POPULAR_COUNTRIES.map((country) => (
                <option key={country} value={country}>
                  {country}
                </option>
              ))}
            </Select>
          </div>

          <div>
            <Field
              label='Current location (short)'
              value={values.current_location || ''}
              placeholder='e.g. Sydney, Australia'
              onChange={(val) => onChange('current_location', val)}
            />
          </div>
        </div>

        {/* Nearby Cities Suggestions (when detected) */}
        {nearbyCities.length > 0 && (
          <div className='flex flex-wrap items-center gap-1.5 pt-1'>
            <span className='text-[10px] text-ink-secondary/70 font-semibold mr-1'>
              Nearby suggestions:
            </span>
            {nearbyCities.map((city) => (
              <button
                key={city.name}
                type='button'
                onClick={() => applyCityDetails(city)}
                className='px-2 py-0.5 text-[11px] font-medium rounded-md bg-background-secondary/70 hover:bg-primary/15 hover:text-primary text-ink-secondary transition-colors cursor-pointer'
              >
                {city.name}
              </button>
            ))}
          </div>
        )}
      </div>
    </ProfileSectionCard>
  );
}
