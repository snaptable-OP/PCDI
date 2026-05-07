import type { LucideIcon } from "lucide-react";
import { Bot, FolderOpen, Zap } from "lucide-react";

export type AppNavItem = {
  href: string;
  label: string;
  shortLabel: string;
  Icon: LucideIcon;
};

/** Single-level sidebar: Live Analysis, Response agents, Knowledge folders */
export const APP_NAV: readonly AppNavItem[] = [
  {
    href: "/live",
    label: "Live Analysis",
    shortLabel: "Live",
    Icon: Zap,
  },
  {
    href: "/response-agent",
    label: "Response agents",
    shortLabel: "Agents",
    Icon: Bot,
  },
  {
    href: "/knowledge-folders",
    label: "Knowledge folders",
    shortLabel: "Folders",
    Icon: FolderOpen,
  },
] as const;
