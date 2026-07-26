/** @format */

import type { Metadata } from 'next';
import './globals.css';
import { QueryProvider } from '@/components/providers/QueryProvider';
import { ThemeProvider } from '@/components/theme-provider';
import { ConsoleProvider } from '@/components/ConsoleContext';
import ConsoleLayout from '@/components/ConsoleLayout';
import { GeminiBackground } from '@/components/UI/GeminiBackground';

export const metadata: Metadata = {
  title: 'Auto Job Apply - User Console',
  description:
    'Manage user profile, job hunting profiles, agent settings, question cache, and application history.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang='en' suppressHydrationWarning className='bg-background h-screen overflow-hidden'>
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
