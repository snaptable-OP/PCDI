import { ProjectIngestUploadPage } from "@/components/pcdi/project-ingest-upload-page";

type Props = { params: Promise<{ projectId: string }> };

export default async function HistoricalUploadPage({ params }: Props) {
  const { projectId } = await params;
  return (
    <ProjectIngestUploadPage basePath="/historical" module="historical" projectId={projectId} />
  );
}
