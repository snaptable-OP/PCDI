"use client";

import { useEffect, useId, useRef } from "react";
import { X } from "lucide-react";
import { IngestionFlowNav } from "@/components/pcdi/ingestion-flow-nav";

export type CreateProjectNameValues = {
  name: string;
};

type CreateProjectModalProps = {
  open: boolean;
  onClose: () => void;
  onSubmit: (values: CreateProjectNameValues) => void;
};

/**
 * Step 1 only: project name. Metadata is collected on the next screen.
 */
export function CreateProjectModal({ open, onClose, onSubmit }: CreateProjectModalProps) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    nameInputRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    const panel = panelRef.current;
    if (!panel) return;

    const focusables = () =>
      Array.from(
        panel.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((el) => el.offsetParent !== null || el === document.activeElement);

    const onTabTrap = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;
      const list = focusables();
      if (list.length === 0) return;
      const first = list[0];
      const last = list[list.length - 1];
      const active = document.activeElement as HTMLElement | null;
      if (e.shiftKey) {
        if (active === first) {
          e.preventDefault();
          last.focus();
        }
      } else if (active === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onTabTrap);
    return () => document.removeEventListener("keydown", onTabTrap);
  }, [open]);

  if (!open) return null;

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const name = String(new FormData(e.currentTarget).get("name") ?? "").trim();
    if (!name) return;
    onSubmit({ name });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="presentation"
    >
      <div
        className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm"
        aria-hidden
        onClick={onClose}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative z-10 w-full max-w-lg rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-lg"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <IngestionFlowNav currentStep={1} className="mb-4" />
        <div className="mb-4 flex items-start justify-between gap-4">
          <h2 id={titleId} className="text-lg font-semibold text-[var(--foreground)]">
            Create project
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-[var(--muted-foreground)] outline-none ring-[var(--ring)] hover:bg-[var(--surface-muted)] hover:text-[var(--foreground)] focus-visible:ring-2"
            aria-label="Close"
          >
            <X className="h-5 w-5" aria-hidden />
          </button>
        </div>
        <p className="mb-4 text-sm text-[var(--muted-foreground)]">
          Name the project first. You will enter site metadata (asset type, location, etc.) on the next step.
        </p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label htmlFor="proj-name" className="block text-sm font-medium text-[var(--foreground)]">
              Project name
            </label>
            <input
              ref={nameInputRef}
              id="proj-name"
              name="name"
              required
              autoComplete="off"
              className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--foreground)] outline-none ring-[var(--ring)] focus:ring-2"
              placeholder="e.g. North Wharf — Phase 1"
            />
          </div>

          <div className="mt-2 flex justify-end gap-2 border-t border-[var(--border-subtle)] pt-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm font-medium text-[var(--foreground)] outline-none ring-[var(--ring)] hover:bg-[var(--surface-muted)] focus-visible:ring-2"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-medium text-[var(--accent-foreground)] outline-none ring-[var(--ring)] hover:bg-accent-hover active:bg-accent-active focus-visible:ring-2"
            >
              Continue
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
