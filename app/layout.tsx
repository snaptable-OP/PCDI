import type { Metadata, Viewport } from "next";
import { DM_Sans } from "next/font/google";
import { ConditionalAppShell } from "@/components/layout/conditional-app-shell";
import "./globals.css";

const dmSans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-dm",
  display: "swap",
});

export const metadata: Metadata = {
  title: "RESOLV MACHINE — Post-completion defect intelligence",
  description:
    "Defect analysis per project, knowledge mapping, response strategy agents, and master prompts.",
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
        <ConditionalAppShell>{children}</ConditionalAppShell>
      </body>
    </html>
  );
}
