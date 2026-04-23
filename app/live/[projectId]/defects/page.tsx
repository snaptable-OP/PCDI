import Link from "next/link";
import { DefectsRegisterView } from "@/components/pcdi/defects-register-view";

type Props = { params: Promise<{ projectId: string }> };

export default async function LiveDefectsPage({ params }: Props) {
  const { projectId } = await params;
  return (
    <div className="mx-auto w-full min-w-0 max-w-5xl">
      <div className="mb-2 text-sm text-[var(--muted-foreground)]">
        <Link href="/live" className="text-teal-700 hover:underline dark:text-teal-300">
          ← Live projects
        </Link>
      </div>
      <DefectsRegisterView projectId={projectId} module="live" basePath="/live" />
    </div>
  );
}
