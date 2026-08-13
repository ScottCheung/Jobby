'use client';
/** @format */

import { useState, useId } from 'react';
import {
  Cell,
  Pie,
  PieChart as RechartsPieChart,
  ResponsiveContainer,
  Tooltip,
  Legend,
} from 'recharts';
import { ChartTooltip } from './Tooltip';

interface PieChartProps {
  data: any[];
  xKey: string;
  yKey?: string;
  title?: string;
  color?: string;
  multiColor?: boolean;
  showGrid?: boolean; // 是否显示网格线
  showValues?: boolean; // 是否显示值
  showLegend?: boolean;
  customTooltip?: React.ReactElement | ((props: any) => React.ReactElement);
  cx?: string | number;
  cy?: string | number;
  innerRadius?: string | number;
  outerRadius?: string | number;
  showLabels?: boolean;
  ValueProps?: any;
  margin?: { top?: number; right?: number; bottom?: number; left?: number };
  cornerRadius?: number;
  paddingAngle?: number;
  gradientFill?: boolean;
  pieGradients?: Record<string, { start: string; end: string }>;
}

// Modern color palette with bright, accessible colors
const COLORS = [
  '#3b82f6', // Blue
  '#10b981', // Green
  '#f59e0b', // Amber
  '#ec4899', // Pink
  '#8b5cf6', // Purple
  '#06b6d4', // Cyan
  '#f43f5e', // Rose
  '#84cc16', // Lime
  '#fb7185', // Light Rose
  '#60a5fa', // Light Blue
  '#a78bfa', // Light Purple
  '#34d399', // Light Green
];

// Helper to shift color brightness for dynamic gradients
const adjustColorBrightness = (hex: string, percent: number): string => {
  if (!hex || typeof hex !== 'string' || !hex.startsWith('#')) {
    return hex;
  }
  let color = hex.substring(1);
  if (color.length === 3) {
    color = color
      .split('')
      .map((char) => char + char)
      .join('');
  }
  const num = parseInt(color, 16);
  if (isNaN(num)) return hex;
  const amt = Math.round(2.55 * percent);
  let r = (num >> 16) + amt;
  let g = ((num >> 8) & 0x00ff) + amt;
  let b = (num & 0x0000ff) + amt;
  r = Math.min(255, Math.max(0, r));
  g = Math.min(255, Math.max(0, g));
  b = Math.min(255, Math.max(0, b));
  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
};

export const DEFAULT_STATUS_GRADIENTS: Record<
  string,
  { start: string; end: string }
> = {
  Submitted: { start: '#10b981', end: '#9ac4d8' },
  Skipped: { start: '#f59e0b', end: '#f7d455' },
  Pending: { start: '#3b82f6', end: '#8b5cf6' },
  'Processing...': { start: '#ef4444', end: '#fb7185' },
  Other: { start: '#71717a', end: '#9ca3af' },
  _: { start: '#71717a', end: '#9ca3af' },
};

// Generic gradient resolver based on color or name
const getGradientColors = (
  baseColor: string,
  name: string,
  pieGradients?: Record<string, { start: string; end: string }>,
): { start: string; end: string } => {
  // 1. Check if there is a custom gradient by status name
  if (pieGradients && pieGradients[name]) {
    return pieGradients[name];
  }

  // 2. Standard status gradients by status name (case-insensitive & partial match)
  const nameKey = name.toLowerCase();
  const statusGradients: Record<string, { start: string; end: string }> = {
    submitted: { start: '#10b981', end: '#9ac4d8' },
    skipped: { start: '#f59e0b', end: '#f7d455' },
    pending: { start: '#3b82f6', end: '#8b5cf6' },
    cancelled: { start: '#ef4444', end: '#fb7185' },
    processing: { start: '#3b82f6', end: '#8b5cf6' },
    other: { start: '#71717a', end: '#9ca3af' },
  };

  for (const key of Object.keys(statusGradients)) {
    if (nameKey.includes(key)) {
      return statusGradients[key];
    }
  }

  // 3. Match by baseColor hex (case-insensitive)
  const colorKey = baseColor.toLowerCase();
  const colorGradients: Record<string, { start: string; end: string }> = {
    '#10b981': { start: '#10b981', end: '#9ac4d8' }, // Green
    '#f59e0b': { start: '#f59e0b', end: '#f7d455' }, // Amber
    '#3b82f6': { start: '#3b82f6', end: '#8b5cf6' }, // Blue
    '#ef4444': { start: '#ef4444', end: '#fb7185' }, // Red
    '#71717a': { start: '#71717a', end: '#9ca3af' }, // Gray
  };

  if (colorGradients[colorKey]) {
    return colorGradients[colorKey];
  }

  // 4. General fallback: dynamically generate a beautiful gradient
  // Shift brightness positive for lighter, softer gradient end-color
  return {
    start: baseColor,
    end: adjustColorBrightness(baseColor, 20),
  };
};

const renderCustomizedLabel = ({
  cx,
  cy,
  midAngle,
  innerRadius,
  outerRadius,
  percent,
  name,
  index,
}: any) => {
  const RADIAN = Math.PI / 180;
  const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);

  if (percent > 0.05) {
    return (
      <text
        x={x}
        y={y}
        fill='var(--color-ink-primary)'
        textAnchor={x > cx ? 'start' : 'end'}
        dominantBaseline='central'
        className='label-sm'
        stroke='var(--color-background)'
        strokeWidth='3'
        paintOrder='stroke'
      >
        {`${(percent * 100).toFixed(0)}%`}
      </text>
    );
  }
  return null;
};

const PieChart = ({
  data,
  xKey,
  yKey,
  title,
  color,
  multiColor = true,
  showGrid = true,
  showValues = true,
  showLegend = true,
  customTooltip,
  cx = '50%',
  cy = '50%',
  innerRadius = '50%',
  outerRadius = '80%',
  showLabels = true,
  ValueProps,
  margin = { top: 0, right: 0, bottom: 0, left: 0 },
  cornerRadius = 999,
  paddingAngle = 2,
  gradientFill = false,
  pieGradients,
}: PieChartProps) => {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const uniqueId = useId().replace(/:/g, ''); // Unique ID for SVG definitions to avoid collisions

  // Safety check
  if (!data || data.length === 0) {
    return null;
  }

  return (
    <ResponsiveContainer width='100%' height='100%'>
      <RechartsPieChart margin={margin}>
        {gradientFill && (
          <defs>
            {data.map((entry, index) => {
              const baseColor =
                entry.fill ||
                (multiColor ?
                  COLORS[index % COLORS.length]
                : color || '#3b82f6');

              const name = String(entry[xKey] || entry.name || '');
              const { start: startColor, end: endColor } = getGradientColors(
                baseColor,
                name,
                pieGradients,
              );

              return (
                <linearGradient
                  id={`pie-grad-${uniqueId}-${index}`}
                  key={index}
                  x1='0'
                  y1='0'
                  x2='1'
                  y2='1'
                >
                  <stop
                    offset='0%'
                    stopColor={startColor}
                    style={{ stopColor: startColor }}
                  />
                  <stop
                    offset='100%'
                    stopColor={endColor}
                    style={{ stopColor: endColor }}
                  />
                </linearGradient>
              );
            })}
          </defs>
        )}
        {/* Invisible full Pie underneath to capture hover events in the center of the ring */}
        <Pie
          data={data}
          cx={cx}
          cy={cy}
          nameKey={xKey}
          dataKey={yKey as string}
          outerRadius={outerRadius}
          innerRadius={0}
          stroke='none'
          style={{ pointerEvents: 'all' }}
          legendType='none'
          label={false}
          isAnimationActive={false}
          activeShape={false}
          onMouseEnter={(data, index) => setActiveIndex(index)}
          onMouseLeave={() => setActiveIndex(null)}
        >
          {data.map((entry, index) => (
            <Cell
              key={`invisible-cell-${index}`}
              fill='none'
              stroke='none'
              style={{ pointerEvents: 'all' }}
            />
          ))}
        </Pie>
        <Pie
          data={data}
          cx={cx}
          cy={cy}
          labelLine={false}
          nameKey={xKey}
          dataKey={yKey as string}
          outerRadius={outerRadius}
          innerRadius={innerRadius}
          label={showLabels ? renderCustomizedLabel : undefined}
          paddingAngle={paddingAngle}
          cornerRadius={cornerRadius}
          animationDuration={1000}
          animationBegin={0}
          isAnimationActive={true}
          fill={multiColor ? undefined : color}
          onMouseEnter={(data, index) => setActiveIndex(index)}
          onMouseLeave={() => setActiveIndex(null)}
        >
          {data.map((entry, index) => (
            <Cell
              key={`cell-${index}`}
              fill={
                gradientFill ?
                  `url(#pie-grad-${uniqueId}-${index})`
                : entry.fill ||
                  (multiColor ? COLORS[index % COLORS.length] : color)
              }
              stroke='var(--background)'
              strokeWidth={1}
              style={{
                transition: 'opacity 1000ms cubic-bezier(0.2, 0.8, 0.2, 1)',
              }}
              opacity={activeIndex === null || activeIndex === index ? 1 : 0.4}
            />
          ))}
        </Pie>
        <Tooltip
          content={<ChartTooltip ValueProps={ValueProps} />}
          cursor={false}
        />
        {showLegend && (
          <Legend
            verticalAlign='bottom'
            height={44}
            content={<CustomLegend />}
          />
        )}
      </RechartsPieChart>
    </ResponsiveContainer>
  );
};

const CustomLegend = (props: any) => {
  const { payload } = props;
  if (!payload) return null;

  return (
    <div className='label-sm flex flex-wrap items-center gap-3 justify-center mt-5'>
      {payload.map((entry: any, index: number) => {
        const { value, color } = entry;
        return (
          <div
            key={`legend-item-${index}`}
            className='flex items-center gap-2 px-2 py-1 rounded-full transition-all cursor-default bg-linear-to-r from-background to-transparent'
          >
            <svg className='w-3 h-3' viewBox='0 0 12 12'>
              <circle cx='6' cy='6' r='6' fill={color} />
            </svg>
            <span className='capitalize tracking-wide'>{value}</span>
          </div>
        );
      })}
    </div>
  );
};

export default PieChart;
