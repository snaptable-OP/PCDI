"use client";

import Link from "next/link";
import { APP_NAV } from "@/components/layout/nav-config";
import { ProjectSelector } from "@/components/layout/project-selector";

/**
 * Root chrome — navigation is static (no usePathname) so the shell never triggers
 * Next.js App Router CSR-bailout / 500 issues around the root layout.
 *
 * Layout uses CSS Grid with `minmax(0,1fr)` so wide page content cannot blow out the viewport;
 * scroll stays inside `main` / inner overflow regions.
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-svh w-full max-w-full grid-cols-1 items-start md:grid-cols-[17rem_minmax(0,1fr)]">
      <aside className="sticky top-0 hidden h-svh max-h-screen w-full min-w-0 overflow-y-auto border-r border-[color:var(--sidebar-border)] bg-sidebar md:block">
        <div className="border-b border-[color:var(--sidebar-border)] px-4 py-5">
          <Link
            href="/"
            className="text-lg font-semibold tracking-tight text-[color:var(--sidebar-heading-text)]"
          >
            RESOLV MACHINE
          </Link>
          <p className="mt-1 text-xs leading-snug text-[color:var(--sidebar-subtitle-text)]">
            Post-completion defect intelligence
          </p>
        </div>
        <ProjectSelector />
        <nav className="flex flex-col gap-0.5 p-3" aria-label="Main">
          {APP_NAV.map(({ href, label, Icon }) => (
            <Link
              key={href}
              href={href}
              className="flex min-h-[44px] items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm leading-snug text-[color:var(--sidebar-nav-text)] outline-none ring-white/25 transition hover:bg-[color:var(--sidebar-nav-hover-bg)] hover:text-[color:var(--sidebar-nav-hover-text)] focus-visible:ring-2"
            >
              <Icon className="h-4 w-4 shrink-0 text-[color:var(--sidebar-icon)]" aria-hidden />
              <span className="min-w-0 break-words">{label}</span>
            </Link>
          ))}
        </nav>
      </aside>
      <div className="flex min-h-svh min-w-0 w-full max-w-full flex-col bg-[color:var(--main-column-bg)]">
        <header
          className="sticky top-0 z-10 border-b border-border bg-[color:color-mix(in_srgb,var(--main-column-bg)_93%,transparent)] px-3 py-3 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-[color:color-mix(in_srgb,var(--main-column-bg)_88%,transparent)] md:hidden"
        >
          <div className="mb-2 px-1">
            <Link
              href="/"
              className="inline-flex min-h-[44px] min-w-[44px] items-center text-sm font-semibold text-heading outline-none ring-[var(--ring)] focus-visible:ring-2"
            >
              RESOLV MACHINE
            </Link>
          </div>
          <nav
            className="flex gap-2 overflow-x-auto pb-1 [-webkit-overflow-scrolling:touch]"
            aria-label="Main"
          >
            {APP_NAV.map(({ href, shortLabel }) => (
              <Link
                key={href}
                href={href}
                className="flex min-h-[44px] shrink-0 items-center justify-center rounded-full border border-border bg-surface px-3 text-sm text-foreground outline-none ring-[var(--ring)] transition focus-visible:ring-2"
              >
                {shortLabel}
              </Link>
            ))}
          </nav>
        </header>
        <main className="min-h-0 w-full min-w-0 max-w-full flex-1 overflow-x-clip overflow-y-visible px-4 py-6 md:px-8">
          {children}
        </main>
      </div>
    </div>
  );
}
