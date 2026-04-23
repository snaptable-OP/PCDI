import Link from "next/link";

type StubNextProps = {
  href: string;
  label?: string;
};

export function StubNext({ href, label = "Next" }: StubNextProps) {
  return (
    <p className="mt-6">
      <Link
        href={href}
        className="inline-flex items-center rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-medium text-[var(--accent-foreground)] transition hover:opacity-90"
      >
        {label} →
      </Link>
    </p>
  );
}
