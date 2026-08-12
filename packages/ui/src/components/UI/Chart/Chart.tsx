/** @format */

import React from 'react';
import AreaChart from './AreaChart';
import BarChart from './BarChart';
import ChartWrapper from './ChartWrapper';
import LineChart from './LineChart';
import PieChart from './PieChart';
import RadarChart from './RadarChart';
import RadialChart from './RadialChart';
import { ProgressBarList } from '../Progress/ProgressBarList';
import {
  type AreaProps as RechartsAreaProps,
  type RadarProps as RechartsRadarProps, // Added for RadarChart dot/activeDot props
} from 'recharts'; // Import for interpolationType

export interface ChartProps extends React.HTMLAttributes<HTMLDivElement> {
  type: 'bar' | 'line' | 'area' | 'pie' | 'radar' | 'radial' | 'bar-list';
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
  interpolationType?: RechartsAreaProps<any, any>['type'];
  showLegend?: boolean;
  stacked?: boolean;
  stackOffset?: 'expand' | 'none' | 'silhouette' | 'wiggle';
  showDots?: boolean | 'visible' | 'hidden' | object;
  gradientFill?: boolean;
  radarGridType?: 'polygon' | 'circle';
  radarShowDots?: boolean | RechartsRadarProps<any, any>['dot'];
  radarActiveDot?: RechartsRadarProps<any, any>['activeDot'];
  nameKey?: string;
  valueKey?: string;
  radialStartAngle?: number;
  radialEndAngle?: number;
  radialInnerRadius?: string | number;
  radialOuterRadius?: string | number;
  radialBarSize?: number;
  radialHoverAnimationDuration?: number;
  ValueProps?: any;
  layout?: 'horizontal' | 'vertical';
  showXAxis?: boolean;
  showYAxis?: boolean;
  yAxisWidth?: number;
  margin?: { top?: number; right?: number; bottom?: number; left?: number };
  yDomain?: [any, any];
  pieCornerRadius?: number;
  piePaddingAngle?: number;
  pieInnerRadius?: string | number;
  pieOuterRadius?: string | number;
  pieGradients?: Record<string, { start: string; end: string }>;
  barColorClassName?: string;
  maxEquivalent?: boolean;
  emptyMessage?: string;
  valueFormatter?: (value: number, item: any) => React.ReactNode;
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
      layout,
      showXAxis,
      showYAxis,
      yAxisWidth,
      margin,
      yDomain,
      pieCornerRadius,
      piePaddingAngle,
      pieInnerRadius,
      pieOuterRadius,
      pieGradients,
      barColorClassName,
      maxEquivalent,
      emptyMessage,
      valueFormatter,
      ...props
    },
    ref,
  ) => {
    const effectiveXKey =
      (type === 'pie' || type === 'radial' || type === 'radar' || type === 'bar-list') && nameKey ?
        nameKey
      : xKey;
    const effectiveYKeyBase =
      (type === 'pie' || type === 'radial' || type === 'radar' || type === 'bar-list') && valueKey ?
        valueKey
      : yKey;

    let yRequirementMet = false;

    if (type === 'area' || type === 'radar') {
      if (yKeys && yKeys.length > 0) {
        yRequirementMet = true;
      } else {
        yRequirementMet = !!effectiveYKeyBase;
      }
    } else {
      yRequirementMet = !!effectiveYKeyBase;
    }

    const isDataValid = !!(data && data.length > 0 && effectiveXKey && yRequirementMet);

    const getChartComponent = (chartType: ChartProps['type']) => {
      const commonChartProps = {
        data,
        color,
        showLegend,
        title,
        ValueProps,
        margin,
      };

      switch (chartType) {
        case 'bar':
          return (
            <BarChart
              {...commonChartProps}
              xKey={effectiveXKey as string}
              yKey={effectiveYKeyBase}
              multiColor={multiColor}
              showGridX={showGridX}
              showGridY={showGridY}
              ValueProps={ValueProps}
              layout={layout}
              showXAxis={showXAxis}
              showYAxis={showYAxis}
              yAxisWidth={yAxisWidth}
            />
          );
        case 'line':
          return (
            <LineChart
              {...commonChartProps}
              xKey={effectiveXKey as string}
              yKey={effectiveYKeyBase as string}
              ValueProps={ValueProps}
              showXAxis={showXAxis}
              showYAxis={showYAxis}
              yAxisWidth={yAxisWidth}
            />
          );
        case 'area':
          return (
            <AreaChart
              {...commonChartProps}
              xKey={effectiveXKey as string}
              yKey={effectiveYKeyBase}
              yKeys={yKeys}
              interpolationType={interpolationType}
              stacked={stacked}
              stackOffset={stackOffset}
              showDots={showDots}
              gradientFill={gradientFill}
              ValueProps={ValueProps}
              showXAxis={showXAxis}
              showYAxis={showYAxis}
              yAxisWidth={yAxisWidth}
            />
          );
        case 'pie':
          return (
            <PieChart
              {...commonChartProps}
              xKey={effectiveXKey as string}
              yKey={effectiveYKeyBase}
              ValueProps={ValueProps}
              cornerRadius={pieCornerRadius}
              paddingAngle={piePaddingAngle}
              innerRadius={pieInnerRadius}
              outerRadius={pieOuterRadius}
              gradientFill={gradientFill}
              pieGradients={pieGradients}
            />
          );
        case 'radar':
          return (
            <RadarChart
              {...commonChartProps}
              xKey={effectiveXKey as string}
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
              nameKey={effectiveXKey as string}
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
        case 'bar-list':
          return (
            <ProgressBarList
              data={data}
              nameKey={effectiveXKey as any}
              valueKey={effectiveYKeyBase as any}
              barColorClassName={barColorClassName}
              maxEquivalent={maxEquivalent}
              emptyMessage={emptyMessage}
              valueFormatter={valueFormatter}
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
        isEmpty={!isDataValid}
        emptyMessage={emptyMessage}
      >
        <div ref={ref} style={{ width: '100%', height: '100%' }} {...props}>
          {isDataValid && getChartComponent(type)}
        </div>
      </ChartWrapper>
    );
  },
);

Chart.displayName = 'Chart';
