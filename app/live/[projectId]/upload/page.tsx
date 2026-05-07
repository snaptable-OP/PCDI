import { ProjectIngestUploadPage } from "@/components/pcdi/project-ingest-upload-page";

type Props = { params: Promise<{ projectId: string }> };

export default async function LiveUploadPage({ params }: Props) {
  const { projectId } = await params;
  return <ProjectIngestUploadPage basePath="/live" module="live" projectId={projectId} />;
}
