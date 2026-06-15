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
        fill='white'
        textAnchor={x > cx ? 'start' : 'end'}
        dominantBaseline='central'
        className='text-xs font-medium'
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
}: PieChartProps) => {
  // Safety check
  if (!data || data.length === 0) {
    return (
      <div className='flex h-full w-full items-center justify-center text-muted-foreground'>
        No data available
      </div>
    );
  }

  return (
    <ResponsiveContainer
      width='100%'
      height='100%'
    >
      <RechartsPieChart>
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
          paddingAngle={2}
          animationDuration={1000}
          animationBegin={0}
          isAnimationActive={true}
          fill={multiColor ? undefined : color}
        >
          {data.map((entry, index) => (
            <Cell
              key={`cell-${index}`}
              fill={
                entry.fill ||
                (multiColor ? COLORS[index % COLORS.length] : color)
              }
              stroke='var(--background)'
              strokeWidth={1}
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
