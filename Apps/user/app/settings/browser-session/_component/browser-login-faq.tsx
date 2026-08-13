/** @format */

'use client';
import { Accordion } from '@jobby/ui';

import React from 'react';


const faqItems = [
  {
    title: 'How do I use this page?',
    content: (
      <div>
        <p>
          1. Click <strong>Open Separate Profile on Browser</strong> to launch a
          dedicated window.
        </p>
        <p>2. Sign in to your LinkedIn and Seek accounts in that window.</p>
        <p>3. Close the browser window once you are logged in.</p>
        <p>
          4. Use <strong>Check Login Status Panel</strong> on this page to
          confirm the connection.
        </p>
        <p>
          The app will now use your session save on local so you don't have to
          log in again. All sessions and passwords are stored locally on your
          device in Browser's profiles.
        </p>
      </div>
    ),
  },
  {
    title: 'Why does the app use a separate login browser?',
    content: (
      <div>
        <p>
          Using a separate, isolated browser profile ensures your login data is{' '}
          <strong>stored securely and independently</strong>. It prevents your
          everyday browsing history, cookies, and extensions from interfering
          with the automation process, ensuring a stable connection to job
          sites.
        </p>
      </div>
    ),
  },
  {
    title: 'Why does the app sometimes close other Chrome windows?',
    content: (
      <div>
        <p>
          Chrome can sometimes struggle to manage multiple instances of the same
          data profile. By closing other windows, the app ensures it has{' '}
          <strong>exclusive access</strong> to the correct login profile,
          preventing errors and ensuring your credentials are saved exactly
          where the app can find them.
        </p>
      </div>
    ),
  },
  {
    title: 'Why does checking login sometimes close the browser automatically?',
    content: (
      <div>
        <p>
          To ensure your login session is fully saved and recognized, the
          browser needs to be closed first. This is a{' '}
          <strong>necessary step</strong> to allow the system to verify your
          account status accurately without any active sessions blocking the
          process.
        </p>
      </div>
    ),
  },
  {
    title: 'What if the app still asks me to sign in during Auto Apply?',
    content: (
      <div>
        <p>
          This usually happens if your session has expired or the browser failed
          to save the data correctly.{' '}
          <strong>Simply click Open A Separate Profile again</strong>, sign in
          once more, close the window, and hit Check Login to refresh the
          connection.
        </p>
      </div>
    ),
  },
  {
    title: 'When should I use Clear Saved Login?',
    content: (
      <div>
        <p>
          Use this feature if you need to{' '}
          <strong>switch to a different account</strong> or if the login status
          appears to be stuck or unresponsive. Clearing the data resets the
          session, allowing you to start fresh with a new login.
        </p>
      </div>
    ),
  },
];

export const BrowserLoginFaq = React.memo(function BrowserLoginFaq() {
  return (
    <section className='space-y-3'>
      <div className='space-y-1'>
        <h2 className='title-sub'>
          Common Questions
        </h2>
        <p className='body-md text-ink-secondary'>
          Short answers for the things people usually ask here.
        </p>
      </div>

      <div className='space-y-3'>
        {faqItems.map((item, index) => (
          <Accordion
            key={item.title}
            title={item.title}
            defaultOpen={index === 0}
            quickOpenClose={true}
          >
            {item.content}
          </Accordion>
        ))}
      </div>
    </section>
  );
});
