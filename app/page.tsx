import { AnalysisProjectsView } from "@/components/pcdi/analysis-projects-view";

export default function HomePage() {
  return (
    <AnalysisProjectsView
      module="live"
      basePath="/live"
      title="Live project analysis"
      description=""
    />
  );
}
