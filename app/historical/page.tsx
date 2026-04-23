import { AnalysisProjectsView } from "@/components/pcdi/analysis-projects-view";

export default function HistoricalProjectsPage() {
  return (
    <AnalysisProjectsView
      module="historical"
      basePath="/historical"
      title="Historical defect analysis"
      description="Projects with defect registers, response data, Discover Categories, and knowledge map alignment. Use this path when you have historical contractor responses and references."
    />
  );
}
