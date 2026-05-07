/**
 * Live analysis routes use a white content canvas (vs the default mint main-column tint).
 */
export default function LiveLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="-mx-4 -my-6 min-h-svh bg-white px-4 py-6 md:-mx-8 md:px-8">
      {children}
    </div>
  );
}
