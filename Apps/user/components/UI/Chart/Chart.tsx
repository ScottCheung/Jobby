import React from 'react';
import AreaChart from './AreaChart';
import BarChart from './BarChart';
import ChartWrapper from './ChartWrapper';
import LineChart from './LineChart';
import PieChart from './PieChart';
import RadarChart from './RadarChart';
import RadialChart from './RadialChart';
import {
  type AreaProps as RechartsAreaProps,
  type RadarProps as RechartsRadarProps, // Added for RadarChart dot/activeDot props
} from 'recharts'; // Import for interpolationType

export interface ChartProps extends React.HTMLAttributes<HTMLDivElement> {
  type: 'bar' | 'line' | 'area' | 'pie' | 'radar' | 'radial';
  data: any[];
  xKey?: string; // Optional at this level, logic below will check effective xKey
  yKey?: string; // Optional at this level, logic below will check effective yKey/yKeys
  title?: string;
  size?: 'sm' | 'md' | 'lg';
  color?: string;
  multiColor?: boolean; // This might be less relevant if yKeys is used for multi-series in AreaChart
  className?: string;
  showGridX?: boolean; // Prop for BarChart, potentially generalizable
  showGridY?: boolean; // Prop for BarChart, potentially generalizable
  yKeys?: string[];
  interpolationType?: RechartsAreaProps['type'];
  showLegend?: boolean;
  stacked?: boolean;
  stackOffset?: 'expand' | 'none' | 'silhouette' | 'wiggle';
  showDots?: boolean | 'visible' | 'hidden' | object;
  gradientFill?: boolean;
  radarGridType?: 'polygon' | 'circle';
  radarShowDots?: boolean | RechartsRadarProps['dot'];
  radarActiveDot?: RechartsRadarProps['activeDot'];
  nameKey?: string;
  valueKey?: string;
  radialStartAngle?: number;
  radialEndAngle?: number;
  radialInnerRadius?: string | number;
  radialOuterRadius?: string | number;
  radialBarSize?: number;
  radialHoverAnimationDuration?: number;
  ValueProps?: any;
}

export const Chart = React.forwardRef<HTMLDivElement, ChartProps>(
  (
    {
      className,
      type = 'bar',
      data = [],
      xKey, // Direct prop
      yKey, // Direct prop
      title,
      size = 'md',
      color = '#3b82f6',
      multiColor = true,
      showGridX = false,
      showGridY = false,
      showLegend = false,
      yKeys,
      interpolationType,
      stacked,
      stackOffset,
      showDots,
      gradientFill,
      radarGridType,
      radarShowDots,
      radarActiveDot,
      nameKey,
      valueKey,
      radialStartAngle,
      radialEndAngle,
      radialInnerRadius,
      radialOuterRadius,
      radialBarSize,
      radialHoverAnimationDuration,
      ValueProps,
      ...props
    },
    ref,
  ) => {
    const effectiveXKey =
      (type === 'pie' || type === 'radial' || type === 'radar') && nameKey
        ? nameKey
        : xKey;
    const effectiveYKeyBase =
      (type === 'pie' || type === 'radial' || type === 'radar') && valueKey
        ? valueKey
        : yKey;

    let yRequirementMet = false;
    let yKeyMessagePart = 'yKey/valueKey';

    if (type === 'area' || type === 'radar') {
      if (yKeys && yKeys.length > 0) {
        yRequirementMet = true;
        yKeyMessagePart = 'yKeys (覆盖 yKey/valueKey)';
      } else {
        yRequirementMet = !!effectiveYKeyBase;
      }
    } else {
      yRequirementMet = !!effectiveYKeyBase;
    }

    if (!data || data.length === 0 || !effectiveXKey || !yRequirementMet) {
      return (
        <ChartWrapper
          title={title || '数据错误'}
          size={size}
          className={className}
        >
          <div className='flex h-full w-full flex-col items-center justify-center text-center text-muted-foreground'>
            <p>图表数据或配置不完整。</p>
            <p className='text-xs mt-1'>
              (请提供: data,{' '}
              {effectiveXKey
                ? `xKey/nameKey (当前有效: ${effectiveXKey})`
                : 'xKey/nameKey'}
              , 以及{' '}
              {yRequirementMet
                ? `y轴数据键 (已满足来自: ${yKeyMessagePart})`
                : yKeyMessagePart}
              )
            </p>
          </div>
        </ChartWrapper>
      );
    }
    // At this point, effectiveXKey is guaranteed to be a string.
    // effectiveYKeyBase might be undefined if yKeys is used for Area/Radar.

    const getChartComponent = (chartType: ChartProps['type']) => {
      const commonChartProps = {
        data,
        color,
        showLegend,
        title,
        ValueProps,
      };

      switch (chartType) {
        case 'bar':
          return (
            <BarChart
              {...commonChartProps}
              xKey={effectiveXKey}
              yKey={effectiveYKeyBase}
              multiColor={multiColor}
              showGridX={showGridX}
              showGridY={showGridY}
              ValueProps={ValueProps}
            />
          );
        case 'line':
          return (
            <LineChart
              {...commonChartProps}
              xKey={effectiveXKey}
              yKey={effectiveYKeyBase as string}
              ValueProps={ValueProps}
            />
          );
        case 'area':
          return (
            <AreaChart
              {...commonChartProps}
              xKey={effectiveXKey}
              yKey={effectiveYKeyBase}
              yKeys={yKeys}
              interpolationType={interpolationType}
              stacked={stacked}
              stackOffset={stackOffset}
              showDots={showDots}
              gradientFill={gradientFill}
              ValueProps={ValueProps}
            />
          );
        case 'pie':
          return (
            <PieChart
              {...commonChartProps}
              xKey={effectiveXKey}
              yKey={effectiveYKeyBase}
              ValueProps={ValueProps}
            />
          );
        case 'radar':
          return (
            <RadarChart
              {...commonChartProps}
              xKey={effectiveXKey}
              yKey={effectiveYKeyBase}
              yKeys={yKeys}
              gridType={radarGridType}
              showDots={radarShowDots}
              activeDot={radarActiveDot}
              ValueProps={ValueProps}
            />
          );
        case 'radial':
          return (
            <RadialChart
              {...commonChartProps}
              nameKey={effectiveXKey}
              valueKey={effectiveYKeyBase}
              startAngle={radialStartAngle}
              endAngle={radialEndAngle}
              innerRadius={radialInnerRadius}
              outerRadius={radialOuterRadius}
              barSize={radialBarSize}
              hoverAnimationDuration={radialHoverAnimationDuration}
              ValueProps={ValueProps}
            />
          );
        default:
          return null;
      }
    };

    return (
      <ChartWrapper
        title={title}
        size={size}
        className={className}
      >
        <div
          ref={ref}
          style={{ width: '100%', height: '100%' }}
          {...props}
        >
          {getChartComponent(type)}
        </div>
      </ChartWrapper>
    );
  },
);

Chart.displayName = 'Chart';
