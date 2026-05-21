"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, useState } from "react";

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const from = searchParams.get("from");
  const redirectTo =
    from && from.startsWith("/") && !from.startsWith("//") ? from : "/";

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
      };
      if (!res.ok) {
        setError(data.error ?? "Sign-in failed");
        return;
      }
      router.replace(redirectTo);
      router.refresh();
    } catch {
      setError("Could not reach the server. Try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={onSubmit}
      className="w-full max-w-sm rounded-xl border border-border bg-surface p-8 shadow-[var(--card-shadow)]"
    >
      <h1 className="text-xl font-semibold tracking-tight text-[color:var(--heading-foreground)]">
        RESOLV MACHINE
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Enter the site password to continue.
      </p>

      <label className="mt-6 block text-sm font-medium text-[color:var(--emphasis-foreground)]">
        Password
        <input
          type="password"
          name="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="mt-1.5 w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-sm text-foreground outline-none ring-[var(--ring)] placeholder:text-[color:var(--placeholder-foreground)] focus-visible:ring-2"
          placeholder="Password"
          disabled={submitting}
        />
      </label>

      {error ? (
        <p className="mt-3 text-sm text-[color:var(--status-error)]" role="alert">
          {error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={submitting}
        className="mt-6 w-full rounded-lg bg-[color:var(--accent)] px-4 py-2.5 text-sm font-medium text-[color:var(--accent-foreground)] transition hover:bg-[color:var(--accent-hover)] disabled:opacity-60"
      >
        {submitting ? "Signing in…" : "Continue"}
      </button>
    </form>
  );
}
