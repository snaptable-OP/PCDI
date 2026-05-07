/**
 * Cancel AppShell `main` padding so the fullscreen mind map `fixed` overlay aligns with the viewport edges.
 */
export default function LiveDefectsLayout({ children }: { children: React.ReactNode }) {
  return <div className="relative -mx-4 -my-6 min-h-0 md:-mx-8">{children}</div>;
}
