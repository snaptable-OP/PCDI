import { ProjectSetupSinglePage } from "@/components/pcdi/project-setup-single-page";

type Props = { params: Promise<{ projectId: string }> };

export default async function HistoricalProjectSetupPage({ params }: Props) {
  const { projectId } = await params;
  return <ProjectSetupSinglePage basePath="/historical" module="historical" initialProjectId={projectId} />;
}
