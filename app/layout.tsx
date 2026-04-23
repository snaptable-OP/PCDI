import type { Metadata, Viewport } from "next";
import { DM_Sans } from "next/font/google";
import { AppShell } from "@/components/layout/app-shell";
import "./globals.css";

const dmSans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-dm",
  display: "swap",
});

export const metadata: Metadata = {
  title: "PCDI — Post-Completion Defects Intelligence",
  description:
    "Mock UI for defect analysis per project, knowledge mapping, and master prompts.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={dmSans.variable}>
      <body className="min-h-svh bg-[var(--background)] font-sans text-[var(--foreground)] antialiased">
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
