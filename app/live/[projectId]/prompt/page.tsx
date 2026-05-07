import Link from "next/link";
import { DefectAnalysisPromptView } from "@/components/pcdi/defect-analysis-prompt-view";

type Props = { params: Promise<{ projectId: string }> };

export default async function LivePromptPage({ params }: Props) {
  const { projectId } = await params;
  return (
    <div className="mx-auto w-full min-w-0 max-w-5xl">
      <div className="mb-2 text-sm text-[var(--muted-foreground)]">
        <Link href={`/live/${projectId}/defects`} className="text-link hover:underline">
          ← Defect register
        </Link>
      </div>
      <h1 className="text-2xl font-semibold text-[var(--foreground)]">Master prompt</h1>
      <p className="mt-2 text-sm text-[var(--muted-foreground)]">
        Built from live defect rows (response fields empty for AI to suggest). Copy into your AI tool.
      </p>
      <div className="mt-8">
        <DefectAnalysisPromptView projectId={projectId} basePath="/live" />
      </div>
    </div>
  );
}
