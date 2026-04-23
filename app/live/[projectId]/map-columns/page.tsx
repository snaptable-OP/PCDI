import { HistoricalMapColumnsView } from "@/components/pcdi/historical-map-columns-view";

type Props = { params: Promise<{ projectId: string }> };

export default async function LiveMapColumnsPage({ params }: Props) {
  const { projectId } = await params;
  return <HistoricalMapColumnsView projectId={projectId} basePath="/live" mode="live" />;
}
