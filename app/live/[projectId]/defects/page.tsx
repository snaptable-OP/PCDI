import { LiveDataVisualisationDraft } from "@/components/pcdi/live-data-visualisation-draft";

type Props = {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

/** Live analysis: category mind graph + defect/strategy sidebar — optional `defectFile` scopes one Billie defect file / analysis. */
export default async function LiveAnalysisPage({ params, searchParams }: Props) {
  const { projectId } = await params;
  const sp = await searchParams;
  const raw = sp.defectFile;
  const defectFileFromQuery =
    typeof raw === "string" ? raw : Array.isArray(raw) ? raw[0] : null;

  return (
    <div className="min-h-0 min-w-0">
      <LiveDataVisualisationDraft
        projectId={projectId}
        basePath="/live"
        defectFileFromQuery={defectFileFromQuery?.trim() || null}
      />
    </div>
  );
}
