/** @format */

'use client';

import React, { memo } from 'react';
import { ShieldCheck } from 'lucide-react';

export const ExtensionConnectionCard = memo(function ExtensionConnectionCard() {
  return (
    <div className='panel-xl col'>
      <div className='flex items-start justify-between gap-3'>
        <div>
          <h2 className='title-sub'>Browser Extension</h2>
          <p className='body-md mt-1 text-ink-secondary'>
            The extension uses the same Jobby login as this website.
          </p>
        </div>
        <ShieldCheck className='h-5 w-5 shrink-0 text-success' aria-hidden='true' />
      </div>

      <div className='panel-sm'>
        <p className='body-sm text-ink-secondary'>
          Open the extension and choose <strong>Sign in with Jobby</strong>. Your password stays on the Jobby login page;
          no connection code needs to be copied.
        </p>
      </div>
    </div>
  );
});
