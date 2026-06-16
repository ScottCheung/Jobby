/** @format */

'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { cn } from '@/lib/utils';
import { InView } from '@/components/animation';

interface CityData {
  name: string;
  value: number;
  [key: string]: any;
}

interface CityVectorMapProps {
  data: CityData[];
  nameKey?: string;
  valueKey?: string;
  className?: string;
}

// Coordinate lookup for common cities worldwide
const CITY_COORDINATES: Record<string, [number, number]> = {
  // US & Canada
  'san francisco': [37.7749, -122.4194],
  'san francisco bay area': [37.7749, -122.4194],
  'san francisco, ca': [37.7749, -122.4194],
  'san jose': [37.3382, -121.8863],
  'san jose, ca': [37.3382, -121.8863],
  sunnyvale: [37.3688, -122.0363],
  'sunnyvale, ca': [37.3688, -122.0363],
  'mountain view': [37.3861, -122.0839],
  'mountain view, ca': [37.3861, -122.0839],
  'palo alto': [37.4419, -122.143],
  'palo alto, ca': [37.4419, -122.143],
  oakland: [37.8044, -122.2712],
  'los angeles': [34.0522, -118.2437],
  'los angeles, ca': [34.0522, -118.2437],
  'san diego': [32.7157, -117.1611],
  'san diego, ca': [32.7157, -117.1611],
  seattle: [47.6062, -122.3321],
  'seattle, wa': [47.6062, -122.3321],
  'greater seattle area': [47.6062, -122.3321],
  redmond: [47.674, -122.1215],
  'redmond, wa': [47.674, -122.1215],
  bellevue: [47.6101, -122.2015],
  'bellevue, wa': [47.6101, -122.2015],
  portland: [45.5152, -122.6784],
  'portland, or': [45.5152, -122.6784],
  denver: [39.7392, -104.9903],
  'denver, co': [39.7392, -104.9903],
  phoenix: [33.4484, -112.074],
  'phoenix, az': [33.4484, -112.074],
  'salt lake city': [40.7608, -111.891],
  austin: [30.2672, -97.7431],
  'austin, tx': [30.2672, -97.7431],
  houston: [29.7604, -95.3698],
  dallas: [32.7767, -96.797],
  'dallas, tx': [32.7767, -96.797],
  chicago: [41.8781, -87.6298],
  'chicago, il': [41.8781, -87.6298],
  detroit: [42.3314, -83.0458],
  minneapolis: [44.9778, -93.265],
  columbus: [39.9612, -82.9988],
  boston: [42.3601, -71.0589],
  'boston, ma': [42.3601, -71.0589],
  'new york': [40.7128, -74.006],
  'new york city': [40.7128, -74.006],
  'new york, ny': [40.7128, -74.006],
  philadelphia: [39.9526, -75.1652],
  washington: [38.9072, -77.0369],
  'washington, dc': [38.9072, -77.0369],
  atlanta: [33.749, -84.388],
  'atlanta, ga': [33.749, -84.388],
  miami: [25.7617, -80.1918],
  nashville: [36.1627, -86.7816],
  toronto: [43.6532, -79.3832],
  'toronto, on': [43.6532, -79.3832],
  vancouver: [49.2827, -123.1207],
  'vancouver, bc': [49.2827, -123.1207],
  montreal: [45.5017, -73.5673],
  ottawa: [45.4215, -75.6972],
  calgary: [51.0447, -114.0719],

  // Europe
  london: [51.5074, -0.1278],
  manchester: [53.4808, -2.2426],
  dublin: [53.3498, -6.2603],
  paris: [48.8566, 2.3522],
  amsterdam: [52.3676, 4.9041],
  brussels: [50.8503, 4.3517],
  berlin: [52.52, 13.405],
  munich: [48.1351, 11.582],
  frankfurt: [50.1109, 8.6821],
  zurich: [47.3769, 8.5417],
  geneva: [46.2044, 6.1432],
  vienna: [48.2082, 16.3738],
  madrid: [40.4168, -3.7038],
  barcelona: [41.3851, 2.1734],
  lisbon: [38.7223, -9.1393],
  milan: [45.4642, 9.19],
  rome: [41.9028, 12.4964],
  copenhagen: [55.6761, 12.5683],
  stockholm: [59.3293, 18.0686],
  oslo: [59.9139, 10.7522],
  helsinki: [60.1699, 24.9384],

  // Asia Pacific & Others
  sydney: [-33.8688, 151.2093],
  'sydney, nsw': [-33.8688, 151.2093],
  melbourne: [-37.8136, 144.9631],
  'melbourne, vic': [-37.8136, 144.9631],
  brisbane: [-27.4705, 153.026],
  perth: [-31.9505, 115.8605],
  auckland: [-36.8485, 174.7633],
  singapore: [1.3521, 103.8198],
  tokyo: [35.6762, 139.6503],
  seoul: [37.5665, 126.978],
  beijing: [39.9042, 116.4074],
  shanghai: [31.2304, 121.4737],
  shenzhen: [22.5431, 114.0579],
  'hong kong': [22.3193, 114.1694],
  taipei: [25.033, 121.5654],
  bangalore: [12.9716, 77.5946],
  bengaluru: [12.9716, 77.5946],
  hyderabad: [17.385, 78.4867],
  mumbai: [19.076, 72.8777],
  'new delhi': [28.6139, 77.209],
};

function getCoordinatesForCity(cityName: string): [number, number] | null {
  const clean = cityName.toLowerCase().trim();
  if (CITY_COORDINATES[clean]) return CITY_COORDINATES[clean];

  // Try parsing out state/country suffixes (e.g., "Austin, TX" -> "austin")
  const parts = clean.split(',');
  const nameOnly = parts[0].trim();
  if (CITY_COORDINATES[nameOnly]) return CITY_COORDINATES[nameOnly];

  // Partial match search
  for (const key of Object.keys(CITY_COORDINATES)) {
    if (key.includes(nameOnly) || nameOnly.includes(key)) {
      return CITY_COORDINATES[key];
    }
  }

  return null;
}

// Map dimensions
const W = 800;
const H = 400;

// Equirectangular Projection
const project = (lng: number, lat: number): [number, number] => {
  const x = (lng + 180) * (W / 360);
  const y = (90 - lat) * (H / 180);
  return [x, y];
};

export function CityVectorMap({
  data,
  nameKey = 'name',
  valueKey = 'value',
  className,
}: CityVectorMapProps) {
  const [geoJson, setGeoJson] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [hoveredCity, setHoveredCity] = useState<any | null>(null);
  const [shouldZoom, setShouldZoom] = useState(false);

  // Fetch low-res world GeoJSON
  useEffect(() => {
    fetch('/world-lowres.json')
      .then((res) => {
        if (!res.ok) throw new Error('Failed to load map data');
        return res.json();
      })
      .then((json) => {
        setGeoJson(json);
        setLoading(false);
      })
      .catch((err) => {
        console.error(err);
        setLoading(false);
      });
  }, []);

  // Delay zoom animation to trigger after the card fades/slides in
  useEffect(() => {
    if (!loading) {
      const timer = setTimeout(() => {
        setShouldZoom(true);
      }, 600);
      return () => clearTimeout(timer);
    }
  }, [loading]);

  // Filter and map coordinates to cities
  const cities = useMemo(() => {
    if (!data) return [];
    return data
      .map((item) => {
        const name = String(item[nameKey] ?? '');
        const val = Number(item[valueKey] ?? 0);

        // Skip generic labels
        if (
          !name ||
          name.toLowerCase().includes('remote') ||
          name.toLowerCase() === 'unknown' ||
          name.toLowerCase() === 'united states' ||
          name.toLowerCase() === 'canada'
        ) {
          return null;
        }

        const coords = getCoordinatesForCity(name);
        if (!coords) return null;

        const [x, y] = project(coords[1], coords[0]);
        return {
          ...item,
          name,
          value: val,
          x,
          y,
          lat: coords[0],
          lng: coords[1],
        };
      })
      .filter(Boolean) as Array<
      CityData & { x: number; y: number; lat: number; lng: number }
    >;
  }, [data, nameKey, valueKey]);

  // Convert GeoJSON polygon structures to SVG path strings
  const mapPaths = useMemo(() => {
    if (!geoJson || !geoJson.features) return [];

    return geoJson.features.map((feature: any, idx: number) => {
      const { geometry, properties } = feature;
      let d = '';

      if (geometry.type === 'Polygon') {
        d = geometry.coordinates
          .map((ring: any[]) => {
            return (
              'M' +
              ring
                .map((coord) => {
                  const [x, y] = project(coord[0], coord[1]);
                  return `${x.toFixed(1)},${y.toFixed(1)}`;
                })
                .join(' L') +
              ' Z'
            );
          })
          .join(' ');
      } else if (geometry.type === 'MultiPolygon') {
        d = geometry.coordinates
          .map((polygon: any[][]) => {
            return polygon
              .map((ring: any[]) => {
                const [first, ...rest] = ring;
                const [fx, fy] = project(first[0], first[1]);
                return (
                  `M${fx.toFixed(1)},${fy.toFixed(1)}` +
                  rest
                    .map((coord) => {
                      const [x, y] = project(coord[0], coord[1]);
                      return `L${x.toFixed(1)},${y.toFixed(1)}`;
                    })
                    .join('') +
                  ' Z'
                );
              })
              .join(' ');
          })
          .join(' ');
      }

      return {
        id: feature.id || idx,
        name: properties?.name || '',
        d,
      };
    });
  }, [geoJson]);

  // Calculate bounding box and transformation matrix for zoom & scale
  const { scale, translateX, translateY } = useMemo(() => {
    if (cities.length === 0) {
      // Default world view
      return { scale: 1, translateX: 0, translateY: 0 };
    }

    const xs = cities.map((c) => c.x);
    const ys = cities.map((c) => c.y);

    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);

    const targetW = maxX - minX;
    const targetH = maxY - minY;

    // Standard centered points
    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;

    if (cities.length === 1 || (targetW < 10 && targetH < 10)) {
      // Single city view - zoom in closely but reasonably
      const targetScale = 3.5;
      const tx = W / 2 - centerX * targetScale;
      const ty = H / 2 - centerY * targetScale;
      return { scale: targetScale, translateX: tx, translateY: ty };
    }

    // Multiple cities view - scale to fit bounding box with comfortable padding
    const paddedW = Math.max(targetW * 1.5, 120);
    const paddedH = Math.max(targetH * 1.5, 80);

    const scaleX = W / paddedW;
    const scaleY = H / paddedH;
    let targetScale = Math.min(scaleX, scaleY);

    // Bound scale factors between 1.0 (world view) and 5.0 (maximum zoom-in)
    targetScale = Math.min(Math.max(targetScale, 1.1), 5);

    const tx = W / 2 - centerX * targetScale;
    const ty = H / 2 - centerY * targetScale;

    return {
      scale: targetScale,
      translateX: tx,
      translateY: ty,
    };
  }, [cities]);

  const currentScale = shouldZoom ? scale : 1;
  const currentTranslateX = shouldZoom ? translateX : 0;
  const currentTranslateY = shouldZoom ? translateY : 0;

  if (loading) {
    return (
      <div className='flex h-full min-h-[16rem] w-full items-center justify-center text-zinc-500'>
        Loading map outline...
      </div>
    );
  }

  return (
    <div className={cn('relative w-full h-full flex flex-col', className)}>
      {/* SVG Canvas */}
      <div className='flex-1 w-full h-60  relative'>
        <svg viewBox={`0 0 ${W} ${H}`} className='w-full h-full select-none'>
          {/* Transforming group to automatically center and zoom the vector map */}
          <g
            transform={`translate(${currentTranslateX}, ${currentTranslateY}) scale(${currentScale})`}
            style={{
              transition: 'transform 8s cubic-bezier(0.25, 1, 0.5, 1)',
              transformOrigin: '0 0',
            }}
          >
            {/* World Landmass Boundaries */}
            {mapPaths.map(
              (path: { id: string | number; name: string; d: string }) => (
                <path
                  key={path.id}
                  d={path.d}
                  className='fill-zinc-200/50 dark:fill-zinc-800/40 stroke-zinc-300/30 dark:stroke-zinc-700/20 hover:fill-zinc-200 dark:hover:fill-zinc-800 transition-colors'
                >
                  <title>{path.name}</title>
                </path>
              ),
            )}

            {/* City Markers */}
            {cities.map((city, index) => {
              // Scale bubble/dot size relative to city value
              const maxVal = Math.max(...cities.map((c) => c.value), 1);
              const bubbleRadius = 5 + (city.value / maxVal) * 8;

              return (
                <g
                  key={index}
                  transform={`translate(${city.x}, ${city.y})`}
                  className='cursor-pointer group '
                  onMouseEnter={() => setHoveredCity(city)}
                  onMouseLeave={() => setHoveredCity(null)}
                >
                  {/* Glowing Pulse Ring */}
                  <circle
                    r={bubbleRadius}
                    className='fill-primary/10  stroke-primary/30 animate-ping'
                    style={{ animationDuration: '3s' }}
                  />
                  {/* Bubble Base */}
                  <circle
                    r={bubbleRadius}
                    className='fill-primary/10  stroke-white dark:stroke-zinc-900 stroke-1 group-hover:opacity-100 opacity-10  transition-colors'
                  />
                  {/* Tiny center core dot */}
                  <circle r={1} className='fill-primary' />
                </g>
              );
            })}
          </g>
        </svg>

        {/* Hover City Tooltip */}
        {hoveredCity && (
          <div className='absolute z-10 bg-zinc-900/90 dark:bg-zinc-950/95 text-white p-2 rounded-lg text-xs shadow-md border border-zinc-700/50 pointer-events-none transition-opacity duration-200 flex flex-col font-sans'>
            <span className='font-bold truncate'>{hoveredCity.name}</span>
            <span className='text-emerald-400 mt-0.5'>
              {hoveredCity.value}{' '}
              {hoveredCity.value === 1 ? 'application' : 'applications'}
            </span>
          </div>
        )}
      </div>

      {/* Footer Info Display */}
      {cities.length > 0 && (
        <div className=' flex flex-wrap gap-4 items-center text-xs text-zinc-500 dark:text-zinc-400 shrink-0 font-medium'>
          {cities.slice(0, 3).map((city, idx) => (
            <span key={idx} className='flex items-center gap-1'>
              <span className='w-1.5 h-1.5 rounded-full bg-emerald-500' />
              {city.name} ({city.value})
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
