import {
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart as RechartsRadarChart,
  ResponsiveContainer,
  Tooltip,
  Legend,
  type RadarProps as RechartsRadarProps,
} from 'recharts';
import { ChartTooltip } from './Tooltip';

interface RadarChartProps {
  data: any[];
  xKey: string;
  yKey?: string;
  yKeys?: string[];
  title?: string;
  color?: string; // Fallback color for single series if not using yKeys
  showAxes?: boolean; // 是否显示轴
  showValues?: boolean; // This prop is still defined but not actively used to render values on chart
  showGrid?: boolean; // 是否显示网格线
  gridType?: 'polygon' | 'circle';
  showLegend?: boolean;
  customTooltip?: React.ReactElement | ((props: any) => React.ReactElement);
  showDots?: boolean | RechartsRadarProps['dot'];
  activeDot?: RechartsRadarProps['activeDot'];
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

const RadarChart = ({
  data,
  xKey,
  yKey,
  yKeys,
  title,
  color = '#3b82f6', // Used if seriesKeys results in a single key and no specific color in data
  showAxes = true,
  showValues = true, // Prop remains, functionality for displaying values directly on chart not implemented
  showGrid = true,
  gridType = 'polygon',
  showLegend = false,
  customTooltip,
  showDots = true,
  activeDot = { r: 6 },
  ValueProps,
}: RadarChartProps) => {
  const seriesKeys =
    yKeys ||
    (yKey
      ? [yKey]
      : data && data.length > 0
      ? Object.keys(data[0] || {}).filter(
          (k) => k !== xKey && typeof data[0][k] === 'number',
        )
      : []);

  if (!data || data.length === 0 || !xKey || seriesKeys.length === 0) {
    return (
      <div className='flex h-full w-full items-center justify-center text-muted-foreground'>
        No data available or missing key properties (xKey or yKey/yKeys).
      </div>
    );
  }

  const renderRadars = () => {
    return seriesKeys.map((key, index) => {
      // Use the passed 'color' prop for single series, COLORS palette for multiple
      const seriesColor =
        seriesKeys.length === 1 && !yKeys
          ? color
          : COLORS[index % COLORS.length];

      let dotConfig: RechartsRadarProps['dot'] = false;
      if (showDots === true) {
        dotConfig = { stroke: seriesColor, fill: seriesColor, r: 3 };
      } else if (typeof showDots === 'object') {
        dotConfig = showDots;
      }

      let activeDotConfig: RechartsRadarProps['activeDot'] = false;
      if (activeDot === true) {
        activeDotConfig = { r: 6, stroke: seriesColor };
      } else if (typeof activeDot === 'object') {
        activeDotConfig = activeDot;
      }

      return (
        <Radar
          key={key}
          name={key}
          dataKey={key}
          stroke={seriesColor}
          fill={seriesColor}
          fillOpacity={0.3}
          dot={dotConfig}
          activeDot={activeDotConfig}
          animationDuration={1000}
          animationBegin={index * 150}
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
      <RechartsRadarChart
        cx='50%'
        cy='50%'
        outerRadius='80%'
        data={data}
      >
        {showGrid && (
          <PolarGrid
            gridType={gridType}
            strokeDasharray='3 3'
            stroke='var(--muted-foreground)'
            strokeOpacity={0.3}
          />
        )}
        {showAxes && (
          <>
            <PolarAngleAxis
              dataKey={xKey}
              tick={{ fill: 'var(--muted-foreground)', fontSize: 12 }}
              stroke='var(--muted-foreground)'
              strokeOpacity={0.3}
            />
            <PolarRadiusAxis
              tick={{ fill: 'var(--muted-foreground)', fontSize: 10 }}
              axisLine={false}
              tickCount={5}
              stroke='var(--muted-foreground)'
              strokeOpacity={0.3}
            />
          </>
        )}
        {renderRadars()}
        <Tooltip
          content={({ active, payload, label }) => {
            if (customTooltip) {
              if (typeof customTooltip === 'function') {
                return customTooltip({ active, payload, label });
              }
              return customTooltip;
            }
            if (active && payload && payload.length) {
              const originalData = payload[0].payload;
              // 转换 payload 以适应 ChartTooltip 的数据结构
              const transformedPayload = payload.map((entry) => ({
                name: entry.dataKey, // 使用 dataKey 作为系列名称 (studentA, studentB, etc.)
                value: entry.value as number, // 确保 value 是 number 类型
                color: entry.color || entry.stroke,
                payload: entry.payload,
                fill: entry.fill,
                stroke: entry.stroke,
              }));

              return (
                <ChartTooltip
                  active={active}
                  ValueProps={ValueProps}
                  payload={transformedPayload}
                  label={originalData[xKey]} // 使用 subject 值作为 label
                />
              );
            }
            return null;
          }}
          cursor={{ fill: 'var(--muted-foreground)', fillOpacity: 0.05 }}
        />
        {showLegend && <Legend wrapperStyle={{ paddingTop: '20px' }} />}
      </RechartsRadarChart>
    </ResponsiveContainer>
  );
};

export default RadarChart;
