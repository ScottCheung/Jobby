import type { Metadata } from "next";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";

export const metadata: Metadata = {
  title: "Auto Job Apply - User Console",
  description: "Manage user profile, job preferences, question cache, and application history.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <ThemeProvider defaultTheme="system" defaultColor="green">
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
