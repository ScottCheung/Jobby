/** @format */

import React, { memo } from 'react';
import { HelpTip } from '@/components/UI/help-tip';
import { ChromeIcon } from './chrome-icon';

export const BrowserSessionHeader = memo(function BrowserSessionHeader() {
  return (
    <div className=''>
      <div className='flex items-start justify-between gap-4'>
        <h1 className='text-xl font-semibold text-ink-primary'>
          Browser Setting and Platform Account Settings{' '}
          <HelpTip
            content={
              <>
                <p className='font-semibold text-white'>Quick help</p>
                <p className='mt-2'>
                  Use the cards below to Open Separate Profile on Browser check
                  whether your login is saved, or clear it and start again. We
                  don't save any of your private infomation and passward. All
                  sessions and passwords are stored locally on your device in
                  Browser's profiles.
                </p>
              </>
            }
            className='h-10 w-10 text-ink-primary hover:text-primary'
          />
        </h1>
      </div>
    </div>
  );
});
