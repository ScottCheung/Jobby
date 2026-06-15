import {
  Bar,
  CartesianGrid,
  Cell,
  BarChart as RechartsBarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { ChartTooltip } from './Tooltip';

interface BarChartProps {
  title?: string;
  data: any[];
  xKey: string;
  yKey?: string; // Optional, but Chart.tsx ensures it for single series bar
  color?: string;
  multiColor?: boolean;
  showXAxis?: boolean; // 是否显示X轴
  showYAxis?: boolean; // 是否显示Y轴
  showValues?: boolean; // 是否显示值
  showGridX?: boolean; // 是否显示X轴网格线
  showGridY?: boolean; // 是否显示Y轴网格线
  gridType?: 'horizontal' | 'vertical' | 'both'; // 网格线类型
  isShortFormat?: boolean;
  ValueProps?: any;
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

// Handle multi-series bar charts
const generateMultiBars = (data: any[], xKey: string) => {
  if (!data || data.length === 0) return null;
  // Ensure data[0] exists before trying to get its keys
  const firstItem = data[0] || {};
  const keys = Object.keys(firstItem).filter((key) => {
    return key !== xKey && typeof firstItem[key] === 'number';
  });
  return keys.map((key, index) => (
    <Bar
      key={key}
      dataKey={key}
      name={key}
      fill={COLORS[index % COLORS.length]}
      radius={[9, 9, 9, 9]}
      animationDuration={1000}
      animationBegin={index * 100}
      isAnimationActive={true}
    />
  ));
};

const BarChart = ({
  data,
  xKey,
  yKey,
  title,
  color = '#3b82f6',
  multiColor = true,
  showXAxis = true,
  showYAxis = false,
  showValues = true,
  showGridX = false,
  showGridY = false,
  gridType = 'both',
  ValueProps,
}: BarChartProps) => {
  const firstItem = data && data.length > 0 ? data[0] : {};
  const hasMultipleSeries =
    Object.keys(firstItem || {}).filter(
      (key) => key !== xKey && typeof firstItem[key] === 'number',
    ).length > 1;

  if (!data || data.length === 0 || !xKey || (!hasMultipleSeries && !yKey)) {
    return (
      <div className='flex h-full w-full items-center justify-center text-muted-foreground'>
        BarChart: No data or missing key properties (xKey, and yKey if not
        multi-series).
      </div>
    );
  }

  return (
    <ResponsiveContainer
      width='100%'
      height='100%'
    >
      <RechartsBarChart data={data}>
        {showGridX && (
          <CartesianGrid
            strokeDasharray='3 3'
            className='stroke-muted-foreground/20'
            vertical={gridType === 'both' || gridType === 'vertical'}
            horizontal={false}
          />
        )}
        {showGridY && (
          <CartesianGrid
            strokeDasharray='3 3'
            className='stroke-muted-foreground/20'
            vertical={false}
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
            domain={[
              (dataMin: number) => Math.floor(dataMin * 0.7),
              (dataMax: number) => Math.ceil(dataMax * 1.1),
            ]}
          />
        )}
        <Tooltip
          content={<ChartTooltip ValueProps={ValueProps} />}
          cursor={{
            fill: 'var(--muted-foreground)',
            fillOpacity: 0.05,
          }}
        />
        {hasMultipleSeries && multiColor ? (
          generateMultiBars(data, xKey)
        ) : (
          <Bar
            dataKey={yKey as string}
            name={yKey as string}
            fill={multiColor ? undefined : color}
            radius={[999, 999, 999, 999]}
            animationDuration={1000}
            isAnimationActive={true}
          >
            {!hasMultipleSeries &&
              multiColor &&
              data.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={COLORS[index % COLORS.length]}
                  strokeWidth={0}
                />
              ))}
          </Bar>
        )}
      </RechartsBarChart>
    </ResponsiveContainer>
  );
};

export default BarChart;
