import { LiveDataVisualisationDraft } from "@/components/pcdi/live-data-visualisation-draft";

type Props = { params: Promise<{ projectId: string }> };

/** Live analysis: category mind graph + defect/strategy sidebar (replaces the legacy register-only page). */
export default async function LiveAnalysisPage({ params }: Props) {
  const { projectId } = await params;
  return (
    <div className="min-h-0 min-w-0">
      <LiveDataVisualisationDraft projectId={projectId} basePath="/live" />
    </div>
  );
}
