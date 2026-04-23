import { ProjectSetupSinglePage } from "@/components/pcdi/project-setup-single-page";

type Props = { params: Promise<{ projectId: string }> };

export default async function LiveProjectSetupPage({ params }: Props) {
  const { projectId } = await params;
  return <ProjectSetupSinglePage basePath="/live" module="live" initialProjectId={projectId} />;
}
