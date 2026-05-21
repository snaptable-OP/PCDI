"use client";

import { usePathname } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";

/** Login is full-screen without sidebar chrome. */
export function ConditionalAppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  if (pathname === "/login") {
    return <>{children}</>;
  }
  return <AppShell>{children}</AppShell>;
}
