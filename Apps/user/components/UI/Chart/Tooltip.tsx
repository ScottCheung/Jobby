import React from 'react';
import { motion as m } from 'framer-motion';
import { Number } from '../Number/Number';

export interface ChartTooltipPropsItem {
  isShortFormat?: boolean;
  name?: string | number | undefined; // Modified: Allow string or number for name
  value: number | string | undefined; // Modified: Allow undefined to match Recharts payload
  color?: string; // Recharts own color for the series/item
  stroke?: string;
  fill?: string; // Direct fill on the payload item itself
  payload?: {
    // This is the original data object for the item
    fill?: string; // Fill color from the original data object
    [key: string]: any; // To allow access via a string nameKey
  };
  // Add other payload properties if needed
}

export interface ChartTooltipProps {
  isShortFormat?: boolean;
  active?: boolean;
  payload?: ChartTooltipPropsItem[];
  label?: string | number; // This is the default label from Recharts (e.g., x-axis category)
  nameKey?: string; // Kept for potential fallback, but primary is item.name
  ValueProps?: any;
}

export const ChartTooltip: React.FC<ChartTooltipProps> = ({
  isShortFormat = false,
  active,
  payload,
  label, // Recharts default label - this is our new title
  nameKey = 'name', // Default still 'name', used as fallback
  ValueProps,
}) => {
  if (active && payload && payload.length) {
    const displayLabel = label != null ? String(label) : null; // Use the Recharts label as the title

    return (
      <m.div className='rounded-lg border bg-white/90 transition-all duration-300 backdrop-blur-sm card-md text-sm shadow-lg'>
        {displayLabel && (
          <div className='mb-2 font-medium text-foreground '>
            {displayLabel}
          </div>
        )}
        <div className='space-y-1.5 '>
          {payload.map((item, index) => {
            // Ensure item.value is not undefined before processing
            if (item.value === undefined || item.value === null) return null;

            const itemColor =
              item.payload?.fill ||
              item.fill ||
              item.color ||
              item.stroke ||
              '#8884d8';

            // Use item.name (from Recharts payload, which is the dataKey of the Line/Bar/etc.)
            // item.name can be string or number.
            // Fallback to item.payload[nameKey] if item.name is not present.
            let itemName: string = '';
            if (item.name != null) {
              itemName = String(item.name);
            } else if (item.payload && item.payload[nameKey] != null) {
              itemName = String(item.payload[nameKey]);
            }

            return (
              <div
                key={index}
                className='flex items-center gap-2'
              >
                <span
                  className='size-sm shrink-0 rounded-[3px]'
                  style={{ backgroundColor: itemColor }}
                />
                <div className='flex flex-1 items-center justify-between w-full'>
                  {/* Conditionally render the item name (label) */}
                  {itemName && itemName.trim() !== '' && (
                    <span className='text-gray-500 text-xs mr-3'>
                      {itemName}
                    </span>
                  )}
                  {/* Ensure value is always shown, adjust spacing if name is absent */}
                  <div className='flex flex-col items-center gap-2'>
                    <Number
                      value={item.value}
                      duration={0.2}
                      {...ValueProps}
                      className={`font-medium text-xs  ${!itemName || itemName.trim() === '' ? 'ml-auto' : ''
                        }`}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </m.div>
    );
  }

  return null;
};

ChartTooltip.displayName = 'ChartTooltip';
export default ChartTooltip;
