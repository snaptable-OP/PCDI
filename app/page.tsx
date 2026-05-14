import { HomeOverviewStats } from "@/components/pcdi/home-overview-stats";

export default function HomePage() {
  return (
    <div className="-mx-4 -my-6 min-h-svh bg-white px-4 py-6 md:-mx-8 md:px-8">
      <HomeOverviewStats embedCreateProjectDialog />
    </div>
  );
}
