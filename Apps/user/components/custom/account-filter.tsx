/** @format */

'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { Check } from 'lucide-react';
import { Button } from '@/components/UI/Button';
import { Badge } from '@/components/UI/badge';

export interface Account {
  AccountId: string;
  Name: string;

}

interface AccountFilterProps {
  accounts?: Account[];
  selectedIds: string[];
  onSelectionChange: (ids: string[]) => void;
  totalCount?: number;
  className?: string;
}

export function AccountFilter({
  accounts = [],
  selectedIds,
  onSelectionChange,
  totalCount,
  className,
}: AccountFilterProps) {
  const handleToggle = (id: string) => {
    if (selectedIds.includes(id)) {
      onSelectionChange(selectedIds.filter((i) => i !== id));
    } else {
      onSelectionChange([...selectedIds, id]);
    }
  };

  const handleClear = () => {
    onSelectionChange([]);
  };

  const isAllSelected = selectedIds.length === 0;

  return (
    <div className={cn('flex flex-col gap-3', className)}>
      <div className='wrap'>
        {/* All Button */}
        <Button
          variant={isAllSelected ? 'default' : 'ghost'}
          size='sm'
          onClick={handleClear}
          className={cn('gap-2')}
        >
          All
          {totalCount !== undefined && (
            <Badge
              className={cn(isAllSelected ? 'button-default' : 'button-ghost')}
            >
              {totalCount}
            </Badge>
          )}
        </Button>

        {/* Account Chips */}
        {accounts.map((account) => {
          const isSelected = selectedIds.includes(account.AccountId);
          return (
            <Button
              key={account.AccountId}
              variant={isSelected ? 'default' : 'outline'}
              size='sm'
              onClick={() => handleToggle(account.AccountId)}
              className={cn('gap-2')}
            >
              {isSelected && <Check className='size-3.5' />}
              {account.Name}
            </Button>
          );
        })}
      </div>
    </div>
  );
}
