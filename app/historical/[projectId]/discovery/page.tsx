import Link from "next/link";
import { DiscoveryTable } from "@/components/pcdi/discovery-table";

type Props = { params: Promise<{ projectId: string }> };

export default async function HistoricalDiscoveryPage({ params }: Props) {
  const { projectId } = await params;
  return (
    <div className="mx-auto w-full min-w-0 max-w-3xl">
      <div className="mb-2 text-sm text-[var(--muted-foreground)]">
        <Link href="/historical" className="text-teal-700 hover:underline dark:text-teal-300">
          ← Historical projects
        </Link>
      </div>
      <h1 className="text-2xl font-semibold text-[var(--foreground)]">Discover Categories</h1>
      <p className="mt-2 text-sm text-[var(--muted-foreground)]">
        See how register categories align with the knowledge map, choose new categories to publish, then add
        optional references. For the full defect register table, go to{" "}
        <Link
          href={`/historical/${projectId}/defects`}
          className="font-medium text-teal-700 underline-offset-2 hover:underline dark:text-teal-300"
        >
          Defect register
        </Link>
        .
      </p>
      <div className="mt-8">
        <DiscoveryTable projectId={projectId} />
      </div>
    </div>
  );
}
