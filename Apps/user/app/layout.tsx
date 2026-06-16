/** @format */

import type { Metadata } from 'next';
import './globals.css';
import { ThemeProvider } from '@/components/theme-provider';
import { ConsoleProvider } from '@/components/ConsoleContext';
import ConsoleLayout from '@/components/ConsoleLayout';

export const metadata: Metadata = {
  title: 'Auto Job Apply - User Console',
  description:
    'Manage user profile, job preferences, question cache, and application history.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang='en' suppressHydrationWarning className='bg-background'>
      <body>
        <ThemeProvider defaultTheme='system' defaultColor='green'>
          <ConsoleProvider>
            <ConsoleLayout>{children}</ConsoleLayout>
          </ConsoleProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
