import { AnalysisProjectsView } from "@/components/pcdi/analysis-projects-view";

export default function LiveProjectsPage() {
  return (
    <AnalysisProjectsView
      module="live"
      basePath="/live"
      title="Live project analysis"
      description=""
    />
  );
}
