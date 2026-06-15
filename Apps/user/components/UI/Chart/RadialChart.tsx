import { useState } from 'react';
import {
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart as RechartsRadarChart,
  ResponsiveContainer,
  Tooltip,
  Legend,
  RadialBar,
  RadialBarChart as RechartsRadialBarChart,
  type RadarProps as RechartsRadarProps,
} from 'recharts';
import { ChartTooltip } from './Tooltip'; // Assuming you want the custom tooltip
import hexToRgba from './utils/hexToRgba';

interface RadialChartProps {
  data: any[]; // Expects data in a format like [{ name: 'A', value: 10, fill: '#color' }, ...]
  // dataKey: string; // The key for the value to be plotted on the radial bar, often 'value'
  nameKey?: string; // Key for the name of the category
  valueKey?: string; // Changed to optional
  title?: string; // Added title prop
  showLegend?: boolean;
  customTooltip?: React.ReactElement | ((props: any) => React.ReactElement);
  // More props can be added for customization, e.g., startAngle, endAngle, innerRadius, outerRadius
  height?: number | `${number}%`; // Allow custom height
  startAngle?: number; // Added startAngle
  endAngle?: number; // Added endAngle
  innerRadius?: string | number; // Added innerRadius
  outerRadius?: string | number; // Added outerRadius
  barSize?: number; // Added barSize
  // New prop for hover effect customization
  isShortFormat?: boolean;
  hoverAnimationDuration?: number; // New prop for controlling hover animation speed
  ValueProps?: any;
}

// Default color palette if not provided in data items
const DEFAULT_COLORS = [
  '#3b82f6',
  '#10b981',
  '#f59e0b',
  '#ec4899',
  '#8b5cf6',
  '#06b6d4',
  '#f43f5e',
  '#84cc16',
];
const DEFAULT_HOVER_ANIMATION_DURATION = 1000; // Default hover animation speed (ms)

export const RadialChart: React.FC<RadialChartProps> = ({
  data,
  nameKey = 'name',
  valueKey, // Now optional
  title, // Destructure title
  showLegend = true,
  customTooltip,
  height = '100%',
  startAngle = 95, // Default startAngle
  endAngle = -275, // Default endAngle for a full circle effect
  innerRadius = '20%',
  outerRadius = '90%',
  barSize = 10,
  isShortFormat = false,
  ValueProps,
  hoverAnimationDuration = DEFAULT_HOVER_ANIMATION_DURATION,
}) => {
  const [activeName, setActiveName] = useState<string | null>(null);

  if (!data || data.length === 0 || !valueKey) {
    return (
      <div className='flex h-full w-full items-center justify-center text-muted-foreground'>
        RadialChart: No data or missing valueKey.
      </div>
    );
  }

  const processedData = data.map((item, index) => {
    const baseColor =
      item.fill || DEFAULT_COLORS[index % DEFAULT_COLORS.length];
    let currentFill = baseColor;
    if (activeName && item[nameKey!] !== activeName) {
      currentFill = hexToRgba(baseColor, 0.3);
    }
    return {
      ...item,
      fill: currentFill,
      originalFill: baseColor, // Store original fill for legend
    };
  });

  // Calculate domain for PolarAngleAxis based on values
  const maxValue = Math.max(
    ...processedData.map((d) => d[valueKey as string] || 0),
  );

  return (
    <ResponsiveContainer
      width='100%'
      height={height}
    >
      <RechartsRadialBarChart
        cx='50%'
        cy='50%'
        innerRadius={innerRadius}
        outerRadius={outerRadius}
        barSize={barSize}
        data={processedData}
        startAngle={startAngle} // Applied startAngle to the chart
        endAngle={endAngle} // Applied endAngle to the chart
      >
        <PolarAngleAxis
          type='number'
          domain={[0, maxValue]}
          angleAxisId={0}
          tick={false} // Hide ticks for a cleaner look
        />
        <RadialBar
          label={{
            position: 'insideStart',
            fill: '#fff',
            fontSize: '9px',
            formatter: (value: any) => typeof value === 'number' ? value.toLocaleString() : String(value),
          }}
          background={{ fill: '#f0f0f0' }}
          dataKey={valueKey as string}
          angleAxisId={0}
          cornerRadius={barSize / 2}
          onMouseEnter={(itemData) => setActiveName(itemData[nameKey!])}
          onMouseLeave={() => setActiveName(null)}
          isAnimationActive={true} // Keep animation for initial draw
          animationEasing='ease-in-out' // Smoother animation
          animationDuration={hoverAnimationDuration} // Use the new prop for duration
        />
        {showLegend && (
          <Legend
            iconSize={10}
            layout='vertical'
            verticalAlign='middle'
            align='right'
            wrapperStyle={{ fontSize: '12px' }}
          />
        )}
        <Tooltip
          content={({ active, payload }) => {
            if (customTooltip) {
              if (typeof customTooltip === 'function') {
                return customTooltip({ active, payload });
              }
              return customTooltip;
            }
            if (active && payload?.[0]) {
              const data = payload[0];
              const transformedPayload = [
                {
                  name: 'Value', // 显示 "Value" 作为标签
                  value: data.value as number,
                  color: data.fill || data.color || data.stroke,
                  fill: data.fill,
                  stroke: data.stroke,
                  payload: data.payload,
                },
              ];

              return (
                <ChartTooltip
                  active={active}
                  payload={transformedPayload}
                  label={data.payload[nameKey]}
                  isShortFormat={isShortFormat}
                  ValueProps={ValueProps} // 使用 nameKey 对应的值作为标题
                />
              );
            }
            return null;
          }}
          cursor={false}
          wrapperStyle={{ zIndex: 1000 }}
        />
      </RechartsRadialBarChart>
    </ResponsiveContainer>
  );
};

export default RadialChart;
