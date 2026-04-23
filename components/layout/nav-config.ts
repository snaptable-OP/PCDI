import type { LucideIcon } from "lucide-react";
import { Zap } from "lucide-react";

export type AppNavItem = {
  href: string;
  label: string;
  shortLabel: string;
  Icon: LucideIcon;
};

/** Other routes (dashboard, historical, knowledge map) hidden for now */
export const APP_NAV: readonly AppNavItem[] = [
  {
    href: "/live",
    label: "Live Analysis",
    shortLabel: "Live",
    Icon: Zap,
  },
] as const;
