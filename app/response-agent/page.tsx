import type { Metadata } from "next";
import { ResponseAgentsView } from "@/components/pcdi/response-agents-view";

export const metadata: Metadata = {
  title: "Response strategy agents — PCDI",
  description: "Configure response agents with prompts and knowledge folders.",
};

export default function ResponseAgentPage() {
  return <ResponseAgentsView />;
}
