import {
  Area,
  CartesianGrid,
  AreaChart as RechartsAreaChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Legend,
  type AreaProps as RechartsAreaProps,
} from 'recharts';
import { ChartTooltip } from './Tooltip';

interface AreaChartProps {
  data: any[];
  xKey: string;
  yKey?: string;
  title?: string;
  color?: string;
  multiColor?: boolean;
  showXAxis?: boolean; // 是否显示X轴
  showYAxis?: boolean; // 是否显示Y轴
  showValues?: boolean; // 是否显示值
  showGrid?: boolean; // 是否显示网格线
  gridType?: 'horizontal' | 'vertical' | 'both'; // 网格线类型
  interpolationType?: RechartsAreaProps['type'];
  showLegend?: boolean;
  stacked?: boolean;
  stackOffset?: 'expand' | 'none' | 'silhouette' | 'wiggle';
  showDots?: boolean | 'visible' | 'hidden' | object;
  gradientFill?: boolean;
  yKeys?: string[];
  ValueProps?: any;
}

// Modern color palette
const COLORS = [
  '#3b82f6', // Blue
  '#10b981', // Green
  '#f59e0b', // Amber
  '#ec4899', // Pink
  '#8b5cf6', // Purple
  '#06b6d4', // Cyan
  '#f43f5e', // Rose
  '#84cc16', // Lime
];

// Create multiple areas for different data series
const generateMultiAreas = (data: any[], xKey: string) => {
  // Safety check
  if (!data || data.length === 0) return null;

  // Get all numeric data keys (exclude the xKey)
  const keys = Object.keys(data[0] || {}).filter((key) => {
    return key !== xKey && typeof data[0][key] === 'number';
  });

  return keys.map((key, index) => {
    const color = COLORS[index % COLORS.length];
    return (
      <Area
        key={key}
        type='monotone'
        dataKey={key}
        name={key}
        stroke={color}
        fill={color}
        fillOpacity={0.3}
        stackId='1'
        dot={{
          strokeWidth: 2,
          stroke: color,
          fill: color,
          r: 4,
        }}
        activeDot={{ r: 6 }}
        animationDuration={1000}
        animationBegin={index * 100}
        isAnimationActive={true}
      />
    );
  });
};

const AreaChart = ({
  data,
  xKey,
  yKey,
  yKeys,
  title,
  color = '#3b82f6',
  multiColor = true,
  showXAxis = true,
  showYAxis = true,
  showValues = true,
  showGrid = true,
  gridType = 'both',
  interpolationType = 'monotone',
  showLegend = false,
  stacked = false,
  stackOffset = 'none',
  showDots = 'hidden',
  gradientFill = false,
  ValueProps,
}: AreaChartProps) => {
  const seriesKeys =
    yKeys && yKeys.length > 0
      ? yKeys
      : yKey
      ? [yKey]
      : data && data.length > 0
      ? Object.keys(data[0] || {}).filter(
          (k) => k !== xKey && typeof data[0][k] === 'number',
        )
      : [];

  if (seriesKeys.length === 0) {
    return (
      <div className='flex h-full w-full items-center justify-center text-muted-foreground'>
        AreaChart: No yKey/yKeys provided or auto-detection failed.
      </div>
    );
  }

  const currentStackOffset: AreaChartProps['stackOffset'] | 'none' =
    stackOffset || 'none';
  const hasMultipleSeries = seriesKeys.length > 1;

  const renderAreas = () => {
    return seriesKeys.map((key, index) => {
      const seriesColor = hasMultipleSeries
        ? COLORS[index % COLORS.length]
        : color;
      const fillId = gradientFill ? `gradient-${key}` : undefined;

      let resolvedShowDots: boolean | object = false;
      if (showDots === 'visible') {
        resolvedShowDots = {
          strokeWidth: 2,
          stroke: seriesColor,
          fill: seriesColor,
          r: 4,
        };
      } else if (typeof showDots === 'object') {
        resolvedShowDots = showDots;
      }

      return (
        <Area
          key={key}
          type={interpolationType}
          dataKey={key}
          name={key}
          stroke={seriesColor}
          fill={gradientFill ? `url(#${fillId})` : seriesColor}
          fillOpacity={gradientFill ? 1 : 0.3}
          stackId={stacked || currentStackOffset !== 'none' ? '1' : undefined}
          dot={resolvedShowDots}
          activeDot={{ r: 6, stroke: seriesColor, fill: seriesColor }}
          animationDuration={1000}
          animationBegin={index * 100}
          isAnimationActive={true}
        />
      );
    });
  };

  return (
    <ResponsiveContainer
      width='100%'
      height='100%'
    >
      <RechartsAreaChart
        data={data}
        stackOffset={
          currentStackOffset !== 'none' ? currentStackOffset : undefined
        }
      >
        {gradientFill && seriesKeys.length > 0 && (
          <defs>
            {seriesKeys.map((key, index) => {
              const seriesColor = hasMultipleSeries
                ? COLORS[index % COLORS.length]
                : color;
              return (
                <linearGradient
                  key={`gradient-def-${key}`}
                  id={`gradient-${key}`}
                  x1='0'
                  y1='0'
                  x2='0'
                  y2='1'
                >
                  <stop
                    offset='5%'
                    stopColor={seriesColor}
                    stopOpacity={0.8}
                  />
                  <stop
                    offset='95%'
                    stopColor={seriesColor}
                    stopOpacity={0.1}
                  />
                </linearGradient>
              );
            })}
          </defs>
        )}
        {showGrid && (
          <CartesianGrid
            strokeDasharray='3 3'
            className='stroke-muted-foreground/20'
            vertical={gridType === 'both' || gridType === 'vertical'}
            horizontal={gridType === 'both' || gridType === 'horizontal'}
          />
        )}
        {showXAxis && (
          <XAxis
            dataKey={xKey}
            className='text-xs text-muted-foreground'
            tickLine={false}
            axisLine={false}
            tick={{ fill: 'var(--muted-foreground)' }}
          />
        )}
        {showYAxis && (
          <YAxis
            className='text-xs text-muted-foreground'
            tickLine={false}
            axisLine={false}
            tick={{ fill: 'var(--muted-foreground)' }}
            domain={
              (currentStackOffset as AreaChartProps['stackOffset']) === 'expand'
                ? [0, 1]
                : undefined
            }
            tickFormatter={
              (currentStackOffset as AreaChartProps['stackOffset']) === 'expand'
                ? (value) => `${value * 100}%`
                : undefined
            }
          />
        )}
        <Tooltip
          content={<ChartTooltip ValueProps={ValueProps} />}
          cursor={false}
        />
        {showLegend && <Legend wrapperStyle={{ paddingTop: '20px' }} />}

        {renderAreas()}
      </RechartsAreaChart>
    </ResponsiveContainer>
  );
};

export default AreaChart;
