"use client";

import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

type LogoutButtonProps = {
  className?: string;
  variant?: "sidebar" | "mobile";
};

export function LogoutButton({
  className = "",
  variant = "sidebar",
}: LogoutButtonProps) {
  const router = useRouter();
  const [gateEnabled, setGateEnabled] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/auth/login")
      .then((r) => r.json())
      .then((data: { gateEnabled?: boolean }) => {
        if (!cancelled) setGateEnabled(Boolean(data.gateEnabled));
      })
      .catch(() => {
        if (!cancelled) setGateEnabled(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!gateEnabled) return null;

  async function onLogout() {
    setLoading(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      router.replace("/login");
      router.refresh();
    } catch {
      setLoading(false);
    }
  }

  const base =
    variant === "sidebar"
      ? "flex min-h-[44px] w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm text-[color:var(--sidebar-nav-text)] outline-none ring-white/25 transition hover:bg-[color:var(--sidebar-nav-hover-bg)] hover:text-[color:var(--sidebar-nav-hover-text)] focus-visible:ring-2 disabled:opacity-60"
      : "flex min-h-[44px] shrink-0 items-center justify-center gap-1.5 rounded-full border border-border bg-surface px-3 text-sm text-foreground outline-none ring-[var(--ring)] transition hover:bg-surface-muted focus-visible:ring-2 disabled:opacity-60";

  return (
    <button
      type="button"
      onClick={onLogout}
      disabled={loading}
      className={`${base} ${className}`.trim()}
      aria-label="Log out"
    >
      <LogOut
        className={
          variant === "sidebar"
            ? "h-4 w-4 shrink-0 text-[color:var(--sidebar-icon)]"
            : "h-4 w-4 shrink-0"
        }
        aria-hidden
      />
      <span>{loading ? "Signing out…" : "Log out"}</span>
    </button>
  );
}
