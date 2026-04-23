import { ProjectMetadataStep } from "@/components/pcdi/project-metadata-step";

type Props = { params: Promise<{ projectId: string }> };

export default async function HistoricalProjectMetadataPage({ params }: Props) {
  const { projectId } = await params;
  return <ProjectMetadataStep projectId={projectId} basePath="/historical" />;
}
