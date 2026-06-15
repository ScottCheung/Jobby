import type { Metadata } from "next";
import "./globals.css";

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
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
