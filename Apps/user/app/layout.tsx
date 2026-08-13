/** @format */

import { GeminiBackground } from '@jobby/ui';
import type { Metadata } from 'next';
import './globals.css';
import { QueryProvider } from '@/components/providers/QueryProvider';
import { ThemeProvider } from '@/components/theme-provider';
import { ConsoleProvider } from '@/components/ConsoleContext';
import ConsoleLayout from '@/components/ConsoleLayout';


export const metadata: Metadata = {
  title: 'Jobby - User Console',
  description:
    'Manage user profile, job hunting profiles, agent settings, question cache, and application history.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang='en'
      suppressHydrationWarning
      className='bg-background h-screen overflow-hidden'
    >
      <head>
        <link rel='icon' href='/favicon.svg' type='image/svg+xml' sizes='any' />
      </head>
      <body suppressHydrationWarning className='h-screen overflow-hidden'>
        <QueryProvider>
          <ConsoleProvider>
            <ThemeProvider defaultTheme='system' defaultColor='green'>
              <GeminiBackground />
              <ConsoleLayout>{children}</ConsoleLayout>
            </ThemeProvider>
          </ConsoleProvider>
        </QueryProvider>
      </body>
    </html>
  );
}
