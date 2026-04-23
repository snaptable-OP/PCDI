"use client";

import Link from "next/link";
import { APP_NAV } from "@/components/layout/nav-config";

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
      <aside className="sticky top-0 hidden h-svh max-h-screen w-full min-w-0 overflow-y-auto border-r border-border bg-surface md:block">
        <div className="border-b border-border px-4 py-5">
          <Link
            href="/"
            className="text-lg font-semibold tracking-tight text-teal-700 dark:text-teal-300"
          >
            PCDI
          </Link>
          <p className="mt-1 text-xs text-[var(--muted-foreground)]">
            Post-Completion Defects Intelligence
          </p>
        </div>
        <nav className="flex flex-col gap-0.5 p-3" aria-label="Main">
          {APP_NAV.map(({ href, label, Icon }) => (
            <Link
              key={href}
              href={href}
              className="flex min-h-[44px] items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm leading-snug text-foreground outline-none ring-[var(--ring)] transition hover:bg-surface-muted focus-visible:ring-2 dark:hover:bg-slate-800/80"
            >
              <Icon className="h-4 w-4 shrink-0 text-teal-600 dark:text-teal-400" aria-hidden />
              <span className="min-w-0 break-words">{label}</span>
            </Link>
          ))}
        </nav>
      </aside>
      <div className="flex min-h-svh min-w-0 w-full max-w-full flex-col">
        <header
          className="sticky top-0 z-10 border-b border-border bg-[color:color-mix(in_srgb,var(--surface)_93%,transparent)] px-3 py-3 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-[color:color-mix(in_srgb,var(--surface)_88%,transparent)] md:hidden"
        >
          <div className="mb-2 px-1">
            <Link
              href="/"
              className="inline-flex min-h-[44px] min-w-[44px] items-center text-sm font-semibold text-teal-700 outline-none ring-[var(--ring)] focus-visible:ring-2 dark:text-teal-300"
            >
              PCDI
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
