import { HistoricalUploadPanel } from "@/components/pcdi/historical-upload-panel";

type Props = { params: Promise<{ projectId: string }> };

export default async function LiveUploadPage({ params }: Props) {
  const { projectId } = await params;
  return (
    <div className="mx-auto w-full min-w-0 max-w-5xl">
      <HistoricalUploadPanel projectId={projectId} basePath="/live" />
    </div>
  );
}
