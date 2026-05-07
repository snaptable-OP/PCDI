import Link from "next/link";
import { DefectsRegisterView } from "@/components/pcdi/defects-register-view";

type Props = { params: Promise<{ projectId: string }> };

export default async function HistoricalDefectsPage({ params }: Props) {
  const { projectId } = await params;
  return (
    <div className="mx-auto w-full min-w-0 max-w-5xl">
      <div className="mb-2 text-sm text-[var(--muted-foreground)]">
        <Link href="/historical" className="text-link hover:underline">
          ← Historical projects
        </Link>
      </div>
      <DefectsRegisterView projectId={projectId} module="historical" basePath="/historical" />
    </div>
  );
}
