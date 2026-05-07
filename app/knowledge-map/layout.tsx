/**
 * Full-width white canvas in the main column (same bleed as /live), plus mind-map canvas tokens.
 */
export default function KnowledgeMapLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="km-page-canvas -mx-4 -my-6 min-h-svh bg-white px-4 py-6 md:-mx-8 md:px-8 [--map-canvas:#ffffff] [--xy-background-color:#ffffff]">
      {children}
    </div>
  );
}
