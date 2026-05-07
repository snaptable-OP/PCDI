/**
 * White content canvas — matches Live Analysis background (vs default main-column tint).
 */
export default function ResponseAgentLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="-mx-4 -my-6 min-h-svh bg-white px-4 py-6 md:-mx-8 md:px-8">{children}</div>
  );
}
