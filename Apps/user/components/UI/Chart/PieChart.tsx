/** @format */

import { useState } from 'react';
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

export const DEFAULT_STATUS_GRADIENTS: Record<
  string,
  { start: string; end: string }
> = {
  Submitted: { start: '#10b981', end: '#9ac4d8' },
  Skipped: { start: '#f59e0b', end: '#f7d455' },
  Pending: { start: '#3b82f6', end: '#8b5cf6' },
  Cancelled: { start: '#ef4444', end: '#fb7185' },
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
        fill='var(--color-ink-secondary)'
        textAnchor={x > cx ? 'start' : 'end'}
        dominantBaseline='central'
        className='text-xs font-bold'
        stroke='var(--color-panel)'
        strokeWidth='4'
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
  cornerRadius = 0,
  paddingAngle = 2,
  gradientFill = false,
  pieGradients,
}: PieChartProps) => {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

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

              const activeGradients = {
                ...DEFAULT_STATUS_GRADIENTS,
                ...pieGradients,
              };
              const name = String(entry[xKey] || entry.name || '');
              const customGrad = activeGradients[name];

              let startColor =
                entry.colorStart || (customGrad ? customGrad.start : baseColor);
              let endColor =
                entry.colorEnd ||
                (customGrad ?
                  customGrad.end
                : `color-mix(in srgb, ${baseColor} 75%, black 25%)`);

              return (
                <linearGradient
                  id={`pie-grad-${index}`}
                  key={index}
                  x1='0'
                  y1='0'
                  x2='1'
                  y2='1'
                >
                  <stop offset='0%' stopColor={startColor} />
                  <stop offset='100%' stopColor={endColor} />
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
                  `url(#pie-grad-${index})`
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
            height={36}
            iconSize={10}
            wrapperStyle={{ fontSize: '12px' }}
          />
        )}
      </RechartsPieChart>
    </ResponsiveContainer>
  );
};

export default PieChart;
