/** @format */

'use client';

import { useConsole } from '@/components/ConsoleContext';
import CardWithNorth from '../UI/card/CardWithNorth';
import { H1 } from '../UI/text/typography';
import { Number } from '../UI/Number/Number';
import { Stagger, StaggerItem } from '../animation';
import { cn } from '@/lib/utils';

export function DashboardStats({ className }: { className?: string }) {
  const { stats } = useConsole();

  return (
    <Stagger
      staggerDelay={0.15}
      className={cn(
        'grid grid-cols-[repeat(auto-fill,minmax(250px,1fr))] gap-6 pt-4',
        className,
      )}
    >
      {stats.map((item: any) => {
        const Icon = item.icon;
        return (
          <StaggerItem key={item.label} yOffset={20}>
            <CardWithNorth title={item.label}>
              <div className='relative flex items-start justify-between'>
                <div
                  className={cn(
                    'absolute -top-16 -right-2 z-50 rounded-full p-6 backdrop-blur-[10px]',
                    item.bgColor,
                    item.borderColor,
                  )}
                >
                  <Icon className={cn('h-10 w-10', item.iconColor)} />
                </div>
                <div className='flex flex-col'>
                  <H1
                    className={cn(
                      item.textColor,
                      '-mt-4 -ml-[0.13em] md:-ml-[0.23em]',
                    )}
                  >
                    <Number
                      value={item.value}
                      duration={1}
                      className='font-[600]'
                      digitWidth='0.66em'
                    />
                  </H1>
                  {item.comparison && (
                    <div
                      className={cn(
                        'label-sm mt-2 flex items-center gap-1',
                        item.comparisonColor,
                      )}
                    >
                      {item.comparisonIcon && (
                        <item.comparisonIcon className='h-3.5 w-3.5' />
                      )}
                      <span>{item.comparison}</span>
                    </div>
                  )}
                </div>
              </div>
            </CardWithNorth>
          </StaggerItem>
        );
      })}
    </Stagger>
  );
}
